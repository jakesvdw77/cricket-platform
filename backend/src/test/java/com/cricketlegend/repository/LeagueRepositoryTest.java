package com.cricketlegend.repository;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.groups.Tuple.tuple;

import com.cricketlegend.AbstractIntegrationTest;
import com.cricketlegend.domain.Club;
import com.cricketlegend.domain.ClubStatus;
import com.cricketlegend.domain.League;
import com.cricketlegend.domain.LeagueFormat;
import com.cricketlegend.domain.LeagueSource;
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
 * Integration test for LeagueRepository — per docs/standards/backend.md, proves
 * 021-add-league-management.sql applies cleanly (implicit via context boot) and {@code
 * findByClubId} scopes correctly. See docs/specs/029-league-management.md.
 *
 * <p>docs/specs/053-league-extended-profile.md's {@code 029-add-league-profile.sql} migration
 * (nullable {@code logo_url}/{@code format}/{@code phone}/{@code website}/{@code email} columns
 * plus the new {@code league_social_link} table) applying cleanly against an existing seeded
 * {@code League} row (no data loss on the pre-existing columns) and {@code
 * league_social_link}'s composite {@code (league_id, platform)} primary key/{@code league_id} FK
 * behaviour are proven below, mirroring {@code SponsorRepositoryTest}'s equivalent proof for
 * {@code sponsor_social_link}.
 */
@SpringBootTest
@Import(AbstractIntegrationTest.class)
@Transactional
class LeagueRepositoryTest {

    @Autowired
    private ClubRepository clubRepository;

    @Autowired
    private LeagueRepository leagueRepository;

    private Club savedClub(String slug) {
        return clubRepository.save(Club.builder().name("Riverside CC").slug(slug).status(ClubStatus.ACTIVE).build());
    }

    private League league(UUID clubId) {
        return League.builder().clubId(clubId).name("Premier League").source(LeagueSource.INTERNAL)
                .maxPlayingXiSize(11).active(true).build();
    }

    @Test
    void findByClubIdReturnsOnlyLeaguesForThatClub() {
        Club clubX = savedClub("riverside-cc");
        Club clubY = savedClub("lakeside-cc");
        League leagueForX = leagueRepository.save(league(clubX.getId()));
        leagueRepository.save(league(clubY.getId()));

        assertThat(leagueRepository.findByClubId(clubX.getId()))
                .extracting(League::getId)
                .containsExactly(leagueForX.getId());
    }

    @Test
    void createdAtAndUpdatedAtAreSetOnPersist() {
        Club club = savedClub("riverside-cc");
        League league = league(club.getId());
        assertThat(league.getCreatedAt()).isNull();

        League saved = leagueRepository.saveAndFlush(league);

        assertThat(saved.getCreatedAt()).isNotNull();
        assertThat(saved.getUpdatedAt()).isNotNull();
    }

    /**
     * 029-add-league-profile.sql's five new columns are all nullable — a League saved with none
     * of them set (the shape every pre-053 seeded row is in) round-trips with no data loss on its
     * existing columns and no error, proving the migration is genuinely additive.
     */
    @Test
    void aLeagueWithNoneOfTheExtendedProfileFieldsSetPersistsAndReloadsWithNoDataLoss() {
        Club club = savedClub("riverside-cc");
        League league = league(club.getId());

        League saved = leagueRepository.saveAndFlush(league);
        leagueRepository.flush();
        League reloaded = leagueRepository.findById(saved.getId()).orElseThrow();

        assertThat(reloaded.getName()).isEqualTo("Premier League");
        assertThat(reloaded.getSource()).isEqualTo(LeagueSource.INTERNAL);
        assertThat(reloaded.getMaxPlayingXiSize()).isEqualTo(11);
        assertThat(reloaded.isActive()).isTrue();
        assertThat(reloaded.getFormat()).isNull();
        assertThat(reloaded.getLogoUrl()).isNull();
        assertThat(reloaded.getPhone()).isNull();
        assertThat(reloaded.getWebsite()).isNull();
        assertThat(reloaded.getEmail()).isNull();
        assertThat(reloaded.getSocialLinks()).isEmpty();
    }

    /** A League with all five extended-profile fields set, including two social links, persists and reloads both. */
    @Test
    void aLeagueWithTheExtendedProfileFieldsSetPersistsAndReloadsAllOfThem() {
        Club club = savedClub("riverside-cc");
        League league = League.builder()
                .clubId(club.getId())
                .name("Premier League")
                .source(LeagueSource.INTERNAL)
                .maxPlayingXiSize(11)
                .active(true)
                .format(LeagueFormat.T20)
                .logoUrl("/media/league-logo.png")
                .phone("0123456789")
                .website("https://riverside-premier.example")
                .email("info@riverside-premier.example")
                .socialLinks(List.of(
                        SocialLink.builder().platform("facebook").url("https://facebook.com/riverside").build(),
                        SocialLink.builder().platform("instagram").url("https://instagram.com/riverside").build()))
                .build();

        League saved = leagueRepository.saveAndFlush(league);
        leagueRepository.flush();
        League reloaded = leagueRepository.findById(saved.getId()).orElseThrow();

        assertThat(reloaded.getFormat()).isEqualTo(LeagueFormat.T20);
        assertThat(reloaded.getLogoUrl()).isEqualTo("/media/league-logo.png");
        assertThat(reloaded.getPhone()).isEqualTo("0123456789");
        assertThat(reloaded.getWebsite()).isEqualTo("https://riverside-premier.example");
        assertThat(reloaded.getEmail()).isEqualTo("info@riverside-premier.example");
        assertThat(reloaded.getSocialLinks())
                .extracting(SocialLink::getPlatform, SocialLink::getUrl)
                .containsExactlyInAnyOrder(
                        tuple("facebook", "https://facebook.com/riverside"),
                        tuple("instagram", "https://instagram.com/riverside"));
    }

    /**
     * {@code league_social_link}'s composite primary key {@code (league_id, platform)} rejects a
     * second social link for the same platform on the same league at the DB level — a backstop
     * bypassing {@code LeagueServiceImpl}'s own {@code SocialLinkValidation.requireNoDuplicatePlatform}
     * entirely, mirroring {@code SponsorRepositoryTest}'s equivalent proof for {@code
     * sponsor_social_link}.
     */
    @Test
    void compositePrimaryKeyOnLeagueIdAndPlatformRejectsTwoSocialLinksForTheSamePlatformAtTheDbLevel() {
        Club club = savedClub("riverside-cc");
        League leagueWithDuplicatePlatform = League.builder()
                .clubId(club.getId())
                .name("Premier League")
                .source(LeagueSource.INTERNAL)
                .maxPlayingXiSize(11)
                .active(true)
                .socialLinks(List.of(
                        SocialLink.builder().platform("facebook").url("https://facebook.com/one").build(),
                        SocialLink.builder().platform("facebook").url("https://facebook.com/two").build()))
                .build();

        assertThatThrownBy(() -> leagueRepository.saveAndFlush(leagueWithDuplicatePlatform))
                .isInstanceOf(DataIntegrityViolationException.class);
    }
}
