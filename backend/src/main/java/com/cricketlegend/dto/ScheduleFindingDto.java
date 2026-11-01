package com.cricketlegend.dto;

import java.util.UUID;

/**
 * One scheduling finding on a manual match save (docs/specs/132-match-scheduling-rules.md). {@code code} is a
 * {@code ScheduleRule} name, {@code severity} is {@code ERROR} (blocks whatever is acknowledged) or {@code WARNING}
 * (confirmable by sending the code in {@code acknowledgedWarnings}), {@code field} is {@code time}, {@code date},
 * {@code venue} or {@code teams}, and {@code otherMatchId} the match it clashes with (null when there is none to link).
 */
public record ScheduleFindingDto(String code, String severity, String message, String field, UUID otherMatchId) {

    public static final String ERROR = "ERROR";
    public static final String WARNING = "WARNING";

    public boolean isError() {
        return ERROR.equals(severity);
    }
}
