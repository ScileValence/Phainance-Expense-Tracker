package com.example.expensetracker.service;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayDeque;
import java.util.HashMap;
import java.util.Iterator;
import java.util.Locale;
import java.util.Map;

/**
 * Blocks a login key (for example "username|ip") after too many failed attempts inside a sliding window.
 * An attempt counts while it is younger than the window. Safe to share between request threads.
 *
 * <p>Use {@link #tryAttempt} before checking the password: it checks and counts in one step, so a burst of
 * parallel requests cannot all slip past the limit. Call {@link #recordSuccess} if the password was right.
 */
public class LoginRateLimiter {

    /** Upper bound on remembered keys, so many different usernames cannot exhaust memory. */
    static final int MAX_KEYS = 10_000;

    private final int maxFailures;
    private final Duration window;
    private final Clock clock;
    private final Map<String, ArrayDeque<Instant>> failures = new HashMap<>();
    private Instant lastSweep;

    public LoginRateLimiter(int maxFailures, Duration window, Clock clock) {
        this.maxFailures = maxFailures;
        this.window = window;
        this.clock = clock;
    }

    public synchronized boolean isBlocked(String key) {
        return count(normalize(key)) >= maxFailures;
    }

    public synchronized void recordFailure(String key) {
        sweepIfDue();
        String k = normalize(key);
        ArrayDeque<Instant> times = slot(k);
        if (times == null) return; // table full: new keys go untracked rather than using more memory
        prune(times);
        times.addLast(clock.instant());
    }

    /**
     * Admit one attempt, counting it now. Returns false (and counts nothing) when the key is already
     * blocked. The check and the count happen together, so parallel requests cannot exceed the limit.
     */
    public synchronized boolean tryAttempt(String key) {
        if (isBlocked(key)) return false;
        recordFailure(key);
        return true;
    }

    /** The password was right: forget this key's attempts, including the one that was just admitted. */
    public synchronized void recordSuccess(String key) {
        failures.remove(normalize(key));
    }

    /** Whole seconds until the key is allowed to try again (0 when it is not blocked). */
    public synchronized long retryAfterSeconds(String key) {
        String k = normalize(key);
        if (count(k) < maxFailures) return 0;
        ArrayDeque<Instant> times = failures.get(k);
        // the failure that has to expire for the count to drop below the limit
        Iterator<Instant> it = times.iterator();
        for (int skip = times.size() - maxFailures; skip > 0; skip--) it.next();
        Instant frees = it.next().plus(window);
        long millis = Duration.between(clock.instant(), frees).toMillis();
        return Math.max(1, (millis + 999) / 1000);
    }

    /** For tests: how many keys are currently remembered. */
    synchronized int trackedKeys() {
        return failures.size();
    }

    // the existing entry for a key, a new one if there is room, otherwise null
    private ArrayDeque<Instant> slot(String k) {
        ArrayDeque<Instant> existing = failures.get(k);
        if (existing != null) return existing;
        if (failures.size() >= MAX_KEYS) sweep(clock.instant()); // make room by dropping expired keys
        if (failures.size() >= MAX_KEYS) return null;
        ArrayDeque<Instant> created = new ArrayDeque<>();
        failures.put(k, created);
        return created;
    }

    private int count(String k) {
        ArrayDeque<Instant> times = failures.get(k);
        if (times == null) return 0;
        prune(times);
        if (times.isEmpty()) {
            failures.remove(k);
            return 0;
        }
        return times.size();
    }

    private void prune(ArrayDeque<Instant> times) {
        Instant now = clock.instant();
        while (!times.isEmpty() && !times.peekFirst().plus(window).isAfter(now)) times.pollFirst();
    }

    // forget keys whose failures have all expired, at most once per window, so the map cannot grow forever
    private void sweepIfDue() {
        Instant now = clock.instant();
        if (lastSweep != null && now.isBefore(lastSweep.plus(window))) return;
        sweep(now);
    }

    private void sweep(Instant now) {
        lastSweep = now;
        failures.entrySet().removeIf(e -> {
            prune(e.getValue());
            return e.getValue().isEmpty();
        });
    }

    private static String normalize(String key) {
        return key == null ? "" : key.trim().toLowerCase(Locale.ROOT);
    }
}
