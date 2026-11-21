package com.example.expensetracker.controller;

import com.example.expensetracker.model.Category;
import com.example.expensetracker.model.User;
import com.example.expensetracker.repository.CategoryRepository;
import com.example.expensetracker.repository.ExpenseRepository;
import com.example.expensetracker.repository.RecurringPaymentRepository;
import com.example.expensetracker.repository.UserRepository;
import com.example.expensetracker.service.JwtService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/categories")
@CrossOrigin(origins = "${app.url:http://localhost:5173}")
public class CategoryController {

    private static final int MAX_NAME = 40;

    private final CategoryRepository categoryRepository;
    private final ExpenseRepository expenseRepository;
    private final RecurringPaymentRepository recurringRepository;
    private final JwtService jwtService;
    private final UserRepository userRepository;

    public CategoryController(
            CategoryRepository categoryRepository,
            ExpenseRepository expenseRepository,
            RecurringPaymentRepository recurringRepository,
            JwtService jwtService,
            UserRepository userRepository
    ) {
        this.categoryRepository = categoryRepository;
        this.expenseRepository = expenseRepository;
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

    private ResponseEntity<?> error(int status, String message) {
        return ResponseEntity.status(status).body(Map.of("message", message));
    }

    private static String clean(String raw) {
        return raw == null ? "" : raw.trim().replaceAll("\\s+", " ");
    }

    /** Built-in categories plus the user's own. */
    @GetMapping
    public ResponseEntity<?> all(HttpServletRequest request) {
        User user = getUserFromRequest(request);
        if (user == null) return ResponseEntity.status(401).build();
        return ResponseEntity.ok(categoryRepository.findVisibleTo(user));
    }

    @PostMapping
    public ResponseEntity<?> create(@RequestBody Map<String, String> body, HttpServletRequest request) {
        User user = getUserFromRequest(request);
        if (user == null) return ResponseEntity.status(401).build();

        String name = clean(body.get("name"));
        if (name.isEmpty()) return error(400, "Enter a category name");
        if (name.length() > MAX_NAME) return error(400, "Name must be " + MAX_NAME + " characters or fewer");
        if (taken(name, user)) return error(409, "A category with that name already exists");

        return ResponseEntity.ok(categoryRepository.save(new Category(name, user)));
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> rename(@PathVariable Long id, @RequestBody Map<String, String> body, HttpServletRequest request) {
        User user = getUserFromRequest(request);
        if (user == null) return ResponseEntity.status(401).build();

        Optional<Category> oc = categoryRepository.findVisibleById(id, user);
        if (oc.isEmpty()) return error(404, "Category not found");
        Category c = oc.get();
        if (c.isBuiltIn()) return error(403, "Default categories can't be changed");

        String name = clean(body.get("name"));
        if (name.isEmpty()) return error(400, "Enter a category name");
        if (name.length() > MAX_NAME) return error(400, "Name must be " + MAX_NAME + " characters or fewer");
        if (!name.equalsIgnoreCase(c.getName()) && taken(name, user)) return error(409, "A category with that name already exists");

        c.setName(name);
        return ResponseEntity.ok(categoryRepository.save(c));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(@PathVariable Long id, HttpServletRequest request) {
        User user = getUserFromRequest(request);
        if (user == null) return ResponseEntity.status(401).build();

        Optional<Category> oc = categoryRepository.findVisibleById(id, user);
        if (oc.isEmpty()) return error(404, "Category not found");
        Category c = oc.get();
        if (c.isBuiltIn()) return error(403, "Default categories can't be deleted");

        long expenses = expenseRepository.countByCategory(c);
        long recurring = recurringRepository.countByCategory(c);
        if (expenses > 0 || recurring > 0) {
            return error(409, "In use by " + expenses + " expense(s) and " + recurring
                    + " recurring payment(s). Move them to another category first.");
        }

        categoryRepository.delete(c);
        return ResponseEntity.noContent().build();
    }

    private boolean taken(String name, User user) {
        return categoryRepository.existsByNameIgnoreCaseAndUserIsNull(name)
                || categoryRepository.existsByNameIgnoreCaseAndUser(name, user);
    }
}
