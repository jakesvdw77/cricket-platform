package com.cricketlegend.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;
import java.util.UUID;

/** "New player and approve": the player to create, edited by the manager before saving (docs/specs/119). */
public record NewLinkedPlayerRequest(
        @NotBlank @Size(max = 255) String firstName,
        @NotBlank @Size(max = 255) String lastName,
        @NotNull LocalDate dateOfBirth,
        UUID sectionId) {}
