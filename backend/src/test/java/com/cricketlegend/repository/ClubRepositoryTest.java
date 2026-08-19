package com.cricketlegend.repository;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.cricketlegend.AbstractIntegrationTest;
import com.cricketlegend.domain.Club;
import com.cricketlegend.domain.ClubStatus;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.transaction.annotation.Transactional;

/**
 * Integration test for ClubRepository's custom queries — per docs/standards/backend.md, every
 * custom repository query ships a Testcontainers-backed integration test. Each test runs in its
 * own rolled-back transaction for isolation, since all tests share one Testcontainers Postgres
 * instance for the whole class.
 *
 * <p>The searchActiveByNameOrSlug tests below predate docs/specs/010-minimal-club-creation.md
 * (built for 004-landing-page.md's public typeahead); the remaining tests were added for 010 —
 * the {@code search} admin query (status-agnostic, unlike searchActiveByNameOrSlug),
 * existsBySlugIgnoreCase(AndIdNot), the 005-add-club-audit-columns.sql migration applying
 * cleanly, and the DB-level unique slug constraint as TOCTOU defense-in-depth.
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

    @Test
    void auditColumnsFrom005MigrationAreQueryableAndSettableOnPersist() {
        // Proves 005-add-club-audit-columns.sql applied cleanly on top of 001's existing club
        // table (implicit via context boot) and that createdAt/updatedAt/updatedBy round-trip.
        Club club = Club.builder().name("Riverside CC").slug("riverside-cc").status(ClubStatus.ACTIVE).build();
        assertThat(club.getCreatedAt()).isNull();
        assertThat(club.getUpdatedAt()).isNull();

        Club saved = clubRepository.save(club);

        assertThat(saved.getCreatedAt()).isNotNull();
        assertThat(saved.getUpdatedAt()).isNotNull();
        assertThat(saved.getUpdatedBy()).isNull();

        UUID updatedBy = UUID.randomUUID();
        saved.setUpdatedBy(updatedBy);
        Club reloaded = clubRepository.save(saved);

        assertThat(reloaded.getUpdatedBy()).isEqualTo(updatedBy);
    }

    @Test
    void preUpdateAdvancesUpdatedAtOnAnExistingRow() {
        Club saved = clubRepository.saveAndFlush(
                Club.builder().name("Riverside CC").slug("riverside-cc").status(ClubStatus.ACTIVE).build());
        Instant originalUpdatedAt = saved.getUpdatedAt();

        saved.setName("Riverside Cricket Club");
        Club reloaded = clubRepository.saveAndFlush(saved);

        assertThat(reloaded.getUpdatedAt()).isAfterOrEqualTo(originalUpdatedAt);
    }

    @Test
    void adminSearchMatchesNameOrSlugSubstringCaseInsensitivelyRegardlessOfStatus() {
        clubRepository.save(Club.builder().name("Riverside CC").slug("riverside-cc").status(ClubStatus.ACTIVE).build());
        clubRepository.save(Club.builder().name("Hillside CC").slug("hillside").status(ClubStatus.SUSPENDED).build());
        clubRepository.save(Club.builder().name("Onboarding Oaks").slug("onboarding-oaks").status(ClubStatus.ONBOARDING).build());

        Page<Club> byName = clubRepository.search("RIVER", PageRequest.of(0, 20));
        assertThat(byName.getContent()).extracting(Club::getSlug).containsExactly("riverside-cc");

        Page<Club> bySlug = clubRepository.search("hill", PageRequest.of(0, 20));
        assertThat(bySlug.getContent()).extracting(Club::getSlug).containsExactly("hillside");
    }

    @Test
    void adminSearchReturnsClubsOfEveryStatusUnlikeSearchActiveByNameOrSlug() {
        clubRepository.save(Club.builder().name("Onboarding Oaks").slug("onboarding-oaks").status(ClubStatus.ONBOARDING).build());
        clubRepository.save(Club.builder().name("Suspended Swifts").slug("suspended-swifts").status(ClubStatus.SUSPENDED).build());
        clubRepository.save(Club.builder().name("Active Aces").slug("active-aces").status(ClubStatus.ACTIVE).build());

        Page<Club> results = clubRepository.search(null, PageRequest.of(0, 20, Sort.by("name").ascending()));

        assertThat(results.getContent()).extracting(Club::getSlug)
                .containsExactlyInAnyOrder("onboarding-oaks", "suspended-swifts", "active-aces");
    }

    @Test
    void adminSearchWithNullOrBlankReturnsEveryClub() {
        clubRepository.save(Club.builder().name("Riverside CC").slug("riverside-cc").status(ClubStatus.ACTIVE).build());
        clubRepository.save(Club.builder().name("Hillside CC").slug("hillside").status(ClubStatus.SUSPENDED).build());

        Pageable pageable = PageRequest.of(0, 20);
        assertThat(clubRepository.search(null, pageable).getContent()).hasSize(2);
        assertThat(clubRepository.search("", pageable).getContent()).hasSize(2);
    }

    @Test
    void existsBySlugIgnoreCaseMatchesRegardlessOfCase() {
        clubRepository.save(Club.builder().name("Riverside CC").slug("riverside-cc").status(ClubStatus.ACTIVE).build());

        assertThat(clubRepository.existsBySlugIgnoreCase("riverside-cc")).isTrue();
        assertThat(clubRepository.existsBySlugIgnoreCase("RIVERSIDE-CC")).isTrue();
        assertThat(clubRepository.existsBySlugIgnoreCase("Riverside-Cc")).isTrue();
        assertThat(clubRepository.existsBySlugIgnoreCase("hillside")).isFalse();
    }

    @Test
    void existsBySlugIgnoreCaseAndIdNotExcludesTheGivenIdButMatchesOtherwise() {
        Club saved = clubRepository.save(
                Club.builder().name("Riverside CC").slug("riverside-cc").status(ClubStatus.ACTIVE).build());
        UUID otherId = UUID.randomUUID();

        assertThat(clubRepository.existsBySlugIgnoreCaseAndIdNot("riverside-cc", saved.getId())).isFalse();
        assertThat(clubRepository.existsBySlugIgnoreCaseAndIdNot("riverside-cc", otherId)).isTrue();
        assertThat(clubRepository.existsBySlugIgnoreCaseAndIdNot("RIVERSIDE-CC", otherId)).isTrue();
    }

    @Test
    void uniqueSlugConstraintRejectsACollisionAtTheDbLevelAsDefenseInDepth() {
        clubRepository.saveAndFlush(
                Club.builder().name("Riverside CC").slug("riverside-cc").status(ClubStatus.ACTIVE).build());

        Club collision = Club.builder().name("Another Riverside").slug("riverside-cc").status(ClubStatus.ACTIVE).build();

        // saveAndFlush (a repository proxy method, unlike a raw EntityManager.flush()) goes
        // through Spring's PersistenceExceptionTranslationPostProcessor, so the driver-level
        // unique-constraint violation surfaces as the portable DataIntegrityViolationException
        // here — the same TOCTOU defense-in-depth pattern as SubscriptionRepositoryTest's
        // ux_subscription_active_owner test.
        assertThatThrownBy(() -> clubRepository.saveAndFlush(collision))
                .isInstanceOf(DataIntegrityViolationException.class);
    }
}
