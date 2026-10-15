package com.cricketlegend.domain;

/**
 * docs/specs/101: the manager's edit of a standout suggestion. {@link #FEATURE} adds a player the rules did not
 * suggest, {@link #HIDE} removes a suggestion; no override (null) follows the suggestion.
 */
public enum FeaturedOverride {
    FEATURE,
    HIDE
}
