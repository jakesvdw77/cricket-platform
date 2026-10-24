package com.cricketlegend.service.support;

import java.util.UUID;

/** A player on record under the caller's verified email, identified by profile id and club (docs/specs/119). */
public record OwnMatch(UUID profileId, UUID clubId) {}
