package com.cricketlegend.repository;

import static org.assertj.core.api.Assertions.assertThat;

import com.cricketlegend.AbstractIntegrationTest;
import com.cricketlegend.domain.Club;
import com.cricketlegend.domain.ClubStatus;
import com.cricketlegend.domain.Season;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.transaction.annotation.Transactional;

/**
 * Integration test for SeasonRepository — per docs/standards/backend.md, proves {@code
 * findByClubId} scopes correctly. See docs/specs/029-league-management.md.
 */
@SpringBootTest
@Import(AbstractIntegrationTest.class)
@Transactional
class SeasonRepositoryTest {

    @Autowired
    private ClubRepository clubRepository;

    @Autowired
    private SeasonRepository seasonRepository;

    private Club savedClub(String slug) {
        return clubRepository.save(Club.builder().name("Riverside CC").slug(slug).status(ClubStatus.ACTIVE).build());
    }

    private Season season(UUID clubId) {
        return Season.builder().clubId(clubId).label("2026").startDate(LocalDate.of(2026, 1, 1))
                .endDate(LocalDate.of(2026, 12, 31)).active(true).build();
    }

    @Test
    void findByClubIdReturnsOnlySeasonsForThatClub() {
        Club clubX = savedClub("riverside-cc");
        Club clubY = savedClub("lakeside-cc");
        Season seasonForX = seasonRepository.save(season(clubX.getId()));
        seasonRepository.save(season(clubY.getId()));

        assertThat(seasonRepository.findByClubId(clubX.getId()))
                .extracting(Season::getId)
                .containsExactly(seasonForX.getId());
    }
}
