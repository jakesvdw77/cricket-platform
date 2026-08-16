package com.cricketlegend.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

/**
 * Public, unauthenticated lead-capture payload — POST /api/v1/leads.
 * See docs/specs/004-landing-page.md.
 */
public record CreateLeadRequest(
        @NotBlank String name,
        @NotBlank @Email String email,
        @NotBlank String clubName,
        String phone,
        String message) {
}
