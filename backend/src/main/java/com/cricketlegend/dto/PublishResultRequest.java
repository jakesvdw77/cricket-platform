package com.cricketlegend.dto;

/**
 * docs/specs/100-match-results-core.md: body of {@code POST .../result/publish}. {@code acknowledgedWarnings} must be
 * true when validation produced warnings.
 */
public record PublishResultRequest(boolean acknowledgedWarnings) {
}
