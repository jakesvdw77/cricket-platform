package com.cricketlegend.repository;

import com.cricketlegend.domain.ClubMembership;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * The lookups {@code PlayerServiceImpl} needs for its deactivate/reactivate rules — no dedicated
 * service of its own (see {@link com.cricketlegend.domain.ClubMembership}'s own Javadoc). See
 * docs/specs/028-players.md.
 */
public interface ClubMembershipRepository extends JpaRepository<ClubMembership, UUID> {

    /**
     * The currently-active membership for {@code personId} ({@code valid_to IS NULL}) — at most
     * one, backed by the partial unique index {@code ux_club_membership_active}. Used both by
     * {@code deactivate} (the row to close) and {@code reactivate}'s conflict check (whether the
     * person has since picked up a different active membership).
     */
    Optional<ClubMembership> findByPersonIdAndValidToIsNull(UUID personId);

    /**
     * The single {@link ClubMembership} row ever created for a given {@code (personId, clubId)}
     * pair — created once, together with the matching {@code PlayerProfile}, and only ever
     * toggled open/closed thereafter, never duplicated (this spec's flows never create a second
     * row for the same pair). Scoped by {@code clubId} as well as {@code personId} — not just
     * {@code personId} alone — so this stays unambiguous even in the edge case a person picks up
     * a second, unrelated membership row at a different club in the meantime (see {@link
     * #findByPersonIdAndValidToIsNull}'s use in {@code reactivate}'s conflict check for that
     * case); a {@code personId}-only lookup would throw a non-unique-result error instead of the
     * clean conflict this is meant to detect. Used by {@code reactivate} to find "this player's
     * own" membership to reopen, regardless of its current open/closed state — {@link
     * #findByPersonIdAndValidToIsNull} alone can't do this once the row is closed.
     */
    Optional<ClubMembership> findByPersonIdAndClubId(UUID personId, UUID clubId);
}
