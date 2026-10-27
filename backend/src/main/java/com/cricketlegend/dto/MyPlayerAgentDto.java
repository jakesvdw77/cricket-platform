package com.cricketlegend.dto;

import com.cricketlegend.domain.PersonLinkStatus;
import java.util.UUID;

/**
 * One agent in the list every linked agent sees for a player (docs/specs/121, Decision 23): all ACTIVE agents including
 * the caller ({@code you}), the main agent first. {@code name} is given to every viewer; {@code maskedEmail} and
 * {@code linkId} only to the main agent (or the adult player), null for everyone else, so no agent ever receives another
 * agent's email. An {@code INVITED} entry is an invitation the main agent sent (main agent only), shown by the masked
 * invited email.
 */
public record MyPlayerAgentDto(
        UUID linkId, String name, String maskedEmail, boolean main, PersonLinkStatus status, boolean you) {
}
