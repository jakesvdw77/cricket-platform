package com.cricketlegend.dto;

import java.util.List;
import java.util.UUID;

/** A role (a named bundle of permissions), per docs/specs/150. {@code assignable} is false until the areas it covers are enforced (Release 3). */
public record AccessRoleDto(
        UUID id,
        String key,
        String name,
        String description,
        boolean assignable,
        List<AccessRolePermissionDto> permissions) {}
