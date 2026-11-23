package com.example.expensetracker.service;

import com.example.expensetracker.model.Budget;
import com.example.expensetracker.model.Category;
import com.example.expensetracker.model.Expense;
import com.example.expensetracker.model.User;
import com.example.expensetracker.repository.CategoryBudgetRepository;
import com.example.expensetracker.repository.ExpenseRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.YearMonth;
import java.time.format.TextStyle;
import java.util.List;
import java.util.Locale;
import java.util.Objects;

/** Checks the overall and the category budget after spending is added, and sends an alert if a line was crossed. */
@Service
public class BudgetAlertService {

    private static final Logger log = LoggerFactory.getLogger(BudgetAlertService.class);

    private final ExpenseRepository expenseRepository;
    private final BudgetService budgetService;
    private final CategoryBudgetRepository categoryBudgets;
    private final NotificationService notifications;

    public BudgetAlertService(
            ExpenseRepository expenseRepository,
            BudgetService budgetService,
            CategoryBudgetRepository categoryBudgets,
            NotificationService notifications
    ) {
        this.expenseRepository = expenseRepository;
        this.budgetService = budgetService;
        this.categoryBudgets = categoryBudgets;
        this.notifications = notifications;
    }

    /**
     * Call after an expense has been saved. {@code added} is how much it raised the month's spending
     * (the amount for a new expense, the difference for an edit). It never throws: alerts must not break saving.
     */
    public void expenseAdded(User user, Category category, LocalDate date, Double added) {
        try {
            if (user == null || date == null || added == null || added <= 0) return;

            YearMonth ym = YearMonth.from(date);
            List<Expense> month = expenseRepository.findByUserAndDateBetween(user, ym.atDay(1), ym.atEndOfMonth());

            double total = 0;
            double inCategory = 0;
            for (Expense e : month) {
                double amount = e.getAmount() == null ? 0 : e.getAmount();
                total += amount;
                if (category != null && e.getCategory() != null && Objects.equals(e.getCategory().getId(), category.getId())) {
                    inCategory += amount;
                }
            }

            String label = ym.getMonth().getDisplayName(TextStyle.FULL, Locale.ENGLISH) + " " + ym.getYear();

            Budget overall = budgetService.findByUserAndMonth(user, ym.toString()).orElse(null);
            if (overall != null && overall.getLimitAmount() != null) {
                check(user, "Overall budget", label, total - added, total, overall.getLimitAmount());
            }

            if (category != null) {
                final double catAfter = inCategory;
                categoryBudgets.findByUserAndCategory(user, category).ifPresent(cb ->
                        check(user, category.getName() + " budget", label, catAfter - added, catAfter, cb.getLimitAmount()));
            }
        } catch (Exception e) {
            log.warn("Budget alert check failed: {}", e.getMessage());
        }
    }

    private void check(User user, String scope, String month, double before, double after, double limit) {
        BudgetAlertPolicy.Level level = BudgetAlertPolicy.crossed(before, after, limit);
        if (level != BudgetAlertPolicy.Level.NONE) {
            notifications.notifyBudget(user, scope, month, after, limit, level);
        }
    }
}
