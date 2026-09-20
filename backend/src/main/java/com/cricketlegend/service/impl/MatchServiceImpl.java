package com.cricketlegend.service.impl;

import com.cricketlegend.config.AccessService;
import com.cricketlegend.domain.League;
import com.cricketlegend.domain.Match;
import com.cricketlegend.domain.MatchSide;
import com.cricketlegend.domain.Season;
import com.cricketlegend.domain.Section;
import com.cricketlegend.domain.Team;
import com.cricketlegend.dto.CreateMatchRequest;
import com.cricketlegend.dto.MatchDto;
import com.cricketlegend.dto.MatchFilterOptionsDto;
import com.cricketlegend.dto.UpdateMatchRequest;
import com.cricketlegend.exception.InvalidStatusTransitionException;
import com.cricketlegend.exception.NotFoundException;
import com.cricketlegend.exception.ValidationException;
import com.cricketlegend.mapper.MatchMapper;
import com.cricketlegend.repository.LeagueRepository;
import com.cricketlegend.repository.MatchRepository;
import com.cricketlegend.repository.MatchSideRepository;
import com.cricketlegend.repository.MatchSpecifications;
import com.cricketlegend.repository.SeasonRepository;
import com.cricketlegend.repository.SectionRepository;
import com.cricketlegend.repository.TeamRepository;
import com.cricketlegend.service.MatchService;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Business rules per docs/specs/029-league-management.md: {@code list} is the first paginated
 * endpoint in this feature area (default sort {@code matchDate} descending when the caller
 * specifies none, mirroring {@code LeadServiceImpl.withDefaultSort}); {@code create}/{@code
 * update} validate exactly-one-of-team-id/team-name per side ({@link
 * #validateExactlyOneOfIdOrName}) ahead of the DB {@code CHECK} constraints, that {@code leagueId}
 * (when set)/{@code seasonId} each belong to {@code clubId}, and that {@code homeTeamId}/{@code
 * awayTeamId} (when set) reference a real {@code Team} of ANY club (cross-club references are
 * allowed for a real inter-club fixture); {@code club_id} saved on the {@link Match} is ALWAYS
 * {@code clubId} — the acting/creating club from the URL — NEVER derived from {@code
 * homeTeamId}'s own club, a deliberate conservative call (see the spec's dedicated Data Model
 * Changes note); {@code deactivate}/{@code reactivate} mirror every other entity's one-way
 * transition-guard shape.
 */
@Service
public class MatchServiceImpl implements MatchService {

    private final MatchRepository matchRepository;
    private final MatchSideRepository matchSideRepository;
    private final LeagueRepository leagueRepository;
    private final SeasonRepository seasonRepository;
    private final TeamRepository teamRepository;
    private final SectionRepository sectionRepository;
    private final MatchMapper matchMapper;
    private final AccessService accessService;

    public MatchServiceImpl(
            MatchRepository matchRepository,
            MatchSideRepository matchSideRepository,
            LeagueRepository leagueRepository,
            SeasonRepository seasonRepository,
            TeamRepository teamRepository,
            SectionRepository sectionRepository,
            MatchMapper matchMapper,
            AccessService accessService) {
        this.matchRepository = matchRepository;
        this.matchSideRepository = matchSideRepository;
        this.leagueRepository = leagueRepository;
        this.seasonRepository = seasonRepository;
        this.teamRepository = teamRepository;
        this.sectionRepository = sectionRepository;
        this.matchMapper = matchMapper;
        this.accessService = accessService;
    }

    @Override
    @Transactional(readOnly = true)
    public Page<MatchDto> list(
            Authentication authentication,
            UUID clubId,
            UUID sectionId,
            boolean upcomingOnly,
            String search,
            UUID leagueId,
            UUID seasonId,
            Pageable pageable) {
        Optional<Set<UUID>> sectionIds = resolveAuthorizedSectionIds(authentication, clubId, sectionId);
        Pageable sorted = withDefaultSort(pageable);

        Specification<Match> spec = buildMatchSpecification(clubId, sectionIds, upcomingOnly, leagueId, seasonId, search);
        return enrichAnnounced(matchRepository.findAll(spec, sorted).map(matchMapper::toDto));
    }

    /**
     * Per docs/specs/035-section-scoped-access.md: resolves exactly the authorization/section-
     * scoping {@code list()} always applied — an explicit {@code sectionId} is validated (throws
     * if the caller can't administer it) and narrowed to its own descendant closure, ignoring the
     * caller's broader {@link AccessService#accessibleSectionIds} in that case; with no explicit
     * {@code sectionId}, the caller's own {@code accessibleSectionIds} applies as-is —
     * {@code Optional.empty()} meaning unrestricted (no section predicate at all, reproducing the
     * plain club-wide query exactly). Shared by {@link #list} and {@link #filterOptions} rather
     * than duplicated, per docs/standards/backend.md's "shared logic lives in one place" rule.
     */
    private Optional<Set<UUID>> resolveAuthorizedSectionIds(
            Authentication authentication, UUID clubId, UUID sectionId) {
        Optional<Set<UUID>> accessibleSectionIds = accessService.accessibleSectionIds(authentication, clubId);
        if (sectionId != null) {
            accessService.assertCanAdministerSection(authentication, clubId, sectionId);
            return Optional.of(accessService.sectionAndDescendantIds(clubId, sectionId));
        }
        return accessibleSectionIds;
    }

    /**
     * Composes one {@link Specification} from {@code clubId} plus whichever of the optional
     * filters are active — {@code sectionIds} only when present (an unrestricted caller with no
     * explicit {@code sectionId} adds no section predicate at all), {@code upcomingOnly} only when
     * {@code true}, {@code leagueId}/{@code seasonId}/{@code search} only when set/non-blank.
     * {@link Specification#and} is confirmed null-safe in this project's exact
     * {@code spring-data-jpa} version (3.4.3 — {@code SpecificationComposition} treats a
     * {@code null} operand as "no predicate", not an error), but this method guards explicitly
     * with plain {@code if}s regardless, which is unambiguous and version-independent.
     */
    private Specification<Match> buildMatchSpecification(
            UUID clubId,
            Optional<Set<UUID>> sectionIds,
            boolean upcomingOnly,
            UUID leagueId,
            UUID seasonId,
            String search) {
        Specification<Match> spec = Specification.where(MatchSpecifications.clubId(clubId));
        if (sectionIds.isPresent()) {
            spec = spec.and(MatchSpecifications.sectionIn(sectionIds.get()));
        }
        if (upcomingOnly) {
            spec = spec.and(MatchSpecifications.matchDateOnOrAfter(startOfToday()));
        }
        if (leagueId != null) {
            spec = spec.and(MatchSpecifications.leagueIdEquals(leagueId));
        }
        if (seasonId != null) {
            spec = spec.and(MatchSpecifications.seasonIdEquals(seasonId));
        }
        if (search != null && !search.isBlank()) {
            spec = spec.and(MatchSpecifications.searchMatches(search));
        }
        return spec;
    }

    @Override
    @Transactional(readOnly = true)
    public MatchFilterOptionsDto filterOptions(
            Authentication authentication,
            UUID clubId,
            UUID sectionId,
            UUID leagueId,
            UUID seasonId,
            String search,
            boolean upcomingOnly) {
        // Authorization PLUS the caller's own explicit sectionId pick (if any) — used when
        // computing the leagueIds/seasonIds arrays, since a picked Section legitimately narrows
        // what League/Season options remain reachable.
        Optional<Set<UUID>> sectionRestrictionIncludingOwnPick =
                resolveAuthorizedSectionIds(authentication, clubId, sectionId);
        // Authorization ONLY, ignoring the caller's own explicit sectionId pick — used when
        // computing the sectionIds array itself, so picking one Section doesn't narrow its own
        // dropdown down to just that section's closure. Still enforces a SECTION-scoped caller's
        // real access boundary (Optional.of(...) when restricted), it just never reflects the
        // caller's OWN current Section selection.
        Optional<Set<UUID>> sectionRestrictionForOwnArray = resolveAuthorizedSectionIds(authentication, clubId, null);

        List<Match> matchesForSectionIds = matchRepository.findAll(buildMatchSpecification(
                clubId, sectionRestrictionForOwnArray, upcomingOnly, leagueId, seasonId, search));
        List<Match> matchesForLeagueIds = matchRepository.findAll(buildMatchSpecification(
                clubId, sectionRestrictionIncludingOwnPick, upcomingOnly, null, seasonId, search));
        List<Match> matchesForSeasonIds = matchRepository.findAll(buildMatchSpecification(
                clubId, sectionRestrictionIncludingOwnPick, upcomingOnly, leagueId, null, search));
        // teamIds drives Search's autocomplete suggestions, not a picker's own dropdown — narrowed
        // by every filter the admin has actually picked (section/league/season), matching the
        // match list itself, but deliberately NOT by `search` (see MatchFilterOptionsDto's own
        // Javadoc: suggesting names to help decide what to type would be circular otherwise).
        List<Match> matchesForTeamIds = matchRepository.findAll(buildMatchSpecification(
                clubId, sectionRestrictionIncludingOwnPick, upcomingOnly, leagueId, seasonId, null));

        List<UUID> leagueIds =
                matchesForLeagueIds.stream().map(Match::getLeagueId).filter(Objects::nonNull).distinct().toList();
        List<UUID> seasonIds = matchesForSeasonIds.stream().map(Match::getSeasonId).distinct().toList();
        List<UUID> sectionIds =
                resolveReachableSectionIds(clubId, matchesForSectionIds, sectionRestrictionForOwnArray);
        List<UUID> teamIds = resolveReachableTeamIds(matchesForTeamIds);

        return new MatchFilterOptionsDto(sectionIds, leagueIds, seasonIds, teamIds);
    }

    /** The distinct non-null {@code homeTeamId}/{@code awayTeamId} values across a set of matches. */
    private List<UUID> resolveReachableTeamIds(List<Match> matches) {
        Set<UUID> teamIds = new HashSet<>();
        for (Match match : matches) {
            if (match.getHomeTeamId() != null) {
                teamIds.add(match.getHomeTeamId());
            }
            if (match.getAwayTeamId() != null) {
                teamIds.add(match.getAwayTeamId());
            }
        }
        return List.copyOf(teamIds);
    }

    /**
     * Per docs/specs/042-match-list-filters-and-search.md's filter-options endpoint: the reachable
     * {@code Section} ids for a set of matches are not just the direct {@code Team.sectionId} of
     * each match's home/away side — a parent {@code Section} must ALSO read as "reachable" if any
     * descendant of it is, or {@code SectionTreeSelect}'s own tree UI would show a parent node as
     * dead/unselectable directly above a child node that IS genuinely selectable (a real UI bug,
     * not a minor style choice). This walks each directly-reachable section's ancestor chain up to
     * its root and adds every ancestor too — the upward mirror of {@link
     * AccessService#sectionAndDescendantIds}'s existing downward descendant closure. {@code
     * teamRepository.findAllById}/{@code sectionRepository.findByClubId} are each called once
     * (not per-match/per-team), avoiding N+1.
     *
     * <p>{@code sectionRestriction} caps the walk at the caller's own accessible-section boundary
     * (the same {@code Optional<Set<UUID>>} shape {@link #resolveAuthorizedSectionIds} returns —
     * {@code Optional.empty()} for an unrestricted caller, {@code Optional.of(allowed)} for a
     * SECTION-scoped one): the loop stops adding a section the moment {@code current} falls outside
     * {@code allowed}, rather than continuing to climb {@code childToParent} — built from the
     * entire club's section tree, unrestricted — up to the true club root. Without this check a
     * restricted admin's {@code filter-options} response would leak ancestor section ids above
     * their own grant root; found in review, see docs/specs/042-match-list-filters-and-search.md.
     */
    private List<UUID> resolveReachableSectionIds(
            UUID clubId, List<Match> matches, Optional<Set<UUID>> sectionRestriction) {
        Set<UUID> teamIds = new HashSet<>();
        for (Match match : matches) {
            if (match.getHomeTeamId() != null) {
                teamIds.add(match.getHomeTeamId());
            }
            if (match.getAwayTeamId() != null) {
                teamIds.add(match.getAwayTeamId());
            }
        }
        if (teamIds.isEmpty()) {
            return List.of();
        }

        Set<UUID> directSectionIds =
                teamRepository.findAllById(teamIds).stream().map(Team::getSectionId).collect(Collectors.toSet());

        Map<UUID, UUID> childToParent = sectionRepository.findByClubId(clubId).stream()
                .filter(section -> section.getParentSectionId() != null)
                .collect(Collectors.toMap(Section::getId, Section::getParentSectionId));

        Set<UUID> allowed = sectionRestriction.orElse(null);
        Set<UUID> reachable = new HashSet<>();
        for (UUID sectionId : directSectionIds) {
            UUID current = sectionId;
            while (current != null && (allowed == null || allowed.contains(current)) && reachable.add(current)) {
                current = childToParent.get(current);
            }
        }
        return List.copyOf(reachable);
    }

    /**
     * Per docs/specs/040-announce-team.md: resolves {@code homeSideAnnounced}/{@code
     * awaySideAnnounced} for a whole page of {@link MatchDto} in one batched {@code
     * matchSideRepository.findByMatchIdIn} query, never a per-row lookup.
     */
    private Page<MatchDto> enrichAnnounced(Page<MatchDto> page) {
        List<UUID> matchIds = page.getContent().stream().map(MatchDto::id).toList();
        Map<String, Boolean> announcedByKey = matchSideRepository.findByMatchIdIn(matchIds).stream()
                .collect(Collectors.toMap(s -> s.getMatchId() + "|" + s.getTeamId(), MatchSide::isAnnounced));
        return page.map(dto -> new MatchDto(
                dto.id(), dto.clubId(), dto.homeTeamId(), dto.homeTeamName(), dto.awayTeamId(), dto.awayTeamName(),
                dto.leagueId(), dto.seasonId(), dto.matchDate(), dto.venue(), dto.active(),
                dto.homeTeamId() != null && announcedByKey.getOrDefault(dto.id() + "|" + dto.homeTeamId(), false),
                dto.awayTeamId() != null && announcedByKey.getOrDefault(dto.id() + "|" + dto.awayTeamId(), false),
                dto.createdAt(), dto.updatedAt(), dto.updatedBy()));
    }

    /**
     * Per docs/specs/037-match-improvements.md: start of the current local day —
     * {@code ZoneId.systemDefault()}, the one existing timezone precedent in this codebase
     * ({@code EmailTestSendServiceImpl}). No per-club timezone concept yet.
     */
    private Instant startOfToday() {
        return LocalDate.now(ZoneId.systemDefault()).atStartOfDay(ZoneId.systemDefault()).toInstant();
    }

    @Override
    @Transactional(readOnly = true)
    public MatchDto get(Authentication authentication, UUID clubId, UUID matchId) {
        Match match = findOrThrowForClub(clubId, matchId);
        assertCanAdministerMatch(authentication, clubId, match);
        return matchMapper.toDto(match);
    }

    @Override
    @Transactional
    public MatchDto create(Authentication authentication, UUID clubId, CreateMatchRequest request) {
        validateSides(request.homeTeamId(), request.homeTeamName(), request.awayTeamId(), request.awayTeamName());
        validateLeagueAndSeason(clubId, request.leagueId(), request.seasonId());
        validateTeamReferences(request.homeTeamId(), request.awayTeamId());
        accessService.assertCanAdministerAnySection(
                authentication,
                clubId,
                accessService.resolveMatchSectionIds(clubId, request.homeTeamId(), request.awayTeamId()));

        Match match = Match.builder()
                .clubId(clubId)
                .homeTeamId(request.homeTeamId())
                .homeTeamName(request.homeTeamName())
                .awayTeamId(request.awayTeamId())
                .awayTeamName(request.awayTeamName())
                .leagueId(request.leagueId())
                .seasonId(request.seasonId())
                .matchDate(request.matchDate())
                .venue(request.venue())
                .active(true)
                .build();

        return matchMapper.toDto(matchRepository.save(match));
    }

    @Override
    @Transactional
    public MatchDto update(Authentication authentication, UUID clubId, UUID matchId, UpdateMatchRequest request) {
        validateSides(request.homeTeamId(), request.homeTeamName(), request.awayTeamId(), request.awayTeamName());
        validateLeagueAndSeason(clubId, request.leagueId(), request.seasonId());
        validateTeamReferences(request.homeTeamId(), request.awayTeamId());

        Match match = findOrThrowForClub(clubId, matchId);
        assertCanAdministerMatch(authentication, clubId, match);
        match.setHomeTeamId(request.homeTeamId());
        match.setHomeTeamName(request.homeTeamName());
        match.setAwayTeamId(request.awayTeamId());
        match.setAwayTeamName(request.awayTeamName());
        match.setLeagueId(request.leagueId());
        match.setSeasonId(request.seasonId());
        match.setMatchDate(request.matchDate());
        match.setVenue(request.venue());

        return matchMapper.toDto(matchRepository.save(match));
    }

    @Override
    @Transactional
    public MatchDto deactivate(Authentication authentication, UUID clubId, UUID matchId) {
        Match match = findOrThrowForClub(clubId, matchId);
        assertCanAdministerMatch(authentication, clubId, match);
        if (!match.isActive()) {
            throw new InvalidStatusTransitionException("Match is already inactive: " + matchId);
        }
        match.setActive(false);
        return matchMapper.toDto(matchRepository.save(match));
    }

    @Override
    @Transactional
    public MatchDto reactivate(Authentication authentication, UUID clubId, UUID matchId) {
        Match match = findOrThrowForClub(clubId, matchId);
        assertCanAdministerMatch(authentication, clubId, match);
        if (match.isActive()) {
            throw new InvalidStatusTransitionException("Match is already active: " + matchId);
        }
        match.setActive(true);
        return matchMapper.toDto(matchRepository.save(match));
    }

    private Pageable withDefaultSort(Pageable pageable) {
        if (pageable.getSort().isSorted()) {
            return pageable;
        }
        return PageRequest.of(
                pageable.getPageNumber(), pageable.getPageSize(), Sort.by("matchDate").descending());
    }

    private void validateSides(UUID homeTeamId, String homeTeamName, UUID awayTeamId, String awayTeamName) {
        validateExactlyOneOfIdOrName(homeTeamId, homeTeamName, "home");
        validateExactlyOneOfIdOrName(awayTeamId, awayTeamName, "away");
    }

    private void validateExactlyOneOfIdOrName(UUID teamId, String teamName, String side) {
        boolean hasId = teamId != null;
        boolean hasName = teamName != null && !teamName.isBlank();
        if (hasId == hasName) {
            throw new ValidationException(
                    "Exactly one of " + side + "TeamId/" + side + "TeamName must be set");
        }
    }

    private void validateLeagueAndSeason(UUID clubId, UUID leagueId, UUID seasonId) {
        if (leagueId != null) {
            League league = leagueRepository
                    .findById(leagueId)
                    .orElseThrow(() -> new NotFoundException("League not found: " + leagueId));
            if (!league.getClubId().equals(clubId)) {
                throw new NotFoundException("League not found: " + leagueId);
            }
        }
        if (seasonId == null) {
            throw new ValidationException("seasonId is required");
        }
        Season season = seasonRepository
                .findById(seasonId)
                .orElseThrow(() -> new NotFoundException("Season not found: " + seasonId));
        if (!season.getClubId().equals(clubId)) {
            throw new NotFoundException("Season not found: " + seasonId);
        }
    }

    private void validateTeamReferences(UUID homeTeamId, UUID awayTeamId) {
        if (homeTeamId != null) {
            requireTeamExists(homeTeamId);
        }
        if (awayTeamId != null) {
            requireTeamExists(awayTeamId);
        }
    }

    private void requireTeamExists(UUID teamId) {
        if (!teamRepository.existsById(teamId)) {
            throw new NotFoundException("Team not found: " + teamId);
        }
    }

    /**
     * Per docs/specs/035-section-scoped-access.md: a section-scoped caller may only reach a match
     * that resolves to at least one of their own accessible sections; a match resolving to zero
     * of this club's own sections is reachable only by a {@code CLUB}-scope admin.
     */
    private void assertCanAdministerMatch(Authentication authentication, UUID clubId, Match match) {
        Set<UUID> matchSectionIds =
                accessService.resolveMatchSectionIds(clubId, match.getHomeTeamId(), match.getAwayTeamId());
        accessService.assertCanAdministerAnySection(authentication, clubId, matchSectionIds);
    }

    /**
     * 404s when {@code matchId} doesn't exist at all, or exists but belongs to a different
     * club — real cross-club isolation at the data layer.
     */
    private Match findOrThrowForClub(UUID clubId, UUID matchId) {
        Match match = matchRepository
                .findById(matchId)
                .orElseThrow(() -> new NotFoundException("Match not found: " + matchId));
        if (!match.getClubId().equals(clubId)) {
            throw new NotFoundException("Match not found: " + matchId);
        }
        return match;
    }

    @Override
    @Transactional(readOnly = true)
    public List<MatchDto> listPrevious(
            Authentication authentication, UUID clubId, UUID teamId, UUID seasonId, UUID leagueId, UUID excludeMatchId) {
        Team team = findTeamOrThrowForClub(clubId, teamId);
        accessService.assertCanAdministerSection(authentication, clubId, team.getSectionId());
        findSeasonOrThrowForClub(clubId, seasonId);

        return matchRepository
                .findPreviousForTeamSeasonLeague(clubId, teamId, seasonId, leagueId, Instant.now(), excludeMatchId)
                .stream()
                .map(matchMapper::toDto)
                .toList();
    }

    /** Same 404 logic/messages as {@code TeamSquadServiceImpl}'s own helper of the same name. */
    private Team findTeamOrThrowForClub(UUID clubId, UUID teamId) {
        Team team = teamRepository
                .findById(teamId)
                .orElseThrow(() -> new NotFoundException("Team not found: " + teamId));
        if (!team.getClubId().equals(clubId)) {
            throw new NotFoundException("Team not found: " + teamId);
        }
        return team;
    }

    /** Same 404 logic/messages as {@code TeamSquadServiceImpl}'s own helper of the same name. */
    private Season findSeasonOrThrowForClub(UUID clubId, UUID seasonId) {
        Season season = seasonRepository
                .findById(seasonId)
                .orElseThrow(() -> new NotFoundException("Season not found: " + seasonId));
        if (!season.getClubId().equals(clubId)) {
            throw new NotFoundException("Season not found: " + seasonId);
        }
        return season;
    }
}
