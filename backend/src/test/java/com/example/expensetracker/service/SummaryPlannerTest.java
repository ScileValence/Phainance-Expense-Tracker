package com.example.expensetracker.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.example.expensetracker.service.SummaryPlanner.Frequency;
import com.example.expensetracker.service.SummaryPlanner.Period;
import java.time.LocalDate;
import org.junit.jupiter.api.Test;

class SummaryPlannerTest {

    private static LocalDate d(String s) { return LocalDate.parse(s); }

    private static void assertPeriod(String start, String end, Period p) {
        assertEquals(d(start), p.start(), "start");
        assertEquals(d(end), p.end(), "end");
    }

    // 2026-11-23 is a Monday

    @Test
    void weeklyOnAMondayReturnsThePreviousMondayToSunday() {
        assertPeriod("2026-11-16", "2026-11-22", SummaryPlanner.lastCompleted(Frequency.WEEKLY, d("2026-11-23")));
    }

    @Test
    void weeklyOnAWednesdayReturnsThatSameCompletedWeek() {
        assertPeriod("2026-11-16", "2026-11-22", SummaryPlanner.lastCompleted(Frequency.WEEKLY, d("2026-11-25")));
    }

    @Test
    void weeklyOnASundayDoesNotCountTheWeekThatIsStillRunning() {
        assertPeriod("2026-11-09", "2026-11-15", SummaryPlanner.lastCompleted(Frequency.WEEKLY, d("2026-11-22")));
    }

    @Test
    void weeklyAcrossAYearEnd() {
        assertPeriod("2026-12-28", "2027-01-03", SummaryPlanner.lastCompleted(Frequency.WEEKLY, d("2027-01-04")));
    }

    @Test
    void monthlyReturnsThePreviousCalendarMonth() {
        assertPeriod("2026-10-01", "2026-10-31", SummaryPlanner.lastCompleted(Frequency.MONTHLY, d("2026-11-22")));
        assertPeriod("2026-11-01", "2026-11-30", SummaryPlanner.lastCompleted(Frequency.MONTHLY, d("2026-12-01")));
    }

    @Test
    void monthlyInJanuaryReturnsDecemberOfTheYearBefore() {
        assertPeriod("2026-12-01", "2026-12-31", SummaryPlanner.lastCompleted(Frequency.MONTHLY, d("2027-01-15")));
    }

    @Test
    void monthlyInMarchOfALeapYearReturnsA29DayFebruary() {
        assertPeriod("2028-02-01", "2028-02-29", SummaryPlanner.lastCompleted(Frequency.MONTHLY, d("2028-03-10")));
    }

    @Test
    void beforeAWeekIsTheWeekSevenDaysEarlier() {
        assertPeriod("2026-11-09", "2026-11-15", SummaryPlanner.before(Frequency.WEEKLY, new Period(d("2026-11-16"), d("2026-11-22"))));
    }

    @Test
    void beforeAMonthIsTheMonthBefore() {
        assertPeriod("2025-12-01", "2025-12-31", SummaryPlanner.before(Frequency.MONTHLY, new Period(d("2026-01-01"), d("2026-01-31"))));
        assertPeriod("2026-02-01", "2026-02-28", SummaryPlanner.before(Frequency.MONTHLY, new Period(d("2026-03-01"), d("2026-03-31"))));
    }

    @Test
    void aSendIsDueWhenNothingWasEverSent() {
        assertTrue(SummaryPlanner.due(Frequency.WEEKLY, d("2026-11-25"), null));
    }

    @Test
    void aSendIsDueWhenTheLastSentPeriodEndedBeforeTheLatestCompletedOne() {
        assertTrue(SummaryPlanner.due(Frequency.WEEKLY, d("2026-11-25"), d("2026-11-15")));
        assertTrue(SummaryPlanner.due(Frequency.MONTHLY, d("2026-11-22"), d("2026-09-30")));
    }

    @Test
    void noSecondSendForTheSamePeriod() {
        assertFalse(SummaryPlanner.due(Frequency.WEEKLY, d("2026-11-25"), d("2026-11-22")));
        assertFalse(SummaryPlanner.due(Frequency.WEEKLY, d("2026-11-29"), d("2026-11-22")));
        assertFalse(SummaryPlanner.due(Frequency.MONTHLY, d("2026-11-22"), d("2026-10-31")));
    }

    @Test
    void nothingIsDueWhenOff() {
        assertFalse(SummaryPlanner.due(Frequency.OFF, d("2026-11-25"), null));
    }

    @Test
    void parseIsLenient() {
        assertEquals(Frequency.WEEKLY, Frequency.parse("weekly"));
        assertEquals(Frequency.MONTHLY, Frequency.parse(" MONTHLY "));
        assertEquals(Frequency.OFF, Frequency.parse(null));
        assertEquals(Frequency.OFF, Frequency.parse("x"));
        assertEquals(Frequency.OFF, Frequency.parse("OFF"));
    }
}
