package com.example.expensetracker.service;

import com.example.expensetracker.model.User;
import com.example.expensetracker.repository.UserRepository;
import com.example.expensetracker.service.SummaryPlanner.Frequency;
import com.example.expensetracker.service.SummaryPlanner.Period;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.util.List;

/**
 * Once a day (08:00 by default, see app.summary.cron) sends the weekly or monthly summary to everyone whose latest
 * completed period has not been sent yet. Running it twice, or after downtime, never sends a period twice.
 */
@Component
public class SummaryScheduler {

    private static final Logger log = LoggerFactory.getLogger(SummaryScheduler.class);

    private final UserRepository userRepository;
    private final SummaryService summaryService;

    public SummaryScheduler(UserRepository userRepository, SummaryService summaryService) {
        this.userRepository = userRepository;
        this.summaryService = summaryService;
    }

    @Scheduled(cron = "${app.summary.cron:0 0 8 * * *}")
    public void run() {
        runFor(LocalDate.now());
    }

    void runFor(LocalDate today) {
        for (User user : userRepository.findBySummaryFrequencyIn(List.of("WEEKLY", "MONTHLY"))) {
            try {
                Frequency frequency = Frequency.parse(user.getSummaryFrequency());
                if (!SummaryPlanner.due(frequency, today, user.getSummaryLastPeriod())) continue;

                Period period = SummaryPlanner.lastCompleted(frequency, today);
                // claim the period first (one atomic update): a failure, a restart, an overlapping run or a second
                // instance can never produce a second email for it
                if (userRepository.claimSummary(user.getId(), period.end()) == 0) continue;
                summaryService.send(user, frequency, period, true);
            } catch (Exception e) {
                log.warn("Summary for user {} failed: {}", user.getId(), e.getMessage());
            }
        }
    }
}
