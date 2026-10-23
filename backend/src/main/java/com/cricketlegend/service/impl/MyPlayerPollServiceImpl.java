package com.cricketlegend.service.impl;

import com.cricketlegend.domain.AnswerSource;
import com.cricketlegend.domain.Match;
import com.cricketlegend.domain.MatchAvailabilityPoll;
import com.cricketlegend.domain.MyPollKind;
import com.cricketlegend.domain.PlayerAvailability;
import com.cricketlegend.domain.Section;
import com.cricketlegend.domain.SectionAvailabilityResponse;
import com.cricketlegend.domain.SectionAvailabilityRound;
import com.cricketlegend.domain.SectionAvailabilityWindow;
import com.cricketlegend.domain.SectionAvailabilityWindowMatch;
import com.cricketlegend.domain.Team;
import com.cricketlegend.dto.MyPollDto;
import com.cricketlegend.dto.PublicAnswerDto;
import com.cricketlegend.dto.PublicAnswersDto;
import com.cricketlegend.dto.PublicAnswersRequest;
import com.cricketlegend.dto.PublicRoundMatchDto;
import com.cricketlegend.dto.PublicRoundWindowDto;
import com.cricketlegend.exception.NotFoundException;
import com.cricketlegend.exception.ValidationException;
import com.cricketlegend.repository.MatchAvailabilityPollRepository;
import com.cricketlegend.repository.MatchRepository;
import com.cricketlegend.repository.PlayerAvailabilityRepository;
import com.cricketlegend.repository.SectionAvailabilityResponseRepository;
import com.cricketlegend.repository.SectionAvailabilityRoundRepository;
import com.cricketlegend.repository.SectionAvailabilityWindowMatchRepository;
import com.cricketlegend.repository.SectionAvailabilityWindowRepository;
import com.cricketlegend.repository.SectionRepository;
import com.cricketlegend.repository.TeamRepository;
import com.cricketlegend.service.AvailabilityPollSquadResolver;
import com.cricketlegend.service.MyPlayerPollService;
import com.cricketlegend.service.SectionAvailabilityAudienceResolver;
import com.cricketlegend.service.support.HeldPlayer;
import com.cricketlegend.service.support.MatchSideNames;
import com.cricketlegend.service.support.MyPlayerAccess;
import com.cricketlegend.service.support.RoundAnswerWriter;
import com.cricketlegend.service.support.SquadPollAnswerWriter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * docs/specs/119 My players, availability. Belonging is decided by the same resolvers the public form uses
 * ({@link AvailabilityPollSquadResolver}, {@link SectionAvailabilityAudienceResolver}) and answers are written by the
 * shared {@link SquadPollAnswerWriter} and {@link RoundAnswerWriter}, so closed and window rules are 077's. Names are
 * never logged.
 */
@Service
public class MyPlayerPollServiceImpl implements MyPlayerPollService {

    private static final Logger log = LoggerFactory.getLogger(MyPlayerPollServiceImpl.class);

    private final MyPlayerAccess access;
    private final MatchAvailabilityPollRepository pollRepository;
    private final SectionAvailabilityRoundRepository roundRepository;
    private final SectionAvailabilityWindowRepository windowRepository;
    private final SectionAvailabilityWindowMatchRepository windowMatchRepository;
    private final SectionAvailabilityResponseRepository responseRepository;
    private final PlayerAvailabilityRepository availabilityRepository;
    private final MatchRepository matchRepository;
    private final TeamRepository teamRepository;
    private final SectionRepository sectionRepository;
    private final AvailabilityPollSquadResolver squadResolver;
    private final SectionAvailabilityAudienceResolver audienceResolver;
    private final SquadPollAnswerWriter squadWriter;
    private final RoundAnswerWriter roundWriter;

    public MyPlayerPollServiceImpl(
            MyPlayerAccess access,
            MatchAvailabilityPollRepository pollRepository,
            SectionAvailabilityRoundRepository roundRepository,
            SectionAvailabilityWindowRepository windowRepository,
            SectionAvailabilityWindowMatchRepository windowMatchRepository,
            SectionAvailabilityResponseRepository responseRepository,
            PlayerAvailabilityRepository availabilityRepository,
            MatchRepository matchRepository,
            TeamRepository teamRepository,
            SectionRepository sectionRepository,
            AvailabilityPollSquadResolver squadResolver,
            SectionAvailabilityAudienceResolver audienceResolver,
            SquadPollAnswerWriter squadWriter,
            RoundAnswerWriter roundWriter) {
        this.access = access;
        this.pollRepository = pollRepository;
        this.roundRepository = roundRepository;
        this.windowRepository = windowRepository;
        this.windowMatchRepository = windowMatchRepository;
        this.responseRepository = responseRepository;
        this.availabilityRepository = availabilityRepository;
        this.matchRepository = matchRepository;
        this.teamRepository = teamRepository;
        this.sectionRepository = sectionRepository;
        this.squadResolver = squadResolver;
        this.audienceResolver = audienceResolver;
        this.squadWriter = squadWriter;
        this.roundWriter = roundWriter;
    }

    @Override
    @Transactional(readOnly = true)
    public List<MyPollDto> list(Authentication authentication, String key) {
        UUID playerId = access.resolve(authentication, key).profile().getId();
        List<MatchAvailabilityPoll> polls = pollRepository.findOpenForPlayer(playerId);
        List<SectionAvailabilityRound> rounds = roundRepository.findOpenForPlayer(playerId);
        List<MyPollDto> result = new ArrayList<>(squadPolls(polls, playerId));
        result.addAll(groupPolls(rounds, playerId));
        return result;
    }

    @Override
    @Transactional
    public PublicAnswersDto saveAnswers(
            Authentication authentication, String key, UUID pollId, PublicAnswersRequest request) {
        HeldPlayer held = access.resolve(authentication, key);
        UUID playerId = held.profile().getId();
        MatchAvailabilityPoll poll = pollRepository.findById(pollId).orElse(null);
        PublicAnswersDto saved;
        if (poll != null) {
            Match match = matchRepository
                    .findById(poll.getMatchId())
                    .orElseThrow(() -> new NotFoundException("Poll not found"));
            boolean member = squadResolver.resolveSquadRows(poll.getTeamId(), match.getSeasonId()).stream()
                    .anyMatch(row -> playerId.equals(row.playerProfileId()));
            if (!member) {
                throw new NotFoundException("Poll not found");
            }
            if (request.answers().size() != 1) {
                throw new ValidationException("A squad poll takes exactly one answer");
            }
            PlayerAvailability answer = squadWriter.save(
                    poll, playerId, request.answers().get(0).status(), AnswerSource.LINKED_ACCOUNT);
            saved = new PublicAnswersDto(List.of(new PublicAnswerDto(null, answer.getStatus())));
        } else {
            SectionAvailabilityRound round = roundRepository
                    .findById(pollId)
                    .orElseThrow(() -> new NotFoundException("Poll not found"));
            boolean member = audienceResolver.resolveAudience(round.getSectionId()).stream()
                    .anyMatch(row -> Objects.equals(row.playerProfileId(), playerId));
            if (!member) {
                throw new NotFoundException("Poll not found");
            }
            saved = new PublicAnswersDto(roundAnswers(roundWriter.save(
                    round, playerId, request.answers(), AnswerSource.LINKED_ACCOUNT)));
        }
        log.info("My player availability saved: account={} player={} poll={} answers={}",
                held.caller().getId(), playerId, pollId, request.answers().size());
        return saved;
    }

    private List<MyPollDto> squadPolls(List<MatchAvailabilityPoll> polls, UUID playerId) {
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
        List<MyPollDto> out = new ArrayList<>();
        for (MatchAvailabilityPoll poll : polls) {
            Match match = matches.get(poll.getMatchId());
            if (match == null) {
                continue;
            }
            String home = MatchSideNames.home(match, teams);
            String away = MatchSideNames.away(match, teams);
            Team team = teams.get(poll.getTeamId());
            PlayerAvailability answer = answers.get(poll.getId());
            out.add(new MyPollDto(
                    poll.getId(),
                    MyPollKind.SQUAD,
                    home + " v " + away,
                    team == null ? null : team.getName(),
                    null,
                    home,
                    away,
                    match.getMatchDate(),
                    match.getVenue(),
                    poll.getScheduledCloseAt(),
                    List.of(),
                    answer == null ? List.of() : List.of(new PublicAnswerDto(null, answer.getStatus()))));
        }
        return out;
    }

    private List<MyPollDto> groupPolls(List<SectionAvailabilityRound> rounds, UUID playerId) {
        if (rounds.isEmpty()) {
            return List.of();
        }
        List<UUID> roundIds = rounds.stream().map(SectionAvailabilityRound::getId).toList();
        List<SectionAvailabilityWindow> allWindows = windowRepository.findByRoundIdIn(roundIds);
        List<UUID> windowIds = allWindows.stream().map(SectionAvailabilityWindow::getId).toList();
        List<SectionAvailabilityWindowMatch> links =
                windowIds.isEmpty() ? List.of() : windowMatchRepository.findByWindowIdIn(windowIds);
        Map<UUID, Match> matches = links.isEmpty()
                ? Map.of()
                : matchRepository
                        .findAllById(links.stream().map(SectionAvailabilityWindowMatch::getMatchId).collect(Collectors.toSet()))
                        .stream()
                        .collect(Collectors.toMap(Match::getId, Function.identity()));
        Set<UUID> teamIds = new HashSet<>();
        matches.values().forEach(m -> {
            if (m.getHomeTeamId() != null) {
                teamIds.add(m.getHomeTeamId());
            }
            if (m.getAwayTeamId() != null) {
                teamIds.add(m.getAwayTeamId());
            }
        });
        Map<UUID, Team> teams = teamIds.isEmpty()
                ? Map.of()
                : teamRepository.findAllById(teamIds).stream()
                        .collect(Collectors.toMap(Team::getId, Function.identity()));
        Map<UUID, List<PublicRoundMatchDto>> matchesByWindow = new HashMap<>();
        for (SectionAvailabilityWindowMatch link : links) {
            Match match = matches.get(link.getMatchId());
            if (match != null) {
                matchesByWindow.computeIfAbsent(link.getWindowId(), k -> new ArrayList<>())
                        .add(new PublicRoundMatchDto(MatchSideNames.home(match, teams), MatchSideNames.away(match, teams)));
            }
        }
        Map<UUID, List<SectionAvailabilityResponse>> responsesByRound = new HashMap<>();
        Map<UUID, UUID> roundOfWindow = allWindows.stream()
                .collect(Collectors.toMap(SectionAvailabilityWindow::getId, SectionAvailabilityWindow::getRoundId));
        if (!windowIds.isEmpty()) {
            for (SectionAvailabilityResponse r : responseRepository.findByPlayerProfileIdAndWindowIdIn(playerId, windowIds)) {
                responsesByRound.computeIfAbsent(roundOfWindow.get(r.getWindowId()), k -> new ArrayList<>()).add(r);
            }
        }
        Map<UUID, String> sectionNames = sectionRepository
                .findAllById(rounds.stream().map(SectionAvailabilityRound::getSectionId).collect(Collectors.toSet()))
                .stream()
                .collect(Collectors.toMap(Section::getId, Section::getName));
        List<MyPollDto> out = new ArrayList<>();
        for (SectionAvailabilityRound round : rounds) {
            List<PublicRoundWindowDto> windows = allWindows.stream()
                    .filter(w -> w.getRoundId().equals(round.getId()))
                    .sorted(Comparator.comparing(SectionAvailabilityWindow::getWindowDate)
                            .thenComparing(SectionAvailabilityWindow::getDayPart))
                    .map(w -> new PublicRoundWindowDto(
                            w.getId(), w.getWindowDate(), w.getDayPart(), w.isOpen(),
                            matchesByWindow.getOrDefault(w.getId(), List.of())))
                    .toList();
            out.add(new MyPollDto(
                    round.getId(),
                    MyPollKind.GROUP,
                    round.getDescription(),
                    null,
                    sectionNames.get(round.getSectionId()),
                    null,
                    null,
                    null,
                    null,
                    round.getScheduledCloseAt(),
                    windows,
                    roundAnswers(responsesByRound.getOrDefault(round.getId(), List.of()))));
        }
        return out;
    }

    private static List<PublicAnswerDto> roundAnswers(List<SectionAvailabilityResponse> responses) {
        return responses.stream()
                .map(r -> new PublicAnswerDto(r.getWindowId(), r.getStatus()))
                .sorted(Comparator.comparing(a -> a.windowId().toString()))
                .toList();
    }
}
