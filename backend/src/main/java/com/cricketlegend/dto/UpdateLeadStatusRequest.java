package com.cricketlegend.dto;

import com.cricketlegend.domain.LeadStatus;
import jakarta.validation.constraints.NotNull;
import java.util.UUID;

/**
 * POST /api/v1/platform/leads/{id}/status payload — transitions a Lead's status per the
 * allowed-transition table in docs/specs/004-landing-page.md.
 */
public record UpdateLeadStatusRequest(
        @NotNull LeadStatus status,
        UUID convertedClubId) {
}
