package com.example.expensetracker.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.example.expensetracker.service.SummaryBuilder.Line;
import com.example.expensetracker.service.SummaryBuilder.Summary;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.Test;

class SummaryBuilderTest {

    private static Line line(String category, String description, String date, double amount) {
        return new Line(category, description, LocalDate.parse(date), amount);
    }

    private static final List<Line> NONE = List.of();

    @Test
    void totalsAndCountsTheCurrentPeriod() {
        Summary s = SummaryBuilder.build(List.of(
                line("Food", "Groceries", "2026-11-03", 450),
                line("Rent", "Rent", "2026-11-01", 12000),
                line("Food", "Coffee", "2026-11-10", 90)), NONE, 3);
        assertEquals(12540.0, s.total(), 0.001);
        assertEquals(3, s.count());
    }

    @Test
    void topCategoriesAreSortedByAmountWithRoundedPercentOfTheTotal() {
        Summary s = SummaryBuilder.build(List.of(
                line("Food", "a", "2026-11-03", 450),
                line("Rent", "b", "2026-11-01", 12000),
                line("Food", "c", "2026-11-10", 90)), NONE, 3);
        assertEquals(2, s.top().size());
        assertEquals("Rent", s.top().get(0).name());
        assertEquals(96, s.top().get(0).percent());
        assertEquals("Food", s.top().get(1).name());
        assertEquals(540.0, s.top().get(1).amount(), 0.001);
        assertEquals(4, s.top().get(1).percent());
    }

    @Test
    void topIsLimitedToTopN() {
        Summary s = SummaryBuilder.build(List.of(
                line("A", "x", "2026-11-01", 30), line("B", "x", "2026-11-01", 20),
                line("C", "x", "2026-11-01", 10), line("D", "x", "2026-11-01", 5)), NONE, 2);
        assertEquals(2, s.top().size());
        assertEquals("A", s.top().get(0).name());
        assertEquals("B", s.top().get(1).name());
        assertTrue(SummaryBuilder.build(List.of(line("A", "x", "2026-11-01", 30)), NONE, 0).top().isEmpty());
    }

    @Test
    void equalAmountsAreOrderedByName() {
        Summary s = SummaryBuilder.build(List.of(
                line("Zoo", "x", "2026-11-01", 50), line("apple", "x", "2026-11-01", 50)), NONE, 3);
        assertEquals("apple", s.top().get(0).name());
        assertEquals("Zoo", s.top().get(1).name());
    }

    @Test
    void aMissingCategoryIsCalledUncategorized() {
        Summary s = SummaryBuilder.build(List.of(line(null, "x", "2026-11-01", 50), line("  ", "y", "2026-11-02", 25)), NONE, 3);
        assertEquals("Uncategorized", s.top().get(0).name());
        assertEquals(75.0, s.top().get(0).amount(), 0.001);
    }

    @Test
    void changeIsThePercentVersusThePreviousPeriod() {
        assertEquals(50, SummaryBuilder.build(List.of(line("A", "x", "2026-11-01", 150)), List.of(line("A", "x", "2026-10-01", 100)), 3).changePercent());
        assertEquals(-50, SummaryBuilder.build(List.of(line("A", "x", "2026-11-01", 50)), List.of(line("A", "x", "2026-10-01", 100)), 3).changePercent());
        assertEquals(-67, SummaryBuilder.build(List.of(line("A", "x", "2026-11-01", 1)), List.of(line("A", "x", "2026-10-01", 3)), 3).changePercent());
        assertEquals(0, SummaryBuilder.build(List.of(line("A", "x", "2026-11-01", 100)), List.of(line("A", "x", "2026-10-01", 100)), 3).changePercent());
    }

    @Test
    void changeIsNullWhenThePreviousPeriodHadNoSpending() {
        assertNull(SummaryBuilder.build(List.of(line("A", "x", "2026-11-01", 100)), NONE, 3).changePercent());
    }

    @Test
    void thePreviousTotalIsExposed() {
        assertEquals(100.0, SummaryBuilder.build(NONE, List.of(line("A", "x", "2026-10-01", 100)), 3).previousTotal(), 0.001);
    }

    @Test
    void biggestIsTheLargestSingleExpenseAndTiesGoToTheNewestDate() {
        Summary s = SummaryBuilder.build(List.of(
                line("A", "old big", "2026-11-01", 500), line("A", "new big", "2026-11-09", 500), line("A", "small", "2026-11-10", 5)), NONE, 3);
        assertEquals("new big", s.biggest().description());
    }

    @Test
    void anEmptyPeriodIsHandledWithoutErrors() {
        Summary s = SummaryBuilder.build(NONE, NONE, 3);
        assertEquals(0.0, s.total(), 0.001);
        assertEquals(0, s.count());
        assertTrue(s.top().isEmpty());
        assertNull(s.biggest());
        assertNull(s.changePercent());
    }
}
