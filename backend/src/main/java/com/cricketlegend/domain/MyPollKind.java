package com.cricketlegend.domain;

/** The two availability polls a linked account can answer (docs/specs/119, on top of 077): one match squad, or a group round. */
public enum MyPollKind {
    /** A match squad poll: one answer, no window id. */
    SQUAD,
    /** A section group round: one answer per window. */
    GROUP
}
