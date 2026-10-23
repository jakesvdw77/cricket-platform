package com.cricketlegend.dto;

import java.util.UUID;

/** A club in the "which club" picker of the link request form ({@code GET /api/v1/me/clubs}). */
public record ClubOptionDto(UUID id, String name) {}
