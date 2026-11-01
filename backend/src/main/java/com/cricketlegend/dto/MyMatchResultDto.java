package com.cricketlegend.dto;

/** docs/specs/135: the published result line only; no scorecard. */
public record MyMatchResultDto(String homeScore, String awayScore, String resultLine) {}
