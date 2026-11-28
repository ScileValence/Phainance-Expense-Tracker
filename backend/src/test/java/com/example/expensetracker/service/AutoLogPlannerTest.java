package com.example.expensetracker.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.example.expensetracker.model.RecurringPayment.IntervalUnit;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.List;
import org.junit.jupiter.api.Test;

class AutoLogPlannerTest {

    private static final ZoneId UTC = ZoneId.of("UTC");
    private static final ZoneId KOLKATA = ZoneId.of("Asia/Kolkata");

    private static List<LocalDate> due(String nextDue, String time, ZoneId zone, int every, IntervalUnit unit,
                                       Integer anchor, String nowIso, int max) {
        return AutoLogPlanner.dueDates(LocalDate.parse(nextDue), time == null ? null : LocalTime.parse(time), zone,
                every, unit, anchor, Instant.parse(nowIso), max);
    }

    private static List<LocalDate> dates(String... isoDates) {
        return java.util.Arrays.stream(isoDates).map(LocalDate::parse).toList();
    }

    @Test
    void nothingIsDueBeforeTheDueTime() {
        assertTrue(due("2026-11-21", "09:00", UTC, 1, IntervalUnit.MONTHS, 21, "2026-11-21T08:59:59Z", 12).isEmpty());
    }

    @Test
    void anOccurrenceIsDueExactlyAtItsDueMoment() {
        assertEquals(dates("2026-11-21"), due("2026-11-21", "09:00", UTC, 1, IntervalUnit.MONTHS, 21, "2026-11-21T09:00:00Z", 12));
    }

    @Test
    void missedOccurrencesAreReturnedInOrder() {
        assertEquals(dates("2026-09-15", "2026-10-15"),
                due("2026-09-15", "09:00", UTC, 1, IntervalUnit.MONTHS, 15, "2026-11-10T00:00:00Z", 12));
    }

    @Test
    void itStopsAtTheFirstOccurrenceThatIsStillInTheFuture() {
        assertEquals(dates("2026-11-02", "2026-11-16", "2026-11-30"),
                due("2026-11-02", "09:00", UTC, 2, IntervalUnit.WEEKS, null, "2026-11-30T10:00:00Z", 12));
    }

    @Test
    void maxCapsTheNumberOfOccurrences() {
        List<LocalDate> out = due("2026-01-01", "09:00", UTC, 1, IntervalUnit.DAYS, null, "2026-11-21T00:00:00Z", 12);
        assertEquals(12, out.size());
        assertEquals(LocalDate.parse("2026-01-01"), out.get(0));
        assertEquals(LocalDate.parse("2026-01-12"), out.get(11));
    }

    @Test
    void aMissingTimeMeansNineInTheMorning() {
        assertTrue(due("2026-11-21", null, UTC, 1, IntervalUnit.MONTHS, 21, "2026-11-21T08:59:00Z", 12).isEmpty());
        assertEquals(dates("2026-11-21"), due("2026-11-21", null, UTC, 1, IntervalUnit.MONTHS, 21, "2026-11-21T09:00:00Z", 12));
    }

    @Test
    void theTimeZoneOfThePaymentIsHonoured() {
        // 09:00 in Kolkata is 03:30 UTC
        assertEquals(dates("2026-11-21"), due("2026-11-21", "09:00", KOLKATA, 1, IntervalUnit.MONTHS, 21, "2026-11-21T04:00:00Z", 12));
        assertTrue(due("2026-11-21", "09:00", UTC, 1, IntervalUnit.MONTHS, 21, "2026-11-21T04:00:00Z", 12).isEmpty());
    }

    @Test
    void aMonthEndAnchorClampsAndComesBack() {
        assertEquals(dates("2026-01-31", "2026-02-28", "2026-03-31"),
                due("2026-01-31", "09:00", UTC, 1, IntervalUnit.MONTHS, 31, "2026-03-31T12:00:00Z", 12));
    }

    @Test
    void noNextDueDateMeansNothingIsDue() {
        assertTrue(AutoLogPlanner.dueDates(null, LocalTime.of(9, 0), UTC, 1, IntervalUnit.MONTHS, 1, Instant.now(), 12).isEmpty());
    }

    @Test
    void anIntervalOfZeroOrNullStillMovesForwardAndEnds() {
        assertEquals(12, due("2026-01-01", "09:00", UTC, 0, IntervalUnit.DAYS, null, "2026-11-21T00:00:00Z", 12).size());
        // no interval and no unit means "every month", so only the first occurrence is due on 2 November
        assertEquals(dates("2026-11-01"),
                AutoLogPlanner.dueDates(LocalDate.parse("2026-11-01"), LocalTime.of(9, 0), UTC, null, null, null,
                        Instant.parse("2026-11-02T10:00:00Z"), 1000));
    }
}
