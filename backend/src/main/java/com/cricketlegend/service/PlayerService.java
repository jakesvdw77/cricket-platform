package com.cricketlegend.service;

import com.cricketlegend.dto.CreatePlayerRequest;
import com.cricketlegend.dto.PlayerDto;
import com.cricketlegend.dto.UpdatePlayerRequest;
import java.util.List;
import java.util.UUID;

/**
 * A club's players — orchestrates {@link com.cricketlegend.domain.Person} (identity), {@link
 * com.cricketlegend.domain.ClubMembership} ("which club is this person currently with"), and
 * {@link com.cricketlegend.domain.PlayerProfile} (club-scoped profile data) together, the same
 * "one service orchestrates its own composed entity" shape {@code TeamService} follows for a
 * single entity — except this one composes three. Reachable by a club's own {@code CLUB_ADMIN} or
 * a {@code platform_admin} via {@code /api/v1/manage/clubs/{clubId}/players}, no dedicated {@code
 * /platform} mirror. See docs/specs/028-players.md.
 */
public interface PlayerService {

    /**
     * Every player for {@code clubId} — active and inactive, not paginated, a deliberately small
     * bounded collection.
     */
    List<PlayerDto> list(UUID clubId);

    /**
     * Creates a brand-new {@link com.cricketlegend.domain.Person} ({@code status = ACTIVE},
     * {@code email = null} — never {@code PersonServiceImpl.findOrCreatePerson}), a {@link
     * com.cricketlegend.domain.ClubMembership} ({@code validFrom = today}, {@code validTo =
     * null}), and a {@link com.cricketlegend.domain.PlayerProfile}, all in one transaction. 404s
     * if {@code clubId} doesn't exist.
     */
    PlayerDto create(UUID clubId, CreatePlayerRequest request);

    /**
     * Updates the linked {@code Person}'s identity fields ({@code firstName}/{@code lastName}/
     * {@code dateOfBirth}/{@code gender}) and the {@code PlayerProfile}'s own fields together, no
     * overwrite-protection guard (deliberate — see the spec's API Contract Architecture note).
     * 404s if {@code playerId} doesn't belong to {@code clubId}.
     */
    PlayerDto update(UUID clubId, UUID playerId, UpdatePlayerRequest request);

    /**
     * {@code active: true -> false}, and closes the linked {@code ClubMembership} ({@code validTo
     * = today}) in the same transaction. Throws {@link
     * com.cricketlegend.exception.InvalidStatusTransitionException} if already inactive.
     */
    PlayerDto deactivate(UUID clubId, UUID playerId);

    /**
     * {@code active: false -> true}, and reopens the linked {@code ClubMembership} ({@code
     * validTo = null}) in the same transaction. Throws {@link
     * com.cricketlegend.exception.InvalidStatusTransitionException} if already active, or if the
     * person already holds a different active {@code ClubMembership} by then.
     */
    PlayerDto reactivate(UUID clubId, UUID playerId);
}
