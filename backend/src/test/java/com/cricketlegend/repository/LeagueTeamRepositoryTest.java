package com.cricketlegend.repository;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.cricketlegend.AbstractIntegrationTest;
import com.cricketlegend.domain.Club;
import com.cricketlegend.domain.ClubStatus;
import com.cricketlegend.domain.League;
import com.cricketlegend.domain.LeagueSource;
import com.cricketlegend.domain.LeagueTeam;
import com.cricketlegend.domain.Match;
import com.cricketlegend.domain.Season;
import com.cricketlegend.repository.LeagueTeamRepository.ReferencedMatchCount;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.transaction.annotation.Transactional;

/**
 * Integration test for LeagueTeamRepository and the league-team propagation queries on
 * MatchRepository — per docs/standards/backend.md, proves the {@code ux_league_team_name} unique
 * index at the DB level, the case-insensitive exists/list queries, the batched referenced-match
 * count, the home/away bulk propagation (only the right league team, only its own side, {@code
 * updatedAt} bumped) and that the FK blocks deleting a referenced row. See
 * docs/specs/070-league-teams.md.
 */
@SpringBootTest
@Import(AbstractIntegrationTest.class)
@Transactional
class LeagueTeamRepositoryTest {

    @Autowired
    private ClubRepository clubRepository;

    @Autowired
    private LeagueRepository leagueRepository;

    @Autowired
    private SeasonRepository seasonRepository;

    @Autowired
    private LeagueTeamRepository leagueTeamRepository;

    @Autowired
    private MatchRepository matchRepository;

    private Club club;
    private League league;
    private Season season;

    private void seed() {
        club = clubRepository.save(
                Club.builder().name("Riverside CC").slug("riverside-cc").status(ClubStatus.ACTIVE).build());
        league = leagueRepository.save(League.builder().clubId(club.getId()).name("Premier")
                .source(LeagueSource.INTERNAL).maxPlayingXiSize(11).active(true).build());
        season = seasonRepository.save(Season.builder().clubId(club.getId()).label("2026")
                .startDate(LocalDate.of(2026, 1, 1)).endDate(LocalDate.of(2026, 12, 31)).active(true).build());
    }

    private LeagueTeam savedTeam(UUID leagueId, UUID seasonId, String name, boolean active) {
        return leagueTeamRepository.save(LeagueTeam.builder().leagueId(leagueId).seasonId(seasonId).name(name)
                .abbreviation("ABB").logoUrl("/media/" + name + ".png").active(active).build());
    }

    private Match savedMatch(UUID homeLeagueTeamId, String homeName, UUID awayLeagueTeamId, String awayName) {
        return matchRepository.save(Match.builder().clubId(club.getId()).homeTeamName(homeName)
                .homeLeagueTeamId(homeLeagueTeamId).awayTeamName(awayName).awayLeagueTeamId(awayLeagueTeamId)
                .leagueId(league.getId()).seasonId(season.getId()).matchDate(Instant.now()).active(true).build());
    }

    @Test
    void uniqueIndexRejectsTheSameNameCaseInsensitivelyInTheSameLeagueAndSeasonEvenWhenInactive() {
        seed();
        savedTeam(league.getId(), season.getId(), "Riverside CC", false);

        assertThatThrownBy(() -> leagueTeamRepository.saveAndFlush(LeagueTeam.builder().leagueId(league.getId())
                        .seasonId(season.getId()).name("RIVERSIDE cc").active(true).build()))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void theSameNameIsAllowedInAnotherSeasonOrAnotherLeague() {
        seed();
        Season otherSeason = seasonRepository.save(Season.builder().clubId(club.getId()).label("2027")
                .startDate(LocalDate.of(2027, 1, 1)).endDate(LocalDate.of(2027, 12, 31)).active(true).build());
        League otherLeague = leagueRepository.save(League.builder().clubId(club.getId()).name("Cup")
                .source(LeagueSource.INTERNAL).maxPlayingXiSize(11).active(true).build());
        savedTeam(league.getId(), season.getId(), "Riverside CC", true);

        leagueTeamRepository.saveAndFlush(LeagueTeam.builder().leagueId(league.getId()).seasonId(otherSeason.getId())
                .name("Riverside CC").active(true).build());
        leagueTeamRepository.saveAndFlush(LeagueTeam.builder().leagueId(otherLeague.getId())
                .seasonId(season.getId()).name("Riverside CC").active(true).build());
    }

    @Test
    void existsChecksAreCaseInsensitiveAndScopedToLeagueAndSeasonAndTheIdNotVariantExcludesSelf() {
        seed();
        LeagueTeam team = savedTeam(league.getId(), season.getId(), "Riverside CC", true);

        assertThat(leagueTeamRepository.existsByLeagueIdAndSeasonIdAndNameIgnoreCase(
                        league.getId(), season.getId(), "riverside cc"))
                .isTrue();
        assertThat(leagueTeamRepository.existsByLeagueIdAndSeasonIdAndNameIgnoreCase(
                        league.getId(), UUID.randomUUID(), "riverside cc"))
                .isFalse();
        assertThat(leagueTeamRepository.existsByLeagueIdAndSeasonIdAndNameIgnoreCaseAndIdNot(
                        league.getId(), season.getId(), "riverside cc", team.getId()))
                .isFalse();
        assertThat(leagueTeamRepository.existsByLeagueIdAndSeasonIdAndNameIgnoreCaseAndIdNot(
                        league.getId(), season.getId(), "riverside cc", UUID.randomUUID()))
                .isTrue();
    }

    @Test
    void findByLeagueAndSeasonSortsByNameCaseInsensitivelyAndActiveVariantDropsInactiveRows() {
        seed();
        savedTeam(league.getId(), season.getId(), "beta CC", true);
        savedTeam(league.getId(), season.getId(), "Alpha CC", false);
        savedTeam(league.getId(), season.getId(), "Charlie CC", true);
        savedTeam(league.getId(),
                seasonRepository.save(Season.builder().clubId(club.getId()).label("2027")
                                .startDate(LocalDate.of(2027, 1, 1)).endDate(LocalDate.of(2027, 12, 31)).active(true)
                                .build())
                        .getId(),
                "Other Season CC", true);

        assertThat(leagueTeamRepository.findByLeagueAndSeason(league.getId(), season.getId()))
                .extracting(LeagueTeam::getName)
                .containsExactly("Alpha CC", "beta CC", "Charlie CC");
        assertThat(leagueTeamRepository.findActiveByLeagueAndSeason(league.getId(), season.getId()))
                .extracting(LeagueTeam::getName)
                .containsExactly("beta CC", "Charlie CC");
    }

    @Test
    void countReferencingMatchesCountsHomeAndAwayReferencesInOneQueryAndOmitsUnreferencedTeams() {
        seed();
        LeagueTeam a = savedTeam(league.getId(), season.getId(), "A", true);
        LeagueTeam b = savedTeam(league.getId(), season.getId(), "B", true);
        LeagueTeam unused = savedTeam(league.getId(), season.getId(), "C", true);
        savedMatch(a.getId(), "A", null, "Free text");
        savedMatch(null, "Free text", a.getId(), "A");
        savedMatch(b.getId(), "B", a.getId(), "A");

        List<ReferencedMatchCount> counts =
                leagueTeamRepository.countReferencingMatches(List.of(a.getId(), b.getId(), unused.getId()));

        assertThat(counts).hasSize(2);
        assertThat(counts).filteredOn(c -> c.getLeagueTeamId().equals(a.getId()))
                .extracting(ReferencedMatchCount::getMatchCount).containsExactly(3L);
        assertThat(counts).filteredOn(c -> c.getLeagueTeamId().equals(b.getId()))
                .extracting(ReferencedMatchCount::getMatchCount).containsExactly(1L);
    }

    @Test
    void existsReferenceIsTrueForAHomeReferenceAndForAnAwayReferenceAndFalseOtherwise() {
        seed();
        LeagueTeam home = savedTeam(league.getId(), season.getId(), "Home side", true);
        LeagueTeam away = savedTeam(league.getId(), season.getId(), "Away side", true);
        LeagueTeam none = savedTeam(league.getId(), season.getId(), "Nobody", true);
        savedMatch(home.getId(), "Home side", away.getId(), "Away side");

        assertThat(leagueTeamRepository.existsReference(home.getId())).isTrue();
        assertThat(leagueTeamRepository.existsReference(away.getId())).isTrue();
        assertThat(leagueTeamRepository.existsReference(none.getId())).isFalse();
    }

    @Test
    void propagationRewritesNameAndLogoOnlyOnTheRightSideOfTheRightLeagueTeamsMatches() {
        seed();
        LeagueTeam target = savedTeam(league.getId(), season.getId(), "Riversde CC", true);
        LeagueTeam other = savedTeam(league.getId(), season.getId(), "Hillside CC", true);
        Match targetHome = savedMatch(target.getId(), "Riversde CC", null, "Free text");
        Match targetAway = savedMatch(null, "Free text", target.getId(), "Riversde CC");
        Match otherLeagueTeamMatch = savedMatch(other.getId(), "Hillside CC", null, "Free text");
        Match freeTextOnly = savedMatch(null, "Riversde CC", null, "Riversde CC");
        matchRepository.flush();

        // a timestamp a day ahead makes the explicit updatedAt bump observable against the rows' own
        Instant now = Instant.now().plus(1, ChronoUnit.DAYS);
        int home = matchRepository.propagateLeagueTeamToHomeSide(target.getId(), "Riverside CC", "/media/new.png", now);
        int away = matchRepository.propagateLeagueTeamToAwaySide(target.getId(), "Riverside CC", "/media/new.png", now);

        assertThat(home).isEqualTo(1);
        assertThat(away).isEqualTo(1);
        Match reloadedHome = matchRepository.findById(targetHome.getId()).orElseThrow();
        assertThat(reloadedHome.getHomeTeamName()).isEqualTo("Riverside CC");
        assertThat(reloadedHome.getHomeTeamLogoUrl()).isEqualTo("/media/new.png");
        assertThat(reloadedHome.getAwayTeamName()).isEqualTo("Free text");
        assertThat(reloadedHome.getAwayTeamLogoUrl()).isNull();
        assertThat(reloadedHome.getUpdatedAt()).isAfter(now.minus(1, ChronoUnit.MINUTES));
        Match reloadedAway = matchRepository.findById(targetAway.getId()).orElseThrow();
        assertThat(reloadedAway.getAwayTeamName()).isEqualTo("Riverside CC");
        assertThat(reloadedAway.getAwayTeamLogoUrl()).isEqualTo("/media/new.png");
        assertThat(reloadedAway.getHomeTeamName()).isEqualTo("Free text");
        assertThat(reloadedAway.getUpdatedAt()).isAfter(now.minus(1, ChronoUnit.MINUTES));
        Match reloadedOther = matchRepository.findById(otherLeagueTeamMatch.getId()).orElseThrow();
        assertThat(reloadedOther.getHomeTeamName()).isEqualTo("Hillside CC");
        assertThat(reloadedOther.getUpdatedAt()).isBefore(now.minus(12, ChronoUnit.HOURS));
        Match reloadedFree = matchRepository.findById(freeTextOnly.getId()).orElseThrow();
        assertThat(reloadedFree.getHomeTeamName()).isEqualTo("Riversde CC");
        assertThat(reloadedFree.getAwayTeamName()).isEqualTo("Riversde CC");
        assertThat(reloadedFree.getUpdatedAt()).isBefore(now.minus(12, ChronoUnit.HOURS));
    }

    @Test
    void propagationWithANullLogoClearsTheMatchLogo() {
        seed();
        LeagueTeam target = savedTeam(league.getId(), season.getId(), "Riverside CC", true);
        Match match = savedMatch(target.getId(), "Riverside CC", null, "Free text");
        match.setHomeTeamLogoUrl("/media/old.png");
        matchRepository.saveAndFlush(match);

        matchRepository.propagateLeagueTeamToHomeSide(target.getId(), "Riverside CC", null, Instant.now());

        assertThat(matchRepository.findById(match.getId()).orElseThrow().getHomeTeamLogoUrl()).isNull();
    }

    @Test
    void foreignKeyBlocksDeletingALeagueTeamThatAMatchReferences() {
        seed();
        LeagueTeam team = savedTeam(league.getId(), season.getId(), "Riverside CC", true);
        savedMatch(null, "Home", team.getId(), "Riverside CC");
        matchRepository.flush();

        assertThatThrownBy(() -> {
                    leagueTeamRepository.delete(team);
                    leagueTeamRepository.flush();
                })
                .isInstanceOf(DataIntegrityViolationException.class);
    }
}
