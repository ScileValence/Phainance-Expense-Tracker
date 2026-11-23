package com.example.expensetracker.service;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.temporal.TemporalAdjusters;

/**
 * Which period a summary covers and whether one is due. Weeks run Monday to Sunday, months are calendar months,
 * and only a completed period is ever summarised.
 */
public final class SummaryPlanner {

    public enum Frequency {
        OFF, WEEKLY, MONTHLY;

        /** Anything that is not "weekly" or "monthly" (any case) is OFF. */
        public static Frequency parse(String s) {
            if (s == null) return OFF;
            String t = s.trim();
            if (t.equalsIgnoreCase("WEEKLY")) return WEEKLY;
            if (t.equalsIgnoreCase("MONTHLY")) return MONTHLY;
            return OFF;
        }
    }

    /** Both ends inclusive. */
    public record Period(LocalDate start, LocalDate end) {}

    private SummaryPlanner() {}

    /** The most recent period that ended before {@code today}. */
    public static Period lastCompleted(Frequency f, LocalDate today) {
        switch (f) {
            case WEEKLY: {
                LocalDate thisMonday = today.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
                LocalDate end = thisMonday.minusDays(1);
                return new Period(end.minusDays(6), end);
            }
            case MONTHLY: {
                YearMonth previous = YearMonth.from(today).minusMonths(1);
                return new Period(previous.atDay(1), previous.atEndOfMonth());
            }
            default:
                throw new IllegalArgumentException("A summary needs WEEKLY or MONTHLY");
        }
    }

    /** The period immediately before {@code p}, used to show the change. */
    public static Period before(Frequency f, Period p) {
        switch (f) {
            case WEEKLY:
                return new Period(p.start().minusDays(7), p.end().minusDays(7));
            case MONTHLY: {
                YearMonth previous = YearMonth.from(p.start()).minusMonths(1);
                return new Period(previous.atDay(1), previous.atEndOfMonth());
            }
            default:
                throw new IllegalArgumentException("A summary needs WEEKLY or MONTHLY");
        }
    }

    /** True when the latest completed period has not been sent yet (so a missed run catches up, and a repeat does not duplicate). */
    public static boolean due(Frequency f, LocalDate today, LocalDate lastSentPeriodEnd) {
        if (f == Frequency.OFF) return false;
        return lastSentPeriodEnd == null || lastSentPeriodEnd.isBefore(lastCompleted(f, today).end());
    }
}
