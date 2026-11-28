package com.example.expensetracker.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import org.junit.jupiter.api.Test;

class EmailTemplatesTest {

    private static final String APP = "https://app.example.com";

    @Test
    void budgetWarningMentionsPercentAndLinksToBudget() {
        EmailTemplates.Email mail = EmailTemplates.budgetAlert(
                APP, "Asha", "Food budget", "November 2026", "₹6,800.00", "₹8,000.00", "₹1,200.00", 85, false);
        assertEquals("Food budget is at 85%", mail.subject());
        assertTrue(mail.html().contains("85%"));
        assertTrue(mail.html().contains(APP + "/budget"));
        assertTrue(mail.text().contains("Spent ₹6,800.00 of ₹8,000.00"));
    }

    @Test
    void budgetExceededSaysOverBudget() {
        EmailTemplates.Email mail = EmailTemplates.budgetAlert(
                APP, "Asha", "Overall budget", "November 2026", "₹31,000.00", "₹30,000.00", "₹1,000.00", 103, true);
        assertEquals("Overall budget exceeded for November 2026", mail.subject());
        assertTrue(mail.html().contains("Over budget"));
        assertTrue(mail.html().contains("Over by"));
    }

    @Test
    void budgetBarNeverOverflowsPastFullWidth() {
        EmailTemplates.Email mail = EmailTemplates.budgetAlert(
                APP, "Asha", "Food budget", "November 2026", "₹20,000.00", "₹8,000.00", "₹12,000.00", 250, true);
        assertTrue(mail.html().contains("width:100%"));
        assertFalse(mail.html().contains("width:250%"));
    }

    @Test
    void userSuppliedTextIsEscaped() {
        EmailTemplates.Email mail = EmailTemplates.budgetAlert(
                APP, "<b>Asha</b>", "<script>x</script> budget", "November 2026", "₹1.00", "₹2.00", "₹1.00", 50, false);
        assertFalse(mail.html().contains("<script>x</script>"));
        assertFalse(mail.html().contains("<b>Asha</b>"));
    }

    @Test
    void editedEmailListsEachChange() {
        EmailTemplates.Email mail = EmailTemplates.paymentEdited(
                APP, "Asha", "Rent", "₹15,000.00", List.<String[]>of(new String[]{"Amount", "₹12,000.00", "₹15,000.00"}));
        assertTrue(mail.html().contains("Amount"));
        assertTrue(mail.html().contains("₹12,000.00"));
        assertTrue(mail.text().contains("Amount: ₹12,000.00 -> ₹15,000.00"));
    }

    // ---- the five payment status emails ----

    private static final String HOSTILE = "<i>Rent</i>";

    private static java.util.List<EmailTemplates.Email> statusEmails(String title, String category) {
        return java.util.List.of(
                EmailTemplates.paymentPaused(APP, "Asha", title, "₹12,000.00", category, "Repeats every month", "Dec 1, 2026"),
                EmailTemplates.paymentStopped(APP, "Asha", title, "₹12,000.00", category, "Repeated every month", "Dec 1, 2026"),
                EmailTemplates.paymentResumed(APP, "Asha", title, "₹12,000.00", category, "Repeats every month", "Dec 1, 2026"),
                EmailTemplates.paymentSkipped(APP, "Asha", title, "₹12,000.00", category, "Repeats every month", "Nov 1, 2026", "Dec 1, 2026"),
                EmailTemplates.paymentPaid(APP, "Asha", title, "₹12,000.00", category, "Repeats every month", "Nov 1, 2026", "Dec 1, 2026"));
    }

    @Test
    void statusEmailSubjectsNameThePaymentAndWhatHappened() {
        java.util.List<EmailTemplates.Email> mails = statusEmails("Rent", "Housing");
        assertEquals("Rent was paused", mails.get(0).subject());
        assertEquals("Rent was stopped", mails.get(1).subject());
        assertEquals("Rent was resumed", mails.get(2).subject());
        assertEquals("Rent was skipped", mails.get(3).subject());
        assertEquals("Rent was paid", mails.get(4).subject());
    }

    @Test
    void statusEmailsLinkToRecurring() {
        for (EmailTemplates.Email mail : statusEmails("Rent", "Housing")) {
            assertTrue(mail.html().contains(APP + "/recurring"));
            assertTrue(mail.text().contains(APP + "/recurring"));
        }
    }

    @Test
    void statusEmailsEscapeTheTitleAndShowTheAmount() {
        for (EmailTemplates.Email mail : statusEmails(HOSTILE, "Housing")) {
            assertFalse(mail.html().contains(HOSTILE));
            assertTrue(mail.html().contains("&lt;i&gt;Rent&lt;/i&gt;"));
            assertTrue(mail.text().contains("₹12,000.00"));
        }
    }

    @Test
    void statusEmailsLeaveOutTheCategoryRowWhenThereIsNone() {
        for (EmailTemplates.Email mail : statusEmails("Rent", null)) {
            assertFalse(mail.html().contains(">Category<"));
            assertFalse(mail.text().contains("Category:"));
        }
        for (EmailTemplates.Email mail : statusEmails("Rent", "Housing")) {
            assertTrue(mail.html().contains("Housing"));
        }
    }

    // ---- weekly / monthly summary ----

    private static EmailTemplates.SummaryData summary(String change, String biggest, String budget, int count) {
        return new EmailTemplates.SummaryData("Weekly", "Nov 16 to Nov 22", "₹14,200.00", change, true, count,
                count == 0 ? List.<String[]>of()
                        : List.<String[]>of(new String[]{"Food", "₹9,200.00", "65"}, new String[]{"Rent", "₹5,000.00", "35"}),
                biggest, budget,
                List.<String[]>of(new String[]{"Netflix", "₹649.00", "Nov 25"}, new String[]{"<b>Gym</b>", "₹1,500.00", "Nov 27"}));
    }

    @Test
    void summarySubjectNamesTheKindAndThePeriod() {
        EmailTemplates.Email mail = EmailTemplates.summary(APP, "Asha", summary(null, null, null, 4));
        assertEquals("Your weekly summary: Nov 16 to Nov 22", mail.subject());
    }

    @Test
    void summaryShowsTotalTopCategoriesAndWhatIsDue() {
        EmailTemplates.Email mail = EmailTemplates.summary(APP, "Asha", summary(null, null, null, 4));
        assertTrue(mail.html().contains("₹14,200.00"));
        assertTrue(mail.html().contains("Top categories"));
        assertTrue(mail.html().contains("Food"));
        assertTrue(mail.html().contains("65%"));
        assertTrue(mail.html().contains("Netflix"));
        assertTrue(mail.html().contains(APP + "/dashboard"));
        assertTrue(mail.text().contains("₹14,200.00"));
        assertTrue(mail.text().contains("Nov 16 to Nov 22"));
    }

    @Test
    void summaryShowsTheChangeOnlyWhenThereIsOne() {
        assertTrue(EmailTemplates.summary(APP, "Asha", summary("12% more than the week before", null, null, 4)).html().contains("12% more than the week before"));
        assertFalse(EmailTemplates.summary(APP, "Asha", summary(null, null, null, 4)).html().contains("than the week before"));
    }

    @Test
    void summaryShowsBiggestAndBudgetOnlyWhenGiven() {
        EmailTemplates.Email with = EmailTemplates.summary(APP, "Asha", summary(null, "Rent ₹5,000.00", "78% of your ₹30,000.00 budget", 4));
        assertTrue(with.html().contains("Rent ₹5,000.00"));
        assertTrue(with.html().contains("78% of your ₹30,000.00 budget"));
        EmailTemplates.Email without = EmailTemplates.summary(APP, "Asha", summary(null, null, null, 4));
        assertFalse(without.html().contains(">Biggest<"));
        assertFalse(without.html().contains(">Budget<"));
    }

    @Test
    void summaryEscapesNamesAndTitles() {
        EmailTemplates.Email mail = EmailTemplates.summary(APP, "<i>Asha</i>", summary(null, null, null, 4));
        assertFalse(mail.html().contains("<b>Gym</b>"));
        assertTrue(mail.html().contains("&lt;b&gt;Gym&lt;/b&gt;"));
        assertFalse(mail.html().contains("<i>Asha</i>"));
    }

    @Test
    void aSummaryWithNoSpendingSaysSoAndSkipsTheCategories() {
        EmailTemplates.Email mail = EmailTemplates.summary(APP, "Asha", summary(null, null, null, 0));
        assertTrue(mail.html().contains("No spending recorded"));
        assertFalse(mail.html().contains("Top categories"));
        assertTrue(mail.text().contains("No spending recorded"));
    }

    @Test
    void budgetAlertTextAlsoLinksToTheBudgetPage() {
        EmailTemplates.Email mail = EmailTemplates.budgetAlert(
                APP, "Asha", "Food budget", "November 2026", "₹6,800.00", "₹8,000.00", "₹1,200.00", 85, false);
        assertTrue(mail.text().contains(APP + "/budget"));
        assertFalse(mail.text().contains("/recurring"));
    }

    // ---- automatically logged payments ----

    @Test
    void autoLoggedSubjectNamesThePayment() {
        EmailTemplates.Email mail = EmailTemplates.paymentAutoLogged(APP, "Asha", "Rent", "₹12,000.00", "Housing",
                "Repeats every month", List.of("Nov 1"), "Dec 1");
        assertEquals("Rent was logged", mail.subject());
    }

    @Test
    void autoLoggedListsTheDatesAndLinksToTheExpenses() {
        EmailTemplates.Email mail = EmailTemplates.paymentAutoLogged(APP, "Asha", "Rent", "₹12,000.00", "Housing",
                "Repeats every month", List.of("Oct 1", "Nov 1"), "Dec 1");
        assertTrue(mail.html().contains("Oct 1, Nov 1"));
        assertTrue(mail.html().contains("2 occurrences"));
        assertTrue(mail.html().contains(APP + "/list"));
        assertTrue(mail.text().contains(APP + "/list"));
        assertTrue(mail.text().contains("Oct 1, Nov 1"));
    }

    @Test
    void autoLoggedWithOneDateDoesNotTalkAboutOccurrences() {
        EmailTemplates.Email mail = EmailTemplates.paymentAutoLogged(APP, "Asha", "Rent", "₹12,000.00", null,
                "Repeats every month", List.of("Nov 1"), "Dec 1");
        assertFalse(mail.html().contains("occurrences"));
        assertFalse(mail.html().contains(">Category<"));
    }

    @Test
    void autoLoggedEscapesTheTitle() {
        EmailTemplates.Email mail = EmailTemplates.paymentAutoLogged(APP, "Asha", "<i>Rent</i>", "₹1.00", null,
                "Repeats every month", List.of("Nov 1"), "Dec 1");
        assertFalse(mail.html().contains("<i>Rent</i>"));
        assertTrue(mail.html().contains("&lt;i&gt;Rent&lt;/i&gt;"));
    }

    // ---- footers say where each kind of email is switched off ----

    @Test
    void paymentEmailsPointToTheEmailsSettings() {
        EmailTemplates.Email paused = EmailTemplates.paymentPaused(APP, "Asha", "Rent", "₹1.00", null, "Repeats every month", "Dec 1");
        assertTrue(paused.text().contains("payment updates"));
        assertTrue(paused.text().contains("Settings > Emails"));
        assertFalse(paused.text().contains("Reminder alerts"));
        assertFalse(paused.html().contains("Reminder alerts"));
    }

    @Test
    void budgetEmailsSayBudgetAlerts() {
        EmailTemplates.Email mail = EmailTemplates.budgetAlert(APP, "Asha", "Food budget", "November 2026", "₹1.00", "₹2.00", "₹1.00", 50, false);
        assertTrue(mail.text().contains("budget alerts"));
        assertTrue(mail.text().contains("Settings > Emails"));
        assertFalse(mail.text().contains("Reminder alerts"));
    }

    @Test
    void theDueReminderKeepsItsOwnFooter() {
        EmailTemplates.Email due = EmailTemplates.paymentDue(APP, "Asha", "Rent", "₹1.00", null, "Nov 21, 9:00 AM (UTC)", "Repeats every month", "Dec 21");
        assertTrue(due.text().contains("Reminder alerts") || due.html().contains("Reminder alerts"));
    }
}
