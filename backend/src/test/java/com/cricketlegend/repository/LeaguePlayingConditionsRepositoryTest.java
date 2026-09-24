package com.cricketlegend.repository;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.cricketlegend.AbstractIntegrationTest;
import com.cricketlegend.domain.Club;
import com.cricketlegend.domain.ClubStatus;
import com.cricketlegend.domain.League;
import com.cricketlegend.domain.LeaguePlayingConditions;
import com.cricketlegend.domain.LeagueSource;
import com.cricketlegend.domain.Season;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.transaction.annotation.Transactional;

/**
 * Integration test for LeaguePlayingConditionsRepository — per docs/standards/backend.md, proves
 * the {@code UNIQUE (league_id, season_id)} constraint genuinely rejects a second row for the same
 * pair at the DB level, and that {@code findByLeagueIdAndSeasonId}/{@code findBySeasonId} behave
 * correctly. See docs/specs/050-league-schedule-and-fixtures.md. Mirrors
 * {@code LeagueAffiliationRepositoryTest}'s shape.
 */
@SpringBootTest
@Import(AbstractIntegrationTest.class)
@Transactional
class LeaguePlayingConditionsRepositoryTest {

    @Autowired
    private ClubRepository clubRepository;

    @Autowired
    private LeagueRepository leagueRepository;

    @Autowired
    private SeasonRepository seasonRepository;

    @Autowired
    private LeaguePlayingConditionsRepository leaguePlayingConditionsRepository;

    private Club savedClub(String slug) {
        return clubRepository.save(Club.builder().name("Riverside CC").slug(slug).status(ClubStatus.ACTIVE).build());
    }

    private League savedLeague(UUID clubId) {
        return leagueRepository.save(League.builder().clubId(clubId).name("Premier League")
                .source(LeagueSource.INTERNAL).maxPlayingXiSize(11).active(true).build());
    }

    private Season savedSeason(UUID clubId) {
        return seasonRepository.save(Season.builder().clubId(clubId).label("2026")
                .startDate(LocalDate.of(2026, 1, 1)).endDate(LocalDate.of(2026, 12, 31)).active(true).build());
    }

    @Test
    void findByLeagueIdAndSeasonIdReflectsTheCurrentUpload() {
        Club club = savedClub("riverside-cc");
        League league = savedLeague(club.getId());
        Season season = savedSeason(club.getId());

        assertThat(leaguePlayingConditionsRepository.findByLeagueIdAndSeasonId(league.getId(), season.getId()))
                .isEmpty();

        leaguePlayingConditionsRepository.save(LeaguePlayingConditions.builder()
                .leagueId(league.getId()).seasonId(season.getId()).documentUrl("/media/rules.pdf")
                .uploadedAt(Instant.now()).build());

        assertThat(leaguePlayingConditionsRepository.findByLeagueIdAndSeasonId(league.getId(), season.getId()))
                .isPresent()
                .get()
                .extracting(LeaguePlayingConditions::getDocumentUrl)
                .isEqualTo("/media/rules.pdf");
    }

    @Test
    void uniqueConstraintRejectsASecondRowForTheSameLeagueAndSeasonAtTheDbLevel() {
        Club club = savedClub("riverside-cc");
        League league = savedLeague(club.getId());
        Season season = savedSeason(club.getId());
        leaguePlayingConditionsRepository.save(LeaguePlayingConditions.builder()
                .leagueId(league.getId()).seasonId(season.getId()).documentUrl("/media/rules.pdf")
                .uploadedAt(Instant.now()).build());

        LeaguePlayingConditions duplicate = LeaguePlayingConditions.builder()
                .leagueId(league.getId()).seasonId(season.getId()).documentUrl("/media/other-rules.pdf")
                .uploadedAt(Instant.now()).build();

        assertThatThrownBy(() -> leaguePlayingConditionsRepository.saveAndFlush(duplicate))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void theSameLeagueCanHavePlayingConditionsAcrossDifferentSeasons() {
        Club club = savedClub("riverside-cc");
        League league = savedLeague(club.getId());
        Season seasonOne = savedSeason(club.getId());
        Season seasonTwo = savedSeason(club.getId());
        leaguePlayingConditionsRepository.save(LeaguePlayingConditions.builder()
                .leagueId(league.getId()).seasonId(seasonOne.getId()).documentUrl("/media/rules-one.pdf")
                .uploadedAt(Instant.now()).build());

        LeaguePlayingConditions seasonTwoRow = leaguePlayingConditionsRepository.saveAndFlush(
                LeaguePlayingConditions.builder().leagueId(league.getId()).seasonId(seasonTwo.getId())
                        .documentUrl("/media/rules-two.pdf").uploadedAt(Instant.now()).build());

        assertThat(leaguePlayingConditionsRepository.findBySeasonId(seasonTwo.getId()))
                .extracting(LeaguePlayingConditions::getId)
                .containsExactly(seasonTwoRow.getId());
    }
}
