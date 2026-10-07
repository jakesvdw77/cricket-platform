package com.cricketlegend.service.impl;

import com.cricketlegend.domain.AnswerSource;
import com.cricketlegend.domain.Match;
import com.cricketlegend.domain.Section;
import com.cricketlegend.domain.SectionAvailabilityResponse;
import com.cricketlegend.domain.SectionAvailabilityRound;
import com.cricketlegend.domain.SectionAvailabilityWindow;
import com.cricketlegend.domain.SectionAvailabilityWindowMatch;
import com.cricketlegend.domain.Team;
import com.cricketlegend.dto.PublicAnswerDto;
import com.cricketlegend.dto.PublicAnswersDto;
import com.cricketlegend.dto.PublicAnswersRequest;
import com.cricketlegend.dto.PublicRoundHeaderDto;
import com.cricketlegend.dto.PublicRoundMatchDto;
import com.cricketlegend.dto.PublicRoundWindowDto;
import com.cricketlegend.dto.PublicVerifyRequest;
import com.cricketlegend.dto.PublicVerifyResponseDto;
import com.cricketlegend.exception.NotFoundException;
import com.cricketlegend.exception.SectionAvailabilityWindowClosedException;
import com.cricketlegend.exception.ValidationException;
import com.cricketlegend.repository.MatchRepository;
import com.cricketlegend.repository.SectionAvailabilityResponseRepository;
import com.cricketlegend.repository.SectionAvailabilityRoundRepository;
import com.cricketlegend.repository.SectionAvailabilityWindowMatchRepository;
import com.cricketlegend.repository.SectionAvailabilityWindowRepository;
import com.cricketlegend.repository.SectionRepository;
import com.cricketlegend.repository.TeamRepository;
import com.cricketlegend.service.PublicSectionAvailabilityRoundService;
import com.cricketlegend.service.SectionAvailabilityAudienceResolver;
import com.cricketlegend.service.support.MatchSideNames;
import com.cricketlegend.service.support.PublicAudienceMember;
import com.cricketlegend.service.support.PublicAvailabilityToken;
import com.cricketlegend.service.support.PublicAvailabilityVerifier;
import com.cricketlegend.service.support.PublicPollKind;
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
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Public group poll rules (docs/specs/077, on top of docs/specs/063): header without player data;
 * {@link #verify} matches only the round's own audience ({@link SectionAvailabilityAudienceResolver});
 * answers need the token issued for this round and player. A save is all-or-nothing in one
 * transaction: every window must belong to the round (404) and be open (409), partial answers are
 * allowed, rows are upserted with {@code source = PUBLIC_LINK}.
 *
 * <p>{@link #verify} is deliberately NOT {@code @Transactional} so the attempt counters commit even
 * when the verification fails with an exception; see {@code PublicAvailabilityPollServiceImpl}.
 */
@Service
public class PublicSectionAvailabilityRoundServiceImpl implements PublicSectionAvailabilityRoundService {

    private final SectionAvailabilityRoundRepository roundRepository;
    private final SectionAvailabilityWindowRepository windowRepository;
    private final SectionAvailabilityWindowMatchRepository windowMatchRepository;
    private final SectionAvailabilityResponseRepository responseRepository;
    private final SectionRepository sectionRepository;
    private final MatchRepository matchRepository;
    private final TeamRepository teamRepository;
    private final SectionAvailabilityAudienceResolver audienceResolver;
    private final PublicAvailabilityVerifier verifier;
    private final PublicAvailabilityToken tokens;

    public PublicSectionAvailabilityRoundServiceImpl(
            SectionAvailabilityRoundRepository roundRepository,
            SectionAvailabilityWindowRepository windowRepository,
            SectionAvailabilityWindowMatchRepository windowMatchRepository,
            SectionAvailabilityResponseRepository responseRepository,
            SectionRepository sectionRepository,
            MatchRepository matchRepository,
            TeamRepository teamRepository,
            SectionAvailabilityAudienceResolver audienceResolver,
            PublicAvailabilityVerifier verifier,
            PublicAvailabilityToken tokens) {
        this.roundRepository = roundRepository;
        this.windowRepository = windowRepository;
        this.windowMatchRepository = windowMatchRepository;
        this.responseRepository = responseRepository;
        this.sectionRepository = sectionRepository;
        this.matchRepository = matchRepository;
        this.teamRepository = teamRepository;
        this.audienceResolver = audienceResolver;
        this.verifier = verifier;
        this.tokens = tokens;
    }

    @Override
    @Transactional(readOnly = true)
    public PublicRoundHeaderDto getHeader(UUID roundId) {
        SectionAvailabilityRound round = findRoundOrThrow(roundId);
        List<SectionAvailabilityWindow> windows = sortedWindows(roundId);
        List<UUID> windowIds = windows.stream().map(SectionAvailabilityWindow::getId).toList();
        List<SectionAvailabilityWindowMatch> links =
                windowIds.isEmpty() ? List.of() : windowMatchRepository.findByWindowIdIn(windowIds);
        Map<UUID, Match> matches = links.isEmpty()
                ? Map.of()
                : matchRepository.findAllById(
                                links.stream().map(SectionAvailabilityWindowMatch::getMatchId).collect(Collectors.toSet()))
                        .stream()
                        .collect(Collectors.toMap(Match::getId, Function.identity()));
        Set<UUID> teamIds = new HashSet<>();
        matches.values().forEach(match -> {
            if (match.getHomeTeamId() != null) {
                teamIds.add(match.getHomeTeamId());
            }
            if (match.getAwayTeamId() != null) {
                teamIds.add(match.getAwayTeamId());
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
                matchesByWindow.computeIfAbsent(link.getWindowId(), key -> new java.util.ArrayList<>())
                        .add(new PublicRoundMatchDto(
                                MatchSideNames.home(match, teams), MatchSideNames.away(match, teams)));
            }
        }
        List<PublicRoundWindowDto> windowDtos = windows.stream()
                .map(window -> new PublicRoundWindowDto(
                        window.getId(),
                        window.getWindowDate(),
                        window.getDayPart(),
                        window.isOpen(),
                        matchesByWindow.getOrDefault(window.getId(), List.of())))
                .toList();
        return new PublicRoundHeaderDto(
                round.getId(),
                round.getDescription(),
                sectionName(round.getSectionId()),
                round.isOpen(),
                round.getClubId(),
                round.getScheduledCloseAt(),
                windowDtos);
    }

    @Override
    public PublicVerifyResponseDto verify(UUID roundId, PublicVerifyRequest request, String clientAddress) {
        SectionAvailabilityRound round = findRoundOrThrow(roundId);
        List<PublicAudienceMember> audience = audienceResolver.resolveAudience(round.getSectionId()).stream()
                .map(row -> new PublicAudienceMember(
                        row.playerProfileId(), row.firstName(), row.lastName(), row.jerseyNumber()))
                .toList();
        // Players of one section share the round's section as their label; the shirt number separates them.
        return verifier.verify(PublicPollKind.ROUND, roundId, audience, request, clientAddress,
                () -> sectionName(round.getSectionId()));
    }

    @Override
    @Transactional(readOnly = true)
    public PublicAnswersDto getAnswers(UUID roundId, UUID playerId, String token) {
        SectionAvailabilityRound round = findRoundOrThrow(roundId);
        authorise(round, playerId, token);
        List<UUID> windowIds = windowRepository.findByRoundId(roundId).stream()
                .map(SectionAvailabilityWindow::getId)
                .toList();
        List<SectionAvailabilityResponse> responses = windowIds.isEmpty()
                ? List.of()
                : responseRepository.findByPlayerProfileIdAndWindowIdIn(playerId, windowIds);
        return toAnswers(responses);
    }

    @Override
    @Transactional
    public PublicAnswersDto saveAnswers(UUID roundId, UUID playerId, String token, PublicAnswersRequest request) {
        SectionAvailabilityRound round = findRoundOrThrow(roundId);
        authorise(round, playerId, token);
        List<PublicAnswerDto> answers = request.answers();
        if (answers.isEmpty()) {
            throw new ValidationException("At least one answer is required");
        }
        if (answers.stream().anyMatch(answer -> answer.windowId() == null)) {
            throw new ValidationException("Every answer needs a windowId");
        }
        Set<UUID> submitted = answers.stream().map(PublicAnswerDto::windowId).collect(Collectors.toSet());
        if (submitted.size() != answers.size()) {
            throw new ValidationException("Each window may be answered only once");
        }
        Map<UUID, SectionAvailabilityWindow> windows = windowRepository.findByRoundId(roundId).stream()
                .collect(Collectors.toMap(SectionAvailabilityWindow::getId, Function.identity()));
        for (UUID windowId : submitted) {
            if (!windows.containsKey(windowId)) {
                throw new NotFoundException("Window " + windowId + " does not belong to round " + roundId);
            }
        }
        for (UUID windowId : submitted) {
            if (!windows.get(windowId).isOpen()) {
                throw new SectionAvailabilityWindowClosedException(
                        "Section availability round is closed: " + roundId);
            }
        }
        Map<UUID, SectionAvailabilityResponse> existing =
                responseRepository.findByPlayerProfileIdAndWindowIdIn(playerId, submitted).stream()
                        .collect(Collectors.toMap(SectionAvailabilityResponse::getWindowId, Function.identity()));
        List<SectionAvailabilityResponse> toSave = answers.stream()
                .map(answer -> {
                    SectionAvailabilityResponse response = existing.getOrDefault(
                            answer.windowId(),
                            SectionAvailabilityResponse.builder()
                                    .windowId(answer.windowId())
                                    .playerProfileId(playerId)
                                    .build());
                    response.setStatus(answer.status());
                    response.setSource(AnswerSource.PUBLIC_LINK);
                    return response;
                })
                .toList();
        return toAnswers(responseRepository.saveAll(toSave));
    }

    private PublicAnswersDto toAnswers(List<SectionAvailabilityResponse> responses) {
        return new PublicAnswersDto(responses.stream()
                .map(response -> new PublicAnswerDto(response.getWindowId(), response.getStatus()))
                .sorted(Comparator.comparing(answer -> answer.windowId().toString()))
                .toList());
    }

    /** Token first (401), then the player must still belong to the round's audience (404). */
    private void authorise(SectionAvailabilityRound round, UUID playerId, String token) {
        tokens.validate(token, PublicPollKind.ROUND, round.getId(), playerId);
        boolean inAudience = audienceResolver.resolveAudience(round.getSectionId()).stream()
                .anyMatch(row -> Objects.equals(row.playerProfileId(), playerId));
        if (!inAudience) {
            throw new NotFoundException("Player " + playerId + " is not part of this round's own audience");
        }
    }

    private List<SectionAvailabilityWindow> sortedWindows(UUID roundId) {
        return windowRepository.findByRoundId(roundId).stream()
                .sorted(Comparator.comparing(SectionAvailabilityWindow::getWindowDate)
                        .thenComparing(SectionAvailabilityWindow::getDayPart))
                .toList();
    }

    private String sectionName(UUID sectionId) {
        return sectionRepository.findById(sectionId).map(Section::getName).orElse(null);
    }

    private SectionAvailabilityRound findRoundOrThrow(UUID roundId) {
        return roundRepository
                .findById(roundId)
                .orElseThrow(() -> new NotFoundException("Section availability round not found: " + roundId));
    }
}
