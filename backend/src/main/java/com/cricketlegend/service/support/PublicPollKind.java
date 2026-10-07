package com.cricketlegend.service.support;

/** The two public poll kinds; the name is part of every token and attempt key. */
public enum PublicPollKind {
    /** A squad poll ({@code MatchAvailabilityPoll}). */
    POLL,
    /** A group poll ({@code SectionAvailabilityRound}). */
    ROUND
}
