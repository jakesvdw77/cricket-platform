package com.cricketlegend.service.impl;

import com.cricketlegend.domain.ClubStatus;
import com.cricketlegend.dto.ClubOptionDto;
import com.cricketlegend.dto.ClubSummaryDto;
import com.cricketlegend.mapper.ClubMapper;
import com.cricketlegend.repository.ClubRepository;
import com.cricketlegend.service.ClubSearchService;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
public class ClubSearchServiceImpl implements ClubSearchService {

    private final ClubRepository clubRepository;
    private final ClubMapper clubMapper;

    public ClubSearchServiceImpl(ClubRepository clubRepository, ClubMapper clubMapper) {
        this.clubRepository = clubRepository;
        this.clubMapper = clubMapper;
    }

    @Override
    public List<ClubSummaryDto> search(String query) {
        if (!StringUtils.hasText(query)) {
            return List.of();
        }
        return clubRepository.searchActiveByNameOrSlug(query).stream()
                .map(clubMapper::toSummaryDto)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<ClubOptionDto> listActiveOptions() {
        return clubRepository.findByStatusOrderByNameAsc(ClubStatus.ACTIVE).stream()
                .map(clubMapper::toOptionDto)
                .toList();
    }
}
