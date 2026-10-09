package com.cricketlegend.service.support;

import com.cricketlegend.config.AccessService;
import com.cricketlegend.domain.AvailabilityStatus;
import com.cricketlegend.domain.League;
import com.cricketlegend.domain.Match;
import com.cricketlegend.domain.MatchAvailabilityPoll;
import com.cricketlegend.domain.PlayerAvailability;
import com.cricketlegend.domain.PlayerSection;
import com.cricketlegend.domain.Season;
import com.cricketlegend.domain.SectionAvailabilityResponse;
import com.cricketlegend.domain.SectionAvailabilityWindow;
import com.cricketlegend.domain.SectionAvailabilityWindowMatch;
import com.cricketlegend.domain.SelectionAvailability;
import com.cricketlegend.domain.Team;
import com.cricketlegend.domain.TeamSquadMember;
import com.cricketlegend.repository.LeagueRepository;
import com.cricketlegend.repository.MatchAvailabilityPollRepository;
import com.cricketlegend.repository.PlayerAvailabilityRepository;
import com.cricketlegend.repository.PlayerSectionRepository;
import com.cricketlegend.repository.SeasonRepository;
import com.cricketlegend.repository.SectionAvailabilityResponseRepository;
import com.cricketlegend.repository.SectionAvailabilityWindowMatchRepository;
import com.cricketlegend.repository.SectionAvailabilityWindowRepository;
import com.cricketlegend.repository.TeamSquadMemberRepository;
import java.util.Collection;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.stereotype.Component;

/**
 * The team-selection rules of docs/specs/076-team-selection.md for MANY matches and players at
 * once, for the overview of docs/specs/093-team-selection-hub.md. Every fact {@link SelectionRules}
 * resolves per (match, team) call is loaded here in one query per kind however many matches there
 * are, then the very same pure rules decide: {@link SelectionEligibility#inPool}/{@code
 * ageProblems}, {@link SelectionAvailabilityResolver#statusOf}, {@link MatchSlots#takenFor} and
 * finally {@link SelectionRules#rejectionOf}, so a cell reported selectable here is accepted by the
 * apply endpoint and a blocked one is refused with the same reason.
 */
@Component
public class TeamSelectionBatchRules {

    /** A side of a match, by team. */
    public record MatchTeam(UUID matchId, UUID teamId) {
    }

    /** Who may be selected for each side before availability: the whole pool, and its roster part. */
    public record Pools(Map<MatchTeam, Set<UUID>> members, Map<MatchTeam, Set<UUID>> roster) {
    }

    private final SelectionRules rules;
    private final MatchSlots matchSlots;
    private final AccessService accessService;
    private final PlayerSectionRepository playerSectionRepository;
    private final TeamSquadMemberRepository teamSquadMemberRepository;
    private final SectionAvailabilityWindowMatchRepository windowMatchRepository;
    private final SectionAvailabilityWindowRepository windowRepository;
    private final SectionAvailabilityResponseRepository windowResponseRepository;
    private final MatchAvailabilityPollRepository pollRepository;
    private final PlayerAvailabilityRepository playerAvailabilityRepository;
    private final LeagueRepository leagueRepository;
    private final SeasonRepository seasonRepository;

    public TeamSelectionBatchRules(
            SelectionRules rules,
            MatchSlots matchSlots,
            AccessService accessService,
            PlayerSectionRepository playerSectionRepository,
            TeamSquadMemberRepository teamSquadMemberRepository,
            SectionAvailabilityWindowMatchRepository windowMatchRepository,
            SectionAvailabilityWindowRepository windowRepository,
            SectionAvailabilityResponseRepository windowResponseRepository,
            MatchAvailabilityPollRepository pollRepository,
            PlayerAvailabilityRepository playerAvailabilityRepository,
            LeagueRepository leagueRepository,
            SeasonRepository seasonRepository) {
        this.rules = rules;
        this.matchSlots = matchSlots;
        this.accessService = accessService;
        this.playerSectionRepository = playerSectionRepository;
        this.teamSquadMemberRepository = teamSquadMemberRepository;
        this.windowMatchRepository = windowMatchRepository;
        this.windowRepository = windowRepository;
        this.windowResponseRepository = windowResponseRepository;
        this.pollRepository = pollRepository;
        this.playerAvailabilityRepository = playerAvailabilityRepository;
        this.leagueRepository = leagueRepository;
        this.seasonRepository = seasonRepository;
    }

    /**
     * The pool of each side: its roster for the match's season plus (for a team of the match's own
     * club) every player tagged to the team's section or a descendant, as {@link
     * SelectionEligibility#poolMemberIds}, in three queries.
     */
    public Pools pools(UUID clubId, List<Match> matches, Map<UUID, List<Team>> ownTeamsByMatch) {
        Set<UUID> sectionIds = new HashSet<>();
        Set<UUID> teamIds = new HashSet<>();
        Set<UUID> seasonIds = new HashSet<>();
        for (Match match : matches) {
            seasonIds.add(match.getSeasonId());
            for (Team team : ownTeamsByMatch.getOrDefault(match.getId(), List.of())) {
                teamIds.add(team.getId());
                if (clubId.equals(team.getClubId())) {
                    sectionIds.add(team.getSectionId());
                }
            }
        }
        Map<UUID, Set<UUID>> closures = accessService.sectionClosures(clubId, sectionIds);
        Map<UUID, Set<UUID>> taggedBySection = taggedBySection(closures.values());
        Map<String, Set<UUID>> rosterByTeamSeason = new HashMap<>();
        if (!teamIds.isEmpty()) {
            for (TeamSquadMember member : teamSquadMemberRepository.findByTeamIdInAndSeasonIdIn(teamIds, seasonIds)) {
                rosterByTeamSeason
                        .computeIfAbsent(member.getTeamId() + "|" + member.getSeasonId(), key -> new HashSet<>())
                        .add(member.getPlayerProfileId());
            }
        }
        Map<MatchTeam, Set<UUID>> members = new HashMap<>();
        Map<MatchTeam, Set<UUID>> roster = new HashMap<>();
        for (Match match : matches) {
            for (Team team : ownTeamsByMatch.getOrDefault(match.getId(), List.of())) {
                Set<UUID> rosterIds = rosterByTeamSeason.getOrDefault(team.getId() + "|" + match.getSeasonId(), Set.of());
                Set<UUID> pool = new HashSet<>(rosterIds);
                if (clubId.equals(team.getClubId())) {
                    for (UUID sectionId : closures.getOrDefault(team.getSectionId(), Set.of())) {
                        pool.addAll(taggedBySection.getOrDefault(sectionId, Set.of()));
                    }
                }
                MatchTeam key = new MatchTeam(match.getId(), team.getId());
                members.put(key, pool);
                roster.put(key, rosterIds);
            }
        }
        return new Pools(members, roster);
    }

    /**
     * For every (match, own team) the single rejection of each candidate who may not be selected
     * (absent = selectable), by {@link SelectionRules#rejectionOf}. {@code players} must hold the
     * candidates' loaded profiles ({@link SelectionEligibility#loadPlayers}).
     */
    public Map<MatchTeam, Map<UUID, SelectionRejection>> rejections(
            UUID clubId,
            List<Match> matches,
            Map<UUID, List<Team>> ownTeamsByMatch,
            Pools pools,
            Collection<UUID> candidateIds,
            Map<UUID, SelectionEligibility.PlayerInfo> players) {
        Coverage coverage = coverage(matches);
        Map<UUID, Set<UUID>> windowAudience = windowAudience(clubId, coverage.windowsById().values(), players);
        Map<UUID, League> leagues = leagues(matches);
        Map<UUID, Season> seasons = seasonsNeedingCutoff(matches, leagues);
        Map<UUID, List<MatchSlots.Held>> held = matchSlots.heldByMatch(matches);
        SelectionEligibility eligibility = rules.eligibility();
        SelectionAvailabilityResolver availabilityResolver = rules.availability();

        Map<MatchTeam, Map<UUID, SelectionRejection>> result = new HashMap<>();
        for (Match match : matches) {
            League league = match.getLeagueId() == null ? null : leagues.get(match.getLeagueId());
            Map<UUID, String> ageProblems = league == null
                    ? Map.of()
                    : eligibility.ageProblems(league, seasons.get(match.getSeasonId()), candidateIds, players);
            UUID windowId = coverage.windowIdByMatch().get(match.getId());
            for (Team team : ownTeamsByMatch.getOrDefault(match.getId(), List.of())) {
                MatchTeam key = new MatchTeam(match.getId(), team.getId());
                Set<UUID> members = pools.members().getOrDefault(key, Set.of());
                Set<UUID> audience;
                Map<UUID, AvailabilityStatus> answers;
                boolean polled;
                MatchAvailabilityPoll squadPoll = coverage.squadPollByKey().get(key);
                if (windowId != null) {
                    polled = true;
                    answers = coverage.windowAnswers().getOrDefault(windowId, Map.of());
                    audience = windowAudience.getOrDefault(windowId, Set.of());
                } else if (squadPoll != null) {
                    polled = true;
                    answers = coverage.pollAnswers().getOrDefault(squadPoll.getId(), Map.of());
                    audience = pools.roster().getOrDefault(key, Set.of());
                } else {
                    polled = false;
                    answers = Map.of();
                    audience = Set.of();
                }
                Map<UUID, TakenBy> taken = MatchSlots.takenFor(held.getOrDefault(match.getId(), List.of()), team.getId());
                Map<UUID, SelectionRejection> rejections = new HashMap<>();
                for (UUID playerId : candidateIds) {
                    SelectionEligibility.PlayerInfo info = players.get(playerId);
                    String name = info == null ? "Player " + playerId : info.fullName();
                    SelectionAvailability availability = availabilityResolver.statusOf(
                            polled, answers.get(playerId), audience.contains(playerId));
                    SelectionRejection rejection = rules.rejectionOf(
                            playerId,
                            name,
                            !eligibility.inPool(match.getClubId(), info, playerId, members),
                            ageProblems.get(playerId),
                            availability,
                            taken.get(playerId));
                    if (rejection != null) {
                        rejections.put(playerId, rejection);
                    }
                }
                result.put(key, rejections);
            }
        }
        return result;
    }

    /** The coverage facts of {@link com.cricketlegend.service.MatchPollCoverageService#resolve} for many matches. */
    private record Coverage(
            Map<UUID, UUID> windowIdByMatch,
            Map<UUID, SectionAvailabilityWindow> windowsById,
            Map<MatchTeam, MatchAvailabilityPoll> squadPollByKey,
            Map<UUID, Map<UUID, AvailabilityStatus>> windowAnswers,
            Map<UUID, Map<UUID, AvailabilityStatus>> pollAnswers) {
    }

    private Coverage coverage(List<Match> matches) {
        Set<UUID> matchIds = matches.stream().map(Match::getId).collect(Collectors.toSet());
        Map<UUID, UUID> windowIdByMatch = new HashMap<>();
        for (SectionAvailabilityWindowMatch link : windowMatchRepository.findByMatchIdIn(matchIds)) {
            windowIdByMatch.put(link.getMatchId(), link.getWindowId());
        }
        Map<UUID, SectionAvailabilityWindow> windowsById = new HashMap<>();
        if (!windowIdByMatch.isEmpty()) {
            windowRepository.findAllById(new HashSet<>(windowIdByMatch.values()))
                    .forEach(window -> windowsById.put(window.getId(), window));
        }
        // Group coverage only counts when the window exists, as resolveGroup does.
        windowIdByMatch.values().removeIf(id -> !windowsById.containsKey(id));

        Map<MatchTeam, MatchAvailabilityPoll> squadPollByKey = new HashMap<>();
        for (MatchAvailabilityPoll poll : pollRepository.findByMatchIdIn(matchIds)) {
            squadPollByKey.put(new MatchTeam(poll.getMatchId(), poll.getTeamId()), poll);
        }
        Map<UUID, Map<UUID, AvailabilityStatus>> windowAnswers = new HashMap<>();
        if (!windowsById.isEmpty()) {
            for (SectionAvailabilityResponse response : windowResponseRepository.findByWindowIdIn(windowsById.keySet())) {
                windowAnswers
                        .computeIfAbsent(response.getWindowId(), key -> new HashMap<>())
                        .put(response.getPlayerProfileId(), response.getStatus());
            }
        }
        Map<UUID, Map<UUID, AvailabilityStatus>> pollAnswers = new HashMap<>();
        if (!squadPollByKey.isEmpty()) {
            Set<UUID> pollIds = squadPollByKey.values().stream().map(MatchAvailabilityPoll::getId).collect(Collectors.toSet());
            for (PlayerAvailability row : playerAvailabilityRepository.findByPollIdIn(pollIds)) {
                if (row.getStatus() != null) {
                    pollAnswers
                            .computeIfAbsent(row.getPollId(), key -> new HashMap<>())
                            .put(row.getPlayerProfileId(), row.getStatus());
                }
            }
        }
        return new Coverage(windowIdByMatch, windowsById, squadPollByKey, windowAnswers, pollAnswers);
    }

    /** Per window: active players tagged to its section or a descendant, as the group poll's audience. */
    private Map<UUID, Set<UUID>> windowAudience(
            UUID clubId,
            Collection<SectionAvailabilityWindow> windows,
            Map<UUID, SelectionEligibility.PlayerInfo> players) {
        Map<UUID, Set<UUID>> audienceByWindow = new HashMap<>();
        if (windows.isEmpty()) {
            return audienceByWindow;
        }
        Map<UUID, Set<UUID>> closures = accessService.sectionClosures(
                clubId, windows.stream().map(SectionAvailabilityWindow::getSectionId).collect(Collectors.toSet()));
        Map<UUID, Set<UUID>> taggedBySection = taggedBySection(closures.values());
        for (SectionAvailabilityWindow window : windows) {
            Set<UUID> audience = new HashSet<>();
            for (UUID sectionId : closures.getOrDefault(window.getSectionId(), Set.of())) {
                for (UUID playerId : taggedBySection.getOrDefault(sectionId, Set.of())) {
                    SelectionEligibility.PlayerInfo info = players.get(playerId);
                    if (info != null && info.active()) {
                        audience.add(playerId);
                    }
                }
            }
            audienceByWindow.put(window.getId(), audience);
        }
        return audienceByWindow;
    }

    private Map<UUID, Set<UUID>> taggedBySection(Collection<Set<UUID>> closures) {
        Set<UUID> sectionIds = new HashSet<>();
        closures.forEach(sectionIds::addAll);
        Map<UUID, Set<UUID>> tagged = new HashMap<>();
        if (sectionIds.isEmpty()) {
            return tagged;
        }
        for (PlayerSection row : playerSectionRepository.findBySectionIdIn(sectionIds)) {
            tagged.computeIfAbsent(row.getSectionId(), key -> new HashSet<>()).add(row.getPlayerProfileId());
        }
        return tagged;
    }

    private Map<UUID, League> leagues(List<Match> matches) {
        Set<UUID> leagueIds = matches.stream()
                .map(Match::getLeagueId)
                .filter(id -> id != null)
                .collect(Collectors.toSet());
        Map<UUID, League> leagues = new HashMap<>();
        if (!leagueIds.isEmpty()) {
            leagueRepository.findAllById(leagueIds).forEach(league -> leagues.put(league.getId(), league));
        }
        return leagues;
    }

    /** The seasons of matches whose league has an age rule but no cutoff date (the season start applies). */
    private Map<UUID, Season> seasonsNeedingCutoff(List<Match> matches, Map<UUID, League> leagues) {
        Set<UUID> seasonIds = new HashSet<>();
        for (Match match : matches) {
            League league = match.getLeagueId() == null ? null : leagues.get(match.getLeagueId());
            boolean ageRule = league != null && (league.getMinAge() != null || league.getMaxAge() != null);
            if (ageRule && league.getAgeCutoffDate() == null) {
                seasonIds.add(match.getSeasonId());
            }
        }
        Map<UUID, Season> seasons = new HashMap<>();
        if (!seasonIds.isEmpty()) {
            seasonRepository.findAllById(seasonIds).forEach(season -> seasons.put(season.getId(), season));
        }
        return seasons;
    }
}
