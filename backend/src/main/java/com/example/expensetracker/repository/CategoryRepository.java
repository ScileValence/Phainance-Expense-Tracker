package com.example.expensetracker.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import com.example.expensetracker.model.Category;
import com.example.expensetracker.model.User;

public interface CategoryRepository extends JpaRepository<Category, Long> {
    boolean existsByName(String name);
    Optional<Category> findByName(String name);

    boolean existsByNameIgnoreCaseAndUserIsNull(String name);
    boolean existsByNameIgnoreCaseAndUser(String name, User user);

    // built-in categories plus this user's own
    @Query("select c from Category c where c.user is null or c.user = :user order by c.id")
    List<Category> findVisibleTo(@Param("user") User user);

    @Query("select c from Category c where c.id = :id and (c.user is null or c.user = :user)")
    Optional<Category> findVisibleById(@Param("id") Long id, @Param("user") User user);
}
