package com.cricketlegend.dto;

import java.util.List;
import java.util.UUID;

/** Where the caller may give one role, per docs/specs/150 rule 2: club-wide, and the sections (each covering what is beneath). */
public record RoleGrantabilityDto(UUID roleId, boolean clubWide, List<UUID> sectionIds) {}
