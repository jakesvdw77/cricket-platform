package com.cricketlegend.domain;

/**
 * Who wrote an availability answer: a manager on the Responses page, or the player through the
 * verified public form. See docs/specs/077-public-availability-form-verification.md.
 */
public enum AnswerSource {
    MANAGER,
    PUBLIC_LINK
}
