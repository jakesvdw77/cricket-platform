package com.cricketlegend.service.impl;

import com.cricketlegend.domain.Club;
import com.cricketlegend.domain.ClubPlayingArea;
import com.cricketlegend.domain.PlayingArea;
import com.cricketlegend.domain.PlayingAreaCategory;
import com.cricketlegend.domain.PlayingAreaType;
import com.cricketlegend.domain.PlayingAreaVerificationStatus;
import com.cricketlegend.dto.PlayingAreaDto;
import com.cricketlegend.dto.PlayingAreaFilterOptionsDto;
import com.cricketlegend.dto.PlayingAreaRequest;
import com.cricketlegend.dto.PlayingAreaSummaryDto;
import com.cricketlegend.exception.FieldNotEditableException;
import com.cricketlegend.exception.FieldRejectedException;
import com.cricketlegend.exception.NotFoundException;
import com.cricketlegend.exception.ValidationException;
import com.cricketlegend.mapper.PlayingAreaMapper;
import com.cricketlegend.repository.ClubPlayingAreaRepository;
import com.cricketlegend.repository.ClubRepository;
import com.cricketlegend.repository.MatchRepository;
import com.cricketlegend.repository.PlayingAreaRepository;
import com.cricketlegend.repository.PlayingAreaSpecifications;
import com.cricketlegend.service.PlayingAreaService;
import com.cricketlegend.service.support.PlayingAreaMatchResolver;
import com.cricketlegend.service.support.PlayingAreaWriter;
import java.util.Collection;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Business rules per docs/specs/099-fields-directory.md. Search, counters and filter options are composed from {@link
 * PlayingAreaSpecifications} so a counter always equals its list. Every list/get is read-only transactional (open-in-view
 * is off), every write transactional.
 */
@Service
public class PlayingAreaServiceImpl implements PlayingAreaService {

    private static final int SIMILAR_LIMIT = 5;

    private final PlayingAreaRepository playingAreaRepository;
    private final ClubPlayingAreaRepository clubPlayingAreaRepository;
    private final ClubRepository clubRepository;
    private final MatchRepository matchRepository;
    private final PlayingAreaMapper playingAreaMapper;
    private final PlayingAreaWriter playingAreaWriter;
    private final PlayingAreaMatchResolver playingAreaMatchResolver;

    public PlayingAreaServiceImpl(
            PlayingAreaRepository playingAreaRepository,
            ClubPlayingAreaRepository clubPlayingAreaRepository,
            ClubRepository clubRepository,
            MatchRepository matchRepository,
            PlayingAreaMapper playingAreaMapper,
            PlayingAreaWriter playingAreaWriter,
            PlayingAreaMatchResolver playingAreaMatchResolver) {
        this.playingAreaRepository = playingAreaRepository;
        this.clubPlayingAreaRepository = clubPlayingAreaRepository;
        this.clubRepository = clubRepository;
        this.matchRepository = matchRepository;
        this.playingAreaMapper = playingAreaMapper;
        this.playingAreaWriter = playingAreaWriter;
        this.playingAreaMatchResolver = playingAreaMatchResolver;
    }

    @Override
    @Transactional(readOnly = true)
    public Page<PlayingAreaDto> list(
            UUID clubId,
            PlayingAreaType areaType,
            String q,
            List<PlayingAreaCategory> categories,
            String country,
            String province,
            String city,
            PlayingAreaVerificationStatus verification,
            boolean mine,
            Pageable pageable) {
        Specification<PlayingArea> spec =
                filtered(clubId, areaType, q, categories, country, province, city, verification, mine);
        boolean nameDescending = pageable.getSort().getOrderFor("name") != null
                && pageable.getSort().getOrderFor("name").isDescending();
        // The ordering (home fields first, then name) lives in the specification; the page itself is unsorted.
        Pageable unsorted = PageRequest.of(pageable.getPageNumber(), pageable.getPageSize());
        Page<PlayingArea> page = playingAreaRepository.findAll(
                spec.and(PlayingAreaSpecifications.homeFirstThenName(clubId, nameDescending)), unsorted);
        List<PlayingAreaDto> content = toDtos(clubId, page.getContent());
        return new PageImpl<>(content, unsorted, page.getTotalElements());
    }

    @Override
    @Transactional(readOnly = true)
    public PlayingAreaSummaryDto summary(
            UUID clubId,
            PlayingAreaType areaType,
            String q,
            List<PlayingAreaCategory> categories,
            String country,
            String province,
            String city) {
        Specification<PlayingArea> base =
                PlayingAreaSpecifications.directoryBase(typeOrDefault(areaType), q, categories, country, province, city);
        return new PlayingAreaSummaryDto(
                playingAreaRepository.count(base.and(PlayingAreaSpecifications.linkedHome(clubId))),
                playingAreaRepository.count(base),
                playingAreaRepository.count(
                        base.and(PlayingAreaSpecifications.verification(PlayingAreaVerificationStatus.UNVERIFIED))));
    }

    @Override
    @Transactional(readOnly = true)
    public PlayingAreaFilterOptionsDto filterOptions(
            UUID clubId,
            PlayingAreaType areaType,
            String q,
            List<PlayingAreaCategory> categories,
            String country,
            String province,
            String city,
            PlayingAreaVerificationStatus verification,
            boolean mine) {
        // Each dimension is computed ignoring its own pick, so a chosen value never narrows its own dropdown to itself.
        List<PlayingArea> forCountries =
                playingAreaRepository.findAll(filtered(clubId, areaType, q, categories, null, province, city, verification, mine));
        List<PlayingArea> forProvinces =
                playingAreaRepository.findAll(filtered(clubId, areaType, q, categories, country, null, city, verification, mine));
        List<PlayingArea> forCities =
                playingAreaRepository.findAll(filtered(clubId, areaType, q, categories, country, province, null, verification, mine));
        return new PlayingAreaFilterOptionsDto(
                distinctSorted(forCountries, a -> a.getAddress().getCountry(), true),
                distinctSorted(forProvinces, a -> a.getAddress().getProvinceState(), false),
                distinctSorted(forCities, a -> a.getAddress().getCity(), false));
    }

    @Override
    @Transactional(readOnly = true)
    public List<PlayingAreaDto> similar(UUID clubId, String name, String city, String country) {
        String normalised = PlayingAreaWriter.normaliseName(name);
        if (normalised.isEmpty() || country == null || country.isBlank()) {
            return List.of();
        }
        Specification<PlayingArea> spec = Specification.where(PlayingAreaSpecifications.visible())
                .and(PlayingAreaSpecifications.areaType(PlayingAreaType.CRICKET_FIELD))
                .and(PlayingAreaSpecifications.similarName(country, normalised))
                .and(PlayingAreaSpecifications.homeFirstThenName(clubId, false));
        Page<PlayingArea> page = playingAreaRepository.findAll(spec, PageRequest.of(0, SIMILAR_LIMIT));
        return toDtos(clubId, page.getContent());
    }

    @Override
    @Transactional(readOnly = true)
    public PlayingAreaDto get(UUID clubId, UUID playingAreaId) {
        PlayingArea area = playingAreaMatchResolver.follow(playingAreaId);
        return toDtos(clubId, List.of(area)).get(0);
    }

    @Override
    @Transactional
    public PlayingAreaDto create(UUID clubId, PlayingAreaRequest request) {
        requireClub(clubId);
        PlayingArea area = new PlayingArea();
        playingAreaWriter.apply(area, request);
        area.setVerificationStatus(PlayingAreaVerificationStatus.UNVERIFIED);
        area.setCreatedByClubId(clubId);
        area = playingAreaRepository.save(area);
        clubPlayingAreaRepository.save(
                ClubPlayingArea.builder().clubId(clubId).playingAreaId(area.getId()).home(true).build());
        return toDtos(clubId, List.of(area)).get(0);
    }

    @Override
    @Transactional
    public PlayingAreaDto update(UUID clubId, UUID playingAreaId, PlayingAreaRequest request) {
        PlayingArea area = playingAreaRepository
                .findById(playingAreaId)
                .orElseThrow(() -> new NotFoundException("Field not found: " + playingAreaId));
        assertEditableBy(clubId, area);
        playingAreaWriter.apply(area, request);
        area = playingAreaRepository.save(area);
        return toDtos(clubId, List.of(area)).get(0);
    }

    @Override
    @Transactional
    public PlayingAreaDto linkHome(UUID clubId, UUID playingAreaId) {
        requireClub(clubId);
        PlayingArea area = playingAreaMatchResolver.follow(playingAreaId);
        if (area.getVerificationStatus() == PlayingAreaVerificationStatus.REJECTED) {
            throw new FieldRejectedException("A rejected field cannot be added to your fields: " + area.getId());
        }
        ClubPlayingArea link = clubPlayingAreaRepository
                .findByClubIdAndPlayingAreaId(clubId, area.getId())
                .orElseGet(() -> ClubPlayingArea.builder()
                        .clubId(clubId)
                        .playingAreaId(area.getId())
                        .build());
        link.setHome(true);
        clubPlayingAreaRepository.save(link);
        return toDtos(clubId, List.of(area)).get(0);
    }

    @Override
    @Transactional
    public void unlinkHome(UUID clubId, UUID playingAreaId) {
        PlayingArea area = playingAreaMatchResolver.follow(playingAreaId);
        clubPlayingAreaRepository
                .findByClubIdAndPlayingAreaId(clubId, area.getId())
                .ifPresent(clubPlayingAreaRepository::delete);
    }

    /** Edit rights (spec 099): only the capturing club, only while unverified. */
    private void assertEditableBy(UUID clubId, PlayingArea area) {
        if (area.getMergedIntoId() != null) {
            throw new FieldNotEditableException("This field has been merged into another field and cannot be changed");
        }
        if (area.getVerificationStatus() == PlayingAreaVerificationStatus.VERIFIED) {
            throw new FieldNotEditableException("Only a platform admin can change a verified field");
        }
        if (area.getVerificationStatus() == PlayingAreaVerificationStatus.REJECTED) {
            throw new FieldNotEditableException("Only a platform admin can change a rejected field");
        }
        if (!clubId.equals(area.getCreatedByClubId())) {
            throw new FieldNotEditableException(
                    "Only the club that captured this field, or a platform admin, can change it");
        }
    }

    private Specification<PlayingArea> filtered(
            UUID clubId,
            PlayingAreaType areaType,
            String q,
            List<PlayingAreaCategory> categories,
            String country,
            String province,
            String city,
            PlayingAreaVerificationStatus verification,
            boolean mine) {
        Specification<PlayingArea> spec =
                PlayingAreaSpecifications.directoryBase(typeOrDefault(areaType), q, categories, country, province, city);
        if (verification != null) {
            if (verification == PlayingAreaVerificationStatus.REJECTED) {
                throw new ValidationException("verification must be UNVERIFIED or VERIFIED");
            }
            spec = spec.and(PlayingAreaSpecifications.verification(verification));
        }
        if (mine) {
            spec = spec.and(PlayingAreaSpecifications.linkedHome(clubId));
        }
        return spec;
    }

    private static PlayingAreaType typeOrDefault(PlayingAreaType areaType) {
        return areaType == null ? PlayingAreaType.CRICKET_FIELD : areaType;
    }

    /** Distinct non-blank values, de-duplicated ignoring case (first spelling wins), sorted; codes are upper-cased. */
    private static List<String> distinctSorted(
            Collection<PlayingArea> areas, Function<PlayingArea, String> value, boolean upper) {
        Map<String, String> byKey = new LinkedHashMap<>();
        for (PlayingArea area : areas) {
            String v = value.apply(area);
            if (v != null && !v.isBlank()) {
                byKey.putIfAbsent(v.trim().toLowerCase(Locale.ROOT), upper ? v.trim().toUpperCase(Locale.ROOT) : v.trim());
            }
        }
        return byKey.values().stream().sorted(String.CASE_INSENSITIVE_ORDER).toList();
    }

    private void requireClub(UUID clubId) {
        if (!clubRepository.existsById(clubId)) {
            throw new NotFoundException("Club not found: " + clubId);
        }
    }

    /** Maps a page of areas with the club-relative values, one batched query per source. */
    private List<PlayingAreaDto> toDtos(UUID clubId, List<PlayingArea> areas) {
        if (areas.isEmpty()) {
            return List.of();
        }
        List<UUID> ids = areas.stream().map(PlayingArea::getId).toList();
        Set<UUID> creatorIds = areas.stream()
                .map(PlayingArea::getCreatedByClubId)
                .filter(java.util.Objects::nonNull)
                .collect(Collectors.toSet());
        Map<UUID, String> clubNames = creatorIds.isEmpty()
                ? Map.of()
                : clubRepository.findAllById(creatorIds).stream().collect(Collectors.toMap(Club::getId, Club::getName));
        Function<PlayingArea, String> creatorName =
                area -> area.getCreatedByClubId() == null ? null : clubNames.get(area.getCreatedByClubId());
        Set<UUID> homeIds = new HashSet<>();
        clubPlayingAreaRepository.findByClubIdAndPlayingAreaIdIn(clubId, ids).stream()
                .filter(ClubPlayingArea::isHome)
                .forEach(link -> homeIds.add(link.getPlayingAreaId()));
        Map<UUID, Long> matchCounts = matchRepository.countActiveByPlayingAreaIds(clubId, ids).stream()
                .collect(Collectors.toMap(
                        MatchRepository.PlayingAreaMatchCount::getPlayingAreaId,
                        MatchRepository.PlayingAreaMatchCount::getTotal));
        return areas.stream()
                .map(area -> playingAreaMapper.toDto(
                        area,
                        creatorName.apply(area),
                        homeIds.contains(area.getId()),
                        matchCounts.getOrDefault(area.getId(), 0L)))
                .toList();
    }
}
