package com.example.expensetracker.repository;

import com.example.expensetracker.model.PushSubscription;
import com.example.expensetracker.model.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface PushSubscriptionRepository extends JpaRepository<PushSubscription, Long> {
    List<PushSubscription> findByUser(User user);

    Optional<PushSubscription> findFirstByEndpoint(String endpoint);
}
