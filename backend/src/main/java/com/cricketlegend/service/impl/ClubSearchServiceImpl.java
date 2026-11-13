package com.cricketlegend.service.impl;

import com.cricketlegend.domain.ClubStatus;
import com.cricketlegend.dto.ClubOptionDto;
import com.cricketlegend.dto.ClubSummaryDto;
import com.cricketlegend.mapper.ClubMapper;
import com.cricketlegend.repository.ClubRepository;
import com.cricketlegend.service.ClubSearchService;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.regex.Pattern;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
public class ClubSearchServiceImpl implements ClubSearchService {

    static final int MIN_QUERY_LENGTH = 2;
    static final int MAX_RESULTS = 20;
    static final int MAX_SLUG_LENGTH = 63;
    private static final Pattern SLUG_PATTERN = Pattern.compile("^[a-z0-9]+(-[a-z0-9]+)*$");

    private final ClubRepository clubRepository;
    private final ClubMapper clubMapper;

    public ClubSearchServiceImpl(ClubRepository clubRepository, ClubMapper clubMapper) {
        this.clubRepository = clubRepository;
        this.clubMapper = clubMapper;
    }

    @Override
    public List<ClubSummaryDto> search(String query) {
        String trimmed = query == null ? "" : query.trim();
        if (trimmed.length() < MIN_QUERY_LENGTH) {
            return List.of();
        }
        return clubRepository.searchActiveByNameOrSlugOrdered(trimmed, PageRequest.of(0, MAX_RESULTS)).stream()
                .map(clubMapper::toSummaryDto)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<ClubSummaryDto> findActiveBySlug(String slug) {
        if (!StringUtils.hasText(slug) || slug.length() > MAX_SLUG_LENGTH) {
            return Optional.empty();
        }
        String normalised = slug.toLowerCase(Locale.ROOT);
        if (!SLUG_PATTERN.matcher(normalised).matches()) {
            return Optional.empty();
        }
        return clubRepository.findBySlugIgnoreCaseAndStatus(normalised, ClubStatus.ACTIVE)
                .map(clubMapper::toSummaryDto);
    }

    @Override
    @Transactional(readOnly = true)
    public List<ClubOptionDto> listActiveOptions() {
        return clubRepository.findByStatusOrderByNameAsc(ClubStatus.ACTIVE).stream()
                .map(clubMapper::toOptionDto)
                .toList();
    }
}
