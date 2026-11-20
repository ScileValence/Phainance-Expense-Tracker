package com.example.expensetracker.service;

import org.springframework.web.util.HtmlUtils;

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
