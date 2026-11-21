package com.example.expensetracker.controller;

import com.example.expensetracker.model.Expense;
import com.example.expensetracker.model.User;
import com.example.expensetracker.repository.BudgetRepository;
import com.example.expensetracker.repository.ExpenseRepository;
import com.example.expensetracker.repository.UserRepository;
import com.example.expensetracker.service.JwtService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.YearMonth;
import java.time.format.TextStyle;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/analytics")
@CrossOrigin(origins = "${app.url:http://localhost:5173}")
public class AnalyticsController {

    private final ExpenseRepository expenseRepository;
    private final BudgetRepository budgetRepository;
    private final UserRepository userRepository;
    private final JwtService jwtService;

    public AnalyticsController(
            ExpenseRepository expenseRepository,
            BudgetRepository budgetRepository,
            UserRepository userRepository,
            JwtService jwtService
    ) {
        this.expenseRepository = expenseRepository;
        this.budgetRepository = budgetRepository;
        this.userRepository = userRepository;
        this.jwtService = jwtService;
    }

    private User getUserFromRequest(HttpServletRequest request) {
        try {
            final String authHeader = request.getHeader("Authorization");
            if (authHeader == null || !authHeader.startsWith("Bearer ")) return null;
            String token = authHeader.substring(7);
            String username = jwtService.extractUsername(token);
            return userRepository.findByUsername(username).orElse(null);
        } catch (Exception e) {
            e.printStackTrace();
            return null;
        }
    }

    private LocalDate[] getMonthRange(String monthParam) {
        try {
            YearMonth ym = (monthParam != null && !monthParam.isBlank())
                    ? YearMonth.parse(monthParam)
                    : YearMonth.now();
            return new LocalDate[]{ym.atDay(1), ym.atEndOfMonth()};
        } catch (Exception e) {
            YearMonth ym = YearMonth.now();
            return new LocalDate[]{ym.atDay(1), ym.atEndOfMonth()};
        }
    }

    // 1⃣ Spending by Category
    @GetMapping("/category")
    public List<Map<String, Object>> spendingByCategory(
            @RequestParam(required = false) String month,
            HttpServletRequest request
    ) {
        User user = getUserFromRequest(request);
        if (user == null) return Collections.emptyList();

        LocalDate[] range = getMonthRange(month);
        List<Expense> expenses = expenseRepository.findByUserAndDateBetween(user, range[0], range[1]);

        return expenses.stream()
                .collect(Collectors.groupingBy(
                        e -> e.getCategory() != null ? e.getCategory().getName() : "Uncategorized",
                        Collectors.summingDouble(e -> e.getAmount() == null ? 0.0 : e.getAmount())
                ))
                .entrySet()
                .stream()
                .map(entry -> {
                    Map<String, Object> map = new HashMap<>();
                    map.put("name", entry.getKey());
                    map.put("value", entry.getValue());
                    return map;
                })
                .collect(Collectors.toList());
    }

    // 2⃣ Monthly Spending (total for selected month)
    @GetMapping("/monthly")
    public List<Map<String, Object>> monthlySpending(
            @RequestParam(required = false) String month,
            HttpServletRequest request
    ) {
        User user = getUserFromRequest(request);
        if (user == null) return Collections.emptyList();

        LocalDate[] range = getMonthRange(month);
        List<Expense> expenses = expenseRepository.findByUserAndDateBetween(user, range[0], range[1]);
        YearMonth ym = (month != null && !month.isBlank()) ? YearMonth.parse(month) : YearMonth.now();

        double total = expenses.stream()
                .mapToDouble(e -> e.getAmount() == null ? 0.0 : e.getAmount())
                .sum();

        Map<String, Object> map = new HashMap<>();
        map.put("month", ym.getMonth().name().substring(0, 3));
        map.put("monthName", ym.getMonth().getDisplayName(TextStyle.FULL, Locale.ENGLISH));
        map.put("year", ym.getYear());
        map.put("amount", total);

        return Collections.singletonList(map);
    }

    // 3⃣ Budget vs Spent (for selected month)
    @GetMapping("/budget-trend")
    public List<Map<String, Object>> budgetVsSpent(
            @RequestParam(required = false) String month,
            HttpServletRequest request
    ) {
        User user = getUserFromRequest(request);
        if (user == null) return Collections.emptyList();

        YearMonth ym = (month != null && !month.isBlank()) ? YearMonth.parse(month) : YearMonth.now();
        LocalDate start = ym.atDay(1);
        LocalDate end = ym.atEndOfMonth();

        double spent = expenseRepository.findByUserAndDateBetween(user, start, end)
                .stream()
                .mapToDouble(e -> e.getAmount() == null ? 0.0 : e.getAmount())
                .sum();

        double budget = budgetRepository.findAllByUserAndMonth(user, ym.toString())
                .stream()
                .findFirst()
                .map(b -> b.getLimitAmount() != null ? b.getLimitAmount() : 0.0)
                .orElse(0.0);

        Map<String, Object> map = new HashMap<>();
        map.put("month", ym.getMonth().name().substring(0, 3));
        map.put("monthName", ym.getMonth().getDisplayName(TextStyle.FULL, Locale.ENGLISH));
        map.put("year", ym.getYear());
        map.put("budget", budget);
        map.put("spent", spent);

        return Collections.singletonList(map);
    }

    // 4⃣ Daily Spending Breakdown
    @GetMapping("/daily")
    public List<Map<String, Object>> dailySpending(
            @RequestParam(required = false) String month,
            HttpServletRequest request
    ) {
        User user = getUserFromRequest(request);
        if (user == null) return Collections.emptyList();

        LocalDate[] range = getMonthRange(month);
        List<Expense> expenses = expenseRepository.findByUserAndDateBetween(user, range[0], range[1]);

        return expenses.stream()
                .collect(Collectors.groupingBy(
                        e -> e.getDate().toString(),
                        Collectors.summingDouble(e -> e.getAmount() == null ? 0.0 : e.getAmount())
                ))
                .entrySet()
                .stream()
                .sorted(Map.Entry.comparingByKey())
                .map(entry -> {
                    Map<String, Object> map = new HashMap<>();
                    map.put("date", entry.getKey());
                    map.put("amount", entry.getValue());
                    return map;
                })
                .collect(Collectors.toList());
    }

    // 5⃣ Monthly trend: total spending for the last N months, ending at the selected month
    @GetMapping("/trend")
    public List<Map<String, Object>> monthlyTrend(
            @RequestParam(required = false) String month,
            @RequestParam(defaultValue = "6") int months,
            HttpServletRequest request
    ) {
        User user = getUserFromRequest(request);
        if (user == null) return Collections.emptyList();

        YearMonth end;
        try {
            end = (month != null && !month.isBlank()) ? YearMonth.parse(month) : YearMonth.now();
        } catch (Exception e) {
            end = YearMonth.now();
        }
        int n = Math.max(2, Math.min(months, 12));
        YearMonth start = end.minusMonths(n - 1L);

        Map<YearMonth, Double> totals = new LinkedHashMap<>();
        for (int i = 0; i < n; i++) totals.put(start.plusMonths(i), 0.0);

        for (Expense e : expenseRepository.findByUserAndDateBetween(user, start.atDay(1), end.atEndOfMonth())) {
            if (e.getDate() == null) continue;
            totals.merge(YearMonth.from(e.getDate()), e.getAmount() == null ? 0.0 : e.getAmount(), Double::sum);
        }

        List<Map<String, Object>> result = new ArrayList<>();
        totals.forEach((ym, total) -> {
            Map<String, Object> map = new HashMap<>();
            map.put("month", ym.toString());
            map.put("amount", total);
            result.add(map);
        });
        return result;
    }
}
