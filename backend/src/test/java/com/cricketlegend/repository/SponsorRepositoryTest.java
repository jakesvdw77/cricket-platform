package com.cricketlegend.repository;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.cricketlegend.AbstractIntegrationTest;
import com.cricketlegend.domain.Club;
import com.cricketlegend.domain.ClubStatus;
import com.cricketlegend.domain.SocialLink;
import com.cricketlegend.domain.Sponsor;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.transaction.annotation.Transactional;

/**
 * Integration test for SponsorRepository — per docs/standards/backend.md and
 * docs/plans/023-sponsors.md's Test tier list: proves 015-add-sponsor.sql applies cleanly on top
 * of 014's existing migration chain (implicit via context boot), basic CRUD via {@code
 * findByClubId}, and the DB-level backstop on {@code sponsor_social_link}'s composite PK
 * {@code (sponsor_id, platform)} — mirroring ClubProfileRepositoryTest's equivalent proof for
 * {@code club_profile_social_link}.
 */
@SpringBootTest
@Import(AbstractIntegrationTest.class)
@Transactional
class SponsorRepositoryTest {

    @Autowired
    private ClubRepository clubRepository;

    @Autowired
    private SponsorRepository sponsorRepository;

    private Club savedClub(String slug) {
        return clubRepository.save(Club.builder().name("Riverside CC").slug(slug).status(ClubStatus.ACTIVE).build());
    }

    private Sponsor sponsor(UUID clubId) {
        return Sponsor.builder().clubId(clubId).name("Acme Sponsor").active(true).build();
    }

    @Test
    void findByClubIdReturnsOnlySponsorsForThatClub() {
        Club clubX = savedClub("riverside-cc");
        Club clubY = savedClub("lakeside-cc");
        Sponsor sponsorForX = sponsorRepository.save(sponsor(clubX.getId()));
        sponsorRepository.save(sponsor(clubY.getId()));

        assertThat(sponsorRepository.findByClubId(clubX.getId()))
                .extracting(Sponsor::getId)
                .containsExactly(sponsorForX.getId());
    }

    @Test
    void createdAtAndUpdatedAtAreSetOnPersist() {
        Club club = savedClub("riverside-cc");
        Sponsor sponsor = sponsor(club.getId());
        assertThat(sponsor.getCreatedAt()).isNull();

        Sponsor saved = sponsorRepository.saveAndFlush(sponsor);

        assertThat(saved.getCreatedAt()).isNotNull();
        assertThat(saved.getUpdatedAt()).isNotNull();
    }

    @Test
    void compositePrimaryKeyOnSponsorIdAndPlatformRejectsTwoSocialLinksForTheSamePlatformAtTheDbLevel() {
        // sponsor_social_link's PRIMARY KEY (sponsor_id, platform) — proven directly at the
        // repository/Testcontainers level, bypassing SponsorServiceImpl's own
        // requireNoDuplicatePlatform(...) validation entirely, mirroring
        // ClubProfileRepositoryTest's compositePrimaryKeyOnClubIdAndPlatform... proof shape for
        // club_profile_social_link.
        Club club = savedClub("riverside-cc");
        Sponsor sponsorWithDuplicatePlatform = Sponsor.builder()
                .clubId(club.getId())
                .name("Acme Sponsor")
                .active(true)
                .socialLinks(List.of(
                        SocialLink.builder().platform("facebook").url("https://facebook.com/one").build(),
                        SocialLink.builder().platform("facebook").url("https://facebook.com/two").build()))
                .build();

        assertThatThrownBy(() -> sponsorRepository.saveAndFlush(sponsorWithDuplicatePlatform))
                .isInstanceOf(DataIntegrityViolationException.class);
    }
}
