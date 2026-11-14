package com.cricketlegend.dto;

import java.util.List;
import java.util.UUID;

/**
 * One permission the caller holds in a club, per docs/specs/150-managers-and-access-grants.md. {@code sectionIds} is
 * {@code null} when it applies club-wide, otherwise the closed list of sections it applies to.
 */
public record MePermissionItemDto(String key, List<UUID> sectionIds) {}
