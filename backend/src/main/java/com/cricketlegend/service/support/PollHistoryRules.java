package com.cricketlegend.service.support;

import com.cricketlegend.domain.AvailabilityStatus;
import com.cricketlegend.domain.MyPollStatusFilter;
import java.util.List;

/**
 * The status rules of the Hub availability history (pure, no storage or caller information). A poll row is judged by
 * the answers the player gave on it. A squad poll has at most one answer; a group poll has one per window.
 * <ul>
 *   <li>Filter: NOT_ANSWERED matches a row with no answer; any other value matches when ANY answer has that status.</li>
 *   <li>Summary bucket (a row is counted once): no answer is NOT_ANSWERED; else AVAILABLE if any answer is AVAILABLE;
 *       else UNAVAILABLE if any answer is UNAVAILABLE; else UNSURE.</li>
 * </ul>
 */
public final class PollHistoryRules {

    private PollHistoryRules() {}

    public static boolean matches(List<AvailabilityStatus> answers, MyPollStatusFilter filter) {
        if (filter == null) {
            return true;
        }
        if (filter == MyPollStatusFilter.NOT_ANSWERED) {
            return answers.isEmpty();
        }
        return answers.stream().anyMatch(a -> a.name().equals(filter.name()));
    }

    public static MyPollStatusFilter bucket(List<AvailabilityStatus> answers) {
        if (answers.isEmpty()) {
            return MyPollStatusFilter.NOT_ANSWERED;
        }
        if (answers.contains(AvailabilityStatus.AVAILABLE)) {
            return MyPollStatusFilter.AVAILABLE;
        }
        if (answers.contains(AvailabilityStatus.UNAVAILABLE)) {
            return MyPollStatusFilter.UNAVAILABLE;
        }
        return MyPollStatusFilter.UNSURE;
    }
}
