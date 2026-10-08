package com.cricketlegend.service.support;

import com.cricketlegend.config.AccessService;
import com.cricketlegend.domain.AvailabilityPollType;
import com.cricketlegend.domain.Match;
import com.cricketlegend.domain.MatchAvailabilityPoll;
import com.cricketlegend.domain.PlayerAvailability;
import com.cricketlegend.domain.PlayerProfile;
import com.cricketlegend.domain.PlayerSection;
import com.cricketlegend.domain.SectionAvailabilityResponse;
import com.cricketlegend.domain.SectionAvailabilityRound;
import com.cricketlegend.domain.SectionAvailabilityWindow;
import com.cricketlegend.domain.Team;
import com.cricketlegend.domain.TeamSquadMember;
import com.cricketlegend.dto.OverviewPollDto;
import com.cricketlegend.repository.MatchAvailabilityPollRepository;
import com.cricketlegend.repository.MatchRepository;
import com.cricketlegend.repository.PlayerAvailabilityRepository;
import com.cricketlegend.repository.PlayerProfileRepository;
import com.cricketlegend.repository.PlayerSectionRepository;
import com.cricketlegend.repository.SectionAvailabilityResponseRepository;
import com.cricketlegend.repository.SectionAvailabilityRoundRepository;
import com.cricketlegend.repository.SectionAvailabilityWindowRepository;
import com.cricketlegend.repository.TeamRepository;
import com.cricketlegend.repository.TeamSquadMemberRepository;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.stereotype.Component;

/**
 * Every open, in-scope availability poll of a club with who has answered, for the manager overview
 * (docs/specs/079-manager-shell-and-overview.md). Squad polls ({@link MatchAvailabilityPoll}) are
 * scoped by their match's own-club sections, group polls ({@link SectionAvailabilityRound}) by their
 * section, both against the caller's accessible sections ({@code Optional.empty()} is unrestricted).
 * Only polls of active matches count. Audience, answers and names are each loaded with one batched
 * query for all polls of a kind, never per poll. Counting follows the existing poll screens: a squad
 * poll's audience is the {@code (team, season)} squad; a group poll's is the section's active tagged
 * players, and a player has replied once every window of the round has his answer.
 */
@Component
public class OverviewPolls {

    private static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("EEE d MMM", Locale.ENGLISH);

    private record SquadKey(UUID teamId, UUID seasonId) {
    }

    private final MatchAvailabilityPollRepository pollRepository;
    private final PlayerAvailabilityRepository playerAvailabilityRepository;
    private final TeamSquadMemberRepository squadRepository;
    private final MatchRepository matchRepository;
    private final TeamRepository teamRepository;
    private final SectionAvailabilityRoundRepository roundRepository;
    private final SectionAvailabilityWindowRepository windowRepository;
    private final SectionAvailabilityResponseRepository responseRepository;
    private final PlayerSectionRepository playerSectionRepository;
    private final PlayerProfileRepository playerProfileRepository;
    private final AccessService accessService;
    private final AvailabilityPollFilters pollFilters;

    public OverviewPolls(
            MatchAvailabilityPollRepository pollRepository,
            PlayerAvailabilityRepository playerAvailabilityRepository,
            TeamSquadMemberRepository squadRepository,
            MatchRepository matchRepository,
            TeamRepository teamRepository,
            SectionAvailabilityRoundRepository roundRepository,
            SectionAvailabilityWindowRepository windowRepository,
            SectionAvailabilityResponseRepository responseRepository,
            PlayerSectionRepository playerSectionRepository,
            PlayerProfileRepository playerProfileRepository,
            AccessService accessService,
            AvailabilityPollFilters pollFilters) {
        this.pollRepository = pollRepository;
        this.playerAvailabilityRepository = playerAvailabilityRepository;
        this.squadRepository = squadRepository;
        this.matchRepository = matchRepository;
        this.teamRepository = teamRepository;
        this.roundRepository = roundRepository;
        this.windowRepository = windowRepository;
        this.responseRepository = responseRepository;
        this.playerSectionRepository = playerSectionRepository;
        this.playerProfileRepository = playerProfileRepository;
        this.accessService = accessService;
        this.pollFilters = pollFilters;
    }

    /**
     * An open poll with the players behind its counts: {@code audience} is who was asked, {@code
     * responded} the audience members with at least one real answer (for a group poll, in any one
     * window, unlike {@code poll.repliedCount()} which needs every window); {@code awaiting} the
     * audience members who have not fully answered (a squad member without a real answer; for a
     * group poll, anyone who has not answered every window), so {@code awaiting.size()} equals
     * {@code totalCount - repliedCount}; {@code open} is false for a closed poll (only returned
     * when the filter includes closed polls).
     */
    public record OpenPoll(
            OverviewPollDto poll, Set<UUID> audience, Set<UUID> responded, Set<UUID> awaiting, boolean open) {
    }

    /** All open in-scope polls, squad and group, unsorted. */
    public List<OverviewPollDto> openPolls(UUID clubId, Optional<Set<UUID>> accessibleSectionIds) {
        return openPollsWithPlayers(clubId, accessibleSectionIds).stream().map(OpenPoll::poll).toList();
    }

    /** The same polls as {@link #openPolls}, from the same queries, each with its player sets. */
    public List<OpenPoll> openPollsWithPlayers(UUID clubId, Optional<Set<UUID>> accessibleSectionIds) {
        return pollsWithPlayers(clubId, accessibleSectionIds, AvailabilityPollFilter.OPEN_ONLY);
    }

    /**
     * The in-scope polls matching {@code filter} (docs/specs/083): open ones, plus closed ones (the
     * {@value AvailabilityPollFilter#CLOSED_POLLS_LIMIT} most recent of each kind that match) when {@code filter.includeClosed()}.
     */
    public List<OpenPoll> pollsWithPlayers(
            UUID clubId, Optional<Set<UUID>> accessibleSectionIds, AvailabilityPollFilter filter) {
        List<OpenPoll> result = new ArrayList<>();
        if (filter.includesSquad()) {
            result.addAll(squadPolls(clubId, accessibleSectionIds, filter));
        }
        if (filter.includesGroup()) {
            result.addAll(groupPolls(clubId, accessibleSectionIds, filter));
        }
        return result;
    }

    private List<OpenPoll> squadPolls(
            UUID clubId, Optional<Set<UUID>> accessibleSectionIds, AvailabilityPollFilter filter) {
        List<MatchAvailabilityPoll> polls = new ArrayList<>(pollRepository.findOpenByMatchClubId(clubId));
        int openCount = polls.size();
        if (filter.includeClosed()) {
            polls.addAll(pollRepository.findClosedByMatchClubId(clubId));
        }
        if (polls.isEmpty()) {
            return List.of();
        }
        Map<UUID, Match> matchesById = matchRepository
                .findAllById(polls.stream().map(MatchAvailabilityPoll::getMatchId).collect(Collectors.toSet()))
                .stream()
                .filter(Match::isActive)
                .collect(Collectors.toMap(Match::getId, Function.identity()));
        Set<UUID> teamIds = new HashSet<>();
        for (Match match : matchesById.values()) {
            addIfNotNull(teamIds, match.getHomeTeamId());
            addIfNotNull(teamIds, match.getAwayTeamId());
        }
        for (MatchAvailabilityPoll poll : polls) {
            teamIds.add(poll.getTeamId());
        }
        Map<UUID, Team> teamsById = teamRepository.findAllById(teamIds).stream()
                .collect(Collectors.toMap(Team::getId, Function.identity()));

        List<MatchAvailabilityPoll> scoped = new ArrayList<>();
        Set<UUID> openIds = new HashSet<>();
        for (int i = 0; i < polls.size(); i++) {
            MatchAvailabilityPoll poll = polls.get(i);
            Match match = matchesById.get(poll.getMatchId());
            if (!inScope(clubId, match, teamsById, accessibleSectionIds)
                    || !filter.matchesSquad(poll, match, filterSectionIds(clubId, match, teamsById, filter))) {
                continue;
            }
            if (i < openCount) {
                openIds.add(poll.getId());
                scoped.add(poll);
            } else if (scoped.size() - openIds.size() < AvailabilityPollFilter.CLOSED_POLLS_LIMIT) {
                scoped.add(poll);
            }
        }
        if (scoped.isEmpty()) {
            return List.of();
        }

        Set<UUID> squadTeamIds = new HashSet<>();
        Set<UUID> squadSeasonIds = new HashSet<>();
        for (MatchAvailabilityPoll poll : scoped) {
            squadTeamIds.add(poll.getTeamId());
            squadSeasonIds.add(matchesById.get(poll.getMatchId()).getSeasonId());
        }
        Map<SquadKey, Set<UUID>> squads = new HashMap<>();
        for (TeamSquadMember member : squadRepository.findByTeamIdInAndSeasonIdIn(squadTeamIds, squadSeasonIds)) {
            squads.computeIfAbsent(new SquadKey(member.getTeamId(), member.getSeasonId()), key -> new HashSet<>())
                    .add(member.getPlayerProfileId());
        }
        Map<UUID, Set<UUID>> answeredByPollId = new HashMap<>();
        for (PlayerAvailability answer : playerAvailabilityRepository.findByPollIdIn(
                scoped.stream().map(MatchAvailabilityPoll::getId).toList())) {
            answeredByPollId.computeIfAbsent(answer.getPollId(), key -> new HashSet<>())
                    .add(answer.getPlayerProfileId());
        }

        List<OpenPoll> result = new ArrayList<>();
        for (MatchAvailabilityPoll poll : scoped) {
            Match match = matchesById.get(poll.getMatchId());
            Set<UUID> squad = squads.getOrDefault(new SquadKey(poll.getTeamId(), match.getSeasonId()), Set.of());
            Set<UUID> answered = new HashSet<>(answeredByPollId.getOrDefault(poll.getId(), Set.of()));
            answered.retainAll(squad);
            Set<UUID> awaiting = new HashSet<>(squad);
            awaiting.removeAll(answered);
            result.add(new OpenPoll(
                    new OverviewPollDto(
                            AvailabilityPollType.SQUAD,
                            poll.getId(),
                            match.getId(),
                            squadTitle(poll, match, teamsById),
                            answered.size(),
                            squad.size(),
                            poll.getScheduledCloseAt()),
                    squad,
                    answered,
                    awaiting,
                    openIds.contains(poll.getId())));
        }
        return result;
    }

    /** The match's own-club sections, only worked out when the filter narrows by section. */
    private Set<UUID> filterSectionIds(
            UUID clubId, Match match, Map<UUID, Team> teamsById, AvailabilityPollFilter filter) {
        if (filter.sectionIds() == null || match == null) {
            return Set.of();
        }
        return accessService.resolveMatchSectionIds(clubId, match.getHomeTeamId(), match.getAwayTeamId(), teamsById);
    }

    private boolean inScope(
            UUID clubId, Match match, Map<UUID, Team> teamsById, Optional<Set<UUID>> accessibleSectionIds) {
        if (match == null) {
            return false;
        }
        if (accessibleSectionIds.isEmpty()) {
            return true;
        }
        return accessService
                .resolveMatchSectionIds(clubId, match.getHomeTeamId(), match.getAwayTeamId(), teamsById)
                .stream()
                .anyMatch(accessibleSectionIds.get()::contains);
    }

    private String squadTitle(MatchAvailabilityPoll poll, Match match, Map<UUID, Team> teamsById) {
        boolean pollIsHome = poll.getTeamId().equals(match.getHomeTeamId());
        String own = pollIsHome ? MatchSideNames.home(match, teamsById) : MatchSideNames.away(match, teamsById);
        String opponent = pollIsHome ? MatchSideNames.away(match, teamsById) : MatchSideNames.home(match, teamsById);
        String date = DATE.format(match.getMatchDate().atZone(ZoneId.systemDefault()));
        return own + " v " + opponent + ", " + date;
    }

    private List<OpenPoll> groupPolls(
            UUID clubId, Optional<Set<UUID>> accessibleSectionIds, AvailabilityPollFilter filter) {
        List<SectionAvailabilityRound> inScope = (filter.includeClosed()
                        ? roundRepository.findByClubId(clubId)
                        : roundRepository.findByClubIdAndOpenTrue(clubId))
                .stream()
                        .filter(round -> accessibleSectionIds.isEmpty()
                                || accessibleSectionIds.get().contains(round.getSectionId()))
                        .toList();
        Map<UUID, List<Match>> slotMatches = filter.needsGroupMatches() && !inScope.isEmpty()
                ? pollFilters.slotMatchesByRoundId(
                        inScope.stream().map(SectionAvailabilityRound::getId).toList())
                : Map.of();
        List<SectionAvailabilityRound> matching = inScope.stream()
                .filter(round -> filter.matchesGroup(round, slotMatches.getOrDefault(round.getId(), List.of())))
                .toList();
        List<SectionAvailabilityRound> rounds = new ArrayList<>(
                matching.stream().filter(SectionAvailabilityRound::isOpen).toList());
        rounds.addAll(matching.stream()
                .filter(round -> !round.isOpen())
                .sorted(Comparator.comparing(
                        SectionAvailabilityRound::getLastMatchDate, Comparator.nullsLast(Comparator.reverseOrder())))
                .limit(AvailabilityPollFilter.CLOSED_POLLS_LIMIT)
                .toList());
        if (rounds.isEmpty()) {
            return List.of();
        }
        Map<UUID, List<UUID>> windowIdsByRoundId = new HashMap<>();
        for (SectionAvailabilityWindow window :
                windowRepository.findByRoundIdIn(rounds.stream().map(SectionAvailabilityRound::getId).toList())) {
            windowIdsByRoundId.computeIfAbsent(window.getRoundId(), key -> new ArrayList<>()).add(window.getId());
        }
        Map<UUID, Set<UUID>> answeredByWindowId = new HashMap<>();
        Set<UUID> allWindowIds = windowIdsByRoundId.values().stream()
                .flatMap(Collection::stream)
                .collect(Collectors.toSet());
        if (!allWindowIds.isEmpty()) {
            for (SectionAvailabilityResponse response : responseRepository.findByWindowIdIn(allWindowIds)) {
                answeredByWindowId.computeIfAbsent(response.getWindowId(), key -> new HashSet<>())
                        .add(response.getPlayerProfileId());
            }
        }
        Map<UUID, Set<UUID>> audienceBySectionId = audiences(
                rounds.stream().map(SectionAvailabilityRound::getSectionId).collect(Collectors.toSet()));

        List<OpenPoll> result = new ArrayList<>();
        for (SectionAvailabilityRound round : rounds) {
            Set<UUID> audience = audienceBySectionId.getOrDefault(round.getSectionId(), Set.of());
            List<UUID> windowIds = windowIdsByRoundId.getOrDefault(round.getId(), List.of());
            Set<UUID> repliedEvery = audience.stream()
                    .filter(player -> windowIds.stream()
                            .allMatch(window -> answeredByWindowId.getOrDefault(window, Set.of()).contains(player)))
                    .collect(Collectors.toSet());
            Set<UUID> awaiting = new HashSet<>(audience);
            awaiting.removeAll(repliedEvery);
            Set<UUID> responded = audience.stream()
                    .filter(player -> windowIds.stream()
                            .anyMatch(window -> answeredByWindowId.getOrDefault(window, Set.of()).contains(player)))
                    .collect(Collectors.toSet());
            result.add(new OpenPoll(
                    new OverviewPollDto(
                            AvailabilityPollType.GROUP,
                            round.getId(),
                            null,
                            round.getDescription(),
                            repliedEvery.size(),
                            audience.size(),
                            round.getScheduledCloseAt()),
                    audience,
                    responded,
                    awaiting,
                    round.isOpen()));
        }
        return result;
    }

    /** The active players tagged to each section (exact section, as the group poll audience): two queries in all. */
    private Map<UUID, Set<UUID>> audiences(Set<UUID> sectionIds) {
        List<PlayerSection> tags = playerSectionRepository.findBySectionIdIn(sectionIds);
        if (tags.isEmpty()) {
            return Map.of();
        }
        Set<UUID> activeIds = playerProfileRepository
                .findAllById(tags.stream().map(PlayerSection::getPlayerProfileId).collect(Collectors.toSet()))
                .stream()
                .filter(PlayerProfile::isActive)
                .map(PlayerProfile::getId)
                .collect(Collectors.toSet());
        Map<UUID, Set<UUID>> result = new HashMap<>();
        for (PlayerSection tag : tags) {
            if (activeIds.contains(tag.getPlayerProfileId())) {
                result.computeIfAbsent(tag.getSectionId(), key -> new HashSet<>()).add(tag.getPlayerProfileId());
            }
        }
        return result;
    }

    private static void addIfNotNull(Set<UUID> set, UUID id) {
        if (id != null) {
            set.add(id);
        }
    }
}
