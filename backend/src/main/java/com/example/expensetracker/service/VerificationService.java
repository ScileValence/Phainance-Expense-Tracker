package com.example.expensetracker.service;

import com.example.expensetracker.model.User;
import com.example.expensetracker.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.Base64;
import java.util.HexFormat;
import java.util.Optional;

@Service
public class VerificationService {

    private static final Logger log = LoggerFactory.getLogger(VerificationService.class);
    private static final Duration TTL = Duration.ofHours(24);
    private static final Duration COOLDOWN = Duration.ofSeconds(60);

    public enum SendResult { SENT, COOLDOWN, ALREADY_VERIFIED, NOT_CONFIGURED, FAILED }

    private final UserRepository users;
    private final NotificationService notifications;
    private final SecureRandom random = new SecureRandom();

    @Value("${app.url:http://localhost:5173}")
    private String appUrl;

    public VerificationService(UserRepository users, NotificationService notifications) {
        this.users = users;
        this.notifications = notifications;
    }

    /** Creates a fresh token and emails the verification link. */
    public SendResult send(User user) {
        if (user.isEmailVerified()) return SendResult.ALREADY_VERIFIED;

        LocalDateTime now = LocalDateTime.now();
        if (user.getVerificationSentAt() != null && now.isBefore(user.getVerificationSentAt().plus(COOLDOWN))) {
            return SendResult.COOLDOWN;
        }

        byte[] raw = new byte[32];
        random.nextBytes(raw);
        String token = Base64.getUrlEncoder().withoutPadding().encodeToString(raw);

        user.setVerificationTokenHash(hash(token));
        user.setVerificationExpiresAt(now.plus(TTL));
        user.setVerificationSentAt(now);
        users.save(user);

        String link = appUrl + "/verify-email?token=" + token;

        if (!notifications.isEmailConfigured()) {
            // dev convenience: no SMTP set up, so print the link
            log.info("Email not configured. Verification link for {}: {}", user.getEmail(), link);
            return SendResult.NOT_CONFIGURED;
        }
        boolean ok = notifications.sendEmail(user, EmailTemplates.verifyEmail(user.getUsername(), link));
        return ok ? SendResult.SENT : SendResult.FAILED;
    }

    /** @return true if the token was valid and the user is now verified */
    public boolean verify(String token) {
        if (token == null || token.isBlank()) return false;

        Optional<User> ou = users.findByVerificationTokenHash(hash(token.trim()));
        if (ou.isEmpty()) return false;

        User user = ou.get();
        if (user.getVerificationExpiresAt() == null || LocalDateTime.now().isAfter(user.getVerificationExpiresAt())) {
            return false;
        }
        user.setEmailVerified(true);
        user.setVerificationTokenHash(null);
        user.setVerificationExpiresAt(null);
        users.save(user);
        return true;
    }

    private static String hash(String token) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(md.digest(token.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }
}
