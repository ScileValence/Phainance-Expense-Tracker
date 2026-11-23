package com.example.expensetracker.service;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.time.LocalDate;
import org.junit.jupiter.api.Test;

class ExpenseRangeTest {

    private static final LocalDate TODAY = LocalDate.parse("2026-11-21");

    private static void assertRange(String start, String end, LocalDate[] actual) {
        assertEquals(LocalDate.parse(start), actual[0], "start");
        assertEquals(LocalDate.parse(end), actual[1], "end");
    }

    @Test
    void aPlainMonthGivesItsFirstAndLastDay() {
        assertRange("2026-03-01", "2026-03-31", ExpenseRange.resolve("2026-03", null, null, TODAY));
    }

    @Test
    void februaryInALeapYearEndsOnThe29th() {
        assertRange("2028-02-01", "2028-02-29", ExpenseRange.resolve("2028-02", null, null, TODAY));
    }

    @Test
    void aMissingMonthUsesTheMonthOfToday() {
        assertRange("2026-11-01", "2026-11-30", ExpenseRange.resolve(null, null, null, TODAY));
        assertRange("2026-11-01", "2026-11-30", ExpenseRange.resolve("  ", null, null, TODAY));
    }

    @Test
    void aGarbageMonthFallsBackToTheMonthOfToday() {
        assertRange("2026-11-01", "2026-11-30", ExpenseRange.resolve("not-a-month", null, null, TODAY));
    }

    @Test
    void aValidRangeWinsOverTheMonth() {
        assertRange("2026-01-15", "2026-09-30", ExpenseRange.resolve("2026-03", "2026-01-15", "2026-09-30", TODAY));
    }

    @Test
    void aSingleDayRangeIsAllowed() {
        assertRange("2026-05-05", "2026-05-05", ExpenseRange.resolve(null, "2026-05-05", "2026-05-05", TODAY));
    }

    @Test
    void aReversedRangeFallsBackToTheMonth() {
        assertRange("2026-03-01", "2026-03-31", ExpenseRange.resolve("2026-03", "2026-09-30", "2026-01-15", TODAY));
    }

    @Test
    void onlyOneEndFallsBackToTheMonth() {
        assertRange("2026-03-01", "2026-03-31", ExpenseRange.resolve("2026-03", "2026-01-15", null, TODAY));
        assertRange("2026-03-01", "2026-03-31", ExpenseRange.resolve("2026-03", null, "2026-09-30", TODAY));
        assertRange("2026-03-01", "2026-03-31", ExpenseRange.resolve("2026-03", "", "2026-09-30", TODAY));
    }

    @Test
    void unparsableDatesFallBackToTheMonth() {
        assertRange("2026-03-01", "2026-03-31", ExpenseRange.resolve("2026-03", "yesterday", "tomorrow", TODAY));
        assertRange("2026-03-01", "2026-03-31", ExpenseRange.resolve("2026-03", "2026-02-30", "2026-09-30", TODAY));
    }

    @Test
    void aVeryLongRangeIsClampedToFortyThousandDays() {
        LocalDate[] r = ExpenseRange.resolve(null, "2000-01-01", "9999-12-31", TODAY);
        assertEquals(LocalDate.parse("2000-01-01"), r[0]);
        assertEquals(LocalDate.parse("2000-01-01").plusDays(40000), r[1]);
    }

    @Test
    void allTimeAsTheAppAsksForItIsNotClamped() {
        assertRange("2000-01-01", "2099-12-31", ExpenseRange.resolve(null, "2000-01-01", "2099-12-31", TODAY));
    }

    @Test
    void extremeDatesNeverThrow() {
        LocalDate[] r = ExpenseRange.resolve("2026-03", "+999999999-12-31", "+999999999-12-31", TODAY);
        assertEquals(LocalDate.parse("+999999999-12-31"), r[0]);
        assertEquals(LocalDate.parse("+999999999-12-31"), r[1]);
        LocalDate[] wide = ExpenseRange.resolve("2026-03", "-999999999-01-01", "+999999999-12-31", TODAY);
        assertEquals(LocalDate.parse("-999999999-01-01").plusDays(40000), wide[1]);
    }
}
