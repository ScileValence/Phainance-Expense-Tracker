package com.example.expensetracker.service;

/** Decides whether a person may receive a given kind of email. */
public final class EmailGate {

    private EmailGate() {}

    /**
     * @param verified         the address has been confirmed
     * @param dueReminders     flag for due reminders (null means on)
     * @param budgetAlerts     flag for budget alerts (null means on)
     * @param paymentUpdates   flag for payment updates (null means on)
     * @param summaryFrequency OFF / WEEKLY / MONTHLY (null, blank or anything else means off)
     */
    public static boolean allows(boolean verified, Boolean dueReminders, Boolean budgetAlerts,
                                 Boolean paymentUpdates, String summaryFrequency, EmailKind kind) {
        if (!verified) return false;
        return switch (kind) {
            case DUE_REMINDER -> on(dueReminders);
            case BUDGET_ALERT -> on(budgetAlerts);
            case PAYMENT_UPDATE -> on(paymentUpdates);
            case SUMMARY -> summaryFrequency != null
                    && ("WEEKLY".equalsIgnoreCase(summaryFrequency.trim()) || "MONTHLY".equalsIgnoreCase(summaryFrequency.trim()));
        };
    }

    private static boolean on(Boolean flag) {
        return flag == null || flag;
    }
}
