package com.cricketlegend.service.impl;

import com.cricketlegend.config.AccessService;
import com.cricketlegend.domain.AvailabilityPollType;
import com.cricketlegend.domain.League;
import com.cricketlegend.domain.LeagueTeam;
import com.cricketlegend.domain.Match;
import com.cricketlegend.domain.MatchSide;
import com.cricketlegend.domain.Season;
import com.cricketlegend.domain.Section;
import com.cricketlegend.domain.Team;
import com.cricketlegend.dto.CreateMatchRequest;
import com.cricketlegend.dto.MatchDto;
import com.cricketlegend.dto.MatchFilterOptionsDto;
import com.cricketlegend.dto.MatchPollDto;
import com.cricketlegend.dto.UpdateMatchRequest;
import com.cricketlegend.exception.InvalidStatusTransitionException;
import com.cricketlegend.exception.NotFoundException;
import com.cricketlegend.exception.ValidationException;
import com.cricketlegend.mapper.MatchMapper;
import com.cricketlegend.repository.LeagueRepository;
import com.cricketlegend.repository.LeagueTeamRepository;
import com.cricketlegend.repository.MatchRepository;
import com.cricketlegend.repository.MatchSidePlayerRepository;
import com.cricketlegend.repository.MatchSideRepository;
import com.cricketlegend.repository.MatchSpecifications;
import com.cricketlegend.repository.SeasonRepository;
import com.cricketlegend.repository.SectionRepository;
import com.cricketlegend.repository.TeamRepository;
import com.cricketlegend.service.MatchPollCoverageService;
import com.cricketlegend.service.MatchService;
import com.cricketlegend.service.support.LeagueSeasonAccessValidation;
import com.cricketlegend.service.support.ServerClock;
import java.time.Instant;
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
 * #validateExactlyOneOfIdOrName}) ahead of the DB {@code CHECK} constraints, and (per
 * docs/specs/050-league-schedule-and-fixtures.md, {@link #validateLogoOnlyWithName}) that a side's
 * {@code *TeamLogoUrl} is only set alongside that side's own {@code *TeamName}; that {@code
 * leagueId} (when set)/{@code seasonId} each belong to {@code clubId}, and that {@code
 * homeTeamId}/{@code awayTeamId} (when set) reference a real {@code Team} of ANY club (cross-club
 * references are allowed for a real inter-club fixture); {@code club_id} saved on the {@link Match}
 * is ALWAYS
 * {@code clubId} — the acting/creating club from the URL — NEVER derived from {@code
 * homeTeamId}'s own club, a deliberate conservative call (see the spec's dedicated Data Model
 * Changes note); {@code deactivate}/{@code reactivate} mirror every other entity's one-way
 * transition-guard shape.
 */
@Service
public class MatchServiceImpl implements MatchService {

    private final MatchRepository matchRepository;
    private final MatchSideRepository matchSideRepository;
    private final MatchSidePlayerRepository matchSidePlayerRepository;
    private final MatchPollCoverageService matchPollCoverageService;
    private final LeagueRepository leagueRepository;
    private final SeasonRepository seasonRepository;
    private final LeagueTeamRepository leagueTeamRepository;
    private final TeamRepository teamRepository;
    private final SectionRepository sectionRepository;
    private final MatchMapper matchMapper;
    private final AccessService accessService;

    public MatchServiceImpl(
            MatchRepository matchRepository,
            MatchSideRepository matchSideRepository,
            MatchSidePlayerRepository matchSidePlayerRepository,
            MatchPollCoverageService matchPollCoverageService,
            LeagueRepository leagueRepository,
            SeasonRepository seasonRepository,
            LeagueTeamRepository leagueTeamRepository,
            TeamRepository teamRepository,
            SectionRepository sectionRepository,
            MatchMapper matchMapper,
            AccessService accessService) {
        this.matchRepository = matchRepository;
        this.matchSideRepository = matchSideRepository;
        this.matchSidePlayerRepository = matchSidePlayerRepository;
        this.matchPollCoverageService = matchPollCoverageService;
        this.leagueRepository = leagueRepository;
        this.seasonRepository = seasonRepository;
        this.leagueTeamRepository = leagueTeamRepository;
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
        return enrichList(matchRepository.findAll(spec, sorted).map(matchMapper::toDto));
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
            spec = spec.and(MatchSpecifications.matchDateOnOrAfter(ServerClock.startOfToday()));
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
     * One combined enrichment of a page of {@link MatchDto}, one batched query per source and
     * never a per-row lookup (docs/specs/040-announce-team.md announced flags;
     * docs/specs/069-match-card-redesign.md picked counts, playing XI size and polls). A side is a
     * <em>club-team</em> side only when its team's {@code clubId} equals the match's own club; a
     * free-text or other-club side gets a {@code null} picked count and no poll entries. The
     * announced flags keep their original meaning (true only for a real team side with an
     * announced {@code MatchSide}). A batch that would be empty is skipped.
     */
    private Page<MatchDto> enrichList(Page<MatchDto> page) {
        List<MatchDto> content = page.getContent();
        if (content.isEmpty()) {
            return page;
        }
        List<UUID> matchIds = content.stream().map(MatchDto::id).toList();
        List<MatchSide> sides = matchSideRepository.findByMatchIdIn(matchIds);
        Map<String, MatchSide> sideByKey = sides.stream()
                .collect(Collectors.toMap(s -> s.getMatchId() + "|" + s.getTeamId(), s -> s));

        Set<UUID> sideTeamIds = new HashSet<>();
        for (MatchDto dto : content) {
            if (dto.homeTeamId() != null) {
                sideTeamIds.add(dto.homeTeamId());
            }
            if (dto.awayTeamId() != null) {
                sideTeamIds.add(dto.awayTeamId());
            }
        }
        Map<UUID, UUID> clubByTeamId = sideTeamIds.isEmpty()
                ? Map.of()
                : teamRepository.findAllById(sideTeamIds).stream()
                        .collect(Collectors.toMap(Team::getId, Team::getClubId));

        Map<UUID, Long> pickedBySideId = new HashMap<>();
        if (!sides.isEmpty()) {
            matchSidePlayerRepository.findByMatchSideIdIn(
                            sides.stream().map(MatchSide::getId).toList())
                    .forEach(p -> pickedBySideId.merge(p.getMatchSideId(), 1L, Long::sum));
        }

        Set<UUID> leagueIds = content.stream()
                .map(MatchDto::leagueId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());
        Map<UUID, Integer> xiSizeByLeagueId = leagueIds.isEmpty()
                ? Map.of()
                : leagueRepository.findAllById(leagueIds).stream()
                        .collect(Collectors.toMap(League::getId, League::getMaxPlayingXiSize));

        List<UUID> clubSideMatchIds = content.stream()
                .filter(dto -> isClubTeamSide(dto, dto.homeTeamId(), clubByTeamId)
                        || isClubTeamSide(dto, dto.awayTeamId(), clubByTeamId))
                .map(MatchDto::id)
                .toList();
        Map<UUID, List<MatchPollCoverageService.PollRef>> pollsByMatchId =
                clubSideMatchIds.isEmpty() ? Map.of() : matchPollCoverageService.pollsForMatches(clubSideMatchIds);

        return page.map(dto -> {
            boolean homeClub = isClubTeamSide(dto, dto.homeTeamId(), clubByTeamId);
            boolean awayClub = isClubTeamSide(dto, dto.awayTeamId(), clubByTeamId);
            Set<UUID> clubTeamIds = new HashSet<>();
            if (homeClub) {
                clubTeamIds.add(dto.homeTeamId());
            }
            if (awayClub) {
                clubTeamIds.add(dto.awayTeamId());
            }
            List<MatchPollDto> polls = pollsByMatchId.getOrDefault(dto.id(), List.of()).stream()
                    .filter(ref -> ref.type() == AvailabilityPollType.GROUP || clubTeamIds.contains(ref.teamId()))
                    .map(ref -> new MatchPollDto(ref.type(), ref.teamId(), ref.pollId(), ref.roundId(), ref.open()))
                    .toList();
            return new MatchDto(
                    dto.id(), dto.clubId(), dto.homeTeamId(), dto.homeTeamName(), dto.awayTeamId(), dto.awayTeamName(),
                    dto.homeTeamLogoUrl(), dto.awayTeamLogoUrl(),
                    dto.leagueId(), dto.seasonId(), dto.matchDate(), dto.venue(), dto.active(),
                    isAnnounced(sideByKey, dto.id(), dto.homeTeamId()),
                    isAnnounced(sideByKey, dto.id(), dto.awayTeamId()),
                    dto.createdAt(), dto.updatedAt(), dto.updatedBy(),
                    homeClub ? pickedCount(sideByKey, pickedBySideId, dto.id(), dto.homeTeamId()) : null,
                    awayClub ? pickedCount(sideByKey, pickedBySideId, dto.id(), dto.awayTeamId()) : null,
                    dto.leagueId() == null ? null : xiSizeByLeagueId.get(dto.leagueId()),
                    polls,
                    dto.homeLeagueTeamId(), dto.awayLeagueTeamId());
        });
    }

    private boolean isClubTeamSide(MatchDto dto, UUID teamId, Map<UUID, UUID> clubByTeamId) {
        return teamId != null && Objects.equals(clubByTeamId.get(teamId), dto.clubId());
    }

    private boolean isAnnounced(Map<String, MatchSide> sideByKey, UUID matchId, UUID teamId) {
        MatchSide side = teamId == null ? null : sideByKey.get(matchId + "|" + teamId);
        return side != null && side.isAnnounced();
    }

    private int pickedCount(
            Map<String, MatchSide> sideByKey, Map<UUID, Long> pickedBySideId, UUID matchId, UUID teamId) {
        MatchSide side = sideByKey.get(matchId + "|" + teamId);
        return side == null ? 0 : pickedBySideId.getOrDefault(side.getId(), 0L).intValue();
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
        validateSides(
                request.homeTeamId(), request.homeTeamName(), request.homeLeagueTeamId(),
                request.awayTeamId(), request.awayTeamName(), request.awayLeagueTeamId());
        validateLogoOnlyWithName(
                request.homeTeamName(), request.homeTeamLogoUrl(), request.homeLeagueTeamId(),
                request.awayTeamName(), request.awayTeamLogoUrl(), request.awayLeagueTeamId());
        validateLeagueAndSeason(clubId, request.leagueId(), request.seasonId());
        validateTeamReferences(request.homeTeamId(), request.awayTeamId());
        LeagueTeam homeLeagueTeam = resolveLeagueTeam(
                clubId, request.leagueId(), request.seasonId(), request.homeLeagueTeamId(),
                request.awayLeagueTeamId(), null, "home");
        LeagueTeam awayLeagueTeam = resolveLeagueTeam(
                clubId, request.leagueId(), request.seasonId(), request.awayLeagueTeamId(),
                request.homeLeagueTeamId(), null, "away");
        accessService.assertCanAdministerAnySection(
                authentication,
                clubId,
                accessService.resolveMatchSectionIds(clubId, request.homeTeamId(), request.awayTeamId()));

        Match match = Match.builder()
                .clubId(clubId)
                .homeTeamId(request.homeTeamId())
                .homeTeamName(sideName(homeLeagueTeam, request.homeTeamName()))
                .awayTeamId(request.awayTeamId())
                .awayTeamName(sideName(awayLeagueTeam, request.awayTeamName()))
                .homeLeagueTeamId(request.homeLeagueTeamId())
                .awayLeagueTeamId(request.awayLeagueTeamId())
                .homeTeamLogoUrl(sideLogo(homeLeagueTeam, request.homeTeamLogoUrl()))
                .awayTeamLogoUrl(sideLogo(awayLeagueTeam, request.awayTeamLogoUrl()))
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
        // The stored match is loaded before side validation so an already-referenced (now
        // inactive) league team may be kept unchanged — see resolveLeagueTeam.
        Match match = findOrThrowForClub(clubId, matchId);
        validateSides(
                request.homeTeamId(), request.homeTeamName(), request.homeLeagueTeamId(),
                request.awayTeamId(), request.awayTeamName(), request.awayLeagueTeamId());
        validateLogoOnlyWithName(
                request.homeTeamName(), request.homeTeamLogoUrl(), request.homeLeagueTeamId(),
                request.awayTeamName(), request.awayTeamLogoUrl(), request.awayLeagueTeamId());
        validateLeagueAndSeason(clubId, request.leagueId(), request.seasonId());
        validateTeamReferences(request.homeTeamId(), request.awayTeamId());
        LeagueTeam homeLeagueTeam = resolveLeagueTeam(
                clubId, request.leagueId(), request.seasonId(), request.homeLeagueTeamId(),
                request.awayLeagueTeamId(), match.getHomeLeagueTeamId(), "home");
        LeagueTeam awayLeagueTeam = resolveLeagueTeam(
                clubId, request.leagueId(), request.seasonId(), request.awayLeagueTeamId(),
                request.homeLeagueTeamId(), match.getAwayLeagueTeamId(), "away");

        assertCanAdministerMatch(authentication, clubId, match);
        match.setHomeTeamId(request.homeTeamId());
        match.setHomeTeamName(sideName(homeLeagueTeam, request.homeTeamName()));
        match.setAwayTeamId(request.awayTeamId());
        match.setAwayTeamName(sideName(awayLeagueTeam, request.awayTeamName()));
        match.setHomeLeagueTeamId(request.homeLeagueTeamId());
        match.setAwayLeagueTeamId(request.awayLeagueTeamId());
        match.setHomeTeamLogoUrl(sideLogo(homeLeagueTeam, request.homeTeamLogoUrl()));
        match.setAwayTeamLogoUrl(sideLogo(awayLeagueTeam, request.awayTeamLogoUrl()));
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

    /**
     * Per docs/specs/070-league-teams.md, each side is exactly one of: an own team ({@code
     * *TeamId}, no league team), a league team ({@code *LeagueTeamId}, no {@code *TeamId}; any
     * client-sent name/logo is ignored and overwritten from the league team), or a free-text
     * opponent ({@code *TeamName}, no ids).
     */
    private void validateSides(
            UUID homeTeamId, String homeTeamName, UUID homeLeagueTeamId,
            UUID awayTeamId, String awayTeamName, UUID awayLeagueTeamId) {
        validateSide(homeTeamId, homeTeamName, homeLeagueTeamId, "home");
        validateSide(awayTeamId, awayTeamName, awayLeagueTeamId, "away");
    }

    private void validateSide(UUID teamId, String teamName, UUID leagueTeamId, String side) {
        if (leagueTeamId != null) {
            if (teamId != null) {
                throw new ValidationException(
                        side + "LeagueTeamId cannot be set alongside " + side + "TeamId");
            }
            return;
        }
        validateExactlyOneOfIdOrName(teamId, teamName, side);
    }

    private void validateExactlyOneOfIdOrName(UUID teamId, String teamName, String side) {
        boolean hasId = teamId != null;
        boolean hasName = teamName != null && !teamName.isBlank();
        if (hasId == hasName) {
            throw new ValidationException(
                    "Exactly one of " + side + "TeamId/" + side + "TeamName must be set");
        }
    }

    /**
     * Per docs/specs/050-league-schedule-and-fixtures.md: a side's logo may only be set alongside
     * that side's free-text name (i.e. that side is an external opponent, {@code *TeamId} null) —
     * never alongside a real {@code Team} id, whose logo already comes from {@code Team.logoUrl}
     * resolved via the id. Mirrors {@link #validateExactlyOneOfIdOrName}'s existing posture (a
     * clean {@link ValidationException} ahead of any DB-level check); called alongside {@link
     * #validateSides} from both {@link #create}/{@link #update}.
     */
    private void validateLogoOnlyWithName(
            String homeTeamName, String homeTeamLogoUrl, UUID homeLeagueTeamId,
            String awayTeamName, String awayTeamLogoUrl, UUID awayLeagueTeamId) {
        // A league-team side's name/logo come from the league team (client values are ignored),
        // so the free-text logo rule only applies to the other two kinds of side.
        if (homeLeagueTeamId == null) {
            validateLogoOnlyWithName(homeTeamName, homeTeamLogoUrl, "home");
        }
        if (awayLeagueTeamId == null) {
            validateLogoOnlyWithName(awayTeamName, awayTeamLogoUrl, "away");
        }
    }

    private void validateLogoOnlyWithName(String teamName, String teamLogoUrl, String side) {
        boolean hasLogo = teamLogoUrl != null && !teamLogoUrl.isBlank();
        boolean hasName = teamName != null && !teamName.isBlank();
        if (hasLogo && !hasName) {
            throw new ValidationException(
                    side + "TeamLogoUrl may only be set alongside " + side + "TeamName");
        }
    }

    private void validateLeagueAndSeason(UUID clubId, UUID leagueId, UUID seasonId) {
        if (leagueId != null) {
            LeagueSeasonAccessValidation.assertLeagueBelongsToClub(leagueRepository, leagueId, clubId);
        }
        if (seasonId == null) {
            throw new ValidationException("seasonId is required");
        }
        LeagueSeasonAccessValidation.assertSeasonBelongsToClub(seasonRepository, seasonId, clubId);
    }

    /**
     * Per docs/specs/070-league-teams.md: resolves one side's league team (null when the side has
     * none). The league team must exist and belong to this club via its league (404); the match
     * must have a league whose id and season equal the league team's (400); the other side must
     * not reference the same league team (400); an inactive league team may not be newly selected
     * (400) unless it is the one already stored on this side of the match ({@code
     * storedLeagueTeamId}, null on create).
     */
    private LeagueTeam resolveLeagueTeam(
            UUID clubId, UUID matchLeagueId, UUID matchSeasonId, UUID leagueTeamId, UUID otherSideLeagueTeamId,
            UUID storedLeagueTeamId, String side) {
        if (leagueTeamId == null) {
            return null;
        }
        if (leagueTeamId.equals(otherSideLeagueTeamId)) {
            throw new ValidationException("Home and away cannot be the same league team");
        }
        LeagueTeam leagueTeam = leagueTeamRepository
                .findById(leagueTeamId)
                .orElseThrow(() -> new NotFoundException("League team not found: " + leagueTeamId));
        LeagueSeasonAccessValidation.assertLeagueBelongsToClub(leagueRepository, leagueTeam.getLeagueId(), clubId);
        if (matchLeagueId == null) {
            throw new ValidationException(side + "LeagueTeamId requires the match to have a league");
        }
        if (!leagueTeam.getLeagueId().equals(matchLeagueId) || !leagueTeam.getSeasonId().equals(matchSeasonId)) {
            throw new ValidationException(
                    side + "LeagueTeamId must belong to the match's league and season");
        }
        if (!leagueTeam.isActive() && !leagueTeamId.equals(storedLeagueTeamId)) {
            throw new ValidationException("League team is inactive: " + leagueTeamId);
        }
        return leagueTeam;
    }

    private String sideName(LeagueTeam leagueTeam, String requestedName) {
        return leagueTeam == null ? requestedName : leagueTeam.getName();
    }

    private String sideLogo(LeagueTeam leagueTeam, String requestedLogoUrl) {
        return leagueTeam == null ? requestedLogoUrl : leagueTeam.getLogoUrl();
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
