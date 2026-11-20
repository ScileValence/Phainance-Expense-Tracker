package com.example.expensetracker.controller;

import com.example.expensetracker.model.Income;
import com.example.expensetracker.model.Income.Source;
import com.example.expensetracker.model.User;
import com.example.expensetracker.repository.IncomeRepository;
import com.example.expensetracker.repository.UserRepository;
import com.example.expensetracker.service.JwtService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.YearMonth;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/income")
@CrossOrigin(origins = "http://localhost:5173")
public class IncomeController {

    private final IncomeRepository incomeRepository;
    private final JwtService jwtService;
    private final UserRepository userRepository;

    public IncomeController(
            IncomeRepository incomeRepository,
            JwtService jwtService,
            UserRepository userRepository
    ) {
        this.incomeRepository = incomeRepository;
        this.jwtService = jwtService;
        this.userRepository = userRepository;
    }

    private User getUserFromRequest(HttpServletRequest request) {
        final String authHeader = request.getHeader("Authorization");
        if (authHeader == null || !authHeader.startsWith("Bearer ")) return null;
        String username = jwtService.extractUsername(authHeader.substring(7));
        return userRepository.findByUsername(username).orElse(null);
    }

    private Optional<Income> findOwned(Long id, User user) {
        return incomeRepository.findById(id)
                .filter(i -> i.getUser() != null && i.getUser().getId().equals(user.getId()));
    }

    private ResponseEntity<?> bad(String message) {
        return ResponseEntity.badRequest().body(Map.of("message", message));
    }

    /** Validates the DTO and copies it onto the entity. Returns an error message or null. */
    private String apply(IncomeDTO dto, Income i) {
        if (dto.getAmount() == null || dto.getAmount() <= 0) return "Amount must be greater than 0";
        Source source;
        try {
            source = Source.valueOf(String.valueOf(dto.getSource()).toUpperCase());
        } catch (Exception ex) {
            return "Source must be SALARY, FREELANCE, GIFT or OTHER";
        }
        i.setAmount(dto.getAmount());
        i.setSource(source);
        i.setDescription(dto.getDescription() == null ? "" : dto.getDescription().trim());
        i.setDate(dto.getDate() == null ? LocalDate.now() : dto.getDate());
        return null;
    }

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
        List<Income> list = incomeRepository.findByUserAndDateBetweenOrderByDateDescIdDesc(
                user, ym.atDay(1), ym.atEndOfMonth());
        return ResponseEntity.ok(list);
    }

    @PostMapping
    public ResponseEntity<?> create(@RequestBody IncomeDTO dto, HttpServletRequest request) {
        User user = getUserFromRequest(request);
        if (user == null) return ResponseEntity.status(401).build();

        Income i = new Income();
        String err = apply(dto, i);
        if (err != null) return bad(err);
        i.setUser(user);
        return ResponseEntity.ok(incomeRepository.save(i));
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> update(@PathVariable Long id, @RequestBody IncomeDTO dto, HttpServletRequest request) {
        User user = getUserFromRequest(request);
        if (user == null) return ResponseEntity.status(401).build();

        Optional<Income> oi = findOwned(id, user);
        if (oi.isEmpty()) return ResponseEntity.notFound().build();

        Income i = oi.get();
        String err = apply(dto, i);
        if (err != null) return bad(err);
        return ResponseEntity.ok(incomeRepository.save(i));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(@PathVariable Long id, HttpServletRequest request) {
        User user = getUserFromRequest(request);
        if (user == null) return ResponseEntity.status(401).build();

        Optional<Income> oi = findOwned(id, user);
        if (oi.isEmpty()) return ResponseEntity.notFound().build();
        incomeRepository.delete(oi.get());
        return ResponseEntity.noContent().build();
    }

    public static class IncomeDTO {
        private Double amount;
        private String source;
        private String description;
        private LocalDate date;

        public Double getAmount() { return amount; }
        public void setAmount(Double amount) { this.amount = amount; }

        public String getSource() { return source; }
        public void setSource(String source) { this.source = source; }

        public String getDescription() { return description; }
        public void setDescription(String description) { this.description = description; }

        public LocalDate getDate() { return date; }
        public void setDate(LocalDate date) { this.date = date; }
    }
}
