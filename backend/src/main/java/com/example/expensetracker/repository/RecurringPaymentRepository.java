package com.example.expensetracker.repository;

import com.example.expensetracker.model.RecurringPayment;
import com.example.expensetracker.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

public interface RecurringPaymentRepository extends JpaRepository<RecurringPayment, Long> {
    long countByCategory(com.example.expensetracker.model.Category category);

    List<RecurringPayment> findByUserOrderByNextDueDateAscDueTimeAsc(User user);

    // used by the reminder scheduler (user is loaded eagerly: no open session there)
    @Query("select r from RecurringPayment r join fetch r.user where r.active = true")
    List<RecurringPayment> findActiveWithUser();

    // touches only this column so it can't overwrite a concurrent confirm/skip
    @Transactional
    @Modifying
    @Query("update RecurringPayment r set r.notifiedFor = :ts where r.id = :id")
    int markNotified(@Param("id") Long id, @Param("ts") LocalDateTime ts);

    // payments that log themselves (user is loaded eagerly: no open session in the scheduler)
    @Query("select r from RecurringPayment r join fetch r.user where r.active = true and r.autoLog = true")
    List<RecurringPayment> findActiveAutoLogWithUser();

    /**
     * Moves the due date from {@code expected} to {@code next} only if it is still {@code expected} and the payment is
     * still active and automatic. Returns 1 for the one caller that gets it, 0 for anyone else, so an occurrence is
     * never logged twice.
     */
    @Transactional
    @Modifying
    @Query("update RecurringPayment r set r.nextDueDate = :next where r.id = :id and r.nextDueDate = :expected and r.active = true and r.autoLog = true")
    int claimOccurrence(@Param("id") Long id, @Param("expected") java.time.LocalDate expected, @Param("next") java.time.LocalDate next);
}
