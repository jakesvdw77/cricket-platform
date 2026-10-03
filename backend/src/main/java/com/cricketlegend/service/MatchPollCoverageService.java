package com.cricketlegend.service;

import com.cricketlegend.domain.AvailabilityPollType;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * The one place that answers "which availability poll, if any, covers this match?"
 * (docs/specs/064-unified-availability-polls.md). Coverage is resolved from data, never from a team
 * setting: a match is <b>group-covered</b> iff a {@code section_availability_window_match} row links
 * it to a window; it is <b>squad-poll-covered</b> iff a {@code MatchAvailabilityPoll} exists for the
 * match (+ team, in the team-scoped {@link #resolve}). The two are mutually exclusive, enforced by
 * every create path using this service.
 */
public interface MatchPollCoverageService {

    /** Which kind of poll covers a match. */
    enum Kind {
        NONE,
        SQUAD,
        GROUP
    }

    /**
     * Result of a coverage lookup. {@link #pollId()} is set only for {@link Kind#SQUAD} (the {@code
     * MatchAvailabilityPoll} id); {@link #roundId()}/{@link #windowId()} only for {@link
     * Kind#GROUP}. {@link #label()} is a human-readable description of the covering poll (a group
     * poll's description, or a squad poll's "Team v Opponent" text) for 409 messages and the
     * fixture-group "already polled" link.
     */
    record Coverage(Kind kind, UUID pollId, UUID roundId, UUID windowId, String label) {

        public static final Coverage NONE = new Coverage(Kind.NONE, null, null, null, null);

        public boolean covered() {
            return kind != Kind.NONE;
        }

        /** The id of the covering poll in its own kind: the squad poll id, or the group round id. */
        public UUID coveringPollId() {
            return kind == Kind.SQUAD ? pollId : roundId;
        }
    }

    /**
     * Coverage of {@code matchId} as seen by {@code teamId}'s side: GROUP if the match is linked to a
     * window (a group poll covers every involved team of its section), else SQUAD if a poll exists
     * for exactly this match+team, else NONE.
     */
    Coverage resolve(UUID matchId, UUID teamId);

    /**
     * Whether the match is covered by ANY poll of either kind (any team) — GROUP first, else the
     * first squad poll found, else NONE. Used by the round-create path, which
     * must not accept a match any poll already covers.
     */
    Coverage resolveAny(UUID matchId);

    /**
     * One poll covering a match (docs/specs/069-match-card-redesign.md). GROUP: {@code teamId}
     * null, {@code pollId} == {@code roundId}, {@code open} is the window's. SQUAD: {@code roundId}
     * null, {@code pollId} the squad poll id, {@code open} the poll's.
     */
    record PollRef(AvailabilityPollType type, UUID teamId, UUID pollId, UUID roundId, boolean open) {}

    /**
     * Batch form of coverage for a page of matches, in one query per source (never per match). A
     * group-linked match yields exactly one GROUP ref (group beats squad, as {@link #resolve});
     * otherwise one SQUAD ref per squad poll row. Every requested id is a key (empty list when
     * unpolled); an empty input makes no repository call.
     */
    Map<UUID, List<PollRef>> pollsForMatches(Collection<UUID> matchIds);
}
