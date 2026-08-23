package com.cricketlegend.repository;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.cricketlegend.AbstractIntegrationTest;
import com.cricketlegend.domain.Address;
import com.cricketlegend.domain.Club;
import com.cricketlegend.domain.ClubProfile;
import com.cricketlegend.domain.ClubProfileType;
import com.cricketlegend.domain.ClubStatus;
import com.cricketlegend.domain.SocialLink;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.transaction.annotation.Transactional;

/**
 * Integration test for ClubProfileRepository — per docs/standards/backend.md and
 * docs/plans/012-club-profile.md's Test tier list: proves 006-add-club-profile.sql applies
 * cleanly on top of 010's existing club table (implicit via context boot), the embedded
 * {@link Address} fields round-trip correctly through the flat {@code address_*} columns, and
 * the {@code club_id} FK constraint enforces a ClubProfile can never exist for a non-existent
 * Club. Each test runs in its own rolled-back transaction for isolation, since all tests share
 * one Testcontainers Postgres instance for the whole class.
 */
@SpringBootTest
@Import(AbstractIntegrationTest.class)
@Transactional
class ClubProfileRepositoryTest {

    @Autowired
    private ClubRepository clubRepository;

    @Autowired
    private ClubProfileRepository clubProfileRepository;

    @Test
    void embeddedAddressFieldsRoundTripThroughTheFlatAddressColumns() {
        Club club = clubRepository.save(newClub("Riverside CC", "riverside-cc"));

        Address address = Address.builder()
                .number("12")
                .street("Main Street")
                .city("Riverside")
                .provinceState("Gauteng")
                .country("South Africa")
                .postalCode("0001")
                .build();
        ClubProfile profile = ClubProfile.builder()
                .clubId(club.getId())
                .type(ClubProfileType.CLUB)
                .address(address)
                .build();
        clubProfileRepository.saveAndFlush(profile);

        ClubProfile reloaded = clubProfileRepository.findById(club.getId()).orElseThrow();

        assertThat(reloaded.getAddress()).isNotNull();
        assertThat(reloaded.getAddress().getNumber()).isEqualTo("12");
        assertThat(reloaded.getAddress().getStreet()).isEqualTo("Main Street");
        assertThat(reloaded.getAddress().getCity()).isEqualTo("Riverside");
        assertThat(reloaded.getAddress().getProvinceState()).isEqualTo("Gauteng");
        assertThat(reloaded.getAddress().getCountry()).isEqualTo("South Africa");
        assertThat(reloaded.getAddress().getPostalCode()).isEqualTo("0001");
    }

    @Test
    void profileWithNoAddressEnteredYetIsValid() {
        Club club = clubRepository.save(newClub("Riverside CC", "riverside-cc"));

        ClubProfile profile = ClubProfile.builder().clubId(club.getId()).build();
        ClubProfile saved = clubProfileRepository.saveAndFlush(profile);

        assertThat(saved.getAddress()).isNull();
    }

    @Test
    void clubIdForeignKeyConstraintRejectsAProfileForANonexistentClub() {
        // club_id REFERENCES club(id) — the FK half of the strict 1:1 shape docs/specs/012-club-profile.md
        // describes: a ClubProfile can never outlive/outnumber its owning Club row. Since
        // ClubProfile's @Id has no @GeneratedValue, JpaRepository#save uses JPA merge semantics
        // for a non-null id (not persist), so this is exercised as a failing INSERT at flush
        // time against a clubId with no matching club row, translated by the repository proxy
        // into the same DataIntegrityViolationException TOCTOU defense-in-depth pattern as
        // ClubRepositoryTest's unique-slug test.
        ClubProfile orphan = ClubProfile.builder().clubId(UUID.randomUUID()).build();

        assertThatThrownBy(() -> clubProfileRepository.saveAndFlush(orphan))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void createdAtAndUpdatedAtAreSetOnPersist() {
        Club club = clubRepository.save(newClub("Riverside CC", "riverside-cc"));
        ClubProfile profile = ClubProfile.builder().clubId(club.getId()).build();
        assertThat(profile.getCreatedAt()).isNull();

        ClubProfile saved = clubProfileRepository.saveAndFlush(profile);

        assertThat(saved.getCreatedAt()).isNotNull();
        assertThat(saved.getUpdatedAt()).isNotNull();
    }

    @Test
    void compositePrimaryKeyOnClubIdAndPlatformRejectsTwoSocialLinksForTheSamePlatformAtTheDbLevel() {
        // club_profile_social_link's PRIMARY KEY (club_id, platform) — proven directly at the
        // repository/Testcontainers level, bypassing ClubProfileServiceImpl's own
        // requireNoDuplicatePlatform(...) validation entirely, mirroring
        // ClubContactRepositoryTest's ux_club_contact_primary proof shape.
        Club club = clubRepository.save(newClub("Riverside CC", "riverside-cc"));
        ClubProfile profile = ClubProfile.builder()
                .clubId(club.getId())
                .type(ClubProfileType.CLUB)
                .socialLinks(List.of(
                        SocialLink.builder().platform("facebook").url("https://facebook.com/one").build(),
                        SocialLink.builder().platform("facebook").url("https://facebook.com/two").build()))
                .build();

        assertThatThrownBy(() -> clubProfileRepository.saveAndFlush(profile))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    private Club newClub(String name, String slug) {
        return Club.builder().name(name).slug(slug).status(ClubStatus.ACTIVE).build();
    }
}
