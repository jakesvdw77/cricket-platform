package com.cricketlegend.dto;

/**
 * docs/specs/100-match-results-core.md: body of {@code POST .../result/publish}. {@code acknowledgedWarnings} must be
 * true when validation produced warnings. docs/specs/145: {@code showInPlayerHub} says whether the published result also
 * shows in the Player Hub; omitted (null) means yes, so every publish shows by default and a manager opts out.
 */
public record PublishResultRequest(boolean acknowledgedWarnings, Boolean showInPlayerHub) {

    public PublishResultRequest(boolean acknowledgedWarnings) {
        this(acknowledgedWarnings, null);
    }

    /** True unless the request explicitly said {@code false}. */
    public boolean showInPlayerHubOrDefault() {
        return showInPlayerHub == null || showInPlayerHub;
    }
}
