package com.example.expensetracker.controller;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.web.bind.annotation.*;
import com.example.expensetracker.model.User;
import com.example.expensetracker.repository.UserRepository;
import com.example.expensetracker.service.JwtService;
import com.example.expensetracker.service.LoginRateLimiter;
import com.example.expensetracker.service.UserService;
import com.example.expensetracker.service.VerificationService;

import java.time.Clock;
import java.time.Duration;
import java.util.Map;

@RestController
@RequestMapping("/api/auth")
@CrossOrigin(origins = "${app.url:http://localhost:5173}")
public class AuthController {

    private final UserService userService;
    private final UserRepository userRepository;
    private final JwtService jwtService;
    private final AuthenticationManager authManager;
    private final VerificationService verificationService;

    // 5 failed logins per username and address in 15 minutes, then a lock-out until the oldest failure ages out
    private final LoginRateLimiter loginLimiter = new LoginRateLimiter(5, Duration.ofMinutes(15), Clock.systemUTC());

    public AuthController(
            UserService userService,
            UserRepository userRepository,
            JwtService jwtService,
            AuthenticationManager authManager,
            VerificationService verificationService
    ) {
        this.userService = userService;
        this.userRepository = userRepository;
        this.jwtService = jwtService;
        this.authManager = authManager;
        this.verificationService = verificationService;
    }

    // Register user
    @PostMapping("/register")
    public ResponseEntity<?> register(@RequestBody User user) {
        if (userRepository.existsByEmail(user.getEmail())) {
            return ResponseEntity.badRequest().body(Map.of("message", "Email already in use"));
        }
        if (userRepository.existsByUsername(user.getUsername())) {
            return ResponseEntity.badRequest().body(Map.of("message", "Username already exists"));
        }

        // never trust these from the request body
        user.setId(null);
        user.setEmailVerified(false);
        user.setEmailReminders(true);

        User newUser = userService.register(user);
        String token = jwtService.generateToken(newUser.getUsername());

        // best effort: a mail problem must not block sign-up
        try {
            verificationService.send(newUser);
        } catch (Exception ignored) { /* logged inside the service */ }

        return ResponseEntity.ok(Map.of(
                "message", "Registration successful. Check your email to verify your address.",
                "token", token,
                "username", newUser.getUsername(),
                "emailVerified", false
        ));
    }

    // Login user
    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody Map<String, String> payload, HttpServletRequest request) {
        String username = payload.get("username");
        String password = payload.get("password");
        String key = username + "|" + request.getRemoteAddr();

        // counts this attempt and refuses it if the key is locked: checked before the password, so a correct
        // password does not end a lock-out early, and parallel requests cannot all slip past the limit
        if (!loginLimiter.tryAttempt(key)) {
            long wait = loginLimiter.retryAfterSeconds(key);
            long minutes = Math.max(1, (wait + 59) / 60);
            return ResponseEntity.status(429)
                    .header("Retry-After", String.valueOf(wait))
                    .body(Map.of("message", "Too many failed attempts. Try again in " + minutes + " minute" + (minutes == 1 ? "" : "s") + "."));
        }

        try {
            authManager.authenticate(new UsernamePasswordAuthenticationToken(username, password));
        } catch (Exception e) {
            return ResponseEntity.status(401).body(Map.of("message", "Invalid username or password"));
        }
        loginLimiter.recordSuccess(key); // right password: start counting from zero again

        String token = jwtService.generateToken(username);
        return ResponseEntity.ok(Map.of(
                "message", "Login successful",
                "token", token,
                "username", username
        ));
    }

    // Confirm email address from the link in the verification email
    @PostMapping("/verify-email")
    public ResponseEntity<?> verifyEmail(@RequestBody Map<String, String> payload) {
        boolean ok = verificationService.verify(payload.get("token"));
        if (!ok) {
            return ResponseEntity.badRequest().body(Map.of("message", "This verification link is invalid or has expired."));
        }
        return ResponseEntity.ok(Map.of("message", "Email verified"));
    }
}
