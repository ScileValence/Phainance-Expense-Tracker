package com.example.expensetracker.controller;

import com.example.expensetracker.model.PushSubscription;
import com.example.expensetracker.model.User;
import com.example.expensetracker.repository.PushSubscriptionRepository;
import com.example.expensetracker.repository.UserRepository;
import com.example.expensetracker.service.JwtService;
import com.example.expensetracker.service.EmailTemplates;
import com.example.expensetracker.service.NotificationService;
import com.example.expensetracker.service.VerificationService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/notifications")
@CrossOrigin(origins = "${app.url:http://localhost:5173}")
public class NotificationController {

    private final NotificationService notifications;
    private final VerificationService verification;
    private final PushSubscriptionRepository subscriptions;
    private final JwtService jwtService;
    private final UserRepository userRepository;

    public NotificationController(
            NotificationService notifications,
            VerificationService verification,
            PushSubscriptionRepository subscriptions,
            JwtService jwtService,
            UserRepository userRepository
    ) {
        this.notifications = notifications;
        this.verification = verification;
        this.subscriptions = subscriptions;
        this.jwtService = jwtService;
        this.userRepository = userRepository;
    }

    private User getUserFromRequest(HttpServletRequest request) {
        final String authHeader = request.getHeader("Authorization");
        if (authHeader == null || !authHeader.startsWith("Bearer ")) return null;
        String username = jwtService.extractUsername(authHeader.substring(7));
        return userRepository.findByUsername(username).orElse(null);
    }

    private Map<String, Object> settingsOf(User user) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("email", user.getEmail());
        m.put("emailReminders", user.isEmailRemindersEnabled());
        m.put("emailVerified", user.isEmailVerified());
        m.put("emailConfigured", notifications.isEmailConfigured());
        m.put("pushConfigured", notifications.isPushConfigured());
        m.put("vapidPublicKey", notifications.getVapidPublicKey());
        return m;
    }

    @GetMapping("/settings")
    public ResponseEntity<?> getSettings(HttpServletRequest request) {
        User user = getUserFromRequest(request);
        if (user == null) return ResponseEntity.status(401).build();
        return ResponseEntity.ok(settingsOf(user));
    }

    @PutMapping("/settings")
    public ResponseEntity<?> updateSettings(@RequestBody SettingsDTO dto, HttpServletRequest request) {
        User user = getUserFromRequest(request);
        if (user == null) return ResponseEntity.status(401).build();

        if (dto.getEmailReminders() != null) {
            user.setEmailReminders(dto.getEmailReminders());
            userRepository.save(user);
        }
        return ResponseEntity.ok(settingsOf(user));
    }

    @PostMapping("/push/subscribe")
    public ResponseEntity<?> subscribe(@RequestBody SubscribeDTO dto, HttpServletRequest request) {
        User user = getUserFromRequest(request);
        if (user == null) return ResponseEntity.status(401).build();
        if (dto.getEndpoint() == null || dto.getKeys() == null
                || dto.getKeys().getP256dh() == null || dto.getKeys().getAuth() == null) {
            return ResponseEntity.badRequest().body(Map.of("message", "Invalid subscription"));
        }

        // upsert by endpoint: same browser re-subscribing (or another user logging in on it)
        PushSubscription s = subscriptions.findFirstByEndpoint(dto.getEndpoint()).orElseGet(PushSubscription::new);
        s.setEndpoint(dto.getEndpoint());
        s.setP256dh(dto.getKeys().getP256dh());
        s.setAuth(dto.getKeys().getAuth());
        s.setUser(user);
        subscriptions.save(s);
        return ResponseEntity.ok(Map.of("subscribed", true));
    }

    @PostMapping("/push/unsubscribe")
    public ResponseEntity<?> unsubscribe(@RequestBody SubscribeDTO dto, HttpServletRequest request) {
        User user = getUserFromRequest(request);
        if (user == null) return ResponseEntity.status(401).build();

        Optional<PushSubscription> os = subscriptions.findFirstByEndpoint(String.valueOf(dto.getEndpoint()));
        if (os.isPresent() && os.get().getUser() != null && os.get().getUser().getId().equals(user.getId())) {
            subscriptions.delete(os.get());
        }
        return ResponseEntity.ok(Map.of("subscribed", false));
    }

    @PostMapping("/resend-verification")
    public ResponseEntity<?> resendVerification(HttpServletRequest request) {
        User user = getUserFromRequest(request);
        if (user == null) return ResponseEntity.status(401).build();

        VerificationService.SendResult r = verification.send(user);
        return ResponseEntity.ok(Map.of("result", r.name()));
    }

    @PostMapping("/test")
    public ResponseEntity<?> test(HttpServletRequest request) {
        User user = getUserFromRequest(request);
        if (user == null) return ResponseEntity.status(401).build();

        boolean emailSent = user.isEmailVerified()
                && notifications.sendEmail(user, EmailTemplates.test(notifications.getAppUrl(), user.getUsername()));
        int pushSent = notifications.sendPush(
                user, "Phainance test reminder", "Push reminders are working.", "/recurring");

        Map<String, Object> m = new LinkedHashMap<>();
        m.put("emailSent", emailSent);
        m.put("emailSkippedUnverified", !user.isEmailVerified());
        m.put("pushSent", pushSent);
        return ResponseEntity.ok(m);
    }

    public static class SettingsDTO {
        private Boolean emailReminders;
        public Boolean getEmailReminders() { return emailReminders; }
        public void setEmailReminders(Boolean emailReminders) { this.emailReminders = emailReminders; }
    }

    public static class SubscribeDTO {
        private String endpoint;
        private Keys keys;

        public String getEndpoint() { return endpoint; }
        public void setEndpoint(String endpoint) { this.endpoint = endpoint; }

        public Keys getKeys() { return keys; }
        public void setKeys(Keys keys) { this.keys = keys; }

        public static class Keys {
            private String p256dh;
            private String auth;

            public String getP256dh() { return p256dh; }
            public void setP256dh(String p256dh) { this.p256dh = p256dh; }

            public String getAuth() { return auth; }
            public void setAuth(String auth) { this.auth = auth; }
        }
    }
}
