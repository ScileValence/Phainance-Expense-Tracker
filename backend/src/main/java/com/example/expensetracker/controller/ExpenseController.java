package com.example.expensetracker.controller;

import com.example.expensetracker.model.Expense;
import com.example.expensetracker.model.User;
import com.example.expensetracker.repository.CategoryRepository;
import com.example.expensetracker.repository.ExpenseRepository;
import com.example.expensetracker.repository.UserRepository;
import com.example.expensetracker.service.ExpenseService;
import com.example.expensetracker.service.BudgetAlertService;
import com.example.expensetracker.service.ExpenseRange;
import com.example.expensetracker.service.JwtService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.YearMonth;
import java.util.List;
import java.util.Optional;

@RestController
@RequestMapping("/api/expenses")
@CrossOrigin(origins = "${app.url:http://localhost:5173}")
public class ExpenseController {

    private final ExpenseService expenseService;
    private final CategoryRepository categoryRepository;
    private final ExpenseRepository expenseRepository;
    private final JwtService jwtService;
    private final UserRepository userRepository;
    private final BudgetAlertService budgetAlerts;

    public ExpenseController(
            ExpenseService expenseService,
            CategoryRepository categoryRepository,
            ExpenseRepository expenseRepository,
            JwtService jwtService,
            UserRepository userRepository,
            BudgetAlertService budgetAlerts
    ) {
        this.expenseService = expenseService;
        this.categoryRepository = categoryRepository;
        this.expenseRepository = expenseRepository;
        this.jwtService = jwtService;
        this.userRepository = userRepository;
        this.budgetAlerts = budgetAlerts;
    }

    // Extract user from JWT in Authorization header
    private User getUserFromRequest(HttpServletRequest request) {
        final String authHeader = request.getHeader("Authorization");
        if (authHeader == null || !authHeader.startsWith("Bearer ")) return null;

        String token = authHeader.substring(7);
        String username = jwtService.extractUsername(token);
        return userRepository.findByUsername(username).orElse(null);
    }

    // Expenses for a month (default: this month), or for an explicit from/to range (YYYY-MM-DD)
    @GetMapping
    public List<Expense> getExpenses(
            @RequestParam(required = false) String month,
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to,
            HttpServletRequest request
    ) {
        User user = getUserFromRequest(request);
        if (user == null) return List.of();

        LocalDate[] range = ExpenseRange.resolve(month, from, to, LocalDate.now());
        return expenseService.allForMonth(user, range[0], range[1]);
    }

    // Create a new expense
    @PostMapping
    public Expense create(@RequestBody ExpenseDTO dto, HttpServletRequest request) {
        User user = getUserFromRequest(request);
        if (user == null) return null;

        Expense e = new Expense();
        e.setAmount(dto.getAmount());
        e.setDescription(dto.getDescription());
        e.setDate(dto.getDate() == null ? LocalDate.now() : dto.getDate());
        e.setUser(user);

        if (dto.getCategoryId() != null) {
            categoryRepository.findVisibleById(dto.getCategoryId(), user).ifPresent(e::setCategory);
        }

        Expense saved = expenseService.add(e);
        budgetAlerts.expenseAdded(user, saved.getCategory(), saved.getDate(), saved.getAmount()); // 80% / 100% alerts
        return saved;
    }

    // Update an existing expense
    @PutMapping("/{id}")
    public Expense update(
            @PathVariable Long id,
            @RequestBody ExpenseDTO dto,
            HttpServletRequest request
    ) {
        User user = getUserFromRequest(request);
        if (user == null) return null;

        Optional<Expense> oe = expenseRepository.findById(id);
        if (oe.isEmpty()) return null;

        Expense e = oe.get();
        if (!e.getUser().getId().equals(user.getId())) return null; // security check

        Double oldAmount = e.getAmount();
        Long oldCategoryId = e.getCategory() == null ? null : e.getCategory().getId();
        java.time.YearMonth oldMonth = e.getDate() == null ? null : java.time.YearMonth.from(e.getDate());

        e.setAmount(dto.getAmount());
        e.setDescription(dto.getDescription());
        e.setDate(dto.getDate() == null ? e.getDate() : dto.getDate());

        if (dto.getCategoryId() != null) {
            categoryRepository.findVisibleById(dto.getCategoryId(), user).ifPresent(e::setCategory);
        } else {
            e.setCategory(null);
        }

        Expense saved = expenseService.update(e);

        // only the part that raised this month's spending counts towards an alert
        Long newCategoryId = saved.getCategory() == null ? null : saved.getCategory().getId();
        java.time.YearMonth newMonth = saved.getDate() == null ? null : java.time.YearMonth.from(saved.getDate());
        boolean sameBucket = java.util.Objects.equals(oldCategoryId, newCategoryId) && java.util.Objects.equals(oldMonth, newMonth);
        double newAmount = saved.getAmount() == null ? 0 : saved.getAmount();
        double added = sameBucket ? newAmount - (oldAmount == null ? 0 : oldAmount) : newAmount;
        budgetAlerts.expenseAdded(user, saved.getCategory(), saved.getDate(), added);
        return saved;
    }

    // Delete an expense
    @DeleteMapping("/{id}")
    public void delete(@PathVariable Long id, HttpServletRequest request) {
        User user = getUserFromRequest(request);
        if (user == null) return;

        Optional<Expense> oe = expenseRepository.findById(id);
        if (oe.isPresent() && oe.get().getUser().getId().equals(user.getId())) {
            expenseService.delete(id);
        }
    }

    // DTO class for request body mapping
    public static class ExpenseDTO {
        private Double amount;
        private String description;
        private LocalDate date;
        private Long categoryId;

        public Double getAmount() { return amount; }
        public void setAmount(Double amount) { this.amount = amount; }

        public String getDescription() { return description; }
        public void setDescription(String description) { this.description = description; }

        public LocalDate getDate() { return date; }
        public void setDate(LocalDate date) { this.date = date; }

        public Long getCategoryId() { return categoryId; }
        public void setCategoryId(Long categoryId) { this.categoryId = categoryId; }
    }
}
