package com.cricketlegend.service;

import com.cricketlegend.dto.ApplySelectionRequest;
import com.cricketlegend.dto.MatchSideDto;
import com.cricketlegend.dto.SelectionPoolDto;
import java.util.UUID;
import org.springframework.security.core.Authentication;

/**
 * The selection pool and the atomic apply of a side's selection, per
 * docs/specs/076-team-selection.md. Access is the same as {@link MatchSideService}: the caller must
 * be able to administer one of the match's sections.
 */
public interface MatchSelectionService {

    /**
     * The candidates for {@code teamId}'s side of the match, each with availability, taken info and
     * a selectable flag. {@code teamId} must be one of the match's own team ids (400 otherwise).
     * Works before the side exists. {@code q} is a case-insensitive "contains" on first or last name.
     */
    SelectionPoolDto pool(
            Authentication authentication,
            UUID clubId,
            UUID matchId,
            UUID teamId,
            boolean wholeSection,
            String q);

    /**
     * Applies the complete desired selection atomically: validates everything, collects every
     * rejection (409 {@link com.cricketlegend.exception.SelectionRejectedException}) before any
     * write, otherwise adds, removes and orders in one transaction.
     */
    MatchSideDto apply(
            Authentication authentication, UUID clubId, UUID matchId, UUID sideId, ApplySelectionRequest request);
}
