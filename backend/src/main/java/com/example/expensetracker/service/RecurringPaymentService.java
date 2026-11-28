package com.example.expensetracker.service;

import com.example.expensetracker.model.Expense;
import com.example.expensetracker.model.RecurringEvent;
import com.example.expensetracker.model.RecurringPayment;
import com.example.expensetracker.repository.ExpenseRepository;
import com.example.expensetracker.repository.RecurringEventRepository;
import com.example.expensetracker.repository.RecurringPaymentRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class RecurringPaymentService {

    private final RecurringPaymentRepository recurringRepository;
    private final ExpenseRepository expenseRepository;
    private final RecurringEventRepository events;

    public RecurringPaymentService(
            RecurringPaymentRepository recurringRepository,
            ExpenseRepository expenseRepository,
            RecurringEventRepository events
    ) {
        this.recurringRepository = recurringRepository;
        this.expenseRepository = expenseRepository;
        this.events = events;
    }

    /** User confirms the payment: log an expense on the due date, then roll to the next occurrence. */
    @Transactional
    public RecurringPayment confirm(RecurringPayment r) {
        Expense e = new Expense();
        e.setAmount(r.getAmount());
        e.setDescription(r.getTitle());
        e.setDate(r.getNextDueDate());
        e.setCategory(r.getCategory());
        e.setUser(r.getUser());
        expenseRepository.save(e);

        r.advance();
        return recurringRepository.save(r);
    }

    /** User skips this occurrence: no expense, just roll forward. */
    @Transactional
    public RecurringPayment skip(RecurringPayment r) {
        events.save(RecurringEvent.of(r.getUser(), r.getId(), r.getTitle(), r.getAmount(), r.getNextDueDate(), RecurringEvent.Action.SKIPPED));
        r.advance();
        return recurringRepository.save(r);
    }

    /**
     * Logs one due occurrence by itself. The occurrence is claimed first with one conditional update; if someone else
     * got it (another run or instance) or the payment was paused or switched to manual meanwhile, nothing is logged
     * and the result is empty. The claim, the expense and the history entry commit together.
     */
    @Transactional
    public java.util.Optional<Expense> autoLogOne(RecurringPayment r, java.time.LocalDate due) {
        java.time.LocalDate next = RecurringPayment.nextAfter(due, r.getIntervalValue(), r.getIntervalUnit(), r.getAnchorDay());
        if (recurringRepository.claimOccurrence(r.getId(), due, next) == 0) return java.util.Optional.empty();

        Expense e = new Expense();
        e.setAmount(r.getAmount());
        e.setDescription(r.getTitle());
        e.setDate(due);
        e.setCategory(r.getCategory());
        e.setUser(r.getUser());
        expenseRepository.save(e);
        events.save(RecurringEvent.of(r.getUser(), r.getId(), r.getTitle(), r.getAmount(), due, RecurringEvent.Action.AUTO_PAID));
        return java.util.Optional.of(e);
    }
}
