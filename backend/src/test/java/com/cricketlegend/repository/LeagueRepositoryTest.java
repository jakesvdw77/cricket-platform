package com.cricketlegend.repository;

import static org.assertj.core.api.Assertions.assertThat;

import com.cricketlegend.AbstractIntegrationTest;
import com.cricketlegend.domain.Club;
import com.cricketlegend.domain.ClubStatus;
import com.cricketlegend.domain.League;
import com.cricketlegend.domain.LeagueSource;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.transaction.annotation.Transactional;

/**
 * Integration test for LeagueRepository — per docs/standards/backend.md, proves
 * 021-add-league-management.sql applies cleanly (implicit via context boot) and {@code
 * findByClubId} scopes correctly. See docs/specs/029-league-management.md.
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
}
