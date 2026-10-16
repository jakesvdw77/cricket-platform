package com.cricketlegend.service.support;

/** A tier 4 suggestion: a candidate and its similarity score in (0, 1]. Never an automatic link. */
public record NameSuggestion(NameCandidate candidate, double score) {}
