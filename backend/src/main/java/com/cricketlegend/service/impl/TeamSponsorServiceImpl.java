package com.cricketlegend.service.impl;

import com.cricketlegend.domain.Section;
import com.cricketlegend.domain.Sponsor;
import com.cricketlegend.domain.Team;
import com.cricketlegend.domain.TeamSponsor;
import com.cricketlegend.dto.SponsorDto;
import com.cricketlegend.exception.ConflictException;
import com.cricketlegend.exception.NotFoundException;
import com.cricketlegend.mapper.SponsorMapper;
import com.cricketlegend.repository.SectionRepository;
import com.cricketlegend.repository.SponsorRepository;
import com.cricketlegend.repository.TeamRepository;
import com.cricketlegend.repository.TeamSponsorRepository;
import com.cricketlegend.service.TeamSponsorService;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Business rules per docs/specs/027-team-profile.md: {@code list}/{@code link}/{@code unlink} are
 * scoped two levels deep exactly like {@code TeamServiceImpl} — {@code sectionId} must belong to
 * {@code clubId} ({@link #findSectionOrThrowForClub}), then {@code teamId} must belong to {@code
 * sectionId} ({@link #findTeamOrThrowForSection}) — THEN, only once that parent-scope chain
 * passes, {@code sponsorId} is independently validated against {@code clubId} ({@link
 * #findOrThrowForClub}, mirrors {@code SponsorServiceImpl.findOrThrowForClub}): a cross-club
 * parent 404s without ever querying the sponsor. {@code link} throws {@link ConflictException} if
 * already linked; {@code unlink} throws {@link NotFoundException} if no such link exists and is
 * always a hard delete of the join row.
 *
 * <p>{@code list} is {@code @Transactional(readOnly = true)} — {@code Sponsor.socialLinks} is an
 * {@code @ElementCollection}, which JPA defaults to lazy, the same shape that already caused a
 * real {@code LazyInitializationException} (a 500 on a plain {@code GET}) in {@code
 * ClubProfileServiceImpl} and was fixed uniformly in {@code SponsorServiceImpl} — this class
 * originally missed it (caught by manual smoke-testing against a real Postgres instance, not a
 * unit/integration test, since Testcontainers-backed tests share a session long enough not to
 * trip this) and has been corrected to match that same convention.
 */
@Service
public class TeamSponsorServiceImpl implements TeamSponsorService {

    private final TeamRepository teamRepository;
    private final SectionRepository sectionRepository;
    private final TeamSponsorRepository teamSponsorRepository;
    private final SponsorRepository sponsorRepository;
    private final SponsorMapper sponsorMapper;

    public TeamSponsorServiceImpl(
            TeamRepository teamRepository,
            SectionRepository sectionRepository,
            TeamSponsorRepository teamSponsorRepository,
            SponsorRepository sponsorRepository,
            SponsorMapper sponsorMapper) {
        this.teamRepository = teamRepository;
        this.sectionRepository = sectionRepository;
        this.teamSponsorRepository = teamSponsorRepository;
        this.sponsorRepository = sponsorRepository;
        this.sponsorMapper = sponsorMapper;
    }

    @Override
    @Transactional(readOnly = true)
    public List<SponsorDto> list(UUID clubId, UUID sectionId, UUID teamId) {
        findSectionOrThrowForClub(clubId, sectionId);
        findTeamOrThrowForSection(sectionId, teamId);

        return teamSponsorRepository.findByTeamId(teamId).stream()
                .map(link -> sponsorRepository
                        .findById(link.getSponsorId())
                        .orElseThrow(
                                () -> new NotFoundException("Sponsor not found: " + link.getSponsorId())))
                .map(sponsorMapper::toDto)
                .toList();
    }

    @Override
    @Transactional
    public void link(UUID clubId, UUID sectionId, UUID teamId, UUID sponsorId) {
        findSectionOrThrowForClub(clubId, sectionId);
        findTeamOrThrowForSection(sectionId, teamId);
        findOrThrowForClub(clubId, sponsorId);

        if (teamSponsorRepository.existsByTeamIdAndSponsorId(teamId, sponsorId)) {
            throw new ConflictException(
                    "Sponsor " + sponsorId + " is already linked to team " + teamId);
        }

        TeamSponsor link =
                TeamSponsor.builder().teamId(teamId).sponsorId(sponsorId).build();
        teamSponsorRepository.save(link);
    }

    @Override
    @Transactional
    public void unlink(UUID clubId, UUID sectionId, UUID teamId, UUID sponsorId) {
        findSectionOrThrowForClub(clubId, sectionId);
        findTeamOrThrowForSection(sectionId, teamId);

        teamSponsorRepository
                .findByTeamIdAndSponsorId(teamId, sponsorId)
                .orElseThrow(() -> new NotFoundException(
                        "No link between team " + teamId + " and sponsor " + sponsorId));

        teamSponsorRepository.deleteByTeamIdAndSponsorId(teamId, sponsorId);
    }

    /**
     * 404s when {@code sectionId} doesn't exist at all, or exists but belongs to a different
     * club — mirrors {@code TeamServiceImpl.findSectionOrThrowForClub}.
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
     * section — mirrors {@code TeamServiceImpl.findTeamOrThrowForSection}.
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

    /**
     * 404s when {@code sponsorId} doesn't exist at all, or exists but belongs to a different
     * club — mirrors {@code SponsorServiceImpl.findOrThrowForClub}.
     */
    private Sponsor findOrThrowForClub(UUID clubId, UUID sponsorId) {
        Sponsor sponsor = sponsorRepository
                .findById(sponsorId)
                .orElseThrow(() -> new NotFoundException("Sponsor not found: " + sponsorId));
        if (!sponsor.getClubId().equals(clubId)) {
            throw new NotFoundException("Sponsor not found: " + sponsorId);
        }
        return sponsor;
    }
}
