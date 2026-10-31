package com.cricketlegend.domain;

/** How a row relates to existing records (spec 097 principle 8). */
public enum ImportOutcome {
    NEW, DUPLICATE, DIFFERS, POSSIBLE_DUPLICATE, SKIPPED_NOT_OURS
}
