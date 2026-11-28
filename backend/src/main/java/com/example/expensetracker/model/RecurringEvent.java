package com.example.expensetracker.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;

import java.time.LocalDate;
import java.time.LocalDateTime;

/** One thing that happened to one occurrence of a recurring payment. Kept after the payment is deleted. */
@Entity
@Table(name = "recurring_events")
public class RecurringEvent {

    public enum Action { PAID, SKIPPED, AUTO_PAID }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    @JsonIgnore
    private User user;

    // null once the payment itself has been deleted
    @Column(name = "recurring_id")
    private Long recurringId;

    private String title;
    private Double amount;

    @Column(name = "due_date", nullable = false)
    private LocalDate dueDate;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Action action;

    @Column(name = "happened_at", nullable = false)
    private LocalDateTime happenedAt;

    public RecurringEvent() {}

    public static RecurringEvent of(User user, Long recurringId, String title, Double amount, LocalDate dueDate, Action action) {
        RecurringEvent e = new RecurringEvent();
        e.user = user;
        e.recurringId = recurringId;
        e.title = title;
        e.amount = amount;
        e.dueDate = dueDate;
        e.action = action;
        e.happenedAt = LocalDateTime.now();
        return e;
    }

    public Long getId() { return id; }
    public Long getRecurringId() { return recurringId; }
    public String getTitle() { return title; }
    public Double getAmount() { return amount; }
    public LocalDate getDueDate() { return dueDate; }
    public Action getAction() { return action; }
    public LocalDateTime getHappenedAt() { return happenedAt; }
}
