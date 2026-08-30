package com.cricketlegend.service.impl;

import com.cricketlegend.domain.Section;
import com.cricketlegend.domain.Team;
import com.cricketlegend.dto.CreateTeamRequest;
import com.cricketlegend.dto.TeamDto;
import com.cricketlegend.dto.UpdateTeamRequest;
import com.cricketlegend.exception.InvalidStatusTransitionException;
import com.cricketlegend.exception.NotFoundException;
import com.cricketlegend.mapper.TeamMapper;
import com.cricketlegend.repository.SectionRepository;
import com.cricketlegend.repository.TeamRepository;
import com.cricketlegend.service.TeamService;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Business rules per docs/specs/026-teams.md: {@code listBySection}/{@code listByClub} return
 * every team for their scope (active and inactive, flat, not paginated — mirrors {@code
 * SectionServiceImpl}); {@code create}/{@code update}/{@code deactivate}/{@code reactivate} are
 * scoped two levels deep — {@code sectionId} must belong to {@code clubId} ({@link
 * #findSectionOrThrowForClub}), then {@code teamId} must belong to {@code sectionId} ({@link
 * #findTeamOrThrowForSection}), each throwing {@link NotFoundException} on mismatch for real
 * cross-club/cross-section isolation at the data layer, not only relying on the controller's
 * {@code @PreAuthorize}; {@code deactivate}/{@code reactivate} mirror {@code
 * ClubContactServiceImpl}'s plain one-way-transition-guard shape — {@code Team} never
 * hard-deletes, unlike {@code SectionServiceImpl}'s one-off exception.
 */
@Service
public class TeamServiceImpl implements TeamService {

    private final TeamRepository teamRepository;
    private final SectionRepository sectionRepository;
    private final TeamMapper teamMapper;

    public TeamServiceImpl(
            TeamRepository teamRepository, SectionRepository sectionRepository, TeamMapper teamMapper) {
        this.teamRepository = teamRepository;
        this.sectionRepository = sectionRepository;
        this.teamMapper = teamMapper;
    }

    @Override
    public List<TeamDto> listBySection(UUID clubId, UUID sectionId) {
        findSectionOrThrowForClub(clubId, sectionId);
        return teamRepository.findByClubIdAndSectionId(clubId, sectionId).stream()
                .map(teamMapper::toDto)
                .toList();
    }

    @Override
    public List<TeamDto> listByClub(UUID clubId) {
        return teamRepository.findByClubId(clubId).stream().map(teamMapper::toDto).toList();
    }

    @Override
    @Transactional
    public TeamDto create(UUID clubId, UUID sectionId, CreateTeamRequest request) {
        findSectionOrThrowForClub(clubId, sectionId);

        Team team = teamMapper.toEntity(request);
        team.setClubId(clubId);
        team.setSectionId(sectionId);
        team.setLogoUrl(request.logoUrl());
        team.setActive(true);

        return teamMapper.toDto(teamRepository.save(team));
    }

    @Override
    @Transactional
    public TeamDto update(UUID clubId, UUID sectionId, UUID teamId, UpdateTeamRequest request) {
        findSectionOrThrowForClub(clubId, sectionId);
        Team team = findTeamOrThrowForSection(sectionId, teamId);
        team.setName(request.name());
        team.setLogoUrl(request.logoUrl());

        return teamMapper.toDto(teamRepository.save(team));
    }

    @Override
    @Transactional
    public TeamDto deactivate(UUID clubId, UUID sectionId, UUID teamId) {
        findSectionOrThrowForClub(clubId, sectionId);
        Team team = findTeamOrThrowForSection(sectionId, teamId);
        if (!team.isActive()) {
            throw new InvalidStatusTransitionException("Team is already inactive: " + teamId);
        }
        team.setActive(false);
        return teamMapper.toDto(teamRepository.save(team));
    }

    @Override
    @Transactional
    public TeamDto reactivate(UUID clubId, UUID sectionId, UUID teamId) {
        findSectionOrThrowForClub(clubId, sectionId);
        Team team = findTeamOrThrowForSection(sectionId, teamId);
        if (team.isActive()) {
            throw new InvalidStatusTransitionException("Team is already active: " + teamId);
        }
        team.setActive(true);
        return teamMapper.toDto(teamRepository.save(team));
    }

    /**
     * 404s when {@code sectionId} doesn't exist at all, or exists but belongs to a different
     * club — real cross-club isolation at the data layer, not only relying on the controller's
     * {@code @PreAuthorize}. Mirrors {@code SectionServiceImpl.findOrThrowForClub}.
     */
    private Section findSectionOrThrowForClub(UUID clubId, UUID sectionId) {
        Section section = sectionRepository
                .findById(sectionId)
                .orElseThrow(() -> new NotFoundException("Section not found: " + sectionId));
        if (!section.getClubId().equals(clubId)) {
            throw new NotFoundException("Section not found: " + sectionId);
        }
        return section;
    }

    /**
     * 404s when {@code teamId} doesn't exist at all, or exists but belongs to a different
     * section.
     */
    private Team findTeamOrThrowForSection(UUID sectionId, UUID teamId) {
        Team team = teamRepository
                .findById(teamId)
                .orElseThrow(() -> new NotFoundException("Team not found: " + teamId));
        if (!team.getSectionId().equals(sectionId)) {
            throw new NotFoundException("Team not found: " + teamId);
        }
        return team;
    }
}
