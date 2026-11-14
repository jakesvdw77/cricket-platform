package com.cricketlegend.service;

import com.cricketlegend.dto.AccessGrantDto;
import com.cricketlegend.dto.AccessGrantListDto;
import com.cricketlegend.dto.AddAccessGrantRequest;
import com.cricketlegend.dto.AddAccessGrantResultDto;
import com.cricketlegend.dto.ChangeAccessGrantRoleRequest;
import java.util.UUID;
import org.springframework.security.core.Authentication;

/**
 * Who has which role where, per docs/specs/150-managers-and-access-grants.md. Every rule (the level rule, hold-what-you-give,
 * own grant, last club-wide Manager, redundant grants, visibility, the invitation limit) is enforced here, never only in the UI.
 * A grant is a {@code RoleAssignment} row; a person's Keycloak account is never touched by a removal.
 */
public interface AccessGrantService {

    /** The people list, shaped for the caller (rule 8). */
    AccessGrantListDto list(Authentication authentication, UUID clubId);

    /**
     * Gives a person a role at a place. Finds or creates the person by email, invites them only if they have no account, and
     * keeps the grant even if the invitation cannot be sent. 403 above the caller's reach or for a role they do not fully hold,
     * 404 for a section of another club, 409 when the person already has this access, 429 over the daily invitation limit.
     */
    AddAccessGrantResultDto add(Authentication authentication, UUID clubId, AddAccessGrantRequest request);

    /** Changes the role of a grant in place (never the place). 403, 404 and 409 as {@link #remove}. */
    AccessGrantDto changeRole(
            Authentication authentication, UUID clubId, UUID grantId, ChangeAccessGrantRoleRequest request);

    /** Sends the invitation again while the person has never signed in; 409 otherwise. */
    void resend(Authentication authentication, UUID clubId, UUID grantId);

    /**
     * Removes the grant. 403 for the caller's own grant, a grant outside their reach or one carrying more than they hold; 409 for
     * the last club-wide Manager; 404 when it does not exist in this club.
     */
    void remove(Authentication authentication, UUID clubId, UUID grantId);
}
