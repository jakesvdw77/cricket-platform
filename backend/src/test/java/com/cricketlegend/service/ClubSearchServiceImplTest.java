package com.cricketlegend.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.cricketlegend.domain.Club;
import com.cricketlegend.domain.ClubStatus;
import com.cricketlegend.dto.ClubSummaryDto;
import com.cricketlegend.mapper.ClubMapper;
import com.cricketlegend.repository.ClubRepository;
import com.cricketlegend.service.impl.ClubSearchServiceImpl;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

/**
 * Unit test for ClubSearchServiceImpl's business rule: a blank/null query returns no results
 * rather than delegating to the repository (this is a typeahead, not a full club listing).
 */
@ExtendWith(MockitoExtension.class)
class ClubSearchServiceImplTest {

    @Mock
    private ClubRepository clubRepository;

    @Mock
    private ClubMapper clubMapper;

    private ClubSearchServiceImpl clubSearchService;

    @BeforeEach
    void setUp() {
        clubSearchService = new ClubSearchServiceImpl(clubRepository, clubMapper);
    }

    @Test
    void blankQueryReturnsEmptyListWithoutQueryingRepository() {
        List<ClubSummaryDto> result = clubSearchService.search("   ");

        assertThat(result).isEmpty();
        verifyNoInteractions(clubRepository);
    }

    @Test
    void nullQueryReturnsEmptyListWithoutQueryingRepository() {
        List<ClubSummaryDto> result = clubSearchService.search(null);

        assertThat(result).isEmpty();
        verifyNoInteractions(clubRepository);
    }

    @Test
    void nonBlankQueryDelegatesToRepositoryAndMapsResults() {
        Club club = Club.builder().name("Riverside CC").slug("riverside").status(ClubStatus.ACTIVE).build();
        when(clubRepository.searchActiveByNameOrSlug("river")).thenReturn(List.of(club));
        when(clubMapper.toSummaryDto(club)).thenReturn(new ClubSummaryDto("Riverside CC", "riverside"));

        List<ClubSummaryDto> result = clubSearchService.search("river");

        assertThat(result).containsExactly(new ClubSummaryDto("Riverside CC", "riverside"));
    }
}
