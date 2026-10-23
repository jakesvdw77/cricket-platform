package com.cricketlegend.dto;

/** {@code GET .../link-requests/summary}: how many requests the caller can decide (docs/specs/119). */
public record LinkRequestSummaryDto(int waiting) {}
