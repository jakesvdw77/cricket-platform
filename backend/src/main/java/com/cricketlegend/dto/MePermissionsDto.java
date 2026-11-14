package com.cricketlegend.dto;

import java.util.List;
import java.util.UUID;

/**
 * What the caller may do in one club, per docs/specs/150-managers-and-access-grants.md. The UI uses it only to hide
 * actions; every endpoint checks the permission again. {@code clubWide} is true when any grant covers the whole club.
 */
public record MePermissionsDto(UUID clubId, boolean clubWide, List<MePermissionItemDto> items) {}
