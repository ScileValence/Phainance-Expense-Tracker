package com.example.expensetracker.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.util.List;

@Entity
@Table(name = "users")
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String username;

    @Column(nullable = false, unique = true)
    private String email;

    @Column(nullable = false)
    private String password;

    // null = not set yet, treated as enabled
    private Boolean emailReminders = true;

    // null = account created before verification existed, treated as verified
    private Boolean emailVerified;

    // which emails this person wants (null = on, for the older kinds) and the optional weekly / monthly summary
    @Column(name = "email_budget_alerts")
    private Boolean emailBudgetAlerts;

    @Column(name = "email_payment_updates")
    private Boolean emailPaymentUpdates;

    @Column(name = "summary_frequency")
    private String summaryFrequency; // OFF, WEEKLY, MONTHLY (null = OFF)

    @Column(name = "summary_last_period")
    private java.time.LocalDate summaryLastPeriod; // end of the last period a summary was sent for
    @JsonIgnore
    private String verificationTokenHash;
    @JsonIgnore
    private LocalDateTime verificationExpiresAt;
    @JsonIgnore
    private LocalDateTime verificationSentAt;

    // New: link to expenses and budgets (one-to-many)
    @OneToMany(mappedBy = "user", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<Expense> expenses;

    @OneToMany(mappedBy = "user", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<Budget> budgets;

    public User() {}

    public User(String username, String email, String password) {
        this.username = username;
        this.email = email;
        this.password = password;
    }

    // ===== Getters & Setters =====
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

    public String getPassword() { return password; }
    public void setPassword(String password) { this.password = password; }

    public boolean isEmailRemindersEnabled() { return emailReminders == null || emailReminders; }
    public Boolean getEmailReminders() { return emailReminders; }
    public void setEmailReminders(Boolean emailReminders) { this.emailReminders = emailReminders; }

    public Boolean getEmailBudgetAlerts() { return emailBudgetAlerts; }
    public void setEmailBudgetAlerts(Boolean v) { this.emailBudgetAlerts = v; }

    public Boolean getEmailPaymentUpdates() { return emailPaymentUpdates; }
    public void setEmailPaymentUpdates(Boolean v) { this.emailPaymentUpdates = v; }

    public String getSummaryFrequency() { return summaryFrequency; }
    public void setSummaryFrequency(String v) { this.summaryFrequency = v; }

    public java.time.LocalDate getSummaryLastPeriod() { return summaryLastPeriod; }
    public void setSummaryLastPeriod(java.time.LocalDate v) { this.summaryLastPeriod = v; }

    public boolean isEmailVerified() { return emailVerified == null || emailVerified; }
    public Boolean getEmailVerified() { return emailVerified; }
    public void setEmailVerified(Boolean emailVerified) { this.emailVerified = emailVerified; }

    public String getVerificationTokenHash() { return verificationTokenHash; }
    public void setVerificationTokenHash(String h) { this.verificationTokenHash = h; }

    public LocalDateTime getVerificationExpiresAt() { return verificationExpiresAt; }
    public void setVerificationExpiresAt(LocalDateTime t) { this.verificationExpiresAt = t; }

    public LocalDateTime getVerificationSentAt() { return verificationSentAt; }
    public void setVerificationSentAt(LocalDateTime t) { this.verificationSentAt = t; }

    public List<Expense> getExpenses() { return expenses; }
    public void setExpenses(List<Expense> expenses) { this.expenses = expenses; }

    public List<Budget> getBudgets() { return budgets; }
    public void setBudgets(List<Budget> budgets) { this.budgets = budgets; }
}
