package com.cricketlegend.service.support;

import com.cricketlegend.service.support.OverviewPolls.OpenPoll;
import java.time.Duration;
import java.time.Instant;
import java.util.Collection;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;

/**
 * The distinct-player aggregation behind the availability counters (docs/specs/081, 083) and the
 * players list of docs/specs/084: one place, so the list totals equal the counters by construction.
 * {@code audience} distinct players asked by any poll shown; {@code responded} those of them with at
 * least one real answer in at least one poll; {@code stillToAnswer} players who owe at least one
 * answer in some poll shown.
 */
public record AvailabilitySummaryPlayers(Set<UUID> audience, Set<UUID> responded, Set<UUID> stillToAnswer) {

    /** An open poll is closing soon when its close time is after now and at most this far away. */
    public static final Duration CLOSING_SOON = Duration.ofHours(48);

    public static AvailabilitySummaryPlayers of(Collection<OpenPoll> polls) {
        Set<UUID> audience = new HashSet<>();
        Set<UUID> responded = new HashSet<>();
        Set<UUID> stillToAnswer = new HashSet<>();
        for (OpenPoll shown : polls) {
            audience.addAll(shown.audience());
            responded.addAll(shown.responded());
            stillToAnswer.addAll(shown.awaiting());
        }
        responded.retainAll(audience);
        return new AvailabilitySummaryPlayers(audience, responded, stillToAnswer);
    }

    /** Open, with a close time in {@code (now, now + CLOSING_SOON]}. */
    public static boolean isClosingSoon(OpenPoll shown, Instant now) {
        Instant closeAt = shown.poll().scheduledCloseAt();
        return shown.open() && closeAt != null && closeAt.isAfter(now) && !closeAt.isAfter(now.plus(CLOSING_SOON));
    }
}
