package com.cricketlegend.dto;

import com.cricketlegend.domain.LinkGrantedVia;
import com.cricketlegend.domain.PersonLinkStatus;
import java.time.Instant;
import java.util.UUID;

/** One agent of a player, for the manager's Account section (docs/specs/119). The email is masked only. */
public record PlayerLinkDto(
        UUID linkId,
        String agentName,
        String maskedEmail,
        boolean main,
        LinkGrantedVia grantedVia,
        Instant since,
        PersonLinkStatus status) {}
