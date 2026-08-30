package com.cricketlegend.service.impl;

import com.cricketlegend.domain.ClubContact;
import com.cricketlegend.domain.Section;
import com.cricketlegend.domain.Team;
import com.cricketlegend.domain.TeamContact;
import com.cricketlegend.dto.TeamContactDto;
import com.cricketlegend.exception.ConflictException;
import com.cricketlegend.exception.NotFoundException;
import com.cricketlegend.mapper.ClubContactMapper;
import com.cricketlegend.repository.ClubContactRepository;
import com.cricketlegend.repository.SectionRepository;
import com.cricketlegend.repository.TeamContactRepository;
import com.cricketlegend.repository.TeamRepository;
import com.cricketlegend.service.TeamContactService;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Business rules per docs/specs/027-team-profile.md: {@code list}/{@code link}/{@code unlink} are
 * scoped two levels deep exactly like {@code TeamServiceImpl} — {@code sectionId} must belong to
 * {@code clubId} ({@link #findSectionOrThrowForClub}), then {@code teamId} must belong to {@code
 * sectionId} ({@link #findTeamOrThrowForSection}) — THEN, only once that parent-scope chain
 * passes, {@code contactId} is independently validated against {@code clubId} ({@link
 * #findOrThrowContactForClub}, mirrors {@code SectionServiceImpl.findOrThrowContactForClub}
 * verbatim): a cross-club parent 404s without ever querying the contact. {@code link} throws
 * {@link ConflictException} if already linked; {@code unlink} throws {@link NotFoundException} if
 * no such link exists and is always a hard delete of the join row.
 *
 * <p>{@code list} is {@code @Transactional(readOnly = true)} for the same reason {@code
 * TeamSponsorServiceImpl.list} is — {@code ClubContact} has no lazy collection today, but every
 * list method in this codebase's established convention ({@code SponsorServiceImpl}, {@code
 * ClubProfileServiceImpl}) carries this uniformly rather than only where a lazy field currently
 * happens to exist, so a future lazy field added to {@code ClubContact} doesn't silently
 * reintroduce the same class of bug.
 */
@Service
public class TeamContactServiceImpl implements TeamContactService {

    private final TeamRepository teamRepository;
    private final SectionRepository sectionRepository;
    private final TeamContactRepository teamContactRepository;
    private final ClubContactRepository clubContactRepository;
    private final ClubContactMapper clubContactMapper;

    public TeamContactServiceImpl(
            TeamRepository teamRepository,
            SectionRepository sectionRepository,
            TeamContactRepository teamContactRepository,
            ClubContactRepository clubContactRepository,
            ClubContactMapper clubContactMapper) {
        this.teamRepository = teamRepository;
        this.sectionRepository = sectionRepository;
        this.teamContactRepository = teamContactRepository;
        this.clubContactRepository = clubContactRepository;
        this.clubContactMapper = clubContactMapper;
    }

    @Override
    @Transactional(readOnly = true)
    public List<TeamContactDto> list(UUID clubId, UUID sectionId, UUID teamId) {
        findSectionOrThrowForClub(clubId, sectionId);
        findTeamOrThrowForSection(sectionId, teamId);

        return teamContactRepository.findByTeamId(teamId).stream()
                .map(link -> {
                    ClubContact contact = clubContactRepository
                            .findById(link.getClubContactId())
                            .orElseThrow(() -> new NotFoundException(
                                    "Club contact not found: " + link.getClubContactId()));
                    return new TeamContactDto(
                            link.getId(),
                            clubContactMapper.toDto(contact),
                            link.getRole(),
                            link.getCreatedAt());
                })
                .toList();
    }

    @Override
    @Transactional
    public void link(UUID clubId, UUID sectionId, UUID teamId, UUID contactId, String role) {
        findSectionOrThrowForClub(clubId, sectionId);
        findTeamOrThrowForSection(sectionId, teamId);
        findOrThrowContactForClub(clubId, contactId);

        if (teamContactRepository.existsByTeamIdAndClubContactId(teamId, contactId)) {
            throw new ConflictException(
                    "Club contact " + contactId + " is already linked to team " + teamId);
        }

        TeamContact link = TeamContact.builder()
                .teamId(teamId)
                .clubContactId(contactId)
                .role(role)
                .build();
        teamContactRepository.save(link);
    }

    @Override
    @Transactional
    public void unlink(UUID clubId, UUID sectionId, UUID teamId, UUID contactId) {
        findSectionOrThrowForClub(clubId, sectionId);
        findTeamOrThrowForSection(sectionId, teamId);

        teamContactRepository
                .findByTeamIdAndClubContactId(teamId, contactId)
                .orElseThrow(() -> new NotFoundException(
                        "No link between team " + teamId + " and club contact " + contactId));

        teamContactRepository.deleteByTeamIdAndClubContactId(teamId, contactId);
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
     * 404s when {@code contactId} doesn't exist at all, or exists but belongs to a different
     * club. {@link Team} and {@link ClubContact} are independent siblings under {@code Club}, not
     * a parent-child chain, so this is checked against {@code clubId} directly rather than
     * against the team — mirrors {@code SectionServiceImpl.findOrThrowContactForClub}.
     */
    private ClubContact findOrThrowContactForClub(UUID clubId, UUID contactId) {
        ClubContact contact = clubContactRepository
                .findById(contactId)
                .orElseThrow(() -> new NotFoundException("Club contact not found: " + contactId));
        if (!contact.getClubId().equals(clubId)) {
            throw new NotFoundException("Club contact not found: " + contactId);
        }
        return contact;
    }
}
