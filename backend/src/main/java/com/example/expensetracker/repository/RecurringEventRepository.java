package com.example.expensetracker.repository;

import com.example.expensetracker.model.RecurringEvent;
import com.example.expensetracker.model.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface RecurringEventRepository extends JpaRepository<RecurringEvent, Long> {
    /** Newest first. Filtered by user, so nobody can read another person's history. */
    List<RecurringEvent> findTop50ByUserAndRecurringIdOrderByHappenedAtDescIdDesc(User user, Long recurringId);

    /** Used by "clear all data". Call inside a transaction. */
    void deleteByUser(User user);
}
