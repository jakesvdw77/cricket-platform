package com.cricketlegend.domain;

/** Spec 125: where an effective import row came from. A null origin on a stored row is read as FILE. */
public enum ImportRowOrigin {
    FILE, EDITED, ADDED
}
