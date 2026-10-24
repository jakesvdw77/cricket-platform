package com.cricketlegend.dto;

import com.cricketlegend.domain.PersonLinkStatus;
import java.util.UUID;

/**
 * An agent of a player as the main agent sees them (docs/specs/119): name and masked email only. An {@code INVITED}
 * entry is an invitation the main agent sent, shown by the masked invited email.
 */
public record MyPlayerAgentDto(UUID linkId, String name, String maskedEmail, boolean main, PersonLinkStatus status) {
}
