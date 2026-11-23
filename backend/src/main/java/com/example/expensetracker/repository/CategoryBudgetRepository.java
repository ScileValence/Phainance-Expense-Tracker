package com.example.expensetracker.repository;

import com.example.expensetracker.model.Category;
import com.example.expensetracker.model.CategoryBudget;
import com.example.expensetracker.model.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface CategoryBudgetRepository extends JpaRepository<CategoryBudget, Long> {
    List<CategoryBudget> findByUser(User user);
    Optional<CategoryBudget> findByUserAndCategory(User user, Category category);
}
