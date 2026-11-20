package com.example.expensetracker.service;

import com.example.expensetracker.model.Expense;
import com.example.expensetracker.model.RecurringPayment;
import com.example.expensetracker.repository.ExpenseRepository;
import com.example.expensetracker.repository.RecurringPaymentRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class RecurringPaymentService {

    private final RecurringPaymentRepository recurringRepository;
    private final ExpenseRepository expenseRepository;

    public RecurringPaymentService(
            RecurringPaymentRepository recurringRepository,
            ExpenseRepository expenseRepository
    ) {
        this.recurringRepository = recurringRepository;
        this.expenseRepository = expenseRepository;
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
        r.advance();
        return recurringRepository.save(r);
    }
}
