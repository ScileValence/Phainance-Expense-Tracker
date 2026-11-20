package com.example.expensetracker.config;

import com.example.expensetracker.model.Category;
import com.example.expensetracker.repository.CategoryRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
public class DataLoader implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(DataLoader.class);

    // lowest id per category name (ignoring case and surrounding spaces) = the row we keep
    private static final String KEEP =
            "(SELECT MIN(id) AS keep_id, LOWER(TRIM(name)) AS n FROM categories GROUP BY LOWER(TRIM(name)))";

    private final CategoryRepository categoryRepository;
    private final JdbcTemplate jdbc;

    public DataLoader(CategoryRepository categoryRepository, JdbcTemplate jdbc) {
        this.categoryRepository = categoryRepository;
        this.jdbc = jdbc;
    }

    @Override
    public void run(String... args) {
        mergeDuplicateCategories();

        List<String> defaultCategories = List.of(
                "Food", "Rent", "Utilities", "Entertainment", "Other"
        );

        for (String name : defaultCategories) {
            if (!categoryRepository.existsByName(name)) {
                categoryRepository.save(new Category(name));
            }
        }
    }

    /**
     * Older databases can hold the same category more than once. Keep the lowest id per name,
     * point every expense / recurring payment at it, then delete the extra rows. Safe to run on every start.
     */
    private void mergeDuplicateCategories() {
        try {
            Integer extra = jdbc.queryForObject(
                    "SELECT COUNT(*) - COUNT(DISTINCT LOWER(TRIM(name))) FROM categories WHERE name IS NOT NULL", Integer.class);
            if (extra == null || extra <= 0) return;

            for (String table : List.of("expenses", "recurring_payments")) {
                jdbc.update("UPDATE " + table + " t JOIN categories c ON t.category_id = c.id "
                        + "JOIN " + KEEP + " k ON k.n = LOWER(TRIM(c.name)) "
                        + "SET t.category_id = k.keep_id WHERE t.category_id <> k.keep_id");
            }
            int removed = jdbc.update("DELETE c FROM categories c JOIN " + KEEP + " k ON k.n = LOWER(TRIM(c.name)) "
                    + "WHERE c.id <> k.keep_id");
            log.info("Merged duplicate categories: removed {} extra rows", removed);
        } catch (Exception e) {
            log.warn("Could not merge duplicate categories automatically ({}). Run database/fix_duplicate_categories.sql instead.", e.getMessage());
        }
    }
}
