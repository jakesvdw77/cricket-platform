package com.cricketlegend.service;

import com.cricketlegend.dto.CreateTeamRequest;
import com.cricketlegend.dto.TeamDto;
import com.cricketlegend.dto.UpdateTeamRequest;
import java.util.List;
import java.util.UUID;

/**
 * A club's {@link com.cricketlegend.domain.Team} rows — leaves hanging off a {@link
 * com.cricketlegend.domain.Section}. Reachable by a club's own {@code CLUB_ADMIN} or a {@code
 * platform_admin} via {@code /api/v1/manage/clubs/{clubId}/sections/{sectionId}/teams} (plus one
 * flat club-wide list), no dedicated {@code /platform} mirror. "Disable, never delete" — unlike
 * {@code SectionService}, there is no hard-delete branch here at all (see
 * docs/specs/026-teams.md's Non-goals). See docs/specs/026-teams.md.
 */
public interface TeamService {

    /**
     * Every team under {@code sectionId}, scoped to {@code clubId} — active and inactive, not
     * paginated, a deliberately small bounded collection. 404s if {@code sectionId} doesn't
     * belong to {@code clubId}.
     */
    List<TeamDto> listBySection(UUID clubId, UUID sectionId);

    /**
     * Every team for {@code clubId}, flat, across all sections — active and inactive, not
     * paginated — backs the club-wide Teams directory. No section-ownership check needed, {@code
     * club_id} is a direct column on {@link com.cricketlegend.domain.Team}.
     */
    List<TeamDto> listByClub(UUID clubId);

    /**
     * Creates a team under {@code sectionId} for {@code clubId}. 404s if {@code sectionId}
     * doesn't exist at all, or exists but belongs to a different club.
     */
    TeamDto create(UUID clubId, UUID sectionId, CreateTeamRequest request);

    /**
     * Renames an existing team belonging to {@code sectionId}/{@code clubId}. {@code sectionId}
     * is not editable via this method (see docs/specs/026-teams.md's Non-goals on re-parenting).
     * 404s if {@code sectionId} doesn't belong to {@code clubId}, or if {@code teamId} doesn't
     * belong to {@code sectionId}.
     */
    TeamDto update(UUID clubId, UUID sectionId, UUID teamId, UpdateTeamRequest request);

    /**
     * {@code active: true -> false}. Throws {@link
     * com.cricketlegend.exception.InvalidStatusTransitionException} if already inactive.
     */
    TeamDto deactivate(UUID clubId, UUID sectionId, UUID teamId);

    /**
     * {@code active: false -> true}. Throws {@link
     * com.cricketlegend.exception.InvalidStatusTransitionException} if already active.
     */
    TeamDto reactivate(UUID clubId, UUID sectionId, UUID teamId);
}
