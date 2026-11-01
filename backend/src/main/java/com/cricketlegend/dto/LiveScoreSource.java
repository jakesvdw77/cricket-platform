package com.cricketlegend.dto;

import com.cricketlegend.domain.LiveScoreKind;

/**
 * docs/specs/135, the LiveScore seam: a discriminated source ({@code kind}). EXTERNAL carries the https scoring link
 * and its host; a later NATIVE kind adds a summary and may drop the link.
 */
public record LiveScoreSource(LiveScoreKind kind, String url, String host) {}
