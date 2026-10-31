package com.cricketlegend.service.support.schedule;

import com.cricketlegend.domain.ImportScopeMode;

/**
 * Every rule code of docs/specs/098-league-schedule-import.md "Validation list" (plus the two the spec leaves implicit,
 * see below), each with its severity and the mode it applies in: {@code BOTH} is the spec's tag B, {@code ALL_ONLY} is
 * tag A (skipped in {@code OURS_ONLY}, because the rows about other teams are deliberately absent), {@code OURS_ONLY_MODE}
 * applies only to the ours-only scope. {@code NOTE} is informational and never needs acknowledging.
 *
 * <p>Additions: {@code DATE_OUTSIDE_LEAGUE_DATES} (plan 098 finding 3, spec 111), {@code DATE_EXCEL_NUMBER} (the
 * warning the parsing rules ask for), {@code FILE_DATES_OUTSIDE_SEASON} (the file-level error the {@code
 * DATE_OUTSIDE_SEASON} row asks for) and {@code UPDATE_BLOCKED} (an opt-in update on a match with dependants).
 */
public enum ScheduleRule {
    FILE_REJECTED(Severity.ERROR, Mode.BOTH),
    LEAGUE_OR_SEASON_INVALID(Severity.ERROR, Mode.BOTH),
    TEMPLATE_SCOPE_MISMATCH(Severity.WARNING, Mode.BOTH),
    FILE_IMPORTED_BEFORE(Severity.WARNING, Mode.BOTH),
    DATE_INVALID(Severity.ERROR, Mode.BOTH),
    DATE_OUTSIDE_SEASON(Severity.ERROR, Mode.BOTH),
    FILE_DATES_OUTSIDE_SEASON(Severity.ERROR, Mode.BOTH),
    DATE_OUTSIDE_LEAGUE_DATES(Severity.ERROR, Mode.BOTH),
    TIME_INVALID(Severity.ERROR, Mode.BOTH),
    TEAM_MISSING(Severity.ERROR, Mode.BOTH),
    TEAM_UNRESOLVED(Severity.ERROR, Mode.BOTH),
    TEAM_SAME_BOTH_SIDES(Severity.ERROR, Mode.BOTH),
    TEAM_NAME_COLLISION(Severity.ERROR, Mode.BOTH),
    TEAM_INACTIVE(Severity.ERROR, Mode.BOTH),
    DUPLICATE_ROW_IN_FILE(Severity.ERROR, Mode.BOTH),
    CONFLICTING_ROW_IN_FILE(Severity.ERROR, Mode.BOTH),
    OWN_TEAM_OVERLAP(Severity.ERROR, Mode.BOTH),
    OWN_TEAM_SAME_DATE(Severity.WARNING, Mode.BOTH),
    TEAM_TWICE_SAME_DATE(Severity.WARNING, Mode.ALL_ONLY),
    TEAM_MISSING_ON_DATE(Severity.WARNING, Mode.ALL_ONLY),
    VENUE_TIME_CLASH(Severity.WARNING, Mode.BOTH),
    WEEKDAY_MISMATCH(Severity.WARNING, Mode.BOTH),
    SAME_CLUB_DERBY(Severity.WARNING, Mode.BOTH),
    OWN_TEAM_NOT_AFFILIATED(Severity.WARNING, Mode.BOTH),
    VENUE_MISSING(Severity.WARNING, Mode.BOTH),
    VENUE_SPELLING(Severity.NOTE, Mode.BOTH),
    POSSIBLE_DUPLICATE_NEARBY(Severity.WARNING, Mode.BOTH),
    MEETINGS_EXCEED(Severity.WARNING, Mode.BOTH),
    POSSIBLE_DUPLICATE_FREE_TEXT(Severity.WARNING, Mode.BOTH),
    ROW_DIFFERS(Severity.NOTE, Mode.BOTH),
    ALREADY_EXISTS(Severity.NOTE, Mode.BOTH),
    SKIPPED_NOT_OURS(Severity.NOTE, Mode.OURS_ONLY_MODE),
    DATE_TWO_DIGIT_YEAR(Severity.NOTE, Mode.BOTH),
    DATE_YEAR_INFERRED(Severity.NOTE, Mode.BOTH),
    DATE_DAY_FIRST(Severity.WARNING, Mode.BOTH),
    DATE_EXCEL_NUMBER(Severity.WARNING, Mode.BOTH),
    TWO_NAMES_ONE_TEAM(Severity.WARNING, Mode.BOTH),
    UPDATE_BLOCKED(Severity.ERROR, Mode.BOTH);

    public enum Severity { ERROR, WARNING, NOTE }

    public enum Mode { BOTH, ALL_ONLY, OURS_ONLY_MODE }

    private final Severity severity;
    private final Mode mode;

    ScheduleRule(Severity severity, Mode mode) {
        this.severity = severity;
        this.mode = mode;
    }

    public Severity severity() {
        return severity;
    }

    public Mode mode() {
        return mode;
    }

    public boolean appliesIn(ImportScopeMode scopeMode) {
        return switch (mode) {
            case BOTH -> true;
            case ALL_ONLY -> scopeMode == ImportScopeMode.ALL;
            case OURS_ONLY_MODE -> scopeMode == ImportScopeMode.OURS_ONLY;
        };
    }
}
