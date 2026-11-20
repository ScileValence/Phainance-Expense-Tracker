package com.example.expensetracker.controller;

import com.example.expensetracker.model.Budget;
import com.example.expensetracker.model.Expense;
import com.example.expensetracker.model.Income;
import com.example.expensetracker.model.RecurringPayment;
import com.example.expensetracker.model.User;
import com.example.expensetracker.repository.BudgetRepository;
import com.example.expensetracker.repository.ExpenseRepository;
import com.example.expensetracker.repository.IncomeRepository;
import com.example.expensetracker.repository.RecurringPaymentRepository;
import com.example.expensetracker.repository.UserRepository;
import com.example.expensetracker.service.JwtService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Settings > Data. Export everything the signed-in user owns, or wipe it.
 * (Import reuses the normal create endpoints from the frontend.)
 */
@RestController
@RequestMapping("/api/data")
@CrossOrigin(origins = "http://localhost:5173")
public class DataController {

    private final ExpenseRepository expenseRepository;
    private final IncomeRepository incomeRepository;
    private final BudgetRepository budgetRepository;
    private final RecurringPaymentRepository recurringRepository;
    private final JwtService jwtService;
    private final UserRepository userRepository;

    public DataController(
            ExpenseRepository expenseRepository,
            IncomeRepository incomeRepository,
            BudgetRepository budgetRepository,
            RecurringPaymentRepository recurringRepository,
            JwtService jwtService,
            UserRepository userRepository
    ) {
        this.expenseRepository = expenseRepository;
        this.incomeRepository = incomeRepository;
        this.budgetRepository = budgetRepository;
        this.recurringRepository = recurringRepository;
        this.jwtService = jwtService;
        this.userRepository = userRepository;
    }

    private User getUserFromRequest(HttpServletRequest request) {
        final String authHeader = request.getHeader("Authorization");
        if (authHeader == null || !authHeader.startsWith("Bearer ")) return null;
        String username = jwtService.extractUsername(authHeader.substring(7));
        return userRepository.findByUsername(username).orElse(null);
    }

    private static String text(Object o) {
        return o == null ? null : o.toString();
    }

    @GetMapping("/export")
    @Transactional(readOnly = true)
    public ResponseEntity<?> export(HttpServletRequest request) {
        User user = getUserFromRequest(request);
        if (user == null) return ResponseEntity.status(401).body(Map.of("message", "Sign in required"));

        List<Map<String, Object>> expenses = new ArrayList<>();
        for (Expense e : expenseRepository.findByUser(user)) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("amount", e.getAmount());
            m.put("description", e.getDescription());
            m.put("date", text(e.getDate()));
            m.put("category", e.getCategory() == null ? null : e.getCategory().getName());
            expenses.add(m);
        }

        List<Map<String, Object>> income = new ArrayList<>();
        for (Income i : incomeRepository.findByUser(user)) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("amount", i.getAmount());
            m.put("source", text(i.getSource()));
            m.put("description", i.getDescription());
            m.put("date", text(i.getDate()));
            income.add(m);
        }

        List<Map<String, Object>> budgets = new ArrayList<>();
        for (Budget b : budgetRepository.findByUser(user)) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("month", b.getMonth());
            m.put("limitAmount", b.getLimitAmount());
            budgets.add(m);
        }

        List<Map<String, Object>> recurring = new ArrayList<>();
        for (RecurringPayment r : recurringRepository.findByUserOrderByNextDueDateAscDueTimeAsc(user)) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("title", r.getTitle());
            m.put("amount", r.getAmount());
            m.put("category", r.getCategory() == null ? null : r.getCategory().getName());
            m.put("intervalValue", r.getIntervalValue());
            m.put("intervalUnit", text(r.getIntervalUnit()));
            m.put("nextDueDate", text(r.getNextDueDate()));
            m.put("dueTime", text(r.getDueTime()));
            m.put("active", r.isActive());
            recurring.add(m);
        }

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("expenses", expenses);
        out.put("income", income);
        out.put("budgets", budgets);
        out.put("recurring", recurring);
        return ResponseEntity.ok(out);
    }

    /** Deletes every expense, income, budget and recurring payment of the signed-in user. */
    @DeleteMapping
    @Transactional
    public ResponseEntity<?> clearAll(HttpServletRequest request) {
        User user = getUserFromRequest(request);
        if (user == null) return ResponseEntity.status(401).body(Map.of("message", "Sign in required"));

        expenseRepository.deleteAll(expenseRepository.findByUser(user));
        incomeRepository.deleteAll(incomeRepository.findByUser(user));
        budgetRepository.deleteAll(budgetRepository.findByUser(user));
        recurringRepository.deleteAll(recurringRepository.findByUserOrderByNextDueDateAscDueTimeAsc(user));

        return ResponseEntity.ok(Map.of("message", "All data cleared"));
    }
}
