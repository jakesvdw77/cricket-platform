package com.cricketlegend.domain;

/** How a {@link PersonLink} came to exist (docs/specs/119). */
public enum LinkGrantedVia {
    EMAIL_MATCH,
    CLUB_APPROVAL,
    AGENT_INVITE,
    CLUB_MANAGER
}
