package com.cricketlegend.service.support.schedule;

/** Tunable values of the league schedule import rules (docs/specs/098-league-schedule-import.md, "Validation list"). */
public final class ScheduleConstants {

    /** One of our teams with two matches closer than this on a date is an error (OWN_TEAM_OVERLAP). */
    public static final int OWN_TEAM_MIN_GAP_MINUTES = 120;
    /** Two matches at one venue closer than this on a date is a warning (VENUE_TIME_CLASH). */
    public static final int VENUE_MIN_GAP_MINUTES = 180;
    /** A weekday holding at least this share of the file's dates is "the usual match day". */
    public static final double WEEKDAY_SHARE = 0.60;

    public static final int DEFAULT_WINDOW_DAYS = 14;
    public static final int MIN_WINDOW_DAYS = 1;
    public static final int MAX_WINDOW_DAYS = 60;

    private ScheduleConstants() {}

    public static boolean isValidWindowDays(int days) {
        return days >= MIN_WINDOW_DAYS && days <= MAX_WINDOW_DAYS;
    }

    /** The given window, or the default when it is null or outside 1 to 60. */
    public static int windowDaysOrDefault(Integer days) {
        return days != null && isValidWindowDays(days) ? days : DEFAULT_WINDOW_DAYS;
    }

    /** TEAM_MISSING_ON_DATE applies on a date where at least half of the file's teams play. */
    public static boolean atLeastHalfOfTeams(int teamsPlaying, int teamsInFile) {
        return teamsInFile > 0 && teamsPlaying * 2 >= teamsInFile;
    }
}
