package com.example.expensetracker.controller;

import com.example.expensetracker.model.RecurringPayment;
import com.example.expensetracker.model.RecurringPayment.IntervalUnit;
import com.example.expensetracker.model.User;
import com.example.expensetracker.repository.CategoryRepository;
import com.example.expensetracker.repository.RecurringPaymentRepository;
import com.example.expensetracker.repository.UserRepository;
import com.example.expensetracker.service.JwtService;
import com.example.expensetracker.service.NotificationService;
import com.example.expensetracker.service.RecurringPaymentService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Objects;
import java.time.LocalTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/recurring")
@CrossOrigin(origins = "http://localhost:5173")
public class RecurringPaymentController {

    private final RecurringPaymentRepository recurringRepository;
    private final RecurringPaymentService recurringService;
    private final CategoryRepository categoryRepository;
    private final JwtService jwtService;
    private final UserRepository userRepository;
    private final NotificationService notifications;

    public RecurringPaymentController(
            RecurringPaymentRepository recurringRepository,
            RecurringPaymentService recurringService,
            CategoryRepository categoryRepository,
            JwtService jwtService,
            UserRepository userRepository,
            NotificationService notifications
    ) {
        this.recurringRepository = recurringRepository;
        this.recurringService = recurringService;
        this.categoryRepository = categoryRepository;
        this.jwtService = jwtService;
        this.userRepository = userRepository;
        this.notifications = notifications;
    }

    private User getUserFromRequest(HttpServletRequest request) {
        final String authHeader = request.getHeader("Authorization");
        if (authHeader == null || !authHeader.startsWith("Bearer ")) return null;
        String username = jwtService.extractUsername(authHeader.substring(7));
        return userRepository.findByUsername(username).orElse(null);
    }

    private Optional<RecurringPayment> findOwned(Long id, User user) {
        return recurringRepository.findById(id)
                .filter(r -> r.getUser() != null && r.getUser().getId().equals(user.getId()));
    }

    private ResponseEntity<?> bad(String message) {
        return ResponseEntity.badRequest().body(Map.of("message", message));
    }

    /** Validates the DTO and copies it onto the entity. Returns an error message or null. */
    private String apply(RecurringPaymentDTO dto, RecurringPayment r) {
        if (dto.getTitle() == null || dto.getTitle().isBlank()) return "Title is required";
        if (dto.getAmount() == null || dto.getAmount() <= 0) return "Amount must be greater than 0";
        if (dto.getIntervalValue() == null || dto.getIntervalValue() < 1 || dto.getIntervalValue() > 1000)
            return "Interval must be between 1 and 1000";
        if (dto.getNextDueDate() == null) return "Due date is required";

        IntervalUnit unit;
        try {
            unit = IntervalUnit.valueOf(String.valueOf(dto.getIntervalUnit()).toUpperCase());
        } catch (Exception ex) {
            return "Interval unit must be DAYS, WEEKS or MONTHS";
        }

        LocalDate oldDate = r.getNextDueDate();
        LocalTime oldTime = r.getDueTime();

        r.setTitle(dto.getTitle().trim());
        r.setAmount(dto.getAmount());
        r.setIntervalValue(dto.getIntervalValue());
        r.setIntervalUnit(unit);
        r.setNextDueDate(dto.getNextDueDate());
        r.setAnchorDay(dto.getNextDueDate().getDayOfMonth());
        r.setDueTime(dto.getDueTime() == null ? LocalTime.of(9, 0) : dto.getDueTime());

        String tz = dto.getTimeZone();
        if (tz != null && !tz.isBlank()) {
            try {
                ZoneId.of(tz);
                r.setTimeZone(tz);
            } catch (Exception ignored) { /* keep previous zone */ }
        }

        // due moment changed -> allow a fresh reminder
        if (!Objects.equals(oldDate, r.getNextDueDate()) || !Objects.equals(oldTime, r.getDueTime())) {
            r.setNotifiedFor(null);
        }

        if (dto.getCategoryId() != null) {
            categoryRepository.findById(dto.getCategoryId()).ifPresent(r::setCategory);
        } else {
            r.setCategory(null);
        }
        return null;
    }

    @GetMapping
    public ResponseEntity<?> list(HttpServletRequest request) {
        User user = getUserFromRequest(request);
        if (user == null) return ResponseEntity.status(401).build();
        List<RecurringPayment> all = recurringRepository.findByUserOrderByNextDueDateAscDueTimeAsc(user);
        return ResponseEntity.ok(all);
    }

    @PostMapping
    public ResponseEntity<?> create(@RequestBody RecurringPaymentDTO dto, HttpServletRequest request) {
        User user = getUserFromRequest(request);
        if (user == null) return ResponseEntity.status(401).build();

        RecurringPayment r = new RecurringPayment();
        String err = apply(dto, r);
        if (err != null) return bad(err);
        r.setUser(user);
        r.setActive(true);
        return ResponseEntity.ok(recurringRepository.save(r));
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> update(
            @PathVariable Long id,
            @RequestBody RecurringPaymentDTO dto,
            HttpServletRequest request
    ) {
        User user = getUserFromRequest(request);
        if (user == null) return ResponseEntity.status(401).build();

        Optional<RecurringPayment> or = findOwned(id, user);
        if (or.isEmpty()) return ResponseEntity.notFound().build();

        RecurringPayment r = or.get();
        Map<String, String> before = notifications.snapshot(r);
        String err = apply(dto, r);
        if (err != null) return bad(err);
        RecurringPayment saved = recurringRepository.save(r);
        notifications.notifyEdited(user, saved, before); // edited -> email (only if something changed)
        return ResponseEntity.ok(saved);
    }

    @PostMapping("/{id}/confirm")
    public ResponseEntity<?> confirm(@PathVariable Long id, HttpServletRequest request) {
        User user = getUserFromRequest(request);
        if (user == null) return ResponseEntity.status(401).build();

        Optional<RecurringPayment> or = findOwned(id, user);
        if (or.isEmpty()) return ResponseEntity.notFound().build();
        RecurringPayment r = or.get();
        LocalDate paid = r.getNextDueDate();
        RecurringPayment saved = recurringService.confirm(r);
        notifications.notifyPaid(user, saved, paid); // paid -> email
        return ResponseEntity.ok(saved);
    }

    @PostMapping("/{id}/skip")
    public ResponseEntity<?> skip(@PathVariable Long id, HttpServletRequest request) {
        User user = getUserFromRequest(request);
        if (user == null) return ResponseEntity.status(401).build();

        Optional<RecurringPayment> or = findOwned(id, user);
        if (or.isEmpty()) return ResponseEntity.notFound().build();
        RecurringPayment r = or.get();
        LocalDate skipped = r.getNextDueDate();
        RecurringPayment saved = recurringService.skip(r);
        notifications.notifySkipped(user, saved, skipped); // skipped -> email
        return ResponseEntity.ok(saved);
    }

    @PostMapping("/{id}/toggle")
    public ResponseEntity<?> toggle(@PathVariable Long id, HttpServletRequest request) {
        User user = getUserFromRequest(request);
        if (user == null) return ResponseEntity.status(401).build();

        Optional<RecurringPayment> or = findOwned(id, user);
        if (or.isEmpty()) return ResponseEntity.notFound().build();

        RecurringPayment r = or.get();
        boolean wasActive = r.isActive();
        r.setActive(!wasActive);
        RecurringPayment saved = recurringRepository.save(r);
        if (wasActive && !saved.isActive()) notifications.notifyPaused(user, saved); // paused -> email
        else if (!wasActive && saved.isActive()) notifications.notifyResumed(user, saved); // resumed -> email
        return ResponseEntity.ok(saved);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(@PathVariable Long id, HttpServletRequest request) {
        User user = getUserFromRequest(request);
        if (user == null) return ResponseEntity.status(401).build();

        Optional<RecurringPayment> or = findOwned(id, user);
        if (or.isEmpty()) return ResponseEntity.notFound().build();
        RecurringPayment r = or.get();
        recurringRepository.delete(r);
        notifications.notifyStopped(user, r); // stopped -> email
        return ResponseEntity.noContent().build();
    }

    public static class RecurringPaymentDTO {
        private String title;
        private Double amount;
        private Long categoryId;
        private Integer intervalValue;
        private String intervalUnit;
        private LocalDate nextDueDate;
        private LocalTime dueTime;
        private String timeZone;

        public String getTimeZone() { return timeZone; }
        public void setTimeZone(String timeZone) { this.timeZone = timeZone; }

        public String getTitle() { return title; }
        public void setTitle(String title) { this.title = title; }

        public Double getAmount() { return amount; }
        public void setAmount(Double amount) { this.amount = amount; }

        public Long getCategoryId() { return categoryId; }
        public void setCategoryId(Long categoryId) { this.categoryId = categoryId; }

        public Integer getIntervalValue() { return intervalValue; }
        public void setIntervalValue(Integer intervalValue) { this.intervalValue = intervalValue; }

        public String getIntervalUnit() { return intervalUnit; }
        public void setIntervalUnit(String intervalUnit) { this.intervalUnit = intervalUnit; }

        public LocalDate getNextDueDate() { return nextDueDate; }
        public void setNextDueDate(LocalDate nextDueDate) { this.nextDueDate = nextDueDate; }

        public LocalTime getDueTime() { return dueTime; }
        public void setDueTime(LocalTime dueTime) { this.dueTime = dueTime; }
    }
}
