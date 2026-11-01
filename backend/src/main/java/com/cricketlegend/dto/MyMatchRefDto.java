package com.cricketlegend.dto;

import java.util.UUID;

/** docs/specs/135: an id and name (league or season). */
public record MyMatchRefDto(UUID id, String name) {}
