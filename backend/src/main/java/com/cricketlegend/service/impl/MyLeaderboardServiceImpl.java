package com.cricketlegend.service.impl;

import com.cricketlegend.domain.League;
import com.cricketlegend.domain.Season;
import com.cricketlegend.domain.Team;
import com.cricketlegend.domain.TeamSquadMember;
import com.cricketlegend.dto.AwardsViewDto;
import com.cricketlegend.dto.MyLeaderboardAwardsDto;
import com.cricketlegend.dto.MyLeaderboardFiltersDto;
import com.cricketlegend.dto.MyLeaderboardStandingDto;
import com.cricketlegend.dto.MyLeaderboardTableDto;
import com.cricketlegend.dto.MyLeaderboardTableDto.MyLeaderboardScope;
import com.cricketlegend.dto.MyResultFiltersDto;
import com.cricketlegend.exception.ValidationException;
import com.cricketlegend.repository.LeagueAffiliationRepository;
import com.cricketlegend.repository.LeagueRepository;
import com.cricketlegend.repository.SeasonRepository;
import com.cricketlegend.repository.TeamRepository;
import com.cricketlegend.repository.TeamSquadMemberRepository;
import com.cricketlegend.service.LeaderboardService;
import com.cricketlegend.service.MyLeaderboardService;
import com.cricketlegend.service.PlayerStatsService;
import com.cricketlegend.service.PlayerStatsService.PlayerStatsCombo;
import com.cricketlegend.service.support.HeldLeaderboardTable;
import com.cricketlegend.service.support.HeldPlayer;
import com.cricketlegend.service.support.HubLeaderboardReach;
import com.cricketlegend.service.support.HubRankingPolicy;
import com.cricketlegend.service.support.LeaderboardPlayers;
import com.cricketlegend.service.support.MyLeaderboardBuilder;
import com.cricketlegend.service.support.MyPlayerAccess;
import com.cricketlegend.service.support.SeasonResolution;
import com.cricketlegend.service.support.StatsScopeResolver;
import java.time.LocalDate;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * docs/specs/147. Authorised only by {@link MyPlayerAccess#resolve}; the club and the player come from the held player,
 * never from the request. The ranked data is {@link LeaderboardService}'s (the held-player variants, which reach the
 * statistics repositories, the only classes allowed to) and the held player's own combinations are {@link
 * PlayerStatsService}'s; the payloads are shaped by the pure {@link MyLeaderboardBuilder}. Nothing here defines a figure or
 * an order. Names are returned (Decision 3) but never logged.
 */
@Service
class MyLeaderboardServiceImpl implements MyLeaderboardService {

    static final String AWARDS_NOT_ENDED_MESSAGE = "Awards are revealed when the season ends.";
    static final String AWARDS_NOT_SHARED_MESSAGE = "Awards are not shared by this club.";

    private final MyPlayerAccess access;
    private final LeaderboardService leaderboardService;
    private final PlayerStatsService playerStatsService;
    private final StatsScopeResolver scopeResolver;
    private final HubRankingPolicy rankingPolicy;
    private final LeagueAffiliationRepository affiliationRepository;
    private final TeamSquadMemberRepository squadRepository;
    private final SeasonRepository seasonRepository;
    private final TeamRepository teamRepository;
    private final LeagueRepository leagueRepository;

    MyLeaderboardServiceImpl(
            MyPlayerAccess access,
            LeaderboardService leaderboardService,
            PlayerStatsService playerStatsService,
            StatsScopeResolver scopeResolver,
            HubRankingPolicy rankingPolicy,
            LeagueAffiliationRepository affiliationRepository,
            TeamSquadMemberRepository squadRepository,
            SeasonRepository seasonRepository,
            TeamRepository teamRepository,
            LeagueRepository leagueRepository) {
        this.access = access;
        this.leaderboardService = leaderboardService;
        this.playerStatsService = playerStatsService;
        this.scopeResolver = scopeResolver;
        this.rankingPolicy = rankingPolicy;
        this.affiliationRepository = affiliationRepository;
        this.squadRepository = squadRepository;
        this.seasonRepository = seasonRepository;
        this.teamRepository = teamRepository;
        this.leagueRepository = leagueRepository;
    }

    @Override
    @Transactional(readOnly = true)
    public MyLeaderboardTableDto table(
            Authentication authentication,
            String playerKey,
            String group,
            String sort,
            String direction,
            UUID seasonId,
            UUID leagueId,
            UUID teamId,
            String minimum,
            Integer page,
            Integer size) {
        HeldPlayer held = access.resolve(authentication, playerKey);
        UUID clubId = held.profile().getClubId();
        UUID playerId = held.profile().getId();
        if (!List.of("batting", "bowling", "fielding").contains(group)) {
            throw new ValidationException("group must be batting, bowling or fielding.");
        }
        // an empty reach lists nobody: that is the answer when the policy does not allow rankings
        Set<UUID> leagues = rankingPolicy.allowsRankings(clubId) ? reachOf(clubId, playerId).leagueIds(seasonId) : Set.of();
        HeldLeaderboardTable table = leaderboardService.tableForHeldPlayer(
                clubId, playerId, group, sort, direction, seasonId, leagueId, teamId, leagues, minimum, page, size);
        return MyLeaderboardBuilder.table(table, playerId);
    }

    @Override
    @Transactional(readOnly = true)
    public MyLeaderboardStandingDto standing(
            Authentication authentication, String playerKey, UUID seasonId, UUID leagueId, UUID teamId) {
        HeldPlayer held = access.resolve(authentication, playerKey);
        UUID clubId = held.profile().getClubId();
        UUID playerId = held.profile().getId();
        MyLeaderboardScope scope = new MyLeaderboardScope(seasonId, leagueId, teamId);
        scopeResolver.resolveForHeldPlayer(clubId, seasonId, leagueId, teamId, null, null);
        if (!rankingPolicy.allowsRankings(clubId)) {
            return new MyLeaderboardStandingDto(scope, held.subject().getFirstName(), 0, 0, List.of());
        }
        LeaderboardPlayers loaded = leaderboardService.playersForHeldPlayer(
                clubId, seasonId, leagueId, teamId, null, reachOf(clubId, playerId).leagueIds(seasonId), null, true);
        return MyLeaderboardBuilder.standing(loaded, playerId, held.subject().getFirstName(), scope);
    }

    @Override
    @Transactional(readOnly = true)
    public MyLeaderboardAwardsDto awards(
            Authentication authentication, String playerKey, UUID seasonId, UUID leagueId, UUID teamId) {
        HeldPlayer held = access.resolve(authentication, playerKey);
        UUID clubId = held.profile().getClubId();
        UUID playerId = held.profile().getId();
        MyLeaderboardScope scope = new MyLeaderboardScope(seasonId, leagueId, teamId);
        scopeResolver.resolveForHeldPlayer(clubId, seasonId, leagueId, teamId, null, null);
        if (!rankingPolicy.allowsRankings(clubId)) {
            return MyLeaderboardBuilder.awardsHeldBack(scope, "RANKINGS_NOT_SHARED", AWARDS_NOT_SHARED_MESSAGE, null);
        }
        LocalDate today = LocalDate.now();
        List<Season> seasons = seasonRepository.findByClubId(clubId);
        LocalDate endsOn = seasonId != null
                ? seasons.stream().filter(s -> s.getId().equals(seasonId)).map(Season::getEndDate).findFirst().orElse(null)
                : seasons.stream()
                        .filter(s -> !s.getStartDate().isAfter(today) && !s.getEndDate().isBefore(today))
                        .map(Season::getEndDate)
                        .max(Comparator.naturalOrder())
                        .orElse(null);
        // a chosen season has ended once its end date is past; with no season chosen awards wait while one is running
        boolean ended = seasonId != null ? endsOn != null && endsOn.isBefore(today) : endsOn == null;
        if (!ended) {
            return MyLeaderboardBuilder.awardsHeldBack(scope, "SEASON_NOT_ENDED", AWARDS_NOT_ENDED_MESSAGE, endsOn);
        }
        AwardsViewDto awards = leaderboardService.awardsForHeldPlayer(
                clubId, seasonId, leagueId, teamId, reachOf(clubId, playerId).leagueIds(seasonId));
        return MyLeaderboardBuilder.awards(awards, playerId, scope);
    }

    @Override
    @Transactional(readOnly = true)
    public MyLeaderboardFiltersDto filters(Authentication authentication, String playerKey) {
        HeldPlayer held = access.resolve(authentication, playerKey);
        UUID clubId = held.profile().getClubId();
        UUID playerId = held.profile().getId();
        boolean rankings = rankingPolicy.allowsRankings(clubId);
        HubLeaderboardReach reach = rankings ? reachOf(clubId, playerId) : HubLeaderboardReach.of(List.of());
        List<PlayerStatsCombo> combos = rankings ? leaderboardService.comboOptionsForHeldPlayer(clubId, reach) : List.of();

        // The Season list always offers the seasons of the player's own flagged results (a friendly-only season has no league
        // in the reach) and the seasons the reach names, even when no counted result of the reach exists yet.
        Set<UUID> seasonIds = combos.stream().map(PlayerStatsCombo::seasonId).collect(Collectors.toSet());
        if (rankings) {
            playerStatsService.comboOptionsForHeldPlayer(clubId, playerId).forEach(c -> seasonIds.add(c.seasonId()));
            reach.pairs().forEach(pair -> seasonIds.add(pair.seasonId()));
        }
        Set<UUID> teamIds = combos.stream().map(PlayerStatsCombo::teamId).collect(Collectors.toSet());
        Set<UUID> leagueIds = combos.stream().map(PlayerStatsCombo::leagueId).collect(Collectors.toSet());
        List<Season> clubSeasons = seasonRepository.findByClubId(clubId);
        List<Season> seasons = clubSeasons.stream()
                .filter(s -> seasonIds.contains(s.getId()))
                .sorted(Comparator.comparing(Season::getStartDate).reversed())
                .toList();
        List<MyResultFiltersDto.Option> teams = teamRepository.findByClubId(clubId).stream()
                .filter(t -> teamIds.contains(t.getId()))
                .sorted(Comparator.comparing(Team::getName, String.CASE_INSENSITIVE_ORDER))
                .map(t -> new MyResultFiltersDto.Option(t.getId(), t.getName()))
                .toList();
        List<MyResultFiltersDto.Option> leagues = leagueRepository.findByClubId(clubId).stream()
                .filter(l -> leagueIds.contains(l.getId()))
                .sorted(Comparator.comparing(League::getName, String.CASE_INSENSITIVE_ORDER))
                .map(l -> new MyResultFiltersDto.Option(l.getId(), l.getName()))
                .toList();

        UUID club = SeasonResolution.currentSeasonId(clubSeasons);
        UUID current = seasons.stream().anyMatch(s -> s.getId().equals(club))
                ? club
                : seasons.isEmpty() ? null : seasons.get(0).getId();
        return new MyLeaderboardFiltersDto(
                current,
                seasons.stream().map(s -> new MyResultFiltersDto.Option(s.getId(), s.getLabel())).toList(),
                teams,
                leagues,
                combos.stream()
                        .map(c -> new MyResultFiltersDto.Combo(c.seasonId(), c.leagueId(), c.teamId()))
                        .toList());
    }

    /**
     * The leagues the held player's teams played in, per season: the leagues of the player's own flagged results, plus the
     * leagues the player's teams are entered in for a season in which the player played for, or is in the squad of, that
     * team (so the reach exists before the first flagged result of a season).
     */
    private HubLeaderboardReach reachOf(UUID clubId, UUID playerId) {
        List<PlayerStatsCombo> combos = playerStatsService.comboOptionsForHeldPlayer(clubId, playerId);
        Set<TeamSeason> teamSeasons = new HashSet<>();
        Set<HubLeaderboardReach.SeasonLeague> pairs = new HashSet<>();
        for (PlayerStatsCombo combo : combos) {
            teamSeasons.add(new TeamSeason(combo.teamId(), combo.seasonId()));
            pairs.add(new HubLeaderboardReach.SeasonLeague(combo.seasonId(), combo.leagueId()));
        }
        for (TeamSquadMember member : squadRepository.findByPlayerProfileId(playerId)) {
            teamSeasons.add(new TeamSeason(member.getTeamId(), member.getSeasonId()));
        }
        if (!teamSeasons.isEmpty()) {
            Set<UUID> teamIds = teamSeasons.stream().map(TeamSeason::teamId).collect(Collectors.toSet());
            affiliationRepository.findByTeamIdIn(teamIds).stream()
                    .filter(a -> teamSeasons.contains(new TeamSeason(a.getTeamId(), a.getSeasonId())))
                    .forEach(a -> pairs.add(new HubLeaderboardReach.SeasonLeague(a.getSeasonId(), a.getLeagueId())));
        }
        return HubLeaderboardReach.of(pairs);
    }

    private record TeamSeason(UUID teamId, UUID seasonId) {
    }
}
