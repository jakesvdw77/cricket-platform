package com.cricketlegend.repository;

import static org.assertj.core.api.Assertions.assertThat;

import com.cricketlegend.AbstractIntegrationTest;
import com.cricketlegend.domain.Club;
import com.cricketlegend.domain.ClubStatus;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.transaction.annotation.Transactional;

/**
 * Integration test for ClubRepository's custom searchActiveByNameOrSlug query — per
 * docs/standards/backend.md, every custom repository query ships a Testcontainers-backed
 * integration test. Each test runs in its own rolled-back transaction for isolation, since all
 * tests share one Testcontainers Postgres instance for the whole class.
 */
@SpringBootTest
@Import(AbstractIntegrationTest.class)
@Transactional
class ClubRepositoryTest {

    @Autowired
    private ClubRepository clubRepository;

    @Test
    void searchMatchesActiveClubsByNameOrSlugCaseInsensitively() {
        clubRepository.save(Club.builder().name("Riverside CC").slug("riverside").status(ClubStatus.ACTIVE).build());
        clubRepository.save(Club.builder().name("Hillside CC").slug("hillside").status(ClubStatus.ACTIVE).build());
        clubRepository.save(Club.builder().name("Onboarding Oaks").slug("onboarding-oaks").status(ClubStatus.ONBOARDING).build());
        clubRepository.save(Club.builder().name("Suspended Swifts").slug("suspended-swifts").status(ClubStatus.SUSPENDED).build());

        List<Club> byName = clubRepository.searchActiveByNameOrSlug("RIVER");
        assertThat(byName).extracting(Club::getSlug).containsExactly("riverside");

        List<Club> bySlug = clubRepository.searchActiveByNameOrSlug("hill");
        assertThat(bySlug).extracting(Club::getSlug).containsExactly("hillside");
    }

    @Test
    void searchExcludesNonActiveClubs() {
        clubRepository.save(Club.builder().name("Onboarding Oaks").slug("onboarding-oaks").status(ClubStatus.ONBOARDING).build());
        clubRepository.save(Club.builder().name("Suspended Swifts").slug("suspended-swifts").status(ClubStatus.SUSPENDED).build());

        List<Club> results = clubRepository.searchActiveByNameOrSlug("o");

        assertThat(results).isEmpty();
    }
}
