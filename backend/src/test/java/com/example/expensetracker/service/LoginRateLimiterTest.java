package com.example.expensetracker.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import org.junit.jupiter.api.Test;

class LoginRateLimiterTest {

    /** Clock the test can move forward. */
    static final class MutableClock extends Clock {
        private Instant now = Instant.parse("2026-01-01T00:00:00Z");
        void advance(Duration d) { now = now.plus(d); }
        @Override public ZoneId getZone() { return ZoneOffset.UTC; }
        @Override public Clock withZone(ZoneId zone) { return this; }
        @Override public Instant instant() { return now; }
    }

    private final MutableClock clock = new MutableClock();
    private final LoginRateLimiter limiter = new LoginRateLimiter(5, Duration.ofMinutes(15), clock);

    private void fail(String key, int times) {
        for (int i = 0; i < times; i++) limiter.recordFailure(key);
    }

    @Test
    void allowsFourFailuresThenBlocksOnTheFifth() {
        fail("asha|1.1.1.1", 4);
        assertFalse(limiter.isBlocked("asha|1.1.1.1"));
        limiter.recordFailure("asha|1.1.1.1");
        assertTrue(limiter.isBlocked("asha|1.1.1.1"));
    }

    @Test
    void unblocksOnceTheOldestFailureLeavesTheWindow() {
        fail("asha", 5);
        clock.advance(Duration.ofSeconds(899));
        assertTrue(limiter.isBlocked("asha"));
        clock.advance(Duration.ofSeconds(1));
        assertFalse(limiter.isBlocked("asha"));
    }

    @Test
    void retryAfterCountsDownToWhenTheOldestFailureExpires() {
        fail("asha", 4);
        clock.advance(Duration.ofSeconds(60));
        limiter.recordFailure("asha");
        assertTrue(limiter.isBlocked("asha"));
        assertEquals(840L, limiter.retryAfterSeconds("asha"));
        clock.advance(Duration.ofSeconds(839));
        assertEquals(1L, limiter.retryAfterSeconds("asha"));
        clock.advance(Duration.ofSeconds(1));
        assertEquals(0L, limiter.retryAfterSeconds("asha"));
        assertFalse(limiter.isBlocked("asha"));
    }

    @Test
    void retryAfterIsZeroWhenNotBlocked() {
        fail("asha", 2);
        assertEquals(0L, limiter.retryAfterSeconds("asha"));
        assertEquals(0L, limiter.retryAfterSeconds("never-seen"));
    }

    @Test
    void successClearsTheFailures() {
        fail("asha", 3);
        limiter.recordSuccess("asha");
        fail("asha", 4);
        assertFalse(limiter.isBlocked("asha"));
    }

    @Test
    void tryAttemptAdmitsFiveAndRefusesTheSixth() {
        for (int i = 0; i < 5; i++) assertTrue(limiter.tryAttempt("asha"));
        assertFalse(limiter.tryAttempt("asha"));
        assertTrue(limiter.isBlocked("asha"));
    }

    @Test
    void successClearsEvenWhenTheLastAdmittedAttemptReachedTheLimit() {
        for (int i = 0; i < 5; i++) assertTrue(limiter.tryAttempt("asha"));
        limiter.recordSuccess("asha"); // the fifth attempt had the right password
        assertTrue(limiter.tryAttempt("asha"));
    }

    @Test
    void refusedAttemptsDoNotExtendTheLockout() {
        for (int i = 0; i < 5; i++) limiter.tryAttempt("asha");
        clock.advance(Duration.ofMinutes(10));
        assertFalse(limiter.tryAttempt("asha")); // refused, must not be counted
        clock.advance(Duration.ofMinutes(5));
        assertTrue(limiter.tryAttempt("asha"));
    }

    @Test
    void parallelAttemptsNeverAdmitMoreThanTheLimit() throws Exception {
        java.util.concurrent.atomic.AtomicInteger admitted = new java.util.concurrent.atomic.AtomicInteger();
        Thread[] workers = new Thread[8];
        for (int t = 0; t < workers.length; t++) {
            workers[t] = new Thread(() -> {
                for (int i = 0; i < 25; i++) if (limiter.tryAttempt("shared")) admitted.incrementAndGet();
            });
            workers[t].start();
        }
        for (Thread w : workers) w.join();
        assertEquals(5, admitted.get());
    }

    @Test
    void trackedKeysAreCappedEvenInsideOneWindow() {
        for (int i = 0; i < LoginRateLimiter.MAX_KEYS * 2; i++) limiter.tryAttempt("user" + i);
        assertTrue(limiter.trackedKeys() <= LoginRateLimiter.MAX_KEYS);
    }

    @Test
    void aKeyAlreadyTrackedStillCountsWhenTheMapIsFull() {
        limiter.tryAttempt("known");
        for (int i = 0; i < LoginRateLimiter.MAX_KEYS * 2; i++) limiter.tryAttempt("user" + i);
        for (int i = 0; i < 4; i++) limiter.tryAttempt("known");
        assertFalse(limiter.tryAttempt("known")); // 5 admitted so far, the sixth is refused
    }

    @Test
    void keysAreIndependent() {
        fail("asha", 5);
        assertTrue(limiter.isBlocked("asha"));
        assertFalse(limiter.isBlocked("ravi"));
    }

    @Test
    void keysIgnoreCaseAndSurroundingSpaces() {
        fail("Asha", 3);
        fail("  asha ", 2);
        assertTrue(limiter.isBlocked("ASHA"));
    }

    @Test
    void manyDistinctKeysDoNotGrowTheMapForever() {
        for (int i = 0; i < 20000; i++) limiter.recordFailure("user" + i);
        clock.advance(Duration.ofMinutes(16));
        limiter.recordFailure("latest");
        assertEquals(1, limiter.trackedKeys());
    }

    @Test
    void concurrentFailuresAreAllCounted() throws Exception {
        LoginRateLimiter big = new LoginRateLimiter(1000, Duration.ofMinutes(15), clock);
        Thread[] workers = new Thread[8];
        for (int t = 0; t < workers.length; t++) {
            workers[t] = new Thread(() -> {
                for (int i = 0; i < 100; i++) big.recordFailure("shared");
            });
            workers[t].start();
        }
        for (Thread w : workers) w.join();
        assertFalse(big.isBlocked("shared")); // 800 recorded, none lost, still under 1000
        for (int i = 0; i < 200; i++) big.recordFailure("shared");
        assertTrue(big.isBlocked("shared"));
    }
}
