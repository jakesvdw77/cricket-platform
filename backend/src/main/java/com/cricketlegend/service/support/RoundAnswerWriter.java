package com.cricketlegend.service.support;

import com.cricketlegend.domain.AnswerSource;
import com.cricketlegend.domain.SectionAvailabilityResponse;
import com.cricketlegend.domain.SectionAvailabilityRound;
import com.cricketlegend.domain.SectionAvailabilityWindow;
import com.cricketlegend.dto.PublicAnswerDto;
import com.cricketlegend.exception.NotFoundException;
import com.cricketlegend.exception.SectionAvailabilityWindowClosedException;
import com.cricketlegend.exception.ValidationException;
import com.cricketlegend.repository.SectionAvailabilityResponseRepository;
import com.cricketlegend.repository.SectionAvailabilityWindowRepository;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.stereotype.Component;

/**
 * The one place group poll (round) answers are written for a player (docs/specs/077, docs/specs/119). All or nothing
 * in the caller's transaction: every window must belong to the round (404) and be open (409); partial answers are
 * allowed; rows are upserted with the caller's {@link AnswerSource}. Who may answer is decided before this runs.
 */
@Component
public class RoundAnswerWriter {

    private final SectionAvailabilityWindowRepository windowRepository;
    private final SectionAvailabilityResponseRepository responseRepository;

    public RoundAnswerWriter(
            SectionAvailabilityWindowRepository windowRepository,
            SectionAvailabilityResponseRepository responseRepository) {
        this.windowRepository = windowRepository;
        this.responseRepository = responseRepository;
    }

    public List<SectionAvailabilityResponse> save(
            SectionAvailabilityRound round, UUID playerId, List<PublicAnswerDto> answers, AnswerSource source) {
        UUID roundId = round.getId();
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
                throw new SectionAvailabilityWindowClosedException("Section availability round is closed: " + roundId);
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
                    response.setSource(source);
                    return response;
                })
                .toList();
        return responseRepository.saveAll(toSave);
    }
}
