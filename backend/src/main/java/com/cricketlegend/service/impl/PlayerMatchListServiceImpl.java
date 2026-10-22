package com.cricketlegend.service.impl;

import com.cricketlegend.dto.LeaderboardTableDto.LeaderboardPageInfo;
import com.cricketlegend.dto.PlayerMatchListDto;
import com.cricketlegend.dto.PlayerMatchRowDto;
import com.cricketlegend.dto.PlayerStatsDto.PlayerStatsScope;
import com.cricketlegend.exception.ValidationException;
import com.cricketlegend.repository.PlayerStatsFactsRepository;
import com.cricketlegend.service.PlayerMatchListService;
import com.cricketlegend.service.support.PlayerMatchFactsReader;
import com.cricketlegend.service.support.PlayerMatchRowBuilder;
import com.cricketlegend.service.support.StatsScope;
import com.cricketlegend.service.support.ClubPlayerLookup;
import com.cricketlegend.service.support.StatsScopeResolver;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * docs/specs/115-player-match-list.md: validates the paging, resolves the filters through {@link StatsScopeResolver} (the
 * one place tenancy and section scope are checked), reads one page of the player's counted matches and their entries with
 * a fixed number of queries, and hands them to {@link PlayerMatchRowBuilder}. No figure is decided here, and no name is
 * logged.
 */
@Service
public class PlayerMatchListServiceImpl implements PlayerMatchListService {

    static final int DEFAULT_PAGE_SIZE = 20;
    static final int MAX_PAGE_SIZE = 100;

    private static final Logger log = LoggerFactory.getLogger(PlayerMatchListServiceImpl.class);

    private final PlayerStatsFactsRepository factsRepository;
    private final ClubPlayerLookup playerLookup;
    private final StatsScopeResolver scopeResolver;

    public PlayerMatchListServiceImpl(
            PlayerStatsFactsRepository factsRepository,
            ClubPlayerLookup playerLookup,
            StatsScopeResolver scopeResolver) {
        this.factsRepository = factsRepository;
        this.playerLookup = playerLookup;
        this.scopeResolver = scopeResolver;
    }

    @Override
    @Transactional(readOnly = true)
    public PlayerMatchListDto list(
            Authentication authentication,
            UUID clubId,
            UUID playerId,
            UUID seasonId,
            UUID leagueId,
            UUID teamId,
            UUID sectionId,
            String competition,
            String direction,
            Integer pageNumber,
            Integer pageSize) {
        StatsScope.Competition competitionFilter = StatsScopeResolver.parseCompetition(competition);
        boolean ascending = parseAscending(direction);
        int page = pageNumber == null ? 0 : pageNumber;
        int size = pageSize == null ? DEFAULT_PAGE_SIZE : pageSize;
        if (page < 0) {
            throw new ValidationException("page must be zero or more.");
        }
        if (size < 1 || size > MAX_PAGE_SIZE) {
            throw new ValidationException("size must be from 1 to " + MAX_PAGE_SIZE + ".");
        }
        playerLookup.require(clubId, playerId);
        StatsScopeResolver.Resolved resolved =
                scopeResolver.resolve(authentication, clubId, seasonId, leagueId, teamId, sectionId, competitionFilter);
        StatsScope scope = resolved.scope();
        PlayerStatsScope echoed = new PlayerStatsScope(
                StatsScopeResolver.KIND_CLUB_VERIFIED, seasonId, leagueId, teamId, sectionId, StatsScopeResolver.competitionName(scope));
        if (resolved.nothingInReach()) {
            return empty(playerId, echoed, page, size);
        }

        UUID season = scope.seasonId();
        UUID league = scope.leagueId();
        UUID team = scope.teamId();
        String comp = StatsScopeResolver.competitionName(scope);
        boolean restricted = scope.sectionRestricted();
        List<UUID> sectionTeams = StatsScopeResolver.sectionTeamParameter(scope);

        long total = factsRepository.matchCount(clubId, playerId, season, league, team, comp, restricted, sectionTeams);
        long offset = (long) page * size;
        if (total == 0 || offset >= total) {
            return new PlayerMatchListDto(
                    playerId, echoed, new LeaderboardPageInfo(page, size, total, false), List.of());
        }
        List<PlayerMatchRowBuilder.MatchHeader> headers = factsRepository
                .matchPage(
                        clubId, playerId, season, league, team, comp, restricted, sectionTeams, ascending, size, offset)
                .stream()
                .map(PlayerMatchFactsReader::toHeader)
                .toList();
        List<UUID> resultIds = headers.stream().map(PlayerMatchRowBuilder.MatchHeader::resultId).toList();
        List<PlayerMatchRowDto> rows = resultIds.isEmpty()
                ? List.of()
                : PlayerMatchRowBuilder.build(
                        headers,
                        factsRepository
                                .matchBatting(
                                        clubId, playerId, season, league, team, comp, restricted, sectionTeams, resultIds)
                                .stream()
                                .map(PlayerMatchFactsReader::toBatting)
                                .toList(),
                        factsRepository
                                .matchBowling(
                                        clubId, playerId, season, league, team, comp, restricted, sectionTeams, resultIds)
                                .stream()
                                .map(PlayerMatchFactsReader::toBowling)
                                .toList(),
                        factsRepository
                                .matchFielding(
                                        clubId, playerId, season, league, team, comp, restricted, sectionTeams, resultIds)
                                .stream()
                                .map(PlayerMatchFactsReader::toFielding)
                                .toList(),
                        factsRepository
                                .matchAwards(
                                        clubId, playerId, season, league, team, comp, restricted, sectionTeams, resultIds)
                                .stream()
                                .map(PlayerMatchFactsReader::toAward)
                                .toList());
        log.debug("Player match list for player {} in club {}: page {} of {} matches", playerId, clubId, page, total);
        return new PlayerMatchListDto(
                playerId,
                echoed,
                new LeaderboardPageInfo(page, size, total, offset + rows.size() < total),
                rows);
    }

    private static PlayerMatchListDto empty(UUID playerId, PlayerStatsScope scope, int page, int size) {
        return new PlayerMatchListDto(playerId, scope, new LeaderboardPageInfo(page, size, 0, false), List.of());
    }

    /** Newest first by default; {@code asc} reverses. */
    private static boolean parseAscending(String direction) {
        if (direction == null || direction.isBlank()) {
            return false;
        }
        return switch (direction.trim().toLowerCase(Locale.ROOT)) {
            case "asc" -> true;
            case "desc" -> false;
            default -> throw new ValidationException("direction must be asc or desc.");
        };
    }
}
