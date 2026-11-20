package com.example.expensetracker.service;

import com.example.expensetracker.model.PushSubscription;
import com.example.expensetracker.model.RecurringPayment;
import com.example.expensetracker.model.User;
import com.example.expensetracker.repository.PushSubscriptionRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import jakarta.mail.internet.MimeMessage;
import nl.martijndwars.webpush.Notification;
import nl.martijndwars.webpush.PushService;
import org.bouncycastle.jce.provider.BouncyCastleProvider;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.Security;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZoneId;
import java.text.NumberFormat;
import java.time.format.DateTimeFormatter;
import java.util.Locale;
import java.util.List;
import java.util.Map;

@Service
public class NotificationService {

    private static final Logger log = LoggerFactory.getLogger(NotificationService.class);
    private static final DateTimeFormatter WHEN = DateTimeFormatter.ofPattern("dd MMM yyyy, hh:mm a");
    private static final DateTimeFormatter DAY = DateTimeFormatter.ofPattern("EEE, dd MMM yyyy");

    private final ObjectProvider<JavaMailSender> mailSenderProvider;
    private final PushSubscriptionRepository subscriptions;
    private final ObjectMapper mapper = new ObjectMapper();

    @Value("${spring.mail.username:}")
    private String mailUser;
    @Value("${spring.mail.password:}")
    private String mailPass;
    @Value("${push.vapid.public:}")
    private String vapidPublic;
    @Value("${push.vapid.private:}")
    private String vapidPrivate;
    @Value("${push.vapid.subject:mailto:admin@example.com}")
    private String vapidSubject;
    @Value("${app.url:http://localhost:5173}")
    private String appUrl;

    private PushService pushService;

    public NotificationService(
            ObjectProvider<JavaMailSender> mailSenderProvider,
            PushSubscriptionRepository subscriptions
    ) {
        this.mailSenderProvider = mailSenderProvider;
        this.subscriptions = subscriptions;
    }

    @PostConstruct
    void init() {
        if (vapidPublic.isBlank() || vapidPrivate.isBlank()) {
            log.info("Web push disabled: VAPID keys not set");
        } else {
            try {
                if (Security.getProvider(BouncyCastleProvider.PROVIDER_NAME) == null) {
                    Security.addProvider(new BouncyCastleProvider());
                }
                pushService = new PushService(vapidPublic.trim(), vapidPrivate.trim(), vapidSubject.trim());
                log.info("Web push enabled");
            } catch (Exception e) {
                log.warn("Web push disabled: invalid VAPID keys ({})", e.getMessage());
            }
        }
        if (!isEmailConfigured()) {
            log.info("Email reminders disabled: MAIL_USERNAME / MAIL_PASSWORD not set");
        }
    }

    public boolean isEmailConfigured() {
        return !mailUser.isBlank() && !mailPass.isBlank() && mailSenderProvider.getIfAvailable() != null;
    }

    public boolean isPushConfigured() {
        return pushService != null;
    }

    public String getVapidPublicKey() {
        return isPushConfigured() ? vapidPublic.trim() : "";
    }

    // ---------- reminders ----------

    public void notifyDue(RecurringPayment r) {
        User user = r.getUser();
        if (user == null) return;

        String amount = formatInr(r.getAmount());
        String when = dueLocal(r).format(WHEN) + " (" + zoneOf(r) + ")";
        String category = r.getCategory() == null ? null : r.getCategory().getName();

        if (user.isEmailRemindersEnabled() && user.isEmailVerified()) {
            sendEmail(user, EmailTemplates.paymentDue(
                    appUrl, user.getUsername(), r.getTitle(), amount, category, when,
                    scheduleText(r), r.getNextDueDate() == null ? "" : r.nextOccurrence().format(DAY)));
        }
        sendPush(user, r.getTitle() + " is due", amount + " · " + when, "/recurring");
    }

    private static String formatInr(Double value) {
        NumberFormat nf = NumberFormat.getNumberInstance(new Locale("en", "IN"));
        nf.setMinimumFractionDigits(2);
        nf.setMaximumFractionDigits(2);
        return "₹" + nf.format(value == null ? 0.0 : value);
    }

    private static String scheduleText(RecurringPayment r) {
        int n = r.getIntervalValue() == null ? 1 : r.getIntervalValue();
        String unit = r.getIntervalUnit() == null ? "months" : r.getIntervalUnit().name().toLowerCase();
        if (n == 1) return "Repeats every " + unit.substring(0, unit.length() - 1);
        return "Repeats every " + n + " " + unit;
    }

    public LocalDateTime dueLocal(RecurringPayment r) {
        LocalTime t = r.getDueTime() == null ? LocalTime.of(9, 0) : r.getDueTime();
        return LocalDateTime.of(r.getNextDueDate(), t);
    }

    public ZoneId zoneOf(RecurringPayment r) {
        try {
            if (r.getTimeZone() != null && !r.getTimeZone().isBlank()) return ZoneId.of(r.getTimeZone());
        } catch (Exception ignored) { /* fall through */ }
        return ZoneId.systemDefault();
    }

    // ---------- channels ----------

    /** @return true if the message was handed to the SMTP server */
    public boolean sendEmail(User user, EmailTemplates.Email mail) {
        JavaMailSender sender = mailSenderProvider.getIfAvailable();
        if (!isEmailConfigured() || sender == null || user.getEmail() == null) return false;
        try {
            MimeMessage msg = sender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(msg, true, "UTF-8");
            helper.setFrom(mailUser, "Phainance");
            helper.setTo(user.getEmail());
            helper.setSubject(mail.subject());
            helper.setText(mail.text(), mail.html()); // plain-text fallback + branded HTML
            sender.send(msg);
            return true;
        } catch (Exception e) {
            log.warn("Email to {} failed: {}", user.getEmail(), e.getMessage());
            return false;
        }
    }

    public String getAppUrl() {
        return appUrl;
    }

    /** @return number of devices the push was accepted for */
    public int sendPush(User user, String title, String body, String url) {
        if (pushService == null) return 0;

        String payload;
        try {
            payload = mapper.writeValueAsString(Map.of("title", title, "body", body, "url", url));
        } catch (Exception e) {
            return 0;
        }

        int ok = 0;
        List<PushSubscription> subs = subscriptions.findByUser(user);
        for (PushSubscription s : subs) {
            try {
                Notification n = new Notification(
                        s.getEndpoint(), s.getP256dh(), s.getAuth(),
                        payload.getBytes(StandardCharsets.UTF_8));
                var resp = pushService.send(n);
                int code = resp.getStatusLine().getStatusCode();
                if (code == 404 || code == 410) {
                    subscriptions.delete(s); // browser unsubscribed / expired
                } else if (code >= 200 && code < 300) {
                    ok++;
                } else {
                    log.warn("Push to subscription {} returned HTTP {}", s.getId(), code);
                }
            } catch (Exception e) {
                log.warn("Push to subscription {} failed: {}", s.getId(), e.getMessage());
            }
        }
        return ok;
    }
}
