package com.example.expensetracker.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.YearMonth;

@Entity
@Table(name = "recurring_payments")
public class RecurringPayment {

    public enum IntervalUnit { DAYS, WEEKS, MONTHS }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String title;
    private Double amount;

    @ManyToOne
    @JoinColumn(name = "category_id")
    private Category category;

    // "every N days/weeks/months"
    private Integer intervalValue;

    @Enumerated(EnumType.STRING)
    private IntervalUnit intervalUnit;

    private LocalDate nextDueDate;
    private LocalTime dueTime;

    // original day-of-month, keeps monthly schedules from drifting (31st -> 28th -> 28th)
    private Integer anchorDay;

    // browser time zone the due time was entered in (e.g. Asia/Kolkata)
    private String timeZone;

    // local due date-time of the occurrence a reminder was last sent for
    private LocalDateTime notifiedFor;

    private boolean active = true;

    // opt in: log the expense by itself when the payment falls due
    @Column(name = "auto_log")
    private boolean autoLog = false;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id")
    @JsonIgnore
    private User user;

    public RecurringPayment() {}

    /** The due date that follows the current one (does not change the entity). */
    public LocalDate nextOccurrence() {
        return nextAfter(nextDueDate, intervalValue, intervalUnit, anchorDay);
    }

    /**
     * The occurrence after {@code current}. A missing or non-positive interval means 1, a missing unit means months,
     * and a monthly schedule returns to its anchor day after a short month (31st, 28th, 31st).
     */
    public static LocalDate nextAfter(LocalDate current, Integer every, IntervalUnit unit, Integer anchorDay) {
        int n = (every == null || every < 1) ? 1 : every;
        IntervalUnit u = unit == null ? IntervalUnit.MONTHS : unit;
        switch (u) {
            case DAYS:
                return current.plusDays(n);
            case WEEKS:
                return current.plusWeeks(n);
            default: {
                LocalDate next = current.plusMonths(n);
                int anchor = anchorDay == null ? current.getDayOfMonth() : anchorDay;
                int last = YearMonth.from(next).lengthOfMonth();
                return next.withDayOfMonth(Math.min(anchor, last));
            }
        }
    }

    /** Move nextDueDate forward by one interval. */
    public void advance() {
        nextDueDate = nextOccurrence();
    }

    // ===== Getters & Setters =====
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public Double getAmount() { return amount; }
    public void setAmount(Double amount) { this.amount = amount; }

    public Category getCategory() { return category; }
    public void setCategory(Category category) { this.category = category; }

    public Integer getIntervalValue() { return intervalValue; }
    public void setIntervalValue(Integer intervalValue) { this.intervalValue = intervalValue; }

    public IntervalUnit getIntervalUnit() { return intervalUnit; }
    public void setIntervalUnit(IntervalUnit intervalUnit) { this.intervalUnit = intervalUnit; }

    public LocalDate getNextDueDate() { return nextDueDate; }
    public void setNextDueDate(LocalDate nextDueDate) { this.nextDueDate = nextDueDate; }

    public LocalTime getDueTime() { return dueTime; }
    public void setDueTime(LocalTime dueTime) { this.dueTime = dueTime; }

    public Integer getAnchorDay() { return anchorDay; }
    public void setAnchorDay(Integer anchorDay) { this.anchorDay = anchorDay; }

    public String getTimeZone() { return timeZone; }
    public void setTimeZone(String timeZone) { this.timeZone = timeZone; }

    public LocalDateTime getNotifiedFor() { return notifiedFor; }
    public void setNotifiedFor(LocalDateTime notifiedFor) { this.notifiedFor = notifiedFor; }

    public boolean isActive() { return active; }
    public boolean isAutoLog() { return autoLog; }
    public void setAutoLog(boolean autoLog) { this.autoLog = autoLog; }
    public void setActive(boolean active) { this.active = active; }

    public User getUser() { return user; }
    public void setUser(User user) { this.user = user; }
}
