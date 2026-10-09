package com.cricketlegend.repository;

import static org.assertj.core.api.Assertions.assertThat;

import com.cricketlegend.AbstractIntegrationTest;
import com.cricketlegend.domain.Match;
import com.cricketlegend.domain.PlayerProfile;
import com.cricketlegend.domain.Season;
import com.cricketlegend.domain.TeamSquadMember;
import com.cricketlegend.support.ManagerOverviewFixtures;
import com.cricketlegend.support.ManagerOverviewFixtures.World;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.ApplicationContext;
import org.springframework.context.annotation.Import;

/**
 * docs/specs/088-players-polls-alignment.md: the two queries behind the Players counters, against real Postgres - the
 * players in a team squad for a season, and the players selected for an active match of a club and season. Not
 * {@code @Transactional}; {@link ManagerOverviewFixtures} removes what it seeds.
 */
@SpringBootTest
@Import(AbstractIntegrationTest.class)
class PlayerCounterQueriesIntegrationTest {

    @Autowired
    private TeamSquadMemberRepository teamSquadMemberRepository;

    @Autowired
    private MatchSidePlayerRepository matchSidePlayerRepository;

    @Autowired
    private SeasonRepository seasonRepository;

    @Autowired
    private MatchRepository matchRepository;

    @Autowired
    private ApplicationContext context;

    private ManagerOverviewFixtures fixtures;

    @BeforeEach
    void setUp() {
        fixtures = new ManagerOverviewFixtures(context);
    }

    @AfterEach
    void cleanUp() {
        fixtures.cleanUp();
    }

    @Test
    void aPlayerInTwoSquadsOfTheSeasonIsReturnedOnceAndAnotherSeasonIsIgnored() {
        World w = fixtures.world();
        PlayerProfile both = fixtures.rosterPlayer(w, w.seniors1(), "Both");
        teamSquadMemberRepository.save(TeamSquadMember.builder().teamId(w.seniors2().getId())
                .seasonId(w.season().getId()).playerProfileId(both.getId()).build());
        PlayerProfile oneSquad = fixtures.rosterPlayer(w, w.juniorsTeam(), "One");
        PlayerProfile noSquad = fixtures.player(w, "None", true);
        Season next = seasonRepository.save(Season.builder().clubId(w.club().getId()).label("2032")
                .startDate(LocalDate.of(2032, 1, 1)).endDate(LocalDate.of(2032, 12, 31)).active(true).build());
        PlayerProfile nextOnly = fixtures.player(w, "Next", true);
        teamSquadMemberRepository.save(TeamSquadMember.builder().teamId(w.seniors1().getId())
                .seasonId(next.getId()).playerProfileId(nextOnly.getId()).build());

        assertThat(teamSquadMemberRepository.findDistinctPlayerProfileIdsBySeasonId(w.season().getId()))
                .containsExactlyInAnyOrder(both.getId(), oneSquad.getId())
                .doesNotContain(noSquad.getId(), nextOnly.getId());
        assertThat(teamSquadMemberRepository.findDistinctPlayerProfileIdsBySeasonId(next.getId()))
                .containsExactly(nextOnly.getId());
    }

    @Test
    void selectionCountsPastAndUpcomingActiveMatchesOfTheClubAndSeasonOnceEach() {
        World w = fixtures.world();
        World other = fixtures.world();
        Instant now = Instant.now();
        PlayerProfile twice = fixtures.player(w, "Twice", true);
        PlayerProfile upcoming = fixtures.player(w, "Upcoming", true);
        PlayerProfile onlyInactive = fixtures.player(w, "Inactive", true);
        PlayerProfile otherClub = fixtures.player(other, "Other", true);

        Match past = fixtures.match(w, w.seniors1(), null, now.minus(Duration.ofDays(5)));
        Match future = fixtures.match(w, w.seniors1(), null, now.plus(Duration.ofDays(5)));
        fixtures.side(past, w.seniors1(), true, twice);
        fixtures.side(future, w.seniors1(), false, twice, upcoming);
        Match off = fixtures.match(w, w.juniorsTeam(), null, now.plus(Duration.ofDays(6)), false, null);
        fixtures.side(off, w.juniorsTeam(), false, onlyInactive);
        Match otherMatch = fixtures.match(other, other.seniors1(), null, now.plus(Duration.ofDays(2)));
        fixtures.side(otherMatch, other.seniors1(), false, otherClub);

        assertThat(matchSidePlayerRepository.findDistinctSelectedPlayerProfileIds(w.club().getId(), w.season().getId()))
                .containsExactlyInAnyOrder(twice.getId(), upcoming.getId())
                .doesNotContain(onlyInactive.getId(), otherClub.getId());
        assertThat(matchSidePlayerRepository.findDistinctSelectedPlayerProfileIds(
                        w.club().getId(), other.season().getId()))
                .isEmpty();
    }

    private Map<UUID, Long> asMap(java.util.List<PlayerGamesView> views) {
        return views.stream().collect(Collectors.toMap(PlayerGamesView::getPlayerProfileId, PlayerGamesView::getGames));
    }

    // docs/specs/088-players-polls-alignment.md: games played = distinct active matches that have started
    @Test
    void gamesPlayedCountsStartedActiveMatchesOnceEachAcrossAllSeasonsOrOneSeason() {
        World w = fixtures.world();
        World other = fixtures.world();
        Instant now = Instant.now();
        Season next = seasonRepository.save(Season.builder().clubId(w.club().getId()).label("2032")
                .startDate(LocalDate.of(2032, 1, 1)).endDate(LocalDate.of(2032, 12, 31)).active(true).build());
        PlayerProfile player = fixtures.player(w, "Regular", true);
        PlayerProfile benched = fixtures.player(w, "Bench", true);
        PlayerProfile otherClub = fixtures.player(other, "Other", true);

        Match first = fixtures.match(w, w.seniors1(), null, now.minus(Duration.ofDays(9)));
        Match second = fixtures.match(w, w.seniors1(), null, now.minus(Duration.ofDays(2)));
        Match inProgress = fixtures.match(w, w.seniors1(), null, now.minus(Duration.ofHours(1)));
        Match upcoming = fixtures.match(w, w.seniors1(), null, now.plus(Duration.ofDays(4)));
        Match deactivated = fixtures.match(w, w.seniors1(), null, now.minus(Duration.ofDays(5)), false, null);
        Match otherSeason = matchRepository.save(Match.builder().clubId(w.club().getId()).homeTeamId(w.seniors1().getId())
                .awayTeamName("Occasionals").seasonId(next.getId()).matchDate(now.minus(Duration.ofDays(1))).active(true).build());
        for (Match match : new Match[] {first, second, inProgress, upcoming, deactivated, otherSeason}) {
            fixtures.side(match, w.seniors1(), false, player);
        }
        // a second side in the same match must not count the match twice
        fixtures.side(second, w.seniors2(), false, player);
        fixtures.side(fixtures.match(other, other.seniors1(), null, now.minus(Duration.ofDays(3))), other.seniors1(), false, otherClub);

        // overall: first, second, in progress, other season; not the upcoming or the deactivated one
        Map<UUID, Long> overall = asMap(matchSidePlayerRepository.findGamesPlayed(w.club().getId(), now));
        assertThat(overall).containsEntry(player.getId(), 4L).doesNotContainKeys(benched.getId(), otherClub.getId());

        // this season: the same without the other season's match
        Map<UUID, Long> season = asMap(matchSidePlayerRepository.findGamesPlayedInSeason(w.club().getId(), w.season().getId(), now));
        assertThat(season).containsEntry(player.getId(), 3L).doesNotContainKeys(benched.getId(), otherClub.getId());
        assertThat(asMap(matchSidePlayerRepository.findGamesPlayedInSeason(w.club().getId(), next.getId(), now)))
                .containsEntry(player.getId(), 1L);
    }
}
