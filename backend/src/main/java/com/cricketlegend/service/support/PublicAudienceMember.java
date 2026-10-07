package com.cricketlegend.service.support;

import java.util.UUID;

/** One player who belongs to a poll, as the verifier sees them. */
public record PublicAudienceMember(UUID playerProfileId, String firstName, String lastName, Integer shirtNumber) {
}
