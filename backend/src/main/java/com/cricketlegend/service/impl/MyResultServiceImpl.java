package com.cricketlegend.service.impl;

import com.cricketlegend.domain.League;
import com.cricketlegend.domain.ResultSide;
import com.cricketlegend.domain.Season;
import com.cricketlegend.domain.Team;
import com.cricketlegend.dto.MatchResultDto;
import com.cricketlegend.dto.MyResultDto;
import com.cricketlegend.dto.MyResultFiltersDto;
import com.cricketlegend.dto.MyResultListDto;
import com.cricketlegend.dto.MyResultRowDto;
import com.cricketlegend.dto.MyResultScopeDto;
import com.cricketlegend.dto.MyResultSummaryDto;
import com.cricketlegend.dto.PlayerMatchListDto;
import com.cricketlegend.dto.PlayerMatchRowDto;
import com.cricketlegend.dto.PlayerStatsDto;
import com.cricketlegend.dto.PlayerStatsFilterOptionsDto;
import com.cricketlegend.exception.NotFoundException;
import com.cricketlegend.repository.LeagueRepository;
import com.cricketlegend.repository.SeasonRepository;
import com.cricketlegend.repository.TeamRepository;
import com.cricketlegend.service.MyResultService;
import com.cricketlegend.service.PlayerMatchListService;
import com.cricketlegend.service.PlayerStatsService;
import com.cricketlegend.service.ResultService;
import com.cricketlegend.service.ScorecardService;
import com.cricketlegend.service.support.HeldPlayer;
import com.cricketlegend.service.support.LeagueResultText;
import com.cricketlegend.service.support.MyPlayerAccess;
import com.cricketlegend.service.support.MyResultScorecard;
import com.cricketlegend.service.support.SeasonResolution;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * docs/specs/145 (Player Hub results). Authorised only by {@link MyPlayerAccess#resolve}; the club and the player come
 * from the held player, never from the request. The counted matches and the figures are those of {@link
 * PlayerMatchListService} and {@link PlayerStatsService} in their Player Hub scope (only published results a manager
 * switched on), the match header comes from {@link ResultService}, the scorecard from {@link ScorecardService}; no
 * counting rule is repeated here. Names are shown in full (spec Decision 7); no result id or other internal id leaves.
 */
@Service
class MyResultServiceImpl implements MyResultService {

    private static final int LAST_FIVE = 5;

    private final MyPlayerAccess access;
    private final PlayerMatchListService matchListService;
    private final PlayerStatsService statsService;
    private final ResultService resultService;
    private final ScorecardService scorecardService;
    private final SeasonRepository seasonRepository;
    private final TeamRepository teamRepository;
    private final LeagueRepository leagueRepository;

    MyResultServiceImpl(
            MyPlayerAccess access,
            PlayerMatchListService matchListService,
            PlayerStatsService statsService,
            ResultService resultService,
            ScorecardService scorecardService,
            SeasonRepository seasonRepository,
            TeamRepository teamRepository,
            LeagueRepository leagueRepository) {
        this.access = access;
        this.matchListService = matchListService;
        this.statsService = statsService;
        this.resultService = resultService;
        this.scorecardService = scorecardService;
        this.seasonRepository = seasonRepository;
        this.teamRepository = teamRepository;
        this.leagueRepository = leagueRepository;
    }

    @Override
    @Transactional(readOnly = true)
    public MyResultListDto list(
            Authentication authentication,
            String playerKey,
            UUID seasonId,
            UUID teamId,
            UUID leagueId,
            Integer page,
            Integer size) {
        HeldPlayer held = access.resolve(authentication, playerKey);
        UUID clubId = held.profile().getClubId();
        PlayerMatchListDto list = matchListService.listForHeldPlayer(
                clubId, held.profile().getId(), seasonId, leagueId, teamId, null, page, size);
        return new MyResultListDto(new MyResultScopeDto(seasonId, teamId, leagueId), list.page(), rows(clubId, list.rows()));
    }

    @Override
    @Transactional(readOnly = true)
    public MyResultSummaryDto summary(
            Authentication authentication, String playerKey, UUID seasonId, UUID teamId, UUID leagueId) {
        HeldPlayer held = access.resolve(authentication, playerKey);
        UUID clubId = held.profile().getClubId();
        UUID playerId = held.profile().getId();
        PlayerStatsDto stats = statsService.getForHeldPlayer(clubId, playerId, seasonId, leagueId, teamId);
        PlayerMatchListDto recent =
                matchListService.listForHeldPlayer(clubId, playerId, seasonId, leagueId, teamId, null, 0, LAST_FIVE);
        return new MyResultSummaryDto(
                new MyResultScopeDto(seasonId, teamId, leagueId),
                stats.basis().matchesCounted(),
                stats.record().won(),
                stats.record().lost(),
                stats.record().tied(),
                stats.record().drawn(),
                stats.record().internal(),
                stats.batting().runs(),
                stats.bowling().wickets(),
                stats.fielding().catches(),
                stats.awards().playerOfTheMatch(),
                stats.batting().highestScore(),
                stats.bowling().best(),
                rows(clubId, recent.rows()));
    }

    @Override
    @Transactional(readOnly = true)
    public MyResultFiltersDto filters(Authentication authentication, String playerKey) {
        HeldPlayer held = access.resolve(authentication, playerKey);
        UUID clubId = held.profile().getClubId();
        PlayerStatsFilterOptionsDto options = statsService.filterOptionsForHeldPlayer(clubId, held.profile().getId());

        Set<UUID> seasonIds = Set.copyOf(options.seasonIds());
        List<Season> clubSeasons = seasonRepository.findByClubId(clubId);
        List<Season> seasons = clubSeasons.stream()
                .filter(s -> seasonIds.contains(s.getId()))
                .sorted(Comparator.comparing(Season::getStartDate).reversed())
                .toList();
        Set<UUID> teamIds = Set.copyOf(options.teamIds());
        List<MyResultFiltersDto.Option> teams = teamRepository.findByClubId(clubId).stream()
                .filter(t -> teamIds.contains(t.getId()))
                .sorted(Comparator.comparing(Team::getName, String.CASE_INSENSITIVE_ORDER))
                .map(t -> new MyResultFiltersDto.Option(t.getId(), t.getName()))
                .toList();
        Set<UUID> leagueIds = Set.copyOf(options.leagueIds());
        List<MyResultFiltersDto.Option> leagues = leagueRepository.findByClubId(clubId).stream()
                .filter(l -> leagueIds.contains(l.getId()))
                .sorted(Comparator.comparing(League::getName, String.CASE_INSENSITIVE_ORDER))
                .map(l -> new MyResultFiltersDto.Option(l.getId(), l.getName()))
                .toList();

        UUID club = SeasonResolution.currentSeasonId(clubSeasons);
        UUID current = seasons.stream().anyMatch(s -> s.getId().equals(club))
                ? club
                : seasons.isEmpty() ? null : seasons.get(0).getId();
        return new MyResultFiltersDto(
                current,
                seasons.stream().map(s -> new MyResultFiltersDto.Option(s.getId(), s.getLabel())).toList(),
                teams,
                leagues);
    }

    @Override
    @Transactional(readOnly = true)
    public MyResultDto get(Authentication authentication, String playerKey, UUID matchId) {
        HeldPlayer held = access.resolve(authentication, playerKey);
        UUID clubId = held.profile().getClubId();
        UUID playerId = held.profile().getId();
        // The held player's own card is the same row the list returns for this match; none means 404 (not counted, not
        // shown in the Player Hub, or another club's match).
        List<PlayerMatchRowDto> own = matchListService
                .listForHeldPlayer(clubId, playerId, null, null, null, matchId, 0, 1)
                .rows();
        if (own.isEmpty()) {
            throw new NotFoundException("Result not found");
        }
        MatchResultDto result = resultService.visibleResult(clubId, matchId);
        MyResultRowDto mine = row(own.get(0), result);
        var scorecard = scorecardService.readForPlayers(clubId, matchId);
        return new MyResultDto(
                mine,
                result.playingAreaName(),
                MyResultScorecard.innings(result, scorecard, playerId, mine.homeName(), mine.awayName()),
                MyResultScorecard.awards(scorecard));
    }

    private List<MyResultRowDto> rows(UUID clubId, List<PlayerMatchRowDto> rows) {
        if (rows.isEmpty()) {
            return List.of();
        }
        Map<UUID, MatchResultDto> results =
                resultService.publishedResults(clubId, rows.stream().map(PlayerMatchRowDto::matchId).toList());
        return rows.stream().map(r -> row(r, results.get(r.matchId()))).toList();
    }

    /** The counted row plus the match header words; {@code result} is null only if the header cannot be read. */
    private static MyResultRowDto row(PlayerMatchRowDto row, MatchResultDto result) {
        String homeName = sideName(row, ResultSide.HOME);
        String awayName = sideName(row, ResultSide.AWAY);
        return new MyResultRowDto(
                row.matchId(),
                row.matchDate(),
                row.ourTeams(),
                row.opponentName(),
                row.derby(),
                row.leagueId(),
                row.leagueName(),
                row.competition(),
                row.result(),
                homeName,
                awayName,
                result == null ? "" : LeagueResultText.sideScore(result, ResultSide.HOME),
                result == null ? "" : LeagueResultText.sideScore(result, ResultSide.AWAY),
                result == null ? null : LeagueResultText.resultLine(result, homeName, awayName),
                row.ballsPerOver(),
                row.hasBattingCard(),
                row.hasBowlingCard(),
                row.batting(),
                row.bowling(),
                row.fielding(),
                row.awards());
    }

    /** Our team's name on that side, else the opposition's name. */
    private static String sideName(PlayerMatchRowDto row, ResultSide side) {
        return row.ourTeams().stream()
                .filter(t -> side.name().equals(t.side()))
                .map(PlayerMatchRowDto.PlayerMatchTeam::teamName)
                .findFirst()
                .orElse(row.opponentName());
    }
}
