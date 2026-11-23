package com.example.expensetracker.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;

/** Standing monthly spending limit for one category of one user. */
@Entity
@Table(name = "category_budgets", uniqueConstraints = @UniqueConstraint(columnNames = {"user_id", "category_id"}))
public class CategoryBudget {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    @JsonIgnore
    private User user;

    @ManyToOne(optional = false)
    @JoinColumn(name = "category_id", nullable = false)
    private Category category;

    @Column(name = "limit_amount", nullable = false)
    private Double limitAmount;

    public CategoryBudget() {}

    public Long getId() { return id; }
    public User getUser() { return user; }
    public void setUser(User user) { this.user = user; }
    public Category getCategory() { return category; }
    public void setCategory(Category category) { this.category = category; }
    public Double getLimitAmount() { return limitAmount; }
    public void setLimitAmount(Double limitAmount) { this.limitAmount = limitAmount; }
}
