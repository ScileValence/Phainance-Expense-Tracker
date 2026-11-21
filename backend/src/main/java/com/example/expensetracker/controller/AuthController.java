package com.example.expensetracker.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.web.bind.annotation.*;
import com.example.expensetracker.model.User;
import com.example.expensetracker.repository.UserRepository;
import com.example.expensetracker.service.JwtService;
import com.example.expensetracker.service.UserService;
import com.example.expensetracker.service.VerificationService;

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
    public ResponseEntity<?> login(@RequestBody Map<String, String> payload) {
        String username = payload.get("username");
        String password = payload.get("password");

        try {
            authManager.authenticate(new UsernamePasswordAuthenticationToken(username, password));
        } catch (Exception e) {
            return ResponseEntity.status(401).body(Map.of("message", "Invalid username or password"));
        }

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
