package com.cricketlegend.service.support.schedule;

import java.util.Collection;
import java.util.List;

/** The one rule for naming schedule rows in message text: file rows are "Row 14", added rows (spec 125) "New 1". */
public final class ScheduleRows {

    /** Row numbers above this belong to rows added in the wizard. */
    public static final int ADDED_ROW_BASE = 1000;

    private ScheduleRows() {}

    public static String label(int rowNumber) {
        return rowNumber > ADDED_ROW_BASE ? "New " + (rowNumber - ADDED_ROW_BASE) : "Row " + rowNumber;
    }

    /** "Row 3", "Row 3 and New 1", "Row 3, New 1 and New 2"; an all-file list reads "rows 3 and 7". */
    public static String labels(Collection<Integer> rowNumbers) {
        List<Integer> sorted = rowNumbers.stream().distinct().sorted().toList();
        boolean allFile = sorted.stream().allMatch(n -> n <= ADDED_ROW_BASE);
        List<String> parts = sorted.stream().map(n -> allFile ? String.valueOf(n) : label(n)).toList();
        String joined = parts.size() <= 1 ? String.join("", parts)
                : String.join(", ", parts.subList(0, parts.size() - 1)) + " and " + parts.get(parts.size() - 1);
        return allFile ? (parts.size() == 1 ? "row " : "rows ") + joined : joined;
    }
}
