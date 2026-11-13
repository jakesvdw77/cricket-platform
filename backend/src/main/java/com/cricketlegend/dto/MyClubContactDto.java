package com.cricketlegend.dto;

import java.util.UUID;

/** docs/specs/148: one directory row; {@code phone}/{@code email} are null unless the club switched that column on and the contact has a value. */
public record MyClubContactDto(UUID id, String firstName, String lastName, String role, boolean primary, String phone, String email) {
}
