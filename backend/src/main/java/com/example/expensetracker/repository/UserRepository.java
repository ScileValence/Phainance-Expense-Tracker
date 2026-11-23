package com.example.expensetracker.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import com.example.expensetracker.model.User;
import java.time.LocalDate;
import java.util.Optional;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

public interface UserRepository extends JpaRepository<User, Long> {
    Optional<User> findByUsername(String username);
    boolean existsByEmail(String email);
    boolean existsByUsername(String username);
    Optional<User> findByVerificationTokenHash(String verificationTokenHash);

    java.util.List<User> findBySummaryFrequencyIn(java.util.Collection<String> frequencies);

    /**
     * Claims the summary for the period ending on {@code periodEnd}: returns 1 for the one caller that records it first,
     * 0 for anyone else (another run or another instance), so a period can only ever be sent once. Touches nothing else.
     */
    @Modifying
    @Transactional
    @Query("update User u set u.summaryLastPeriod = :periodEnd where u.id = :id and (u.summaryLastPeriod is null or u.summaryLastPeriod < :periodEnd)")
    int claimSummary(@Param("id") Long id, @Param("periodEnd") LocalDate periodEnd);
}
