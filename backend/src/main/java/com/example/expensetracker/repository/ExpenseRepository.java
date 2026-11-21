package com.example.expensetracker.repository;

import com.example.expensetracker.model.Expense;
import com.example.expensetracker.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import java.time.LocalDate;
import java.util.List;

public interface ExpenseRepository extends JpaRepository<Expense, Long> {
    long countByCategory(com.example.expensetracker.model.Category category);

    // Existing method (used for global filtering if needed)
    List<Expense> findByDateBetween(LocalDate start, LocalDate end);

    // New method: find all expenses for a specific user within a date range
    List<Expense> findByUserAndDateBetween(User user, LocalDate start, LocalDate end);

    // Optional: find all expenses for a user (useful for debugging or admin)
    List<Expense> findByUser(User user);
}
