package com.example.expensetracker.service;

import com.example.expensetracker.model.Expense;
import com.example.expensetracker.model.RecurringPayment;
import com.example.expensetracker.repository.RecurringPaymentRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

/**
 * Every minute, logs the occurrences of automatic recurring payments that have come due (in each payment's own time
 * zone), including ones missed while the server was down, at most {@value #MAX_CATCH_UP} per payment per run.
 */
@Component
public class AutoLogScheduler {

    static final int MAX_CATCH_UP = 12;

    private static final Logger log = LoggerFactory.getLogger(AutoLogScheduler.class);

    private final RecurringPaymentRepository repository;
    private final RecurringPaymentService service;
    private final NotificationService notifications;
    private final BudgetAlertService budgetAlerts;

    public AutoLogScheduler(
            RecurringPaymentRepository repository,
            RecurringPaymentService service,
            NotificationService notifications,
            BudgetAlertService budgetAlerts
    ) {
        this.repository = repository;
        this.service = service;
        this.notifications = notifications;
        this.budgetAlerts = budgetAlerts;
    }

    @Scheduled(initialDelay = 30_000, fixedDelay = 60_000)
    public void logDuePayments() {
        Instant now = Instant.now();
        for (RecurringPayment r : repository.findActiveAutoLogWithUser()) {
            try {
                List<LocalDate> due = AutoLogPlanner.dueDates(r.getNextDueDate(), r.getDueTime(), notifications.zoneOf(r),
                        r.getIntervalValue(), r.getIntervalUnit(), r.getAnchorDay(), now, MAX_CATCH_UP);

                List<LocalDate> logged = new ArrayList<>();
                for (LocalDate date : due) {
                    Optional<Expense> expense = service.autoLogOne(r, date);
                    if (expense.isEmpty()) break; // lost the claim (or it was paused): leave the rest alone
                    logged.add(date);
                    budgetAlerts.expenseAdded(r.getUser(), r.getCategory(), date, r.getAmount());
                }
                if (!logged.isEmpty()) notifications.notifyAutoLogged(r, logged);
            } catch (Exception e) {
                log.warn("Auto-log for recurring payment {} failed: {}", r.getId(), e.getMessage());
            }
        }
    }
}
