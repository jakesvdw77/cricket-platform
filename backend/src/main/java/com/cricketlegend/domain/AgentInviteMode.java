package com.cricketlegend.domain;

/** How a main agent invites another agent (docs/specs/119, Decisions 5 and 14). */
public enum AgentInviteMode {
    /** The invitee becomes main when they accept; the previous main steps down to an ordinary agent. */
    HANDOVER,
    /** The invitee becomes another agent; main only if the player has none when they accept. */
    ADD
}
