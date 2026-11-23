package com.example.expensetracker.service;

import com.example.expensetracker.model.Budget;
import com.example.expensetracker.model.Expense;
import com.example.expensetracker.model.RecurringPayment;
import com.example.expensetracker.model.User;
import com.example.expensetracker.repository.ExpenseRepository;
import com.example.expensetracker.repository.RecurringPaymentRepository;
import com.example.expensetracker.service.SummaryBuilder.Line;
import com.example.expensetracker.service.SummaryBuilder.Summary;
import com.example.expensetracker.service.SummaryPlanner.Frequency;
import com.example.expensetracker.service.SummaryPlanner.Period;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.YearMonth;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/** Collects one person's numbers for a period and e-mails them as the weekly or monthly summary. */
@Service
public class SummaryService {

    private static final DateTimeFormatter DAY = DateTimeFormatter.ofPattern("MMM d", Locale.ENGLISH);
    private static final DateTimeFormatter DAY_YEAR = DateTimeFormatter.ofPattern("MMM d, yyyy", Locale.ENGLISH);
    private static final DateTimeFormatter MONTH = DateTimeFormatter.ofPattern("MMMM yyyy", Locale.ENGLISH);

    private final ExpenseRepository expenseRepository;
    private final RecurringPaymentRepository recurringRepository;
    private final BudgetService budgetService;
    private final NotificationService notifications;

    public SummaryService(
            ExpenseRepository expenseRepository,
            RecurringPaymentRepository recurringRepository,
            BudgetService budgetService,
            NotificationService notifications
    ) {
        this.expenseRepository = expenseRepository;
        this.recurringRepository = recurringRepository;
        this.budgetService = budgetService;
        this.notifications = notifications;
    }

    /** Builds the email for {@code period} and queues it. {@code scheduled} false means a sample the person asked for. */
    public boolean send(User user, Frequency frequency, Period period, boolean scheduled) {
        return notifications.sendSummaryEmail(user, build(user, frequency, period), scheduled);
    }

    EmailTemplates.Email build(User user, Frequency frequency, Period period) {
        Summary s = SummaryBuilder.build(lines(user, period), lines(user, SummaryPlanner.before(frequency, period)), 3);
        boolean weekly = frequency == Frequency.WEEKLY;
        String unit = weekly ? "week" : "month";

        String change = null;
        boolean up = false;
        if (s.changePercent() != null) {
            int c = s.changePercent();
            up = c > 0;
            change = c == 0 ? "Same as the " + unit + " before"
                    : Math.abs(c) + "% " + (c > 0 ? "more" : "less") + " than the " + unit + " before";
        }

        String biggest = s.biggest() == null ? null
                : s.biggest().description() + " " + NotificationService.formatInr(s.biggest().amount());

        String budget = null;
        if (!weekly) {
            Budget b = budgetService.findByUserAndMonth(user, YearMonth.from(period.start()).toString()).orElse(null);
            if (b != null && b.getLimitAmount() != null && b.getLimitAmount() > 0) {
                budget = BudgetAlertPolicy.percent(s.total(), b.getLimitAmount()) + "% of your "
                        + NotificationService.formatInr(b.getLimitAmount()) + " budget";
            }
        }

        List<String[]> top = new ArrayList<>();
        for (SummaryBuilder.CategoryShare c : s.top()) {
            top.add(new String[]{c.name(), NotificationService.formatInr(c.amount()), String.valueOf(c.percent())});
        }

        EmailTemplates.SummaryData data = new EmailTemplates.SummaryData(
                weekly ? "Weekly" : "Monthly", label(frequency, period),
                NotificationService.formatInr(s.total()), change, up, s.count(), top, biggest, budget, upcoming(user));
        return EmailTemplates.summary(notifications.getAppUrl(), user.getUsername(), data);
    }

    private List<Line> lines(User user, Period period) {
        List<Line> out = new ArrayList<>();
        for (Expense e : expenseRepository.findByUserAndDateBetween(user, period.start(), period.end())) {
            out.add(new Line(e.getCategory() == null ? null : e.getCategory().getName(), e.getDescription(), e.getDate(),
                    e.getAmount() == null ? 0 : e.getAmount()));
        }
        return out;
    }

    /** Active recurring payments due in the next 7 days (at most 5). */
    private List<String[]> upcoming(User user) {
        LocalDate today = LocalDate.now();
        LocalDate limit = today.plusDays(7);
        List<String[]> out = new ArrayList<>();
        for (RecurringPayment r : recurringRepository.findByUserOrderByNextDueDateAscDueTimeAsc(user)) {
            if (!r.isActive() || r.getNextDueDate() == null) continue;
            if (r.getNextDueDate().isBefore(today) || r.getNextDueDate().isAfter(limit)) continue;
            out.add(new String[]{r.getTitle(), NotificationService.formatInr(r.getAmount()), r.getNextDueDate().format(DAY)});
            if (out.size() == 5) break;
        }
        return out;
    }

    private static String label(Frequency frequency, Period p) {
        if (frequency == Frequency.MONTHLY) return p.start().format(MONTH);
        if (p.start().getYear() != p.end().getYear()) return p.start().format(DAY_YEAR) + " to " + p.end().format(DAY_YEAR);
        return p.start().format(DAY) + " to " + p.end().format(DAY);
    }
}
