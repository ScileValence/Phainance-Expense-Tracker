package com.example.expensetracker.service;

import org.springframework.web.util.HtmlUtils;

import java.util.List;
import java.util.Map;

/** Branded HTML + plain-text email bodies. Inline CSS and tables only, so they render in Gmail/Outlook/Apple Mail. */
public final class EmailTemplates {

    private EmailTemplates() {}

    public record Email(String subject, String text, String html) {}

    private static final String INK = "#15161A";
    private static final String LIME = "#C8F23C";
    private static final String PAPER = "#F2F0EA";
    private static final String MUTED = "#6C6F7A";
    private static final String LINE = "#E7E4DB";

    // ---------- public builders ----------

    /** Sent at the due time of a recurring payment. */
    public static Email paymentDue(
            String appUrl, String username, String title, String amount,
            String category, String when, String schedule, String nextDate
    ) {
        String subject = title + " is due — " + amount;

        String text = "Hi " + username + ",\n\n"
                + "Your " + title + " payment of " + amount + " is due now (" + when + ").\n"
                + (category == null ? "" : "Category: " + category + "\n")
                + schedule + ".\n\n"
                + "Paid it? Open Phainance and tap \"Mark as paid\". We'll log it as an expense and move the next reminder to "
                + nextDate + ". Not paying this time? You can skip it from the same screen.\n\n"
                + appUrl + "/recurring\n\n"
                + "You're getting this because email reminders are on for your Phainance account. "
                + "Turn them off in Recurring > Reminder alerts.\n\n— Phainance";

        String rows = row("Due", esc(when))
                + (category == null ? "" : row("Category", esc(category)))
                + row("Repeats", esc(schedule))
                + row("Next reminder", esc(nextDate) + " <span style=\"color:" + MUTED + ";\">(after you mark this paid)</span>");

        String body = "<p style=\"margin:0 0 6px;font-size:13px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:" + MUTED + ";\">Payment due now</p>"
                + "<h1 style=\"margin:0 0 4px;font-size:26px;line-height:1.2;color:" + INK + ";\">" + esc(title) + "</h1>"
                + "<p style=\"margin:0 0 22px;font-size:40px;font-weight:700;letter-spacing:-0.03em;color:" + INK + ";\">" + esc(amount) + "</p>"
                + "<p style=\"margin:0 0 20px;font-size:15px;line-height:1.6;color:" + INK + ";\">Hi " + esc(username) + ", it's time to pay <strong>"
                + esc(title) + "</strong>. Once you've paid, tap <strong>Mark as paid</strong> and we'll log it as an expense and schedule the next reminder for you.</p>"
                + "<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"margin:0 0 26px;border-top:1px solid " + LINE + ";\">" + rows + "</table>"
                + button(appUrl + "/recurring", "Review &amp; mark as paid")
                + "<p style=\"margin:22px 0 0;font-size:13px;line-height:1.6;color:" + MUTED + ";\">Not paying this time? Open the app and choose <strong>Skip</strong> and we'll roll to the next date without logging an expense.</p>";

        String footer = "You're getting this because email reminders are on for your Phainance account. "
                + "Turn them off in <a href=\"" + esc(appUrl) + "/recurring\" style=\"color:" + MUTED + ";\">Recurring &rarr; Reminder alerts</a>.";

        return new Email(subject, text, layout("Payment due: " + title, body, footer));
    }

    /** Sent when a recurring payment is paused. */
    public static Email paymentPaused(
            String appUrl, String username, String title, String amount,
            String category, String schedule, String nextDate
    ) {
        String subject = title + " was paused";

        String text = "Hi " + username + ",\n\n"
                + "Your " + title + " payment of " + amount + " is now paused. We won't send reminders for it until you resume it.\n"
                + (category == null ? "" : "Category: " + category + "\n")
                + schedule + ".\n"
                + (nextDate == null || nextDate.isBlank() ? "" : "Next due: " + nextDate + " (kept while paused).\n")
                + "\nResume it any time from Recurring in Phainance:\n" + appUrl + "/recurring\n\n"
                + "You're getting this because email reminders are on for your Phainance account. "
                + "Turn them off in Recurring > Reminder alerts.\n\n— Phainance";

        String rows = row("Status", statusPill("Paused", "#FFF1D6", "#8A5A00"))
                + (category == null ? "" : row("Category", esc(category)))
                + row("Repeats", esc(schedule))
                + (nextDate == null || nextDate.isBlank() ? "" : row("Next due", esc(nextDate) + " <span style=\"color:" + MUTED + ";\">(kept while paused)</span>"));

        String body = "<p style=\"margin:0 0 6px;font-size:13px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:" + MUTED + ";\">Payment paused</p>"
                + "<h1 style=\"margin:0 0 4px;font-size:26px;line-height:1.2;color:" + INK + ";\">" + esc(title) + "</h1>"
                + "<p style=\"margin:0 0 22px;font-size:40px;font-weight:700;letter-spacing:-0.03em;color:" + INK + ";\">" + esc(amount) + "</p>"
                + "<p style=\"margin:0 0 20px;font-size:15px;line-height:1.6;color:" + INK + ";\">Hi " + esc(username) + ", <strong>"
                + esc(title) + "</strong> is now paused. We won't remind you about it, and it won't count towards your monthly total, until you resume it.</p>"
                + "<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"margin:0 0 26px;border-top:1px solid " + LINE + ";\">" + rows + "</table>"
                + button(appUrl + "/recurring", "Resume payment")
                + "<p style=\"margin:22px 0 0;font-size:13px;line-height:1.6;color:" + MUTED + ";\">Didn't pause this? Open the app and tap <strong>Resume</strong> on the payment.</p>";

        return new Email(subject, text, layout("Payment paused: " + title, body, reminderFooter(appUrl)));
    }

    /** Sent when a recurring payment is stopped (deleted). */
    public static Email paymentStopped(
            String appUrl, String username, String title, String amount,
            String category, String schedule, String lastDate
    ) {
        String subject = title + " was stopped";

        String text = "Hi " + username + ",\n\n"
                + "Your " + title + " payment of " + amount + " has been stopped and removed. You won't get any more reminders for it.\n"
                + (category == null ? "" : "Category: " + category + "\n")
                + schedule + ".\n"
                + (lastDate == null || lastDate.isBlank() ? "" : "Last scheduled for: " + lastDate + ".\n")
                + "\nExpenses you already logged stay in your history. Stopped by mistake? Add it again in Recurring > New payment:\n"
                + appUrl + "/recurring\n\n"
                + "You're getting this because email reminders are on for your Phainance account. "
                + "Turn them off in Recurring > Reminder alerts.\n\n— Phainance";

        String rows = row("Status", statusPill("Stopped", "#FFE3DC", "#B23A1E"))
                + (category == null ? "" : row("Category", esc(category)))
                + row("Repeated", esc(schedule))
                + (lastDate == null || lastDate.isBlank() ? "" : row("Last scheduled", esc(lastDate)));

        String body = "<p style=\"margin:0 0 6px;font-size:13px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:" + MUTED + ";\">Payment stopped</p>"
                + "<h1 style=\"margin:0 0 4px;font-size:26px;line-height:1.2;color:" + INK + ";\">" + esc(title) + "</h1>"
                + "<p style=\"margin:0 0 22px;font-size:40px;font-weight:700;letter-spacing:-0.03em;color:" + INK + ";\">" + esc(amount) + "</p>"
                + "<p style=\"margin:0 0 20px;font-size:15px;line-height:1.6;color:" + INK + ";\">Hi " + esc(username) + ", <strong>"
                + esc(title) + "</strong> has been stopped and removed. You won't get any more reminders for it. Expenses you already logged stay in your history.</p>"
                + "<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"margin:0 0 26px;border-top:1px solid " + LINE + ";\">" + rows + "</table>"
                + button(appUrl + "/recurring", "Open Phainance")
                + "<p style=\"margin:22px 0 0;font-size:13px;line-height:1.6;color:" + MUTED + ";\">Stopped by mistake? Add it again from <strong>Recurring &rarr; New payment</strong>.</p>";

        return new Email(subject, text, layout("Payment stopped: " + title, body, reminderFooter(appUrl)));
    }

    /** Sent when a paused recurring payment is resumed. */
    public static Email paymentResumed(
            String appUrl, String username, String title, String amount,
            String category, String schedule, String nextDate
    ) {
        String rows = row("Status", statusPill("Active", "#DDF5E9", "#0E7A53"))
                + (category == null ? "" : row("Category", esc(category)))
                + row("Repeats", esc(schedule))
                + (blank(nextDate) ? "" : row("Next due", esc(nextDate)));
        String text = "Your " + title + " payment of " + amount + " is active again, so reminders are back on.\n"
                + (category == null ? "" : "Category: " + category + "\n")
                + schedule + ".\n"
                + (blank(nextDate) ? "" : "Next due: " + nextDate + ".");
        return compose(appUrl, username, title + " was resumed", "Payment resumed", title, amount,
                "<strong>" + esc(title) + "</strong> is active again, so we'll send reminders for it at the due time.",
                text, rows, "Open Phainance",
                "Didn't resume this? Open the app and tap <strong>Pause</strong> on the payment.");
    }

    /** Sent when a recurring payment is marked as paid (an expense is logged). */
    public static Email paymentPaid(
            String appUrl, String username, String title, String amount,
            String category, String schedule, String paidDate, String nextDate
    ) {
        String rows = row("Status", statusPill("Paid", "#DDF5E9", "#0E7A53"))
                + (blank(paidDate) ? "" : row("Paid on", esc(paidDate)))
                + (category == null ? "" : row("Category", esc(category)))
                + row("Expense", "Logged")
                + (blank(nextDate) ? "" : row("Next due", esc(nextDate)))
                + row("Repeats", esc(schedule));
        String text = title + " (" + amount + ") was marked as paid and logged as an expense.\n"
                + (blank(paidDate) ? "" : "Paid on: " + paidDate + "\n")
                + (category == null ? "" : "Category: " + category + "\n")
                + (blank(nextDate) ? "" : "Next due: " + nextDate + "\n")
                + schedule + ".";
        return compose(appUrl, username, title + " was paid", "Payment recorded", title, amount,
                "<strong>" + esc(title) + "</strong> was marked as paid. We logged it as an expense and moved the next reminder forward.",
                text, rows, "Open Phainance",
                "Marked paid by mistake? Open <strong>Expenses</strong> in the app and delete the entry.");
    }

    /** Sent when one occurrence of a recurring payment is skipped. */
    public static Email paymentSkipped(
            String appUrl, String username, String title, String amount,
            String category, String schedule, String skippedDate, String nextDate
    ) {
        String rows = row("Status", statusPill("Skipped", "#E4EAFF", "#3B4FB8"))
                + (blank(skippedDate) ? "" : row("Skipped", esc(skippedDate)))
                + (blank(nextDate) ? "" : row("Next due", esc(nextDate)))
                + (category == null ? "" : row("Category", esc(category)))
                + row("Repeats", esc(schedule))
                + row("Expense", "Not logged");
        String text = "You skipped this occurrence of " + title + " (" + amount + "). No expense was logged.\n"
                + (blank(skippedDate) ? "" : "Skipped: " + skippedDate + "\n")
                + (blank(nextDate) ? "" : "Next due: " + nextDate + "\n")
                + schedule + ".";
        return compose(appUrl, username, title + " was skipped", "Payment skipped", title, amount,
                "You skipped this occurrence of <strong>" + esc(title) + "</strong>. We rolled it to the next date and didn't log an expense.",
                text, rows, "Open Phainance",
                "Paid it after all? Add it from <strong>Add</strong> in the app and it will count towards your spending.");
    }

    /** Sent when a recurring payment is edited. Each change is {label, before, after}. */
    public static Email paymentEdited(
            String appUrl, String username, String title, String amount, List<String[]> changes
    ) {
        StringBuilder rows = new StringBuilder(row("Status", statusPill("Updated", "#EDE9FF", "#4B3FC4")));
        StringBuilder textChanges = new StringBuilder();
        for (String[] c : changes) {
            rows.append(row(esc(c[0]), "<span style=\"color:" + MUTED + ";text-decoration:line-through;font-weight:400;\">" + esc(c[1])
                    + "</span> &rarr; " + esc(c[2])));
            textChanges.append(c[0]).append(": ").append(c[1]).append(" -> ").append(c[2]).append("\n");
        }
        String text = "Your " + title + " payment was updated.\n\n" + textChanges.toString().trim();
        return compose(appUrl, username, title + " was updated", "Payment updated", title, amount,
                "Your <strong>" + esc(title) + "</strong> payment was updated. Here's what changed:",
                text, rows.toString(), "Review payment",
                "Didn't make this change? Open the app and edit the payment from <strong>Recurring</strong>.");
    }

    /** Sent right after sign-up (and on "resend"). */
    public static Email verifyEmail(String username, String link) {
        String subject = "Confirm your email for Phainance";

        String text = "Hi " + username + ",\n\nWelcome to Phainance! Confirm your email address so we can send you payment reminders:\n\n"
                + link + "\n\nThis link works for 24 hours. If you didn't create an account, you can ignore this email.\n\n— Phainance";

        String body = "<h1 style=\"margin:0 0 12px;font-size:26px;line-height:1.2;color:" + INK + ";\">Confirm your email</h1>"
                + "<p style=\"margin:0 0 22px;font-size:15px;line-height:1.6;color:" + INK + ";\">Hi " + esc(username)
                + ", welcome to Phainance! Confirm this address so we can email you recurring-payment reminders at the exact time they're due.</p>"
                + button(link, "Verify my email")
                + "<p style=\"margin:22px 0 0;font-size:13px;line-height:1.6;color:" + MUTED + ";\">Button not working? Paste this link into your browser:<br>"
                + "<a href=\"" + esc(link) + "\" style=\"color:" + MUTED + ";word-break:break-all;\">" + esc(link) + "</a></p>";

        String footer = "This link works for 24 hours. If you didn't create a Phainance account, you can safely ignore this email.";
        return new Email(subject, text, layout("Confirm your email", body, footer));
    }

    /** Sent by the "Send test" button. */
    public static Email test(String appUrl, String username) {
        String subject = "Phainance test reminder";
        String text = "Hi " + username + ",\n\nThis is a test reminder. Email reminders are working.\n\n" + appUrl + "/recurring\n\n— Phainance";
        String body = "<h1 style=\"margin:0 0 12px;font-size:26px;line-height:1.2;color:" + INK + ";\">Email reminders are working</h1>"
                + "<p style=\"margin:0 0 22px;font-size:15px;line-height:1.6;color:" + INK + ";\">Hi " + esc(username)
                + ", this is a test. Your recurring-payment reminders will look like this, sent at the due time you set.</p>"
                + button(appUrl + "/recurring", "Open Phainance");
        return new Email(subject, text, layout("Test reminder", body,
                "Sent because you clicked <strong>Send test</strong> in Phainance."));
    }

    // ---------- helpers ----------

    private static String esc(String s) {
        return HtmlUtils.htmlEscape(s == null ? "" : s);
    }

    private static String row(String label, String value) {
        return "<tr><td style=\"padding:12px 0;border-bottom:1px solid " + LINE + ";font-size:13px;color:" + MUTED + ";width:120px;\">" + label + "</td>"
                + "<td style=\"padding:12px 0;border-bottom:1px solid " + LINE + ";font-size:15px;font-weight:600;color:" + INK + ";\">" + value + "</td></tr>";
    }

    private static boolean blank(String s) {
        return s == null || s.isBlank();
    }

    /** Shared body for the payment status emails (same layout as the due reminder). */
    private static Email compose(
            String appUrl, String username, String subject, String eyebrow, String title, String amount,
            String introHtml, String textBody, String rowsHtml, String cta, String noteHtml
    ) {
        String text = "Hi " + username + ",\n\n" + textBody + "\n\n" + appUrl + "/recurring\n\n"
                + "You're getting this because email reminders are on for your Phainance account. "
                + "Turn them off in Recurring > Reminder alerts.\n\n— Phainance";

        String body = "<p style=\"margin:0 0 6px;font-size:13px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:" + MUTED + ";\">" + eyebrow + "</p>"
                + "<h1 style=\"margin:0 0 4px;font-size:26px;line-height:1.2;color:" + INK + ";\">" + esc(title) + "</h1>"
                + "<p style=\"margin:0 0 22px;font-size:40px;font-weight:700;letter-spacing:-0.03em;color:" + INK + ";\">" + esc(amount) + "</p>"
                + "<p style=\"margin:0 0 20px;font-size:15px;line-height:1.6;color:" + INK + ";\">Hi " + esc(username) + ", " + introHtml + "</p>"
                + "<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"margin:0 0 26px;border-top:1px solid " + LINE + ";\">" + rowsHtml + "</table>"
                + button(appUrl + "/recurring", cta)
                + "<p style=\"margin:22px 0 0;font-size:13px;line-height:1.6;color:" + MUTED + ";\">" + noteHtml + "</p>";

        return new Email(subject, text, layout(eyebrow + ": " + title, body, reminderFooter(appUrl)));
    }

    private static String statusPill(String label, String bg, String fg) {
        return "<span style=\"display:inline-block;padding:3px 12px;border-radius:999px;background:" + bg + ";color:" + fg
                + ";font-size:13px;font-weight:700;\">" + label + "</span>";
    }

    private static String reminderFooter(String appUrl) {
        return "You're getting this because email reminders are on for your Phainance account. "
                + "Turn them off in <a href=\"" + esc(appUrl) + "/recurring\" style=\"color:" + MUTED + ";\">Recurring &rarr; Reminder alerts</a>.";
    }

    private static String button(String href, String label) {
        return "<table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\"><tr><td style=\"border-radius:999px;background:" + INK + ";\">"
                + "<a href=\"" + esc(href) + "\" style=\"display:inline-block;padding:14px 28px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:999px;\">"
                + label + "</a></td></tr></table>";
    }

    private static String layout(String preheader, String body, String footer) {
        String tpl = "<!DOCTYPE html><html><head><meta charset=\"UTF-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"></head>"
                + "<body style=\"margin:0;padding:0;background:{{paper}};font-family:'Segoe UI',Helvetica,Arial,sans-serif;\">"
                + "<div style=\"display:none;max-height:0;overflow:hidden;opacity:0;\">{{pre}}</div>"
                + "<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"background:{{paper}};\"><tr><td align=\"center\" style=\"padding:32px 16px;\">"
                + "<table role=\"presentation\" width=\"560\" cellpadding=\"0\" cellspacing=\"0\" style=\"max-width:560px;width:100%;\">"
                // header
                + "<tr><td style=\"background:{{ink}};border-radius:20px 20px 0 0;padding:22px 32px;\">"
                + "<table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\"><tr>"
                + "<td style=\"width:34px;height:34px;background:{{lime}};border-radius:10px;text-align:center;font-size:20px;font-weight:700;color:{{ink}};\">p</td>"
                + "<td style=\"padding-left:10px;font-size:20px;font-weight:600;letter-spacing:-0.02em;color:#ffffff;\">phainance</td>"
                + "</tr></table></td></tr>"
                // body
                + "<tr><td style=\"background:#ffffff;border-radius:0 0 20px 20px;padding:32px;\">{{body}}</td></tr>"
                // footer
                + "<tr><td style=\"padding:20px 12px 0;text-align:center;font-size:12px;line-height:1.6;color:{{muted}};\">{{footer}}</td></tr>"
                + "</table></td></tr></table></body></html>";

        Map<String, String> v = Map.of(
                "{{paper}}", PAPER, "{{ink}}", INK, "{{lime}}", LIME, "{{muted}}", MUTED,
                "{{pre}}", esc(preheader), "{{body}}", body, "{{footer}}", footer);
        for (Map.Entry<String, String> e : v.entrySet()) {
            tpl = tpl.replace(e.getKey(), e.getValue());
        }
        return tpl;
    }
}
