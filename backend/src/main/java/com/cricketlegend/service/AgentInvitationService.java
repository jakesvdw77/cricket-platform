package com.cricketlegend.service;

import com.cricketlegend.dto.InvitationDto;
import com.cricketlegend.dto.InviteAgentRequest;
import java.util.List;
import java.util.UUID;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.jwt.Jwt;

/**
 * docs/specs/119, slice 4: changing agents from the agent's side. The main agent (or the adult player on their own
 * record) invites an email; the invitee accepts or declines after logging in with that verified email; the sender may
 * cancel; an agent may leave. Every grant and removal is logged at INFO with ids only.
 */
public interface AgentInvitationService {

    /**
     * Creates an INVITED link for the email (14 days) and sends the invitation email after the commit. Only the main agent
     * or the adult player themselves (404 for a key the caller does not hold, 403 for another agent). 400 for the caller's
     * own email, 409 if that email is already an agent or invited, 429 after 5 invitations in a day.
     */
    void invite(Authentication authentication, Jwt jwt, String playerKey, InviteAgentRequest request);

    /** Invitations waiting for the caller's verified email that have not expired. */
    List<InvitationDto> invitations(Authentication authentication, Jwt jwt);

    /**
     * Binds the invitation to the caller (ACTIVE). A hand-over, or an ADD to a player with no main agent, makes the caller
     * main and steps the previous main down to an ordinary agent in the same transaction; a clash on the one-main index is
     * a 409. 404 when the invitation is not the caller's, has expired or is no longer open.
     */
    void accept(Authentication authentication, Jwt jwt, UUID linkId);

    /** Declines the invitation (404 as {@link #accept}). */
    void decline(Authentication authentication, Jwt jwt, UUID linkId);

    /**
     * The sender cancels an INVITED link, or an agent removes their own ACTIVE link ("leave"). A main agent cannot leave
     * while other agents exist (409, hand over first). Anything else is a 404.
     */
    void remove(Authentication authentication, UUID linkId);
}
