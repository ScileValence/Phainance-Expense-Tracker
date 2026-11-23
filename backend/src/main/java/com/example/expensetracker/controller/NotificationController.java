package com.example.expensetracker.controller;

import com.example.expensetracker.model.PushSubscription;
import com.example.expensetracker.model.User;
import com.example.expensetracker.repository.PushSubscriptionRepository;
import com.example.expensetracker.repository.UserRepository;
import com.example.expensetracker.service.JwtService;
import com.example.expensetracker.service.EmailTemplates;
import com.example.expensetracker.service.NotificationService;
import com.example.expensetracker.service.SummaryPlanner;
import com.example.expensetracker.service.SummaryService;
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
    private final SummaryService summaryService;
    private final java.util.Map<Long, java.time.Instant> lastSample = new java.util.concurrent.ConcurrentHashMap<>();
    private final VerificationService verification;
    private final PushSubscriptionRepository subscriptions;
    private final JwtService jwtService;
    private final UserRepository userRepository;

    public NotificationController(
            NotificationService notifications,
            SummaryService summaryService,
            VerificationService verification,
            PushSubscriptionRepository subscriptions,
            JwtService jwtService,
            UserRepository userRepository
    ) {
        this.notifications = notifications;
        this.summaryService = summaryService;
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
        m.put("emailBudgetAlerts", user.getEmailBudgetAlerts() == null || user.getEmailBudgetAlerts());
        m.put("emailPaymentUpdates", user.getEmailPaymentUpdates() == null || user.getEmailPaymentUpdates());
        m.put("summaryFrequency", SummaryPlanner.Frequency.parse(user.getSummaryFrequency()).name());
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

        if (dto.getSummaryFrequency() != null) {
            String wanted = dto.getSummaryFrequency().trim();
            boolean valid = wanted.equalsIgnoreCase("OFF") || wanted.equalsIgnoreCase("WEEKLY") || wanted.equalsIgnoreCase("MONTHLY");
            if (!valid) return ResponseEntity.badRequest().body(Map.of("message", "Choose off, weekly or monthly"));

            SummaryPlanner.Frequency now = SummaryPlanner.Frequency.parse(wanted);
            if (now != SummaryPlanner.Frequency.parse(user.getSummaryFrequency())) {
                user.setSummaryFrequency(now.name());
                // switching it on never sends an old period: the first summary comes after the next period ends
                user.setSummaryLastPeriod(now == SummaryPlanner.Frequency.OFF ? null
                        : SummaryPlanner.lastCompleted(now, java.time.LocalDate.now()).end());
            }
        }
        if (dto.getEmailReminders() != null) user.setEmailReminders(dto.getEmailReminders());
        if (dto.getEmailBudgetAlerts() != null) user.setEmailBudgetAlerts(dto.getEmailBudgetAlerts());
        if (dto.getEmailPaymentUpdates() != null) user.setEmailPaymentUpdates(dto.getEmailPaymentUpdates());
        userRepository.save(user);
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

    /** Sends the latest completed period's summary right now, so the email can be previewed. At most once a minute. */
    @PostMapping("/summary/test")
    public ResponseEntity<?> sendSampleSummary(HttpServletRequest request) {
        User user = getUserFromRequest(request);
        if (user == null) return ResponseEntity.status(401).build();
        if (!user.isEmailVerified()) return ResponseEntity.badRequest().body(Map.of("message", "Verify your email first"));
        if (!notifications.isEmailConfigured()) return ResponseEntity.ok(Map.of("sent", false, "reason", "Email is not set up on the server"));

        java.time.Instant now = java.time.Instant.now();
        java.time.Instant last = lastSample.get(user.getId());
        if (last != null && java.time.Duration.between(last, now).getSeconds() < 60) {
            return ResponseEntity.status(429).body(Map.of("message", "Wait a minute before sending another sample"));
        }
        lastSample.put(user.getId(), now);

        SummaryPlanner.Frequency f = SummaryPlanner.Frequency.parse(user.getSummaryFrequency());
        if (f == SummaryPlanner.Frequency.OFF) f = SummaryPlanner.Frequency.WEEKLY;
        SummaryPlanner.Period period = SummaryPlanner.lastCompleted(f, java.time.LocalDate.now());
        boolean queued = summaryService.send(user, f, period, false);
        return ResponseEntity.ok(Map.of("sent", queued, "kind", f.name()));
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
        private Boolean emailBudgetAlerts;
        private Boolean emailPaymentUpdates;
        private String summaryFrequency;
        public Boolean getEmailReminders() { return emailReminders; }
        public void setEmailReminders(Boolean emailReminders) { this.emailReminders = emailReminders; }
        public Boolean getEmailBudgetAlerts() { return emailBudgetAlerts; }
        public void setEmailBudgetAlerts(Boolean emailBudgetAlerts) { this.emailBudgetAlerts = emailBudgetAlerts; }
        public Boolean getEmailPaymentUpdates() { return emailPaymentUpdates; }
        public void setEmailPaymentUpdates(Boolean emailPaymentUpdates) { this.emailPaymentUpdates = emailPaymentUpdates; }
        public String getSummaryFrequency() { return summaryFrequency; }
        public void setSummaryFrequency(String summaryFrequency) { this.summaryFrequency = summaryFrequency; }
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
