package com.example.expensetracker.service;

import static com.example.expensetracker.service.EmailKind.BUDGET_ALERT;
import static com.example.expensetracker.service.EmailKind.DUE_REMINDER;
import static com.example.expensetracker.service.EmailKind.PAYMENT_UPDATE;
import static com.example.expensetracker.service.EmailKind.SUMMARY;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

class EmailGateTest {

    @Test
    void anUnverifiedAddressBlocksEveryKind() {
        for (EmailKind kind : EmailKind.values()) {
            assertFalse(EmailGate.allows(false, true, true, true, "WEEKLY", kind), kind.name());
        }
    }

    @Test
    void missingFlagsMeanOnForTheOlderKinds() {
        assertTrue(EmailGate.allows(true, null, null, null, null, DUE_REMINDER));
        assertTrue(EmailGate.allows(true, null, null, null, null, BUDGET_ALERT));
        assertTrue(EmailGate.allows(true, null, null, null, null, PAYMENT_UPDATE));
    }

    @Test
    void aFlagTurnsOffOnlyItsOwnKind() {
        assertFalse(EmailGate.allows(true, false, true, true, "OFF", DUE_REMINDER));
        assertTrue(EmailGate.allows(true, false, true, true, "OFF", BUDGET_ALERT));
        assertTrue(EmailGate.allows(true, false, true, true, "OFF", PAYMENT_UPDATE));

        assertFalse(EmailGate.allows(true, true, false, true, "OFF", BUDGET_ALERT));
        assertTrue(EmailGate.allows(true, true, false, true, "OFF", DUE_REMINDER));

        assertFalse(EmailGate.allows(true, true, true, false, "OFF", PAYMENT_UPDATE));
        assertTrue(EmailGate.allows(true, true, true, false, "OFF", BUDGET_ALERT));
    }

    @Test
    void theSummaryNeedsWeeklyOrMonthly() {
        assertTrue(EmailGate.allows(true, true, true, true, "WEEKLY", SUMMARY));
        assertTrue(EmailGate.allows(true, true, true, true, "MONTHLY", SUMMARY));
        assertTrue(EmailGate.allows(true, true, true, true, "weekly", SUMMARY));
    }

    @Test
    void theSummaryIsOffForNothingBlankOrGarbage() {
        assertFalse(EmailGate.allows(true, true, true, true, null, SUMMARY));
        assertFalse(EmailGate.allows(true, true, true, true, "OFF", SUMMARY));
        assertFalse(EmailGate.allows(true, true, true, true, "  ", SUMMARY));
        assertFalse(EmailGate.allows(true, true, true, true, "DAILY", SUMMARY));
    }

    @Test
    void theSummaryIgnoresTheOtherFlags() {
        assertTrue(EmailGate.allows(true, false, false, false, "WEEKLY", SUMMARY));
    }
}
