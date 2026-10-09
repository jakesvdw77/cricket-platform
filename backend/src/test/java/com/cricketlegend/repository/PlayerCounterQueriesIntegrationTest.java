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
}
