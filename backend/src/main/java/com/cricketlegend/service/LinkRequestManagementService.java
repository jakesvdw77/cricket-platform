package com.cricketlegend.service;

import com.cricketlegend.dto.ApproveLinkRequestRequest;
import com.cricketlegend.dto.DeclineLinkRequestRequest;
import com.cricketlegend.dto.LinkRequestDto;
import com.cricketlegend.dto.LinkRequestSummaryDto;
import java.util.List;
import java.util.UUID;
import org.springframework.security.core.Authentication;

/**
 * The manager's side of link requests (docs/specs/119, Access, Player accounts). Section rule (spec 035): a
 * section-scoped manager sees and decides only requests whose suggested or target player is in their sections; a request
 * with no resolved player is club-wide admins only. Anything else is a 403.
 */
public interface LinkRequestManagementService {

    /** The PENDING requests the caller may decide, oldest first, each with its suggested player if any. */
    List<LinkRequestDto> list(Authentication authentication, UUID clubId);

    /** How many requests {@link #list} would return, for the Players-list card and the tab's counter. */
    LinkRequestSummaryDto summary(Authentication authentication, UUID clubId);

    /**
     * Approves a PENDING request in one transaction: {@code confirm} must be true (400); exactly one of {@code playerId}
     * and {@code newPlayer} (a new player is created VERIFIED and optionally tagged to a section); the requester becomes
     * main agent when the player has none or {@code MAKE_MAIN} was chosen (an existing main steps down to an ordinary
     * agent), else an ordinary agent. The link is {@code CLUB_APPROVAL} granted by the caller. The outcome email goes
     * after the commit and never undoes the decision.
     */
    void approve(Authentication authentication, UUID clubId, UUID requestId, ApproveLinkRequestRequest request);

    /** Declines a PENDING request with an optional note shown to the requester; nothing about any player is stored. */
    void decline(Authentication authentication, UUID clubId, UUID requestId, DeclineLinkRequestRequest request);
}
