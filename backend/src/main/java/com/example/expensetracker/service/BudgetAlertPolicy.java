package com.example.expensetracker.service;

/**
 * When should a budget alert fire? Only when spending crosses a threshold on the way up,
 * so adding more after you are already over the limit does not repeat the alert.
 */
public final class BudgetAlertPolicy {

    public enum Level { NONE, WARNING, EXCEEDED }

    /** Share of the limit at which the warning is sent. */
    public static final double WARN_AT = 0.8;

    private static final double EPS = 1e-9;

    private BudgetAlertPolicy() {}

    public static Level crossed(double before, double after, double limit) {
        if (limit <= 0 || after <= before) return Level.NONE;

        boolean wasUnderLimit = before + EPS < limit;
        if (wasUnderLimit && after + EPS >= limit) return Level.EXCEEDED;

        double warnLine = limit * WARN_AT;
        boolean wasUnderWarn = before + EPS < warnLine;
        if (wasUnderWarn && after + EPS >= warnLine) return Level.WARNING;

        return Level.NONE;
    }

    public static int percent(double spent, double limit) {
        return limit <= 0 ? 0 : (int) Math.round(spent / limit * 100.0);
    }
}
