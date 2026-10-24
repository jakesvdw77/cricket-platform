package com.cricketlegend.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;
import java.util.UUID;

/**
 * {@code POST /api/v1/me/link-requests} (docs/specs/119). Everything here is untrusted typed input. {@code
 * sectionId} is required when there is no {@code targetPlayerRef} and the club has sections; {@code
 * targetPlayerRef} may only be a {@code ref} from the caller's own {@code /me/player-matches} ("Ask the club to help").
 */
public record CreateLinkRequestRequest(
        @NotNull UUID clubId,
        @NotBlank @Size(max = 255) String firstName,
        @NotBlank @Size(max = 255) String lastName,
        @NotNull LocalDate dateOfBirth,
        @NotBlank @Size(max = 30) @Pattern(regexp = "^[0-9+()\\-.\\s]{7,30}$", message = "Enter a valid contact number")
                String contactNumber,
        @Size(max = 500) String message,
        String targetPlayerRef,
        UUID sectionId) {}
