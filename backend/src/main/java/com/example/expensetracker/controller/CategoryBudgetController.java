package com.example.expensetracker.controller;

import com.example.expensetracker.model.Category;
import com.example.expensetracker.model.CategoryBudget;
import com.example.expensetracker.model.Expense;
import com.example.expensetracker.model.User;
import com.example.expensetracker.repository.CategoryBudgetRepository;
import com.example.expensetracker.repository.CategoryRepository;
import com.example.expensetracker.repository.ExpenseRepository;
import com.example.expensetracker.repository.UserRepository;
import com.example.expensetracker.service.JwtService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.YearMonth;
import java.util.*;

/** Standing monthly limits per category. */
@RestController
@RequestMapping("/api/budget/categories")
@CrossOrigin(origins = "${app.url:http://localhost:5173}")
public class CategoryBudgetController {

    private static final double MAX_LIMIT = 1_000_000_000d;

    private final CategoryBudgetRepository categoryBudgets;
    private final CategoryRepository categoryRepository;
    private final ExpenseRepository expenseRepository;
    private final JwtService jwtService;
    private final UserRepository userRepository;

    public CategoryBudgetController(
            CategoryBudgetRepository categoryBudgets,
            CategoryRepository categoryRepository,
            ExpenseRepository expenseRepository,
            JwtService jwtService,
            UserRepository userRepository
    ) {
        this.categoryBudgets = categoryBudgets;
        this.categoryRepository = categoryRepository;
        this.expenseRepository = expenseRepository;
        this.jwtService = jwtService;
        this.userRepository = userRepository;
    }

    private User getUserFromRequest(HttpServletRequest request) {
        final String authHeader = request.getHeader("Authorization");
        if (authHeader == null || !authHeader.startsWith("Bearer ")) return null;
        String username = jwtService.extractUsername(authHeader.substring(7));
        return userRepository.findByUsername(username).orElse(null);
    }

    /** Every category that has a limit, with what was spent in it during the month. */
    @GetMapping
    public ResponseEntity<?> list(@RequestParam(required = false) String month, HttpServletRequest request) {
        User user = getUserFromRequest(request);
        if (user == null) return ResponseEntity.status(401).build();

        YearMonth ym;
        try {
            ym = (month != null && !month.isBlank()) ? YearMonth.parse(month) : YearMonth.now();
        } catch (Exception e) {
            ym = YearMonth.now();
        }

        Map<Long, Double> spent = new HashMap<>();
        for (Expense e : expenseRepository.findByUserAndDateBetween(user, ym.atDay(1), ym.atEndOfMonth())) {
            if (e.getCategory() == null || e.getAmount() == null) continue;
            spent.merge(e.getCategory().getId(), e.getAmount(), Double::sum);
        }

        List<Map<String, Object>> out = new ArrayList<>();
        for (CategoryBudget cb : categoryBudgets.findByUser(user)) {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("categoryId", cb.getCategory().getId());
            row.put("name", cb.getCategory().getName());
            row.put("limit", cb.getLimitAmount());
            row.put("spent", spent.getOrDefault(cb.getCategory().getId(), 0.0));
            out.add(row);
        }
        return ResponseEntity.ok(out);
    }

    /** Set (or with 0 / empty, remove) the limit for one category. */
    @PutMapping("/{categoryId}")
    public ResponseEntity<?> set(@PathVariable Long categoryId, @RequestBody Map<String, Object> body, HttpServletRequest request) {
        User user = getUserFromRequest(request);
        if (user == null) return ResponseEntity.status(401).build();

        Optional<Category> oc = categoryRepository.findVisibleById(categoryId, user);
        if (oc.isEmpty()) return ResponseEntity.status(404).body(Map.of("message", "Category not found"));
        Category category = oc.get();

        double limit = 0;
        Object raw = body.get("limitAmount");
        if (raw instanceof Number n) limit = n.doubleValue();
        else if (raw != null) {
            try { limit = Double.parseDouble(raw.toString()); } catch (NumberFormatException ex) {
                return ResponseEntity.badRequest().body(Map.of("message", "Enter a valid amount"));
            }
        }
        if (Double.isNaN(limit) || limit < 0 || limit > MAX_LIMIT) {
            return ResponseEntity.badRequest().body(Map.of("message", "Enter a valid amount"));
        }

        Optional<CategoryBudget> existing = categoryBudgets.findByUserAndCategory(user, category);
        if (limit == 0) {
            existing.ifPresent(categoryBudgets::delete);
            return ResponseEntity.ok(Map.of("categoryId", categoryId, "limit", 0));
        }

        CategoryBudget cb = existing.orElseGet(CategoryBudget::new);
        cb.setUser(user);
        cb.setCategory(category);
        cb.setLimitAmount(limit);
        categoryBudgets.save(cb);
        return ResponseEntity.ok(Map.of("categoryId", categoryId, "limit", limit));
    }
}
