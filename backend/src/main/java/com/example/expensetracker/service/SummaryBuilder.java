package com.example.expensetracker.service;

import java.time.LocalDate;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** The numbers behind a summary email: totals, top categories, change versus the period before, biggest expense. */
public final class SummaryBuilder {

    public record Line(String category, String description, LocalDate date, double amount) {}

    public record CategoryShare(String name, double amount, int percent) {}

    /** {@code changePercent} is null when the previous period had no spending; {@code biggest} is null when there is none. */
    public record Summary(double total, double previousTotal, Integer changePercent, int count,
                          List<CategoryShare> top, Line biggest) {}

    private SummaryBuilder() {}

    public static Summary build(List<Line> current, List<Line> previous, int topN) {
        double total = sum(current);
        double previousTotal = sum(previous);

        Map<String, Double> byCategory = new LinkedHashMap<>();
        for (Line l : current) {
            String name = (l.category() == null || l.category().isBlank()) ? "Uncategorized" : l.category();
            byCategory.merge(name, l.amount(), Double::sum);
        }

        List<CategoryShare> top = byCategory.entrySet().stream()
                .sorted(Comparator.<Map.Entry<String, Double>>comparingDouble(Map.Entry::getValue).reversed()
                        .thenComparing(e -> e.getKey().toLowerCase()))
                .limit(Math.max(0, topN))
                .map(e -> new CategoryShare(e.getKey(), e.getValue(), total > 0 ? (int) Math.round(e.getValue() / total * 100.0) : 0))
                .toList();

        Integer change = previousTotal > 0 ? (int) Math.round((total - previousTotal) / previousTotal * 100.0) : null;

        Line biggest = current.stream()
                .max(Comparator.comparingDouble(Line::amount).thenComparing(Line::date))
                .orElse(null);

        return new Summary(total, previousTotal, change, current.size(), top, biggest);
    }

    private static double sum(List<Line> lines) {
        double s = 0;
        for (Line l : lines) s += l.amount();
        return s;
    }
}
