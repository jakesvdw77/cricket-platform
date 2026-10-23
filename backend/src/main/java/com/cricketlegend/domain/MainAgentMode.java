package com.cricketlegend.domain;

/** How an approved requester joins a player that may already have a main agent (docs/specs/119, link requests). */
public enum MainAgentMode {
    /** The requester becomes the main agent; any existing main agent steps down to an ordinary agent. */
    MAKE_MAIN,
    /** The requester is added as another agent; an existing main agent stays main. */
    ADD
}
