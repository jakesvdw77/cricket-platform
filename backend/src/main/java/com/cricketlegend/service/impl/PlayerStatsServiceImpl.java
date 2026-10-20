package com.cricketlegend.service.impl;

import com.cricketlegend.domain.DismissalType;
import com.cricketlegend.dto.PlayerStatsDto;
import com.cricketlegend.dto.PlayerStatsFilterOptionsDto;
import com.cricketlegend.exception.NotFoundException;
import com.cricketlegend.exception.ValidationException;
import com.cricketlegend.repository.LeagueRepository;
import com.cricketlegend.repository.PlayerProfileRepository;
import com.cricketlegend.repository.PlayerStatsAggregateRepository;
import com.cricketlegend.repository.PlayerStatsAggregateRepository.PlayerStatsAggregateView;
import com.cricketlegend.repository.PlayerStatsFactsRepository;
import com.cricketlegend.repository.PlayerStatsFactsRepository.DismissalCountView;
import com.cricketlegend.repository.PlayerStatsFactsRepository.FilterOptionView;
import com.cricketlegend.repository.SeasonRepository;
import com.cricketlegend.repository.TeamRepository;
import com.cricketlegend.service.PlayerStatsService;
import com.cricketlegend.service.support.ClubMatchScope;
import com.cricketlegend.service.support.PlayerStatsCalculator;
import com.cricketlegend.service.support.PlayerStatsCounters;
import com.cricketlegend.service.support.PlayerStatsFacts;
import com.cricketlegend.service.support.StatsScope;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * docs/specs/103-player-stats.md: resolves and validates the filters (the one place a stats read checks tenancy and
 * section scope), reads the counters and facts of one player through the stats repositories and hands them to {@link
 * PlayerStatsCalculator}. No figure is computed here.
 */
@Service
public class PlayerStatsServiceImpl implements PlayerStatsService {

    private static final Logger log = LoggerFactory.getLogger(PlayerStatsServiceImpl.class);

    /** Native {@code IN} lists may not be empty; this id matches no team. */
    private static final UUID NO_TEAM = new UUID(0L, 0L);

    private final PlayerStatsAggregateRepository aggregateRepository;
    private final PlayerStatsFactsRepository factsRepository;
    private final PlayerProfileRepository playerProfileRepository;
    private final SeasonRepository seasonRepository;
    private final LeagueRepository leagueRepository;
    private final TeamRepository teamRepository;
    private final ClubMatchScope clubMatchScope;

    public PlayerStatsServiceImpl(
            PlayerStatsAggregateRepository aggregateRepository,
            PlayerStatsFactsRepository factsRepository,
            PlayerProfileRepository playerProfileRepository,
            SeasonRepository seasonRepository,
            LeagueRepository leagueRepository,
            TeamRepository teamRepository,
            ClubMatchScope clubMatchScope) {
        this.aggregateRepository = aggregateRepository;
        this.factsRepository = factsRepository;
        this.playerProfileRepository = playerProfileRepository;
        this.seasonRepository = seasonRepository;
        this.leagueRepository = leagueRepository;
        this.teamRepository = teamRepository;
        this.clubMatchScope = clubMatchScope;
    }

    @Override
    @Transactional(readOnly = true)
    public PlayerStatsDto get(
            Authentication authentication,
            UUID clubId,
            UUID playerId,
            UUID seasonId,
            UUID leagueId,
            UUID teamId,
            UUID sectionId,
            String competition) {
        StatsScope.Competition competitionFilter = parseCompetition(competition);
        playerProfileRepository
                .findById(playerId)
                .filter(player -> clubId.equals(player.getClubId()))
                .orElseThrow(() -> new NotFoundException("Player not found: " + playerId));
        if (seasonId != null) {
            seasonRepository
                    .findById(seasonId)
                    .filter(season -> clubId.equals(season.getClubId()))
                    .orElseThrow(() -> new NotFoundException("Season not found: " + seasonId));
        }
        if (leagueId != null) {
            leagueRepository
                    .findById(leagueId)
                    .filter(league -> clubId.equals(league.getClubId()))
                    .orElseThrow(() -> new NotFoundException("League not found: " + leagueId));
        }

        // 404 for another club's section or team, 403 outside a section-scoped caller's reach (ClubMatchScope).
        ClubMatchScope.Scope reach = clubMatchScope.resolve(authentication, clubId, sectionId, teamId);
        Set<UUID> sectionTeamIds = reach.sectionIds() == null ? null : teamIdsInSections(clubId, reach.sectionIds());
        StatsScope scope =
                new StatsScope(clubId, seasonId, leagueId, teamId, sectionTeamIds, competitionFilter);

        PlayerStatsCounters counters = PlayerStatsCounters.EMPTY;
        PlayerStatsFacts facts = PlayerStatsFacts.EMPTY;
        boolean nothingInReach = reach.empty() || (sectionTeamIds != null && sectionTeamIds.isEmpty());
        if (!nothingInReach) {
            List<PlayerStatsAggregateView> rows = aggregateRepository.aggregate(
                    clubId,
                    playerId,
                    scope.seasonId(),
                    scope.leagueId(),
                    scope.teamId(),
                    competitionName(scope),
                    scope.sectionRestricted(),
                    sectionTeamParameter(scope));
            if (!rows.isEmpty()) {
                counters = toCounters(rows.get(0));
                facts = readFacts(scope, playerId);
            }
        }
        log.debug("Player stats for player {} in club {}: {} matches counted", playerId, clubId, counters.matches());

        PlayerStatsCalculator.Figures figures = PlayerStatsCalculator.calculate(counters, facts);
        return new PlayerStatsDto(
                playerId,
                new PlayerStatsDto.PlayerStatsScope(
                        "CLUB_VERIFIED", seasonId, leagueId, teamId, sectionId, competitionName(scope)),
                figures.basis(),
                figures.batting(),
                figures.bowling(),
                figures.fielding(),
                figures.awards(),
                figures.record(),
                figures.form(),
                figures.notCaptured());
    }

    @Override
    @Transactional(readOnly = true)
    public PlayerStatsFilterOptionsDto filterOptions(Authentication authentication, UUID clubId, UUID playerId) {
        playerProfileRepository
                .findById(playerId)
                .filter(player -> clubId.equals(player.getClubId()))
                .orElseThrow(() -> new NotFoundException("Player not found: " + playerId));
        ClubMatchScope.Scope reach = clubMatchScope.resolve(authentication, clubId, null, null);
        Set<UUID> sectionTeamIds = reach.sectionIds() == null ? null : teamIdsInSections(clubId, reach.sectionIds());
        if (reach.empty() || (sectionTeamIds != null && sectionTeamIds.isEmpty())) {
            return new PlayerStatsFilterOptionsDto(List.of(), List.of(), List.of(), List.of(), List.of());
        }
        StatsScope scope = new StatsScope(clubId, null, null, null, sectionTeamIds, null);
        Set<UUID> seasons = new LinkedHashSet<>();
        Set<UUID> leagues = new LinkedHashSet<>();
        Set<UUID> teams = new LinkedHashSet<>();
        Set<UUID> sections = new LinkedHashSet<>();
        Set<String> competitions = new LinkedHashSet<>();
        for (FilterOptionView row : factsRepository.filterOptions(
                clubId,
                playerId,
                null,
                null,
                null,
                null,
                scope.sectionRestricted(),
                sectionTeamParameter(scope))) {
            addIfPresent(seasons, row.getSeasonId());
            addIfPresent(leagues, row.getLeagueId());
            addIfPresent(teams, row.getTeamId());
            addIfPresent(sections, row.getSectionId());
            addIfPresent(competitions, row.getCompetition());
        }
        return new PlayerStatsFilterOptionsDto(
                List.copyOf(seasons),
                List.copyOf(leagues),
                List.copyOf(teams),
                List.copyOf(sections),
                List.copyOf(competitions));
    }

    private static <T> void addIfPresent(Set<T> target, T value) {
        if (value != null) {
            target.add(value);
        }
    }

    private Set<UUID> teamIdsInSections(UUID clubId, Set<UUID> sectionIds) {
        Set<UUID> teamIds = new HashSet<>();
        teamRepository.findByClubId(clubId).forEach(team -> {
            if (sectionIds.contains(team.getSectionId())) {
                teamIds.add(team.getId());
            }
        });
        return teamIds;
    }

    private static StatsScope.Competition parseCompetition(String competition) {
        if (competition == null || competition.isBlank()) {
            return null;
        }
        try {
            return StatsScope.Competition.valueOf(competition);
        } catch (IllegalArgumentException e) {
            throw new ValidationException("competition must be LEAGUE or FRIENDLY.");
        }
    }

    private static String competitionName(StatsScope scope) {
        return scope.competition() == null ? null : scope.competition().name();
    }

    private static List<UUID> sectionTeamParameter(StatsScope scope) {
        return scope.sectionRestricted() && !scope.sectionTeamIds().isEmpty()
                ? List.copyOf(scope.sectionTeamIds())
                : List.of(NO_TEAM);
    }

    private PlayerStatsFacts readFacts(StatsScope scope, UUID playerId) {
        UUID clubId = scope.clubId();
        UUID season = scope.seasonId();
        UUID league = scope.leagueId();
        UUID team = scope.teamId();
        String competition = competitionName(scope);
        boolean restricted = scope.sectionRestricted();
        List<UUID> sectionTeams = sectionTeamParameter(scope);

        List<PlayerStatsFacts.InningsFact> innings = new ArrayList<>();
        factsRepository
                .recentInnings(clubId, playerId, season, league, team, competition, restricted, sectionTeams)
                .forEach(row -> innings.add(new PlayerStatsFacts.InningsFact(
                        row.getMatchId(),
                        Instant.ofEpochMilli(row.getMatchEpochMillis()),
                        row.getRuns(),
                        Boolean.TRUE.equals(row.getNotOut()),
                        row.getBalls())));
        List<PlayerStatsFacts.SpellFact> spells = new ArrayList<>();
        factsRepository
                .recentSpells(clubId, playerId, season, league, team, competition, restricted, sectionTeams)
                .forEach(row -> spells.add(new PlayerStatsFacts.SpellFact(
                        row.getMatchId(),
                        Instant.ofEpochMilli(row.getMatchEpochMillis()),
                        row.getWickets(),
                        row.getRuns(),
                        row.getBalls(),
                        row.getBallsPerOver())));
        List<PlayerStatsFacts.PositionFact> positions = new ArrayList<>();
        factsRepository
                .positions(clubId, playerId, season, league, team, competition, restricted, sectionTeams)
                .forEach(row -> positions.add(new PlayerStatsFacts.PositionFact(
                        row.getPosition(), n(row.getInnings()), n(row.getRuns()), n(row.getDismissals()))));
        return new PlayerStatsFacts(
                innings,
                spells,
                positions,
                dismissalCounts(factsRepository.batterDismissals(
                        clubId, playerId, season, league, team, competition, restricted, sectionTeams)),
                dismissalCounts(factsRepository.bowlerDismissals(
                        clubId, playerId, season, league, team, competition, restricted, sectionTeams)));
    }

    private static Map<DismissalType, Long> dismissalCounts(List<DismissalCountView> rows) {
        Map<DismissalType, Long> counts = new EnumMap<>(DismissalType.class);
        rows.forEach(row -> counts.merge(DismissalType.valueOf(row.getType()), n(row.getTotal()), Long::sum));
        return counts;
    }

    private static PlayerStatsCounters toCounters(PlayerStatsAggregateView v) {
        return new PlayerStatsCounters(
                n(v.getMatches()),
                n(v.getResultsWithBattingCard()),
                n(v.getResultsWithBowlingCard()),
                new PlayerStatsCounters.Batting(
                        n(v.getBatInnings()),
                        n(v.getBatNotOuts()),
                        n(v.getBatDismissals()),
                        n(v.getBatRuns()),
                        n(v.getBatBallsFaced()),
                        n(v.getBatInningsWithBalls()),
                        n(v.getBatRunsWithBalls()),
                        n(v.getBatFours()),
                        n(v.getBatSixes()),
                        n(v.getBatInningsWithBoundaries()),
                        n(v.getBatBoundaryRuns()),
                        n(v.getBatRunsWithBoundaries()),
                        n(v.getBatBallsForBoundaries()),
                        n(v.getBatBoundaryCount()),
                        n(v.getBatDucks()),
                        n(v.getBatGoldenDucks()),
                        n(v.getBatThirtyPlus()),
                        n(v.getBatFiftyPlus()),
                        n(v.getBatHundredPlus()),
                        n(v.getBatCenturies()),
                        n(v.getBatHalfCenturies()),
                        v.getBatHighestKey()),
                new PlayerStatsCounters.Bowling(
                        n(v.getBowlInnings()),
                        n(v.getBowlBalls()),
                        n(v.getBowlRuns()),
                        n(v.getBowlWickets()),
                        n(v.getBowlMaidens()),
                        n(v.getBowlWides()),
                        n(v.getBowlNoBalls()),
                        n(v.getBowlDots()),
                        n(v.getBowlInningsWithWides()),
                        n(v.getBowlInningsWithNoBalls()),
                        n(v.getBowlInningsWithDots()),
                        n(v.getBowlBallsWithDots()),
                        v.getBowlOvers() == null ? BigDecimal.ZERO : v.getBowlOvers(),
                        ballsPerOver(v.getBowlBallsPerOver()),
                        n(v.getBowlThreeWickets()),
                        n(v.getBowlFourWickets()),
                        n(v.getBowlFiveWickets()),
                        v.getBowlBestKey()),
                new PlayerStatsCounters.Fielding(
                        n(v.getFieldCatches()), n(v.getFieldStumpings()), n(v.getFieldRunOuts())),
                new PlayerStatsCounters.Awards(n(v.getAwardPlayerOfMatch()), n(v.getAwardTeamPlayerOfMatch())),
                new PlayerStatsCounters.Record(
                        n(v.getRecWon()), n(v.getRecLost()), n(v.getRecTied()), n(v.getRecDrawn()), n(v.getRecInternal())));
    }

    private static List<Integer> ballsPerOver(String csv) {
        if (csv == null || csv.isBlank()) {
            return List.of();
        }
        List<Integer> values = new ArrayList<>();
        for (String part : csv.split(",")) {
            values.add(Integer.valueOf(part.trim()));
        }
        values.sort(Integer::compare);
        return values;
    }

    private static long n(Long value) {
        return value == null ? 0L : value;
    }

    private static long n(Integer value) {
        return value == null ? 0L : value;
    }
}
