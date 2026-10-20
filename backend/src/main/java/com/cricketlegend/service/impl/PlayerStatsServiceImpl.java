package com.cricketlegend.service.impl;

import com.cricketlegend.domain.DismissalType;
import com.cricketlegend.dto.PlayerStatsDto;
import com.cricketlegend.dto.PlayerStatsFilterOptionsDto;
import com.cricketlegend.exception.NotFoundException;
import com.cricketlegend.exception.ValidationException;
import com.cricketlegend.repository.PlayerProfileRepository;
import com.cricketlegend.repository.PlayerStatsAggregateRepository;
import com.cricketlegend.repository.PlayerStatsAggregateRepository.PlayerStatsAggregateView;
import com.cricketlegend.repository.PlayerStatsFactsRepository;
import com.cricketlegend.repository.PlayerStatsFactsRepository.DismissalCountView;
import com.cricketlegend.service.PlayerStatsService;
import com.cricketlegend.service.support.PlayerStatsCalculator;
import com.cricketlegend.service.support.PlayerStatsCountersReader;
import com.cricketlegend.service.support.PlayerStatsCounters;
import com.cricketlegend.service.support.PlayerStatsFacts;
import com.cricketlegend.service.support.StatsFilterOptionLists;
import com.cricketlegend.service.support.StatsScope;
import com.cricketlegend.service.support.StatsScopeResolver;
import java.time.Instant;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
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

    private final PlayerStatsAggregateRepository aggregateRepository;
    private final PlayerStatsFactsRepository factsRepository;
    private final PlayerProfileRepository playerProfileRepository;
    private final StatsScopeResolver scopeResolver;

    public PlayerStatsServiceImpl(
            PlayerStatsAggregateRepository aggregateRepository,
            PlayerStatsFactsRepository factsRepository,
            PlayerProfileRepository playerProfileRepository,
            StatsScopeResolver scopeResolver) {
        this.aggregateRepository = aggregateRepository;
        this.factsRepository = factsRepository;
        this.playerProfileRepository = playerProfileRepository;
        this.scopeResolver = scopeResolver;
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
        StatsScopeResolver.Resolved resolved =
                scopeResolver.resolve(authentication, clubId, seasonId, leagueId, teamId, sectionId, competitionFilter);
        StatsScope scope = resolved.scope();

        PlayerStatsCounters counters = PlayerStatsCounters.EMPTY;
        PlayerStatsFacts facts = PlayerStatsFacts.EMPTY;
        if (!resolved.nothingInReach()) {
            List<PlayerStatsAggregateView> rows = aggregateRepository.aggregate(
                    clubId,
                    playerId,
                    scope.seasonId(),
                    scope.leagueId(),
                    scope.teamId(),
                    StatsScopeResolver.competitionName(scope),
                    scope.sectionRestricted(),
                    StatsScopeResolver.sectionTeamParameter(scope));
            if (!rows.isEmpty()) {
                counters = PlayerStatsCountersReader.toCounters(rows.get(0));
                facts = readFacts(scope, playerId);
            }
        }
        log.debug("Player stats for player {} in club {}: {} matches counted", playerId, clubId, counters.matches());

        PlayerStatsCalculator.Figures figures = PlayerStatsCalculator.calculate(counters, facts);
        return new PlayerStatsDto(
                playerId,
                new PlayerStatsDto.PlayerStatsScope(
                        "CLUB_VERIFIED", seasonId, leagueId, teamId, sectionId, StatsScopeResolver.competitionName(scope)),
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
        StatsScopeResolver.Resolved resolved =
                scopeResolver.resolve(authentication, clubId, null, null, null, null, null);
        if (resolved.nothingInReach()) {
            return new PlayerStatsFilterOptionsDto(List.of(), List.of(), List.of(), List.of(), List.of());
        }
        StatsScope scope = resolved.scope();
        StatsFilterOptionLists lists = StatsFilterOptionLists.of(factsRepository.filterOptions(
                clubId,
                playerId,
                null,
                null,
                null,
                null,
                scope.sectionRestricted(),
                StatsScopeResolver.sectionTeamParameter(scope)));
        return new PlayerStatsFilterOptionsDto(
                lists.seasonIds(), lists.leagueIds(), lists.teamIds(), lists.sectionIds(), lists.competitions());
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

    private PlayerStatsFacts readFacts(StatsScope scope, UUID playerId) {
        UUID clubId = scope.clubId();
        UUID season = scope.seasonId();
        UUID league = scope.leagueId();
        UUID team = scope.teamId();
        String competition = StatsScopeResolver.competitionName(scope);
        boolean restricted = scope.sectionRestricted();
        List<UUID> sectionTeams = StatsScopeResolver.sectionTeamParameter(scope);

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

    private static long n(Long value) {
        return value == null ? 0L : value;
    }

    private static long n(Integer value) {
        return value == null ? 0L : value;
    }
}
