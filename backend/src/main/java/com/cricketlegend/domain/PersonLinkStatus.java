package com.cricketlegend.domain;

/** Only {@code ACTIVE} grants anything (docs/specs/119). */
public enum PersonLinkStatus {
    INVITED,
    ACTIVE,
    REVOKED,
    DECLINED
}
