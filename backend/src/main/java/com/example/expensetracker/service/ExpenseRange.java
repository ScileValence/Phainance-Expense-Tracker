package com.example.expensetracker.service;

import java.time.LocalDate;
import java.time.YearMonth;
import java.time.temporal.ChronoUnit;

/**
 * Works out which dates an expense listing covers. A valid from/to pair wins; otherwise the month
 * (or the current month). Bad input never throws, it just falls back, and a range is capped in length.
 */
public final class ExpenseRange {

    /** Longest range we will load in one request (about 110 years, so "all time" still fits). */
    static final long MAX_DAYS = 40_000;

    private ExpenseRange() {}

    public static LocalDate[] resolve(String month, String from, String to, LocalDate today) {
        LocalDate start = parseDate(from);
        LocalDate end = parseDate(to);
        if (start != null && end != null && !start.isAfter(end)) {
            // measure first: adding days to a date near the calendar limit would overflow
            boolean tooLong = ChronoUnit.DAYS.between(start, end) > MAX_DAYS;
            return new LocalDate[]{start, tooLong ? start.plusDays(MAX_DAYS) : end};
        }

        YearMonth ym;
        try {
            ym = (month != null && !month.isBlank()) ? YearMonth.parse(month.trim()) : YearMonth.from(today);
        } catch (Exception e) {
            ym = YearMonth.from(today);
        }
        return new LocalDate[]{ym.atDay(1), ym.atEndOfMonth()};
    }

    private static LocalDate parseDate(String s) {
        if (s == null || s.isBlank()) return null;
        try {
            return LocalDate.parse(s.trim());
        } catch (Exception e) {
            return null;
        }
    }
}
