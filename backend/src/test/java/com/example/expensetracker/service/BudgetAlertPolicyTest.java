package com.example.expensetracker.service;

import static com.example.expensetracker.service.BudgetAlertPolicy.Level.EXCEEDED;
import static com.example.expensetracker.service.BudgetAlertPolicy.Level.NONE;
import static com.example.expensetracker.service.BudgetAlertPolicy.Level.WARNING;
import static org.junit.jupiter.api.Assertions.assertEquals;

import org.junit.jupiter.api.Test;

class BudgetAlertPolicyTest {

    @Test
    void warnsWhenCrossingEightyPercent() {
        assertEquals(WARNING, BudgetAlertPolicy.crossed(7000, 8200, 10000));
    }

    @Test
    void warnsExactlyOnTheEightyPercentLine() {
        assertEquals(WARNING, BudgetAlertPolicy.crossed(7999, 8000, 10000));
    }

    @Test
    void doesNotWarnAgainOnceAboveEightyPercent() {
        assertEquals(NONE, BudgetAlertPolicy.crossed(8200, 9500, 10000));
    }

    @Test
    void exceededWhenCrossingTheLimit() {
        assertEquals(EXCEEDED, BudgetAlertPolicy.crossed(9500, 10300, 10000));
    }

    @Test
    void exceededWinsWhenBothLinesAreCrossedAtOnce() {
        assertEquals(EXCEEDED, BudgetAlertPolicy.crossed(2000, 12000, 10000));
    }

    @Test
    void exactlyReachingTheLimitCountsAsExceeded() {
        assertEquals(EXCEEDED, BudgetAlertPolicy.crossed(9000, 10000, 10000));
    }

    @Test
    void noRepeatAlertsOnceOverTheLimit() {
        assertEquals(NONE, BudgetAlertPolicy.crossed(10300, 12000, 10000));
    }

    @Test
    void nothingWhenSpendingStaysLow() {
        assertEquals(NONE, BudgetAlertPolicy.crossed(1000, 3000, 10000));
    }

    @Test
    void nothingWhenSpendingGoesDown() {
        assertEquals(NONE, BudgetAlertPolicy.crossed(9000, 7000, 10000));
    }

    @Test
    void nothingWithoutALimit() {
        assertEquals(NONE, BudgetAlertPolicy.crossed(0, 500, 0));
        assertEquals(NONE, BudgetAlertPolicy.crossed(0, 500, -10));
    }

    @Test
    void percentIsRoundedAndSafeForZeroLimit() {
        assertEquals(85, BudgetAlertPolicy.percent(8500, 10000));
        assertEquals(33, BudgetAlertPolicy.percent(1, 3));
        assertEquals(0, BudgetAlertPolicy.percent(500, 0));
    }
}
