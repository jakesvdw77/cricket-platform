package com.cricketlegend.service;

import com.cricketlegend.dto.PlayerAccountDto;
import com.cricketlegend.dto.PlayerLinkDto;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.security.core.Authentication;

/** The manager's "Players and their main agent" list and a player's agents (docs/specs/119). Masked emails only. */
public interface PlayerAccountService {

    /**
     * One page of the club's active players with their main agent (name and masked email) and other-agent count. Section
     * scope as the Players list (spec 035); {@code sectionId} narrows to its closure (403 if not the caller's);
     * {@code noMainAgent} keeps players with none; {@code search} matches the player's name. Size is capped at 100.
     */
    Page<PlayerAccountDto> list(
            Authentication authentication,
            UUID clubId,
            UUID sectionId,
            boolean noMainAgent,
            String search,
            int page,
            int size);

    /** The ACTIVE agents of one player, main first; the caller must administer at least one of the player's sections. */
    List<PlayerLinkDto> links(Authentication authentication, UUID clubId, UUID playerId);
}
