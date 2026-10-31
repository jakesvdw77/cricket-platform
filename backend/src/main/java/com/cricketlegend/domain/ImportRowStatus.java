package com.cricketlegend.domain;

/** A row's worst issue, or the neutral skipped state (spec 097). */
public enum ImportRowStatus {
    OK, WARNING, ERROR, SKIPPED_NOT_OURS
}
