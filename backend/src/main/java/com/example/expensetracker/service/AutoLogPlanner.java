package com.example.expensetracker.service;

import com.example.expensetracker.model.RecurringPayment;
import com.example.expensetracker.model.RecurringPayment.IntervalUnit;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;

/** Which occurrences of a recurring payment have come due and can be logged automatically. */
public final class AutoLogPlanner {

    private AutoLogPlanner() {}

    /**
     * Every occurrence from {@code nextDue} on whose due moment (the date plus {@code dueTime} in {@code zone};
     * no time means 09:00) is at or before {@code now}, in order, at most {@code max}. Stops at the first one still
     * in the future.
     */
    public static List<LocalDate> dueDates(LocalDate nextDue, LocalTime dueTime, ZoneId zone, Integer every,
                                           IntervalUnit unit, Integer anchorDay, Instant now, int max) {
        List<LocalDate> out = new ArrayList<>();
        if (nextDue == null) return out;

        LocalTime time = dueTime == null ? LocalTime.of(9, 0) : dueTime;
        ZoneId z = zone == null ? ZoneId.systemDefault() : zone;

        LocalDate current = nextDue;
        while (out.size() < max && !LocalDateTime.of(current, time).atZone(z).toInstant().isAfter(now)) {
            out.add(current);
            current = RecurringPayment.nextAfter(current, every, unit, anchorDay);
        }
        return out;
    }
}
