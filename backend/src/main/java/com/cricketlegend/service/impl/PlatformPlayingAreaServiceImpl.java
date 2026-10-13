package com.cricketlegend.service.impl;

import com.cricketlegend.domain.Club;
import com.cricketlegend.domain.ClubPlayingArea;
import com.cricketlegend.domain.PlayingArea;
import com.cricketlegend.domain.PlayingAreaCategory;
import com.cricketlegend.domain.PlayingAreaType;
import com.cricketlegend.domain.PlayingAreaVerificationStatus;
import com.cricketlegend.dto.PlatformPlayingAreaDto;
import com.cricketlegend.dto.PlatformPlayingAreaSummaryDto;
import com.cricketlegend.dto.PlayingAreaLinkedClubDto;
import com.cricketlegend.dto.PlayingAreaRefDto;
import com.cricketlegend.dto.PlayingAreaRequest;
import com.cricketlegend.exception.ConflictException;
import com.cricketlegend.exception.FieldNotEditableException;
import com.cricketlegend.exception.InvalidStatusTransitionException;
import com.cricketlegend.exception.NotFoundException;
import com.cricketlegend.exception.ValidationException;
import com.cricketlegend.mapper.PlayingAreaMapper;
import com.cricketlegend.repository.ClubPlayingAreaRepository;
import com.cricketlegend.repository.ClubRepository;
import com.cricketlegend.repository.MatchRepository;
import com.cricketlegend.repository.PlayingAreaRepository;
import com.cricketlegend.repository.PlayingAreaSpecifications;
import com.cricketlegend.service.PlatformPlayingAreaService;
import com.cricketlegend.service.support.PlayingAreaWriter;
import java.time.Instant;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Business rules per docs/specs/099-fields-directory.md for the platform admin: edit, verify, reject (with a reason),
 * reopen and merge. Unlike player verification, {@code REJECTED -> VERIFIED} is not allowed directly: reopen first.
 */
@Service
public class PlatformPlayingAreaServiceImpl implements PlatformPlayingAreaService {

    private static final int DUPLICATE_LIMIT = 5;

    private final PlayingAreaRepository playingAreaRepository;
    private final ClubPlayingAreaRepository clubPlayingAreaRepository;
    private final ClubRepository clubRepository;
    private final MatchRepository matchRepository;
    private final PlayingAreaMapper playingAreaMapper;
    private final PlayingAreaWriter playingAreaWriter;

    public PlatformPlayingAreaServiceImpl(
            PlayingAreaRepository playingAreaRepository,
            ClubPlayingAreaRepository clubPlayingAreaRepository,
            ClubRepository clubRepository,
            MatchRepository matchRepository,
            PlayingAreaMapper playingAreaMapper,
            PlayingAreaWriter playingAreaWriter) {
        this.playingAreaRepository = playingAreaRepository;
        this.clubPlayingAreaRepository = clubPlayingAreaRepository;
        this.clubRepository = clubRepository;
        this.matchRepository = matchRepository;
        this.playingAreaMapper = playingAreaMapper;
        this.playingAreaWriter = playingAreaWriter;
    }

    @Override
    @Transactional(readOnly = true)
    public Page<PlatformPlayingAreaDto> list(
            PlayingAreaVerificationStatus verification,
            String q,
            List<PlayingAreaCategory> categories,
            String country,
            Pageable pageable) {
        Pageable sorted = pageable.getSort().isSorted()
                ? pageable
                : PageRequest.of(pageable.getPageNumber(), pageable.getPageSize(), Sort.by("createdAt").ascending());
        Page<PlayingArea> page = playingAreaRepository.findAll(
                PlayingAreaSpecifications.moderation(verification, q, categories, country), sorted);
        return new PageImpl<>(toDtos(page.getContent(), false), sorted, page.getTotalElements());
    }

    @Override
    @Transactional(readOnly = true)
    public PlatformPlayingAreaSummaryDto summary() {
        return new PlatformPlayingAreaSummaryDto(
                playingAreaRepository.countByVerificationStatusAndMergedIntoIdIsNull(
                        PlayingAreaVerificationStatus.UNVERIFIED),
                playingAreaRepository.countByVerificationStatusAndMergedIntoIdIsNull(
                        PlayingAreaVerificationStatus.VERIFIED),
                playingAreaRepository.countByVerificationStatusAndMergedIntoIdIsNull(
                        PlayingAreaVerificationStatus.REJECTED));
    }

    @Override
    @Transactional(readOnly = true)
    public PlatformPlayingAreaDto get(UUID playingAreaId) {
        return toDtos(List.of(findOrThrow(playingAreaId)), true).get(0);
    }

    @Override
    @Transactional
    public PlatformPlayingAreaDto update(UUID playingAreaId, PlayingAreaRequest request) {
        PlayingArea area = findOrThrow(playingAreaId);
        assertNotMerged(area, () -> new FieldNotEditableException(
                "This field has been merged into another field and cannot be changed"));
        playingAreaWriter.apply(area, request);
        return toDtos(List.of(playingAreaRepository.save(area)), true).get(0);
    }

    @Override
    @Transactional
    public PlatformPlayingAreaDto verify(UUID playingAreaId, String verifiedBySubject) {
        PlayingArea area = findOrThrow(playingAreaId);
        assertNotMerged(area, () -> new InvalidStatusTransitionException("Field has been merged away: " + playingAreaId));
        if (area.getVerificationStatus() == PlayingAreaVerificationStatus.REJECTED) {
            throw new InvalidStatusTransitionException("A rejected field must be reopened before it is verified: " + playingAreaId);
        }
        if (area.getVerificationStatus() == PlayingAreaVerificationStatus.UNVERIFIED) {
            area.setVerificationStatus(PlayingAreaVerificationStatus.VERIFIED);
            area.setVerifiedAt(Instant.now());
            area.setVerifiedBySubject(verifiedBySubject);
            area.setRejectionReason(null);
            area = playingAreaRepository.save(area);
        }
        return toDtos(List.of(area), true).get(0);
    }

    @Override
    @Transactional
    public PlatformPlayingAreaDto reject(UUID playingAreaId, String reason) {
        if (reason == null || reason.isBlank()) {
            throw new ValidationException("reason is required");
        }
        if (reason.trim().length() > 500) {
            throw new ValidationException("reason must be at most 500 characters");
        }
        PlayingArea area = findOrThrow(playingAreaId);
        assertNotMerged(area, () -> new InvalidStatusTransitionException("Field has been merged away: " + playingAreaId));
        if (area.getVerificationStatus() != PlayingAreaVerificationStatus.UNVERIFIED) {
            throw new InvalidStatusTransitionException("Only an unverified field can be rejected: " + playingAreaId);
        }
        area.setVerificationStatus(PlayingAreaVerificationStatus.REJECTED);
        area.setRejectionReason(reason.trim());
        return toDtos(List.of(playingAreaRepository.save(area)), true).get(0);
    }

    @Override
    @Transactional
    public PlatformPlayingAreaDto reopen(UUID playingAreaId) {
        PlayingArea area = findOrThrow(playingAreaId);
        assertNotMerged(area, () -> new InvalidStatusTransitionException("Field has been merged away: " + playingAreaId));
        if (area.getVerificationStatus() != PlayingAreaVerificationStatus.REJECTED) {
            throw new InvalidStatusTransitionException("Only a rejected field can be reopened: " + playingAreaId);
        }
        area.setVerificationStatus(PlayingAreaVerificationStatus.UNVERIFIED);
        area.setRejectionReason(null);
        return toDtos(List.of(playingAreaRepository.save(area)), true).get(0);
    }

    @Override
    @Transactional
    public PlatformPlayingAreaDto merge(UUID playingAreaId, UUID targetPlayingAreaId) {
        if (playingAreaId.equals(targetPlayingAreaId)) {
            throw new ConflictException("A field cannot be merged into itself");
        }
        PlayingArea source = findOrThrow(playingAreaId);
        PlayingArea target = findOrThrow(targetPlayingAreaId);
        if (source.getMergedIntoId() != null) {
            throw new ConflictException("Field has already been merged away: " + playingAreaId);
        }
        if (target.getMergedIntoId() != null) {
            throw new ConflictException("The target field has been merged away: " + targetPlayingAreaId);
        }
        if (target.getVerificationStatus() == PlayingAreaVerificationStatus.REJECTED) {
            throw new ConflictException("The target field has been rejected: " + targetPlayingAreaId);
        }
        String targetName = target.getName();

        // The bulk update flushes first and clears the persistence context, so everything below re-reads.
        matchRepository.repointPlayingArea(playingAreaId, targetPlayingAreaId, targetName, Instant.now());

        Map<UUID, ClubPlayingArea> targetLinksByClub = clubPlayingAreaRepository
                .findByPlayingAreaId(targetPlayingAreaId).stream()
                .collect(Collectors.toMap(ClubPlayingArea::getClubId, link -> link));
        for (ClubPlayingArea link : clubPlayingAreaRepository.findByPlayingAreaId(playingAreaId)) {
            ClubPlayingArea existing = targetLinksByClub.get(link.getClubId());
            if (existing == null) {
                link.setPlayingAreaId(targetPlayingAreaId);
                clubPlayingAreaRepository.save(link);
            } else {
                if (link.isHome() && !existing.isHome()) {
                    existing.setHome(true);
                    clubPlayingAreaRepository.save(existing);
                }
                clubPlayingAreaRepository.delete(link);
            }
        }

        PlayingArea freshSource = findOrThrow(playingAreaId);
        freshSource.setMergedIntoId(targetPlayingAreaId);
        playingAreaRepository.save(freshSource);
        return toDtos(List.of(findOrThrow(targetPlayingAreaId)), true).get(0);
    }

    private PlayingArea findOrThrow(UUID id) {
        return playingAreaRepository.findById(id).orElseThrow(() -> new NotFoundException("Field not found: " + id));
    }

    private void assertNotMerged(PlayingArea area, java.util.function.Supplier<? extends RuntimeException> failure) {
        if (area.getMergedIntoId() != null) {
            throw failure.get();
        }
    }

    /** Maps areas with creator, linked clubs and counts in batched queries; duplicates only when asked (detail). */
    private List<PlatformPlayingAreaDto> toDtos(List<PlayingArea> areas, boolean withDuplicates) {
        if (areas.isEmpty()) {
            return List.of();
        }
        List<UUID> ids = areas.stream().map(PlayingArea::getId).toList();
        Map<UUID, Long> matchCounts = matchRepository.countAllByPlayingAreaIds(ids).stream()
                .collect(Collectors.toMap(
                        MatchRepository.PlayingAreaMatchCount::getPlayingAreaId,
                        MatchRepository.PlayingAreaMatchCount::getTotal));
        List<ClubPlayingArea> links = clubPlayingAreaRepository.findByPlayingAreaIdIn(ids);
        Set<UUID> clubIds = links.stream().map(ClubPlayingArea::getClubId).collect(Collectors.toSet());
        areas.stream().map(PlayingArea::getCreatedByClubId).filter(Objects::nonNull).forEach(clubIds::add);
        Map<UUID, String> clubNames = new HashMap<>();
        if (!clubIds.isEmpty()) {
            clubRepository.findAllById(clubIds).forEach(club -> clubNames.put(club.getId(), club.getName()));
        }
        Map<UUID, List<PlayingAreaLinkedClubDto>> linkedByArea = links.stream()
                .collect(Collectors.groupingBy(
                        ClubPlayingArea::getPlayingAreaId,
                        Collectors.mapping(
                                link -> new PlayingAreaLinkedClubDto(
                                        link.getClubId(), clubNames.get(link.getClubId()), link.isHome()),
                                Collectors.toList())));
        return areas.stream()
                .map(area -> playingAreaMapper.toPlatformDto(
                        area,
                        area.getCreatedByClubId() == null ? null : clubNames.get(area.getCreatedByClubId()),
                        matchCounts.getOrDefault(area.getId(), 0L),
                        linkedByArea.getOrDefault(area.getId(), List.of()),
                        withDuplicates ? possibleDuplicates(area) : List.of()))
                .toList();
    }

    /** Other not-merged fields in the same country with a near name (same rule as the manager "did you mean"). */
    private List<PlayingAreaRefDto> possibleDuplicates(PlayingArea area) {
        String normalised = PlayingAreaWriter.normaliseName(area.getName());
        if (normalised.isEmpty() || area.getAddress() == null || area.getAddress().getCountry() == null) {
            return List.of();
        }
        Specification<PlayingArea> spec = Specification.where(PlayingAreaSpecifications.notMerged())
                .and(PlayingAreaSpecifications.areaType(PlayingAreaType.CRICKET_FIELD))
                .and(PlayingAreaSpecifications.similarName(area.getAddress().getCountry(), normalised));
        return playingAreaRepository
                .findAll(spec, PageRequest.of(0, DUPLICATE_LIMIT + 1, Sort.by("name")))
                .stream()
                .filter(other -> !other.getId().equals(area.getId()))
                .limit(DUPLICATE_LIMIT)
                .map(playingAreaMapper::toRefDto)
                .toList();
    }
}
