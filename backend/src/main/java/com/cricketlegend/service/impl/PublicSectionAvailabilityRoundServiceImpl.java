package com.cricketlegend.service.impl;

import com.cricketlegend.domain.AvailabilityStatus;
import com.cricketlegend.domain.Section;
import com.cricketlegend.domain.SectionAvailabilityResponse;
import com.cricketlegend.domain.SectionAvailabilityRound;
import com.cricketlegend.domain.SectionAvailabilityWindow;
import com.cricketlegend.dto.PublicSectionAvailabilityRoundDto;
import com.cricketlegend.dto.SectionAvailabilityResponseRowDto;
import com.cricketlegend.dto.SectionAvailabilityRoundResponseRowDto;
import com.cricketlegend.dto.SectionAvailabilityRoundStatusDto;
import com.cricketlegend.exception.NotFoundException;
import com.cricketlegend.exception.SectionAvailabilityWindowClosedException;
import com.cricketlegend.repository.SectionAvailabilityResponseRepository;
import com.cricketlegend.repository.SectionAvailabilityRoundRepository;
import com.cricketlegend.repository.SectionAvailabilityWindowRepository;
import com.cricketlegend.repository.SectionRepository;
import com.cricketlegend.service.PublicSectionAvailabilityRoundService;
import com.cricketlegend.service.SectionAvailabilityAudienceResolver;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Business rules per docs/specs/063-section-availability-and-flexible-squads.md: both methods
 * resolve {@code SectionAvailabilityRound} -&gt; {@code Section} (for display) entirely from
 * {@code roundId}, no {@code clubId} anywhere — the round's own UUID is the entire access
 * boundary, mirroring {@code PublicAvailabilityPollServiceImpl}/the original per-window design
 * exactly. {@link #setAvailability} 404s ({@link NotFoundException}) if {@code roundId} doesn't
 * exist, {@code windowId} doesn't belong to this round, or {@code playerProfileId} isn't part of
 * this round's own resolved audience, then 409s ({@link SectionAvailabilityWindowClosedException})
 * if the resolved bracket's window is currently closed, otherwise upserts the {@link
 * SectionAvailabilityResponse} row against that window — {@code updatedBy} always {@code null}, no
 * authenticated identity on this write path. Per the fixture-group-selection revision, the
 * resolved bracket is now identified by {@code windowId} directly, not re-derived from a {@code
 * dayPart} lookup.
 */
@Service
public class PublicSectionAvailabilityRoundServiceImpl implements PublicSectionAvailabilityRoundService {

    private final SectionAvailabilityRoundRepository sectionAvailabilityRoundRepository;
    private final SectionAvailabilityWindowRepository sectionAvailabilityWindowRepository;
    private final SectionAvailabilityResponseRepository sectionAvailabilityResponseRepository;
    private final SectionRepository sectionRepository;
    private final SectionAvailabilityAudienceResolver audienceResolver;

    public PublicSectionAvailabilityRoundServiceImpl(
            SectionAvailabilityRoundRepository sectionAvailabilityRoundRepository,
            SectionAvailabilityWindowRepository sectionAvailabilityWindowRepository,
            SectionAvailabilityResponseRepository sectionAvailabilityResponseRepository,
            SectionRepository sectionRepository,
            SectionAvailabilityAudienceResolver audienceResolver) {
        this.sectionAvailabilityRoundRepository = sectionAvailabilityRoundRepository;
        this.sectionAvailabilityWindowRepository = sectionAvailabilityWindowRepository;
        this.sectionAvailabilityResponseRepository = sectionAvailabilityResponseRepository;
        this.sectionRepository = sectionRepository;
        this.audienceResolver = audienceResolver;
    }

    @Override
    @Transactional(readOnly = true)
    public PublicSectionAvailabilityRoundDto getRound(UUID roundId) {
        SectionAvailabilityRound round = findRoundOrThrow(roundId);
        return toDto(round);
    }

    @Override
    @Transactional
    public PublicSectionAvailabilityRoundDto setAvailability(
            UUID roundId, UUID playerProfileId, UUID windowId, AvailabilityStatus status) {
        SectionAvailabilityRound round = findRoundOrThrow(roundId);

        List<SectionAvailabilityResponseRowDto> audience = audienceResolver.resolveAudience(round.getSectionId());
        boolean inAudience = audience.stream().anyMatch(row -> row.playerProfileId().equals(playerProfileId));
        if (!inAudience) {
            throw new NotFoundException(
                    "Player " + playerProfileId + " is not part of this round's own audience");
        }

        SectionAvailabilityWindow window = sectionAvailabilityWindowRepository
                .findById(windowId)
                .filter(candidate -> candidate.getRoundId().equals(roundId))
                .orElseThrow(() -> new NotFoundException(
                        "Window " + windowId + " does not belong to round " + roundId));

        if (!window.isOpen()) {
            throw new SectionAvailabilityWindowClosedException(
                    "Section availability round is closed: " + roundId);
        }

        SectionAvailabilityResponse response = sectionAvailabilityResponseRepository
                .findByWindowIdAndPlayerProfileId(window.getId(), playerProfileId)
                .orElseGet(() -> SectionAvailabilityResponse.builder()
                        .windowId(window.getId())
                        .playerProfileId(playerProfileId)
                        .build());
        response.setStatus(status);
        sectionAvailabilityResponseRepository.save(response);

        return toDto(round);
    }

    private PublicSectionAvailabilityRoundDto toDto(SectionAvailabilityRound round) {
        List<SectionAvailabilityResponseRowDto> audience = audienceResolver.resolveAudience(round.getSectionId());

        List<SectionAvailabilityWindow> windows = sectionAvailabilityWindowRepository.findByRoundId(round.getId())
                .stream()
                .sorted(Comparator.comparing(SectionAvailabilityWindow::getWindowDate)
                        .thenComparing(SectionAvailabilityWindow::getDayPart))
                .toList();

        Map<UUID, Map<UUID, AvailabilityStatus>> statusByWindowThenPlayer = windows.stream()
                .collect(Collectors.toMap(
                        SectionAvailabilityWindow::getId,
                        window -> sectionAvailabilityResponseRepository.findByWindowId(window.getId()).stream()
                                .collect(Collectors.toMap(
                                        SectionAvailabilityResponse::getPlayerProfileId,
                                        SectionAvailabilityResponse::getStatus))));

        List<SectionAvailabilityRoundResponseRowDto> rows = audience.stream()
                .map(row -> new SectionAvailabilityRoundResponseRowDto(
                        row.playerProfileId(),
                        row.firstName(),
                        row.lastName(),
                        row.jerseyNumber(),
                        windows.stream()
                                .map(window -> new SectionAvailabilityRoundStatusDto(
                                        window.getId(),
                                        window.getDayPart(),
                                        window.getWindowDate(),
                                        statusByWindowThenPlayer.get(window.getId()).get(row.playerProfileId())))
                                .toList()))
                .toList();

        return new PublicSectionAvailabilityRoundDto(
                round.getId(), round.getDescription(), sectionName(round.getSectionId()), round.isOpen(), rows);
    }

    private String sectionName(UUID sectionId) {
        return sectionRepository.findById(sectionId).map(Section::getName).orElse(null);
    }

    private SectionAvailabilityRound findRoundOrThrow(UUID roundId) {
        return sectionAvailabilityRoundRepository
                .findById(roundId)
                .orElseThrow(() -> new NotFoundException("Section availability round not found: " + roundId));
    }
}
