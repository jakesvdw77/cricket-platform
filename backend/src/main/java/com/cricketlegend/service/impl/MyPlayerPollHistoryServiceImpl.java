package com.cricketlegend.service.impl;

import com.cricketlegend.domain.AvailabilityStatus;
import com.cricketlegend.domain.Match;
import com.cricketlegend.domain.MatchAvailabilityPoll;
import com.cricketlegend.domain.MatchSelectionState;
import com.cricketlegend.domain.MatchSide;
import com.cricketlegend.domain.MatchSidePlayer;
import com.cricketlegend.domain.MyPollKind;
import com.cricketlegend.domain.MyPollStatusFilter;
import com.cricketlegend.domain.PlayerAvailability;
import com.cricketlegend.domain.Season;
import com.cricketlegend.domain.SectionAvailabilityResponse;
import com.cricketlegend.domain.SectionAvailabilityRound;
import com.cricketlegend.domain.SectionAvailabilityWindow;
import com.cricketlegend.domain.Team;
import com.cricketlegend.dto.MyClosedPollsDto;
import com.cricketlegend.dto.MyPollAnswerDto;
import com.cricketlegend.dto.MyPollHistoryRowDto;
import com.cricketlegend.dto.MyPollResponsesDto;
import com.cricketlegend.exception.ValidationException;
import com.cricketlegend.repository.MatchAvailabilityPollRepository;
import com.cricketlegend.repository.MatchRepository;
import com.cricketlegend.repository.MatchSidePlayerRepository;
import com.cricketlegend.repository.MatchSideRepository;
import com.cricketlegend.repository.PlayerAvailabilityRepository;
import com.cricketlegend.repository.SeasonRepository;
import com.cricketlegend.repository.SectionAvailabilityResponseRepository;
import com.cricketlegend.repository.SectionAvailabilityRoundRepository;
import com.cricketlegend.repository.SectionAvailabilityWindowRepository;
import com.cricketlegend.repository.SectionRepository;
import com.cricketlegend.repository.TeamRepository;
import com.cricketlegend.service.MyPlayerPollHistoryService;
import com.cricketlegend.service.support.HeldPlayer;
import com.cricketlegend.service.support.MatchSideNames;
import com.cricketlegend.service.support.MyPlayerAccess;
import com.cricketlegend.service.support.MySelectionRule;
import com.cricketlegend.service.support.PollHistoryRules;
import com.cricketlegend.service.support.SeasonResolution;
import com.cricketlegend.service.support.ServerClock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.format.TextStyle;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The Hub Closed Polls and My Responses reads. Club and player come from the held player, never the request. A group
 * round belongs to a season by the season whose dates contain its first match date. A closed poll's {@code updatedAt} is
 * when it closed. The status and summary rules are {@link PollHistoryRules}; the selection rule is {@link MySelectionRule}.
 * Names and answers are never logged.
 */
@Service
public class MyPlayerPollHistoryServiceImpl implements MyPlayerPollHistoryService {

    static final int DEFAULT_SINCE_DAYS = 30;
    static final int MAX_SINCE_DAYS = 365;

    private final MyPlayerAccess access;
    private final MatchAvailabilityPollRepository pollRepository;
    private final SectionAvailabilityRoundRepository roundRepository;
    private final SectionAvailabilityWindowRepository windowRepository;
    private final SectionAvailabilityResponseRepository responseRepository;
    private final PlayerAvailabilityRepository availabilityRepository;
    private final MatchRepository matchRepository;
    private final MatchSideRepository sideRepository;
    private final MatchSidePlayerRepository sidePlayerRepository;
    private final TeamRepository teamRepository;
    private final SectionRepository sectionRepository;
    private final SeasonRepository seasonRepository;

    public MyPlayerPollHistoryServiceImpl(
            MyPlayerAccess access,
            MatchAvailabilityPollRepository pollRepository,
            SectionAvailabilityRoundRepository roundRepository,
            SectionAvailabilityWindowRepository windowRepository,
            SectionAvailabilityResponseRepository responseRepository,
            PlayerAvailabilityRepository availabilityRepository,
            MatchRepository matchRepository,
            MatchSideRepository sideRepository,
            MatchSidePlayerRepository sidePlayerRepository,
            TeamRepository teamRepository,
            SectionRepository sectionRepository,
            SeasonRepository seasonRepository) {
        this.access = access;
        this.pollRepository = pollRepository;
        this.roundRepository = roundRepository;
        this.windowRepository = windowRepository;
        this.responseRepository = responseRepository;
        this.availabilityRepository = availabilityRepository;
        this.matchRepository = matchRepository;
        this.sideRepository = sideRepository;
        this.sidePlayerRepository = sidePlayerRepository;
        this.teamRepository = teamRepository;
        this.sectionRepository = sectionRepository;
        this.seasonRepository = seasonRepository;
    }

    @Override
    @Transactional(readOnly = true)
    public MyClosedPollsDto closed(Authentication authentication, String key, Integer sinceDays, String status) {
        HeldPlayer held = access.resolve(authentication, key);
        int days = sinceDays == null ? DEFAULT_SINCE_DAYS : sinceDays;
        if (days < 1 || days > MAX_SINCE_DAYS) {
            throw new ValidationException("sinceDays must be between 1 and " + MAX_SINCE_DAYS);
        }
        MyPollStatusFilter filter = parseStatus(status);
        UUID clubId = held.profile().getClubId();
        UUID playerId = held.profile().getId();
        Instant since = ServerClock.now().minus(Duration.ofDays(days));
        List<Row> rows = new ArrayList<>(squadRows(pollRepository.findClosedSinceForPlayer(playerId, clubId, since), playerId));
        rows.addAll(groupRows(roundRepository.findClosedSinceForPlayer(playerId, clubId, since), playerId));
        rows.sort(Comparator.comparing((Row r) -> r.dto().closedAt()).reversed());
        return new MyClosedPollsDto(days, rows.size(), filtered(rows, filter));
    }

    @Override
    @Transactional(readOnly = true)
    public MyPollResponsesDto responses(Authentication authentication, String key, UUID seasonId, String status) {
        HeldPlayer held = access.resolve(authentication, key);
        MyPollStatusFilter filter = parseStatus(status);
        UUID clubId = held.profile().getClubId();
        UUID playerId = held.profile().getId();
        List<Season> clubSeasons = seasonRepository.findByClubId(clubId);
        UUID chosenId = SeasonResolution.resolve(clubSeasons, seasonId);
        Season chosen = chosenId == null ? null : clubSeasons.stream()
                .filter(s -> s.getId().equals(chosenId)).findFirst().orElse(null);

        List<Row> rows = new ArrayList<>();
        if (chosen != null) {
            rows.addAll(squadRows(pollRepository.findAllForPlayerInSeason(playerId, clubId, chosen.getId()), playerId));
            rows.addAll(groupRows(roundRepository.findForPlayerBetween(
                    playerId, clubId, chosen.getStartDate(), chosen.getEndDate()), playerId));
        }
        rows.sort(Comparator.comparing(Row::sortDate).reversed());

        Set<UUID> withPolls = new HashSet<>(pollRepository.findSeasonIdsForPlayer(playerId, clubId));
        List<LocalDate> groupDates = roundRepository.findFirstMatchDatesForPlayer(playerId, clubId);
        for (Season s : clubSeasons) {
            if (groupDates.stream().anyMatch(d -> !d.isBefore(s.getStartDate()) && !d.isAfter(s.getEndDate()))) {
                withPolls.add(s.getId());
            }
        }
        List<MyPollResponsesDto.SeasonOption> seasons = clubSeasons.stream()
                .filter(s -> withPolls.contains(s.getId()))
                .sorted(Comparator.comparing(Season::getStartDate).reversed())
                .map(s -> new MyPollResponsesDto.SeasonOption(s.getId(), s.getLabel()))
                .toList();
        return new MyPollResponsesDto(
                new MyPollResponsesDto.Scope(chosenId),
                seasons,
                SeasonResolution.currentSeasonId(clubSeasons),
                summary(rows),
                filtered(rows, filter));
    }

    private static MyPollResponsesDto.Summary summary(List<Row> rows) {
        long available = 0;
        long unavailable = 0;
        long unsure = 0;
        long notAnswered = 0;
        for (Row r : rows) {
            switch (PollHistoryRules.bucket(r.statuses())) {
                case AVAILABLE -> available++;
                case UNAVAILABLE -> unavailable++;
                case UNSURE -> unsure++;
                case NOT_ANSWERED -> notAnswered++;
            }
        }
        return new MyPollResponsesDto.Summary(
                rows.size(), rows.size() - notAnswered, available, unavailable, unsure, notAnswered);
    }

    private static List<MyPollHistoryRowDto> filtered(List<Row> rows, MyPollStatusFilter filter) {
        return rows.stream().filter(r -> PollHistoryRules.matches(r.statuses(), filter)).map(Row::dto).toList();
    }

    private static MyPollStatusFilter parseStatus(String status) {
        if (status == null || status.isBlank()) {
            return null;
        }
        try {
            return MyPollStatusFilter.valueOf(status.trim());
        } catch (IllegalArgumentException e) {
            throw new ValidationException("status must be one of AVAILABLE, UNAVAILABLE, UNSURE, NOT_ANSWERED");
        }
    }

    /** A built row with the facts the sort and the status rules need. */
    private record Row(MyPollHistoryRowDto dto, Instant sortDate) {
        List<AvailabilityStatus> statuses() {
            return dto.answers().stream().map(MyPollAnswerDto::status).toList();
        }
    }

    private List<Row> squadRows(List<MatchAvailabilityPoll> polls, UUID playerId) {
        if (polls.isEmpty()) {
            return List.of();
        }
        Map<UUID, Match> matches = matchRepository
                .findAllById(polls.stream().map(MatchAvailabilityPoll::getMatchId).collect(Collectors.toSet()))
                .stream()
                .collect(Collectors.toMap(Match::getId, Function.identity()));
        Set<UUID> teamIds = new HashSet<>();
        polls.forEach(p -> teamIds.add(p.getTeamId()));
        matches.values().forEach(m -> {
            if (m.getHomeTeamId() != null) {
                teamIds.add(m.getHomeTeamId());
            }
            if (m.getAwayTeamId() != null) {
                teamIds.add(m.getAwayTeamId());
            }
        });
        Map<UUID, Team> teams = teamRepository.findAllById(teamIds).stream()
                .collect(Collectors.toMap(Team::getId, Function.identity()));
        Map<UUID, PlayerAvailability> answers = availabilityRepository
                .findByPollIdInAndPlayerProfileId(polls.stream().map(MatchAvailabilityPoll::getId).toList(), playerId)
                .stream()
                .collect(Collectors.toMap(PlayerAvailability::getPollId, Function.identity(), (a, b) -> a));
        Map<UUID, List<MatchSide>> sidesByMatch =
                sideRepository.findByMatchIdIn(matches.keySet()).stream().collect(Collectors.groupingBy(MatchSide::getMatchId));
        Set<UUID> sideIds = sidesByMatch.values().stream().flatMap(List::stream).map(MatchSide::getId).collect(Collectors.toSet());
        Map<UUID, List<MatchSidePlayer>> playersBySide = sideIds.isEmpty()
                ? Map.of()
                : sidePlayerRepository.findByMatchSideIdIn(sideIds).stream()
                        .collect(Collectors.groupingBy(MatchSidePlayer::getMatchSideId));
        List<Row> out = new ArrayList<>();
        for (MatchAvailabilityPoll poll : polls) {
            Match match = matches.get(poll.getMatchId());
            if (match == null) {
                continue;
            }
            String home = MatchSideNames.home(match, teams);
            String away = MatchSideNames.away(match, teams);
            Team team = teams.get(poll.getTeamId());
            PlayerAvailability answer = answers.get(poll.getId());
            List<MyPollAnswerDto> mine = answer == null ? List.of() : List.of(new MyPollAnswerDto(null, null, answer.getStatus()));
            MatchSelectionState selection = MySelectionRule.state(
                    sidesByMatch.getOrDefault(match.getId(), List.of()), playersBySide, Set.of(poll.getTeamId()), playerId);
            Boolean selected = selection == MatchSelectionState.NOT_ANNOUNCED ? null : selection == MatchSelectionState.SELECTED;
            out.add(new Row(new MyPollHistoryRowDto(
                    poll.getId(), MyPollKind.SQUAD, home + " v " + away, team == null ? null : team.getName(),
                    match.getMatchDate(), home, away, match.getVenue(), List.of(),
                    poll.isOpen(), poll.isOpen() ? null : poll.getUpdatedAt(), mine, !mine.isEmpty(), selected),
                    match.getMatchDate()));
        }
        return out;
    }

    private List<Row> groupRows(List<SectionAvailabilityRound> rounds, UUID playerId) {
        if (rounds.isEmpty()) {
            return List.of();
        }
        List<UUID> roundIds = rounds.stream().map(SectionAvailabilityRound::getId).toList();
        Map<UUID, SectionAvailabilityWindow> windows = windowRepository.findByRoundIdIn(roundIds).stream()
                .collect(Collectors.toMap(SectionAvailabilityWindow::getId, Function.identity()));
        Map<UUID, List<SectionAvailabilityResponse>> responsesByRound = new HashMap<>();
        if (!windows.isEmpty()) {
            for (SectionAvailabilityResponse r : responseRepository.findByPlayerProfileIdAndWindowIdIn(playerId, windows.keySet())) {
                responsesByRound.computeIfAbsent(windows.get(r.getWindowId()).getRoundId(), k -> new ArrayList<>()).add(r);
            }
        }
        Map<UUID, String> sectionNames = sectionRepository
                .findAllById(rounds.stream().map(SectionAvailabilityRound::getSectionId).collect(Collectors.toSet()))
                .stream()
                .collect(Collectors.toMap(s -> s.getId(), s -> s.getName()));
        List<Row> out = new ArrayList<>();
        for (SectionAvailabilityRound round : rounds) {
            TreeSet<LocalDate> dates = new TreeSet<>();
            windows.values().stream().filter(w -> w.getRoundId().equals(round.getId())).forEach(w -> dates.add(w.getWindowDate()));
            List<MyPollAnswerDto> mine = responsesByRound.getOrDefault(round.getId(), List.of()).stream()
                    .map(r -> Map.entry(windows.get(r.getWindowId()), r.getStatus()))
                    .sorted(Comparator.comparing((Map.Entry<SectionAvailabilityWindow, AvailabilityStatus> e) -> e.getKey().getWindowDate())
                            .thenComparing(e -> e.getKey().getDayPart()))
                    .map(e -> new MyPollAnswerDto(e.getKey().getId(), label(e.getKey()), e.getValue()))
                    .toList();
            out.add(new Row(new MyPollHistoryRowDto(
                    round.getId(), MyPollKind.GROUP, round.getDescription(), sectionNames.get(round.getSectionId()),
                    null, null, null, null, List.copyOf(dates),
                    round.isOpen(), round.isOpen() ? null : round.getUpdatedAt(), mine, !mine.isEmpty(), null),
                    ServerClock.startOfDay(round.getFirstMatchDate())));
        }
        return out;
    }

    /** For example "Sat morning". */
    private static String label(SectionAvailabilityWindow w) {
        return w.getWindowDate().getDayOfWeek().getDisplayName(TextStyle.SHORT, Locale.ENGLISH)
                + " " + w.getDayPart().name().toLowerCase(Locale.ROOT);
    }
}
