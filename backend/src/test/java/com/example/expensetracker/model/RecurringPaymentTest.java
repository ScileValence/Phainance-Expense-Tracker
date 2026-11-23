package com.example.expensetracker.model;

import static org.junit.jupiter.api.Assertions.assertEquals;

import com.example.expensetracker.model.RecurringPayment.IntervalUnit;
import java.time.LocalDate;
import org.junit.jupiter.api.Test;

class RecurringPaymentTest {

    private static RecurringPayment payment(String due, Integer every, IntervalUnit unit, Integer anchor) {
        RecurringPayment r = new RecurringPayment();
        r.setNextDueDate(LocalDate.parse(due));
        r.setIntervalValue(every);
        r.setIntervalUnit(unit);
        r.setAnchorDay(anchor);
        return r;
    }

    @Test
    void monthlyOnThe31stClampsToFebruaryThenReturnsToThe31st() {
        RecurringPayment r = payment("2026-01-31", 1, IntervalUnit.MONTHS, 31);
        r.advance();
        assertEquals(LocalDate.parse("2026-02-28"), r.getNextDueDate());
        r.advance();
        assertEquals(LocalDate.parse("2026-03-31"), r.getNextDueDate());
    }

    @Test
    void leapYearFebruaryUsesThe29th() {
        RecurringPayment r = payment("2028-01-31", 1, IntervalUnit.MONTHS, 31);
        assertEquals(LocalDate.parse("2028-02-29"), r.nextOccurrence());
    }

    @Test
    void monthlyAnchoredOnThe30thKeepsTheAnchor() {
        RecurringPayment r = payment("2026-01-30", 1, IntervalUnit.MONTHS, 30);
        r.advance();
        assertEquals(LocalDate.parse("2026-02-28"), r.getNextDueDate());
        r.advance();
        assertEquals(LocalDate.parse("2026-03-30"), r.getNextDueDate());
    }

    @Test
    void everyTwoMonthsSkipsAMonth() {
        assertEquals(LocalDate.parse("2026-03-15"), payment("2026-01-15", 2, IntervalUnit.MONTHS, 15).nextOccurrence());
    }

    @Test
    void monthlyCrossesAYearEnd() {
        assertEquals(LocalDate.parse("2027-01-15"), payment("2026-12-15", 1, IntervalUnit.MONTHS, 15).nextOccurrence());
    }

    @Test
    void weeklyAddsSevenDaysPerInterval() {
        assertEquals(LocalDate.parse("2026-12-05"), payment("2026-11-21", 2, IntervalUnit.WEEKS, null).nextOccurrence());
    }

    @Test
    void dailyCrossesAYearEnd() {
        assertEquals(LocalDate.parse("2027-01-01"), payment("2026-12-31", 1, IntervalUnit.DAYS, null).nextOccurrence());
    }

    @Test
    void missingIntervalDefaultsToOneMonth() {
        assertEquals(LocalDate.parse("2026-02-10"), payment("2026-01-10", null, null, null).nextOccurrence());
    }

    @Test
    void zeroOrNegativeIntervalIsTreatedAsOne() {
        assertEquals(LocalDate.parse("2026-01-11"), payment("2026-01-10", 0, IntervalUnit.DAYS, null).nextOccurrence());
        assertEquals(LocalDate.parse("2026-01-11"), payment("2026-01-10", -3, IntervalUnit.DAYS, null).nextOccurrence());
    }

    @Test
    void withoutAnAnchorTheCurrentDayIsUsed() {
        assertEquals(LocalDate.parse("2026-02-28"), payment("2026-01-31", 1, IntervalUnit.MONTHS, null).nextOccurrence());
    }

    @Test
    void nextOccurrenceDoesNotChangeTheEntityButAdvanceDoes() {
        RecurringPayment r = payment("2026-05-01", 1, IntervalUnit.MONTHS, 1);
        r.nextOccurrence();
        assertEquals(LocalDate.parse("2026-05-01"), r.getNextDueDate());
        r.advance();
        assertEquals(LocalDate.parse("2026-06-01"), r.getNextDueDate());
        assertEquals(Integer.valueOf(1), r.getAnchorDay());
    }
}
