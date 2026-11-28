package com.example.expensetracker.service;

import com.example.expensetracker.model.RecurringPayment;
import com.example.expensetracker.repository.RecurringPaymentRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.time.LocalDateTime;
import java.util.List;

/** Sends email + web push at the exact due time of each active recurring payment (once per occurrence). */
@Component
public class ReminderScheduler {

    private static final Logger log = LoggerFactory.getLogger(ReminderScheduler.class);

    private final RecurringPaymentRepository repository;
    private final NotificationService notifications;

    public ReminderScheduler(RecurringPaymentRepository repository, NotificationService notifications) {
        this.repository = repository;
        this.notifications = notifications;
    }

    @Scheduled(initialDelay = 20_000, fixedDelay = 60_000)
    public void sendDueReminders() {
        List<RecurringPayment> active = repository.findActiveWithUser();
        Instant now = Instant.now();

        for (RecurringPayment r : active) {
            try {
                if (r.getNextDueDate() == null) continue;
                if (r.isAutoLog()) continue; // automatic payments get a "logged" message instead of a due reminder

                LocalDateTime due = notifications.dueLocal(r);
                if (due.atZone(notifications.zoneOf(r)).toInstant().isAfter(now)) continue; // not yet
                if (r.getNotifiedFor() != null && !r.getNotifiedFor().isBefore(due)) continue; // already sent

                // mark first so a slow/failed send can never cause duplicate reminders
                repository.markNotified(r.getId(), due);
                notifications.notifyDue(r);
            } catch (Exception e) {
                log.warn("Reminder for recurring payment {} failed: {}", r.getId(), e.getMessage());
            }
        }
    }
}
