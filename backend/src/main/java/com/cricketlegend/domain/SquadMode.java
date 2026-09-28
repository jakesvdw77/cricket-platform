package com.cricketlegend.domain;

/**
 * A {@link Team}'s squad-selection mode — {@code STATIC} (default) keeps docs/specs/
 * 029-league-management.md's season-long {@link TeamSquadMember} roster and docs/specs/
 * 032-match-availability-polls.md's per-match {@link MatchAvailabilityPoll} entirely unchanged;
 * {@code FLEXIBLE} opts a team into docs/specs/063-section-availability-and-flexible-squads.md's
 * section-level availability ask and per-fixture {@link MatchSquadMember} pool instead. See
 * docs/specs/063-section-availability-and-flexible-squads.md.
 */
public enum SquadMode {
    STATIC,
    FLEXIBLE
}
