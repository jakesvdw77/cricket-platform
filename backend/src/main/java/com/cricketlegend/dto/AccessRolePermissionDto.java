package com.cricketlegend.dto;

/** One permission a role carries, per docs/specs/150-managers-and-access-grants.md. {@code level} is VIEW or EDIT, {@code reach} SECTION or CLUB. */
public record AccessRolePermissionDto(String key, String label, String level, String reach) {}
