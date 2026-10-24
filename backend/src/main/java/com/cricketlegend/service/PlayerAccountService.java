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

    /** The ACTIVE agents and open (unexpired) invitations of one player, main first; the caller must administer at least one of the player's sections. */
    List<PlayerLinkDto> links(Authentication authentication, UUID clubId, UUID playerId);

    /**
     * Revokes an ACTIVE agent link or cancels an INVITED one at once (docs/specs/119, slice 4); {@code confirm} must be true
     * (400). If it was the main agent nobody is promoted automatically. 404 for a link that is not this player's.
     */
    void revokeLink(Authentication authentication, UUID clubId, UUID playerId, UUID linkId, boolean confirm);

    /**
     * Makes an existing ACTIVE agent the main agent; the old main stays an ordinary agent, in one transaction. {@code
     * confirm} must be true (400); 409 when the link is already main or the main changed meanwhile.
     */
    void makeMain(Authentication authentication, UUID clubId, UUID playerId, UUID linkId, Boolean confirm);

    /**
     * Invites an email as MAIN agent ({@code INVITED}, make_main, granted via CLUB_MANAGER, 14 days) and sends the invitation
     * email after the commit. {@code confirm} must be true (400). The previous main steps down when the invitee accepts.
     */
    void inviteMain(Authentication authentication, UUID clubId, UUID playerId, String email, Boolean confirm);
}
