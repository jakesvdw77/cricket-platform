package com.cricketlegend.dto;

import com.cricketlegend.domain.StreamProvider;

/** docs/specs/135: the club's stream of a live match. {@code embedUrl} is built by the server from a fixed template, else null. */
public record MyMatchStreamDto(String url, StreamProvider provider, String embedUrl) {}
