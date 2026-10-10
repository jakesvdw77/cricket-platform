package com.cricketlegend.service.impl;

import com.cricketlegend.domain.League;
import com.cricketlegend.domain.LeaguePlayingConditions;
import com.cricketlegend.domain.LeagueListFocus;
import com.cricketlegend.domain.LeagueSource;
import com.cricketlegend.domain.LeagueTeam;
import com.cricketlegend.domain.Season;
import com.cricketlegend.domain.SocialLink;
import com.cricketlegend.dto.CreateLeagueRequest;
import com.cricketlegend.dto.LeagueDto;
import com.cricketlegend.dto.LeagueSeasonTeamDto;
import com.cricketlegend.dto.LeaguesSummaryDto;
import com.cricketlegend.dto.SocialLinkDto;
import com.cricketlegend.dto.UpdateLeagueRequest;
import com.cricketlegend.exception.InvalidStatusTransitionException;
import com.cricketlegend.exception.NotFoundException;
import com.cricketlegend.exception.ValidationException;
import com.cricketlegend.mapper.LeagueMapper;
import com.cricketlegend.repository.LeagueAffiliationRepository;
import com.cricketlegend.repository.LeagueAffiliationRepository.LeagueTeamCount;
import com.cricketlegend.repository.LeagueAffiliationRepository.LeagueTeamSummary;
import com.cricketlegend.repository.LeaguePlayingConditionsRepository;
import com.cricketlegend.repository.LeagueRepository;
import com.cricketlegend.repository.LeagueTeamRepository;
import com.cricketlegend.repository.MatchRepository;
import com.cricketlegend.repository.MatchRepository.LeagueMatchSummary;
import com.cricketlegend.repository.MatchRepository.LeagueWeekMatchCount;
import com.cricketlegend.repository.TeamSquadMemberRepository;
import com.cricketlegend.repository.SeasonRepository;
import com.cricketlegend.service.LeagueService;
import com.cricketlegend.service.support.LeagueListRow;
import com.cricketlegend.service.support.LeagueSeasonFields;
import com.cricketlegend.service.support.SeasonResolution;
import com.cricketlegend.service.support.ServerClock;
import com.cricketlegend.service.support.SocialLinkValidation;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Business rules per docs/specs/029-league-management.md: {@code list} returns every league for a
 * club (active and inactive, not paginated — a deliberately small bounded collection, mirroring
 * {@code SponsorServiceImpl}); {@code create}/{@code update} default {@code source} to {@code
 * INTERNAL}, {@code maxPlayingXiSize} to 11 when the request leaves them null, and validate {@code
 * minAge <= maxAge} when both are set — ENFORCED
 * (unlike {@code Section.minAge}/{@code maxAge}, see the spec's Problem &amp; Goals divergence
 * note), though the enforcement itself lives in {@code MatchSideServiceImpl}, not here; {@code
 * deactivate}/{@code reactivate} mirror {@code SponsorServiceImpl}'s one-way transition-guard
 * shape; every lookup is scoped to the owning club, not just by id. Per
 * docs/specs/050-league-schedule-and-fixtures.md: {@code list} also resolves the club's own
 * "current" {@link Season} once ({@link SeasonResolution#currentSeasonId}) and batch-computes each league's
 * {@code currentSeasonTeamCount}/{@code currentSeasonLabel}/{@code
 * currentSeasonPlayingConditionsUrl} in one round trip each (never per-league), reconstructing
 * each {@link LeagueDto} via {@link #withCurrentSeasonFields}. Per
 * docs/specs/053-league-extended-profile.md: {@code create}/{@code update} also reject a
 * duplicate {@code platform} within the request's {@code socialLinks} via the shared {@link
 * com.cricketlegend.service.support.SocialLinkValidation}, also used by {@code
 * SponsorServiceImpl}/{@code ClubProfileServiceImpl}, and set the five new profile fields. Per
 * docs/specs/071-league-card-redesign.md: {@code list} reads {@code now} once and also batches the
 * season's match aggregates and team lists (three more queries, once each), merged per league.
 */
@Service
public class LeagueServiceImpl implements LeagueService {

    private final LeagueRepository leagueRepository;
    private final SeasonRepository seasonRepository;
    private final LeagueAffiliationRepository leagueAffiliationRepository;
    private final LeaguePlayingConditionsRepository leaguePlayingConditionsRepository;
    private final MatchRepository matchRepository;
    private final LeagueTeamRepository leagueTeamRepository;
    private final TeamSquadMemberRepository teamSquadMemberRepository;
    private final LeagueMapper leagueMapper;

    public LeagueServiceImpl(
            LeagueRepository leagueRepository,
            SeasonRepository seasonRepository,
            LeagueAffiliationRepository leagueAffiliationRepository,
            LeaguePlayingConditionsRepository leaguePlayingConditionsRepository,
            MatchRepository matchRepository,
            LeagueTeamRepository leagueTeamRepository,
            TeamSquadMemberRepository teamSquadMemberRepository,
            LeagueMapper leagueMapper) {
        this.leagueRepository = leagueRepository;
        this.seasonRepository = seasonRepository;
        this.leagueAffiliationRepository = leagueAffiliationRepository;
        this.leaguePlayingConditionsRepository = leaguePlayingConditionsRepository;
        this.matchRepository = matchRepository;
        this.leagueTeamRepository = leagueTeamRepository;
        this.teamSquadMemberRepository = teamSquadMemberRepository;
        this.leagueMapper = leagueMapper;
    }

    @Override
    @Transactional(readOnly = true)
    public List<LeagueDto> list(UUID clubId) {
        return list(clubId, null, true, null);
    }

    /**
     * docs/specs/091-leagues-gold-standard.md: the list for one season ({@code seasonId}, else the club's current
     * season), with inactive leagues dropped when {@code includeInactive} is false and narrowed by {@code focus}. The
     * rows are built once in memory and filtered, so {@link #summary} (built from the same rows) can never disagree.
     */
    @Override
    @Transactional(readOnly = true)
    public List<LeagueDto> list(UUID clubId, UUID seasonId, boolean includeInactive, LeagueListFocus focus) {
        List<Season> seasons = seasonRepository.findByClubId(clubId);
        UUID resolvedSeasonId = SeasonResolution.resolve(seasons, seasonId);
        List<LeagueListRow> rows = buildRows(clubId, seasons, resolvedSeasonId, focus == LeagueListFocus.THIS_WEEK);
        return filter(rows, includeInactive, focus).stream().map(LeagueListRow::dto).toList();
    }

    @Override
    @Transactional(readOnly = true)
    public LeaguesSummaryDto summary(UUID clubId, UUID seasonId, boolean includeInactive) {
        List<Season> seasons = seasonRepository.findByClubId(clubId);
        UUID resolvedSeasonId = SeasonResolution.resolve(seasons, seasonId);
        List<LeagueListRow> shown = filter(buildRows(clubId, seasons, resolvedSeasonId, true), includeInactive, null);

        long active = shown.stream().filter(row -> row.dto().active()).count();
        long needAttention = shown.stream().filter(LeagueListRow::needsAttention).count();
        long matchesThisWeek = shown.stream().mapToLong(LeagueListRow::weekMatchCount).sum();
        long teamsEntered = shown.stream()
                .mapToLong(row -> row.dto().teams() == null ? 0 : row.dto().teams().size())
                .sum();
        long players = 0;
        if (resolvedSeasonId != null && !shown.isEmpty()) {
            List<UUID> leagueIds = shown.stream().map(row -> row.dto().id()).toList();
            players = teamSquadMemberRepository.countDistinctPlayersInLeagues(resolvedSeasonId, leagueIds);
        }
        return new LeaguesSummaryDto(shown.size(), active, teamsEntered, players, seasons.size(), matchesThisWeek, needAttention);
    }

    private List<LeagueListRow> filter(List<LeagueListRow> rows, boolean includeInactive, LeagueListFocus focus) {
        return rows.stream()
                .filter(row -> includeInactive || row.dto().active())
                .filter(row -> {
                    if (focus == LeagueListFocus.ACTIVE) {
                        return row.dto().active();
                    }
                    if (focus == LeagueListFocus.THIS_WEEK) {
                        return row.weekMatchCount() > 0;
                    }
                    if (focus == LeagueListFocus.ATTENTION) {
                        return row.needsAttention();
                    }
                    return true;
                })
                .toList();
    }

    /** Every league of the club with its figures for {@code seasonId} (or empty figures when there is no season). */
    private List<LeagueListRow> buildRows(UUID clubId, List<Season> seasons, UUID seasonId, boolean withWeek) {
        List<League> leagues = leagueRepository.findByClubId(clubId);

        if (seasonId == null) {
            return leagues.stream()
                    .map(league -> new LeagueListRow(withCurrentSeasonFields(league, LeagueSeasonFields.none()), 0))
                    .toList();
        }

        Instant now = ServerClock.now();
        Map<UUID, Long> teamCountByLeagueId = new HashMap<>();
        for (LeagueTeamCount row : leagueAffiliationRepository.countDistinctTeamsBySeasonId(seasonId)) {
            teamCountByLeagueId.put(row.getLeagueId(), row.getTeamCount());
        }
        Map<UUID, String> documentUrlByLeagueId = new HashMap<>();
        for (LeaguePlayingConditions playingConditions : leaguePlayingConditionsRepository.findBySeasonId(seasonId)) {
            documentUrlByLeagueId.put(playingConditions.getLeagueId(), playingConditions.getDocumentUrl());
        }
        Map<UUID, LeagueMatchSummary> matchSummaryByLeagueId = new HashMap<>();
        for (LeagueMatchSummary row : matchRepository.summariseByLeagueForSeason(clubId, seasonId, now)) {
            matchSummaryByLeagueId.put(row.getLeagueId(), row);
        }
        Map<UUID, Long> weekCountByLeagueId = new HashMap<>();
        if (withWeek) {
            Instant weekStart = ServerClock.startOfToday();
            Instant weekEnd = ServerClock.startOfDayFromToday(ManagerOverviewServiceImpl.WEEK_DAYS);
            for (LeagueWeekMatchCount row :
                    matchRepository.countMatchesInWindowByLeague(clubId, seasonId, weekStart, weekEnd)) {
                weekCountByLeagueId.put(row.getLeagueId(), row.getMatchCount());
            }
        }
        Map<UUID, List<LeagueSeasonTeamDto>> teamsByLeagueId = new HashMap<>();
        for (LeagueTeamSummary row : leagueAffiliationRepository.findTeamSummariesBySeasonId(seasonId)) {
            teamsByLeagueId
                    .computeIfAbsent(row.getLeagueId(), key -> new ArrayList<>())
                    .add(new LeagueSeasonTeamDto(row.getName(), row.getAbbreviation(), row.getLogoUrl(), true));
        }
        for (LeagueTeam leagueTeam : leagueTeamRepository.findActiveBySeasonId(seasonId)) {
            teamsByLeagueId
                    .computeIfAbsent(leagueTeam.getLeagueId(), key -> new ArrayList<>())
                    .add(new LeagueSeasonTeamDto(
                            leagueTeam.getName(), leagueTeam.getAbbreviation(), leagueTeam.getLogoUrl(), false));
        }
        String seasonLabel = seasons.stream()
                .filter(season -> season.getId().equals(seasonId))
                .findFirst()
                .map(Season::getLabel)
                .orElse(null);

        return leagues.stream()
                .map(league -> {
                    LeagueMatchSummary summary = matchSummaryByLeagueId.get(league.getId());
                    LeagueDto dto = withCurrentSeasonFields(
                            league,
                            new LeagueSeasonFields(
                                    teamCountByLeagueId.getOrDefault(league.getId(), 0L).intValue(),
                                    seasonLabel,
                                    documentUrlByLeagueId.get(league.getId()),
                                    summary == null ? 0 : (int) summary.getMatchCount(),
                                    summary == null ? 0 : (int) summary.getPlayedCount(),
                                    summary == null ? null : summary.getFirstMatchDate(),
                                    summary == null ? null : summary.getLastMatchDate(),
                                    summary == null ? null : summary.getNextMatchDate(),
                                    teamsByLeagueId.getOrDefault(league.getId(), List.of())));
                    return new LeagueListRow(dto, weekCountByLeagueId.getOrDefault(league.getId(), 0L).intValue());
                })
                .toList();
    }

    /**
     * Maps {@code league} via MapStruct, then reconstructs the record adding the computed
     * "current season" fields — the same pattern {@code MatchServiceImpl.enrichAnnounced} uses for
     * {@code homeSideAnnounced}/{@code awaySideAnnounced}.
     */
    private LeagueDto withCurrentSeasonFields(League league, LeagueSeasonFields fields) {
        LeagueDto dto = leagueMapper.toDto(league);
        return new LeagueDto(
                dto.id(), dto.clubId(), dto.name(), dto.source(), dto.maxPlayingXiSize(),
                dto.minAge(), dto.maxAge(), dto.ageCutoffDate(), dto.format(), dto.logoUrl(), dto.phone(),
                dto.website(), dto.email(), dto.socialLinks(), dto.active(), dto.createdAt(), dto.updatedAt(),
                dto.updatedBy(), fields.currentSeasonTeamCount(), fields.currentSeasonLabel(),
                fields.currentSeasonPlayingConditionsUrl(), fields.matchCount(), fields.playedCount(),
                fields.firstMatchDate(), fields.lastMatchDate(), fields.nextMatchDate(), fields.teams());
    }

    @Override
    @Transactional
    public LeagueDto create(UUID clubId, CreateLeagueRequest request) {
        validateAgeRange(request.minAge(), request.maxAge());
        SocialLinkValidation.requireNoDuplicatePlatform(request.socialLinks());

        League league = League.builder()
                .clubId(clubId)
                .name(request.name())
                .source(request.source() != null ? request.source() : LeagueSource.INTERNAL)
                .maxPlayingXiSize(request.maxPlayingXiSize() != null ? request.maxPlayingXiSize() : 11)
                .minAge(request.minAge())
                .maxAge(request.maxAge())
                .ageCutoffDate(request.ageCutoffDate())
                .format(request.format())
                .logoUrl(request.logoUrl())
                .phone(request.phone())
                .website(request.website())
                .email(request.email())
                .socialLinks(toSocialLinks(request.socialLinks()))
                .active(true)
                .build();

        return leagueMapper.toDto(leagueRepository.save(league));
    }

    @Override
    @Transactional
    public LeagueDto update(UUID clubId, UUID leagueId, UpdateLeagueRequest request) {
        validateAgeRange(request.minAge(), request.maxAge());
        SocialLinkValidation.requireNoDuplicatePlatform(request.socialLinks());
        League league = findOrThrowForClub(clubId, leagueId);

        league.setName(request.name());
        league.setSource(request.source() != null ? request.source() : LeagueSource.INTERNAL);
        league.setMaxPlayingXiSize(
                request.maxPlayingXiSize() != null ? request.maxPlayingXiSize() : 11);
        league.setMinAge(request.minAge());
        league.setMaxAge(request.maxAge());
        league.setAgeCutoffDate(request.ageCutoffDate());
        league.setFormat(request.format());
        league.setLogoUrl(request.logoUrl());
        league.setPhone(request.phone());
        league.setWebsite(request.website());
        league.setEmail(request.email());
        league.setSocialLinks(toSocialLinks(request.socialLinks()));

        return leagueMapper.toDto(leagueRepository.save(league));
    }

    @Override
    @Transactional
    public LeagueDto deactivate(UUID clubId, UUID leagueId) {
        League league = findOrThrowForClub(clubId, leagueId);
        if (!league.isActive()) {
            throw new InvalidStatusTransitionException("League is already inactive: " + leagueId);
        }
        league.setActive(false);
        return leagueMapper.toDto(leagueRepository.save(league));
    }

    @Override
    @Transactional
    public LeagueDto reactivate(UUID clubId, UUID leagueId) {
        League league = findOrThrowForClub(clubId, leagueId);
        if (league.isActive()) {
            throw new InvalidStatusTransitionException("League is already active: " + leagueId);
        }
        league.setActive(true);
        return leagueMapper.toDto(leagueRepository.save(league));
    }

    private void validateAgeRange(Integer minAge, Integer maxAge) {
        if (minAge != null && maxAge != null && minAge > maxAge) {
            throw new ValidationException("minAge must be <= maxAge");
        }
    }

    /**
     * 404s when {@code leagueId} doesn't exist at all, or exists but belongs to a different
     * club — real cross-club isolation at the data layer, not only relying on the controller's
     * {@code @PreAuthorize}.
     */
    private League findOrThrowForClub(UUID clubId, UUID leagueId) {
        League league = leagueRepository
                .findById(leagueId)
                .orElseThrow(() -> new NotFoundException("League not found: " + leagueId));
        if (!league.getClubId().equals(clubId)) {
            throw new NotFoundException("League not found: " + leagueId);
        }
        return league;
    }

    /**
     * {@code League} is built via {@code League.builder()}, not {@code leagueMapper.toEntity()}
     * (there is no request-to-entity mapping method on {@link LeagueMapper}), so {@code
     * socialLinks} needs this small helper instead of the mapper-level list conversion — mirrors
     * {@code SponsorServiceImpl.toSocialLinks}.
     */
    private List<SocialLink> toSocialLinks(List<SocialLinkDto> dtos) {
        if (dtos == null) {
            return new ArrayList<>();
        }
        List<SocialLink> links = new ArrayList<>();
        for (SocialLinkDto dto : dtos) {
            links.add(leagueMapper.toEntity(dto));
        }
        return links;
    }
}
