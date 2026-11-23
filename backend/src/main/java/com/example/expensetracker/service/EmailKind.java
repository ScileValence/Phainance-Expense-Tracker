package com.example.expensetracker.service;

/** The kinds of email a person can switch on or off. */
public enum EmailKind {
    /** "Rent is due" at the due time. */
    DUE_REMINDER,
    /** Paused, stopped, resumed, skipped, paid and edited. */
    PAYMENT_UPDATE,
    /** 80% / 100% of a budget. */
    BUDGET_ALERT,
    /** The weekly or monthly summary. */
    SUMMARY
}
