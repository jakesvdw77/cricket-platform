package com.cricketlegend.service;

import static com.cricketlegend.support.ScorecardDtos.guest;
import static com.cricketlegend.support.ScorecardDtos.opposition;
import static com.cricketlegend.support.ScorecardDtos.registered;
import static org.assertj.core.api.Assertions.assertThat;

import com.cricketlegend.AbstractIntegrationTest;
import com.cricketlegend.domain.League;
import com.cricketlegend.domain.LeagueTeam;
import com.cricketlegend.domain.Match;
import com.cricketlegend.domain.MatchSide;
import com.cricketlegend.domain.PlayerProfile;
import com.cricketlegend.domain.ResultSide;
import com.cricketlegend.domain.ScorecardSelectionState;
import com.cricketlegend.dto.GuestNameDto;
import com.cricketlegend.dto.OppositionNameDto;
import com.cricketlegend.dto.ResultDraft;
import com.cricketlegend.dto.ResultPlayerDto;
import com.cricketlegend.dto.ScorecardDto;
import com.cricketlegend.dto.ScorecardPrefillDto;
import com.cricketlegend.repository.MatchRepository;
import com.cricketlegend.repository.MatchSideRepository;
import com.cricketlegend.support.ManagerOverviewFixtures;
import com.cricketlegend.support.ManagerOverviewFixtures.World;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.ApplicationContext;
import org.springframework.context.annotation.Import;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.core.Authentication;

/**
 * docs/specs/101 integration: the prefill from the team selection (selection state, 12th man once, per side in a
 * derby), the guest-names query (never the opposition) and the opposition-names query (league team id, then
 * normalised name; club-scoped; paged; excludes the current list). No ambient transaction.
 */
@SpringBootTest
@Import(AbstractIntegrationTest.class)
class ScorecardQueriesIntegrationTest {

    private static final ResultSide H = ResultSide.HOME;
    private static final ResultSide A = ResultSide.AWAY;

    @Autowired
    private ResultService resultService;

    @Autowired
    private ScorecardService scorecardService;

    @Autowired
    private MatchRepository matchRepository;

    @Autowired
    private MatchSideRepository matchSideRepository;

    @Autowired
    private ApplicationContext context;

    private ManagerOverviewFixtures fixtures;
    private World w;
    private UUID clubId;
    private final Authentication admin = new TestingAuthenticationToken("ops", "n/a", "ROLE_platform_admin");

    @BeforeEach
    void setUp() {
        fixtures = new ManagerOverviewFixtures(context);
        w = fixtures.world();
        clubId = w.club().getId();
    }

    @AfterEach
    void cleanUp() {
        fixtures.cleanUp();
    }

    private Match match(int daysAgo) {
        return fixtures.match(w, w.seniors1(), null, Instant.now().minus(Duration.ofDays(daysAgo)));
    }

    private void saveList(Match match, ResultPlayerDto... players) {
        resultService.upsertDraft(admin, match.getClubId(), match.getId(), new ResultDraft(null, null, null, null, null,
                null, null, null, null, null, null, null, null, null,
                new ScorecardDto(List.of(players), null, null, null, null, null, null)));
    }

    private static ResultPlayerDto[] opp(String... names) {
        ResultPlayerDto[] result = new ResultPlayerDto[names.length];
        for (int i = 0; i < names.length; i++) {
            result[i] = opposition(A, "o" + i, names[i]);
        }
        return result;
    }

    // ---- prefill ----

    @Test
    void prefillReportsNoneWithoutASelectionAndNotAnnouncedOrAnnouncedOtherwise() {
        Match none = match(1);
        assertThat(scorecardService.prefill(admin, clubId, none.getId()).sides()).singleElement().satisfies(s -> {
            assertThat(s.side()).isEqualTo(H);
            assertThat(s.selectionState()).isEqualTo(ScorecardSelectionState.NONE);
            assertThat(s.players()).isEmpty();
        });

        PlayerProfile ann = fixtures.sectionPlayer(w, w.seniors1(), "Ann");
        Match unannounced = match(2);
        fixtures.side(unannounced, w.seniors1(), false, ann);
        assertThat(scorecardService.prefill(admin, clubId, unannounced.getId()).sides().get(0).selectionState())
                .isEqualTo(ScorecardSelectionState.NOT_ANNOUNCED);

        Match announced = match(3);
        fixtures.side(announced, w.seniors1(), true, ann);
        assertThat(scorecardService.prefill(admin, clubId, announced.getId()).sides().get(0).selectionState())
                .isEqualTo(ScorecardSelectionState.ANNOUNCED);

        // a side row with no players is no selection at all
        Match empty = match(4);
        fixtures.side(empty, w.seniors1(), true);
        assertThat(scorecardService.prefill(admin, clubId, empty.getId()).sides().get(0).selectionState())
                .isEqualTo(ScorecardSelectionState.NONE);
    }

    @Test
    void prefillListsPlayersInBattingOrderWithTheTwelfthManOnceAndLastAsASubstitute() {
        PlayerProfile ann = fixtures.sectionPlayer(w, w.seniors1(), "Ann");
        PlayerProfile bob = fixtures.sectionPlayer(w, w.seniors1(), "Bob");
        PlayerProfile cal = fixtures.sectionPlayer(w, w.seniors1(), "Cal");
        PlayerProfile twelfth = fixtures.sectionPlayer(w, w.seniors1(), "Tim");
        Match match = match(1);
        MatchSide side = fixtures.side(match, w.seniors1(), true, ann, bob, cal);
        side.setTwelfthManPlayerId(twelfth.getId());
        matchSideRepository.save(side);

        ScorecardPrefillDto.Side prefilled = scorecardService.prefill(admin, clubId, match.getId()).sides().get(0);

        assertThat(prefilled.teamName()).isEqualTo("Villagers 1");
        assertThat(prefilled.players()).extracting(ScorecardPrefillDto.Player::firstName)
                .containsExactly("Ann", "Bob", "Cal", "Tim");
        assertThat(prefilled.players()).extracting(ScorecardPrefillDto.Player::substitute)
                .containsExactly(false, false, false, true);
        assertThat(prefilled.players().get(3).plannedBattingOrder()).isNull();

        // a 12th man who is also a selection row is listed once, as the substitute
        Match again = match(2);
        MatchSide second = fixtures.side(again, w.seniors1(), true, ann, bob);
        second.setTwelfthManPlayerId(bob.getId());
        matchSideRepository.save(second);
        List<ScorecardPrefillDto.Player> players = scorecardService.prefill(admin, clubId, again.getId()).sides().get(0).players();
        assertThat(players).extracting(ScorecardPrefillDto.Player::firstName).containsExactly("Ann", "Bob");
        assertThat(players.get(1).substitute()).isTrue();
        assertThat(players.get(1).plannedBattingOrder()).isNull();
    }

    @Test
    void prefillInADerbyGivesEachSideItsOwnPlayersAndState() {
        PlayerProfile ann = fixtures.sectionPlayer(w, w.seniors1(), "Ann");
        PlayerProfile bob = fixtures.sectionPlayer(w, w.seniors1(), "Bob");
        Match derby = fixtures.match(w, w.seniors1(), w.seniors2(), Instant.now().minus(Duration.ofDays(1)));
        fixtures.side(derby, w.seniors1(), true, ann);
        fixtures.side(derby, w.seniors2(), false, bob);

        List<ScorecardPrefillDto.Side> sides = scorecardService.prefill(admin, clubId, derby.getId()).sides();

        assertThat(sides).extracting(ScorecardPrefillDto.Side::side).containsExactly(H, A);
        assertThat(sides.get(0).players()).extracting(ScorecardPrefillDto.Player::firstName).containsExactly("Ann");
        assertThat(sides.get(0).selectionState()).isEqualTo(ScorecardSelectionState.ANNOUNCED);
        assertThat(sides.get(1).players()).extracting(ScorecardPrefillDto.Player::firstName).containsExactly("Bob");
        assertThat(sides.get(1).selectionState()).isEqualTo(ScorecardSelectionState.NOT_ANNOUNCED);
    }

    // ---- guest names ----

    @Test
    void guestNamesAreDistinctMostRecentFirstFilteredPagedAndNeverTheOpposition() {
        Match older = match(5);
        Match newer = match(1);
        saveList(older, guest(H, "g1", "Sam Guest"), guest(H, "g2", "Tim Guest"), opposition(A, "o1", "Opp Guest"));
        saveList(newer, guest(H, "g1", "sam guest"), guest(H, "g3", "Zed Guest"), registered(H, "p1", fixtures.sectionPlayer(w, w.seniors1(), "Ann").getId()));

        Page<GuestNameDto> all = scorecardService.guestNames(admin, clubId, null, null, PageRequest.of(0, 10));

        assertThat(all.getContent()).extracting(g -> g.displayName().toLowerCase())
                .doesNotContain("opp guest").containsOnly("sam guest", "tim guest", "zed guest");
        assertThat(all.getTotalElements()).isEqualTo(4);
        assertThat(all.getContent()).extracting(GuestNameDto::displayName).contains("Sam Guest", "sam guest");
        // filtering is a case-insensitive contains
        assertThat(scorecardService.guestNames(admin, clubId, null, "ZED", PageRequest.of(0, 10)).getContent())
                .extracting(GuestNameDto::displayName).containsExactly("Zed Guest");
        // paging
        Page<GuestNameDto> page = scorecardService.guestNames(admin, clubId, null, null, PageRequest.of(0, 2));
        assertThat(page.getContent()).hasSize(2);
        assertThat(page.getTotalElements()).isEqualTo(4);
        assertThat(page.getContent()).extracting(GuestNameDto::displayName).doesNotContain("Tim Guest");
        // limited to one of our teams
        assertThat(scorecardService.guestNames(admin, clubId, w.seniors2().getId(), null, PageRequest.of(0, 10))
                .getContent()).isEmpty();
        assertThat(scorecardService.guestNames(admin, clubId, w.seniors1().getId(), null, PageRequest.of(0, 10))
                .getTotalElements()).isEqualTo(4);
    }

    @Test
    void guestNamesNeverCrossTheClub() {
        saveList(match(1), guest(H, "g1", "Sam Guest"));
        World other = fixtures.world();

        assertThat(scorecardService.guestNames(admin, other.club().getId(), null, null, PageRequest.of(0, 10))
                .getContent()).isEmpty();
        assertThat(scorecardService.guestNames(admin, clubId, null, null, PageRequest.of(0, 10)).getContent())
                .extracting(GuestNameDto::displayName).containsExactly("Sam Guest");
    }

    // ---- opposition names ----

    private Match against(World world, LeagueTeam leagueTeam, String teamName, int daysAgo) {
        Match m = fixtures.match(world, world.seniors1(), null, Instant.now().minus(Duration.ofDays(daysAgo)));
        m.setAwayTeamName(teamName);
        m.setAwayLeagueTeamId(leagueTeam == null ? null : leagueTeam.getId());
        return matchRepository.save(m);
    }

    private void saveOpposition(Match m, String... names) {
        ResultPlayerDto[] players = opp(names);
        resultService.upsertDraft(admin, m.getClubId(), m.getId(), new ResultDraft(null, null, null, null, null, null,
                null, null, null, null, null, null, null, null,
                new ScorecardDto(List.of(players), null, null, null, null, null, null)));
    }

    @Test
    void oppositionNamesMatchOnTheLeagueTeamIdMostRecentFirstWithCountsAndExcludeTheCurrentList() {
        League league = fixtures.league(w, 11);
        LeagueTeam hillside = fixtures.leagueTeam(league, w.season(), "Hillside");
        LeagueTeam other = fixtures.leagueTeam(league, w.season(), "Oakwood");
        saveOpposition(against(w, hillside, "Hillside", 30), "Ann Opp", "Bob Opp");
        saveOpposition(against(w, hillside, "Hillside CC (renamed)", 10), "bob opp", "Cal Opp");
        saveOpposition(against(w, other, "Oakwood", 5), "Dan Elsewhere");
        Match current = against(w, hillside, "Hillside", 1);
        saveOpposition(current, "Ann Opp");

        Page<OppositionNameDto> suggestions = scorecardService.oppositionNames(
                admin, clubId, null, null, hillside.getId(), null, null, PageRequest.of(0, 10));

        // most recent fixture first: Bob (twice, last 10 days ago) and Cal, then Ann (30 days); the current list's Ann is
        // also an earlier name, because only an explicit match excludes the current list
        assertThat(suggestions.getContent()).extracting(OppositionNameDto::displayName)
                .doesNotContain("Dan Elsewhere");
        assertThat(suggestions.getContent()).filteredOn(n -> n.displayName().equalsIgnoreCase("Bob Opp")).singleElement()
                .satisfies(n -> assertThat(n.uses()).isEqualTo(2));
        assertThat(suggestions.getContent()).extracting(OppositionNameDto::lastMatchDate).isSortedAccordingTo(
                java.util.Comparator.reverseOrder());

        // read from the match: the same opposition is found and its own names are left out
        Page<OppositionNameDto> forMatch = scorecardService.oppositionNames(
                admin, clubId, current.getId(), null, null, null, null, PageRequest.of(0, 10));
        assertThat(forMatch.getContent()).extracting(n -> n.displayName().toLowerCase())
                .containsExactlyInAnyOrder("bob opp", "cal opp").doesNotContain("ann opp");

        // q filter and paging
        assertThat(scorecardService.oppositionNames(admin, clubId, null, null, hillside.getId(), null, "cal",
                PageRequest.of(0, 10)).getContent()).extracting(OppositionNameDto::displayName).containsExactly("Cal Opp");
        Page<OppositionNameDto> paged = scorecardService.oppositionNames(
                admin, clubId, null, null, hillside.getId(), null, null, PageRequest.of(1, 1));
        assertThat(paged.getContent()).hasSize(1);
        assertThat(paged.getTotalElements()).isEqualTo(3);
    }

    @Test
    void oppositionNamesFallBackToTheNormalisedTeamNameAndNeverReturnOurOwnOrAnotherClubsNames() {
        saveOpposition(against(w, null, "Hillside CC", 20), "Ann Opp");
        Match ours = against(w, null, "Hillside CC", 15);
        resultService.upsertDraft(admin, clubId, ours.getId(), new ResultDraft(null, null, null, null, null, null, null,
                null, null, null, null, null, null, null, new ScorecardDto(
                        List.of(guest(H, "g1", "Our Guest"), registered(H, "p1", fixtures.sectionPlayer(w, w.seniors1(), "Ann").getId())),
                        null, null, null, null, null, null)));
        World other = fixtures.world();
        saveOpposition(against(other, null, "Hillside CC", 10), "Spy Opp");
        saveOpposition(against(w, null, "Another Team", 8), "Different Opp");

        Page<OppositionNameDto> byName = scorecardService.oppositionNames(
                admin, clubId, null, null, null, "  hillside   CC ".replaceAll("\\s+", " "), null, PageRequest.of(0, 10));

        assertThat(byName.getContent()).extracting(OppositionNameDto::displayName).containsExactly("Ann Opp");
        // another club sees only its own
        assertThat(scorecardService.oppositionNames(admin, other.club().getId(), null, null, null, "Hillside CC", null,
                PageRequest.of(0, 10)).getContent()).extracting(OppositionNameDto::displayName).containsExactly("Spy Opp");
        // nothing to go on: an empty page, not every name the club has ever seen
        assertThat(scorecardService.oppositionNames(admin, clubId, null, null, null, null, null, PageRequest.of(0, 10))
                .getContent()).isEmpty();
    }

    @Test
    void oppositionNamesCanBeLimitedToOneOfOurTeams() {
        saveOpposition(against(w, null, "Hillside CC", 3), "Ann Opp");

        assertThat(scorecardService.oppositionNames(admin, clubId, null, w.seniors1().getId(), null, "Hillside CC", null,
                PageRequest.of(0, 10)).getTotalElements()).isEqualTo(1);
        assertThat(scorecardService.oppositionNames(admin, clubId, null, w.seniors2().getId(), null, "Hillside CC", null,
                PageRequest.of(0, 10)).getTotalElements()).isZero();
    }

    // ---- section narrowing ----

    private Match juniorsMatch(int daysAgo) {
        return fixtures.match(w, w.juniorsTeam(), null, Instant.now().minus(Duration.ofDays(daysAgo)));
    }

    private Match juniorsAgainst(String teamName, int daysAgo) {
        Match m = juniorsMatch(daysAgo);
        m.setAwayTeamName(teamName);
        return matchRepository.save(m);
    }

    @Test
    void guestNamesAreNarrowedToTheCallersSectionsAndClubAdminsSeeAll() {
        saveList(match(2), guest(H, "g1", "Sam Senior"));
        saveList(juniorsMatch(1), guest(H, "g1", "Kid Junior"));
        Authentication seniorsManager = new TestingAuthenticationToken(
                fixtures.sectionManagerSubject(w.seniors()), "n/a", "ROLE_manager");
        Authentication juniorsManager = new TestingAuthenticationToken(
                fixtures.sectionManagerSubject(w.juniors()), "n/a", "ROLE_manager");

        assertThat(scorecardService.guestNames(seniorsManager, clubId, null, null, PageRequest.of(0, 10)).getContent())
                .extracting(GuestNameDto::displayName).containsExactly("Sam Senior");
        assertThat(scorecardService.guestNames(juniorsManager, clubId, null, null, PageRequest.of(0, 10)).getContent())
                .extracting(GuestNameDto::displayName).containsExactly("Kid Junior");
        assertThat(scorecardService.guestNames(admin, clubId, null, null, PageRequest.of(0, 10)).getTotalElements())
                .isEqualTo(2);
    }

    @Test
    void aSectionManagerCannotNameATeamOutsideTheirSectionsOrOfAnotherClub() {
        Authentication juniorsManager = new TestingAuthenticationToken(
                fixtures.sectionManagerSubject(w.juniors()), "n/a", "ROLE_manager");
        World other = fixtures.world();

        org.assertj.core.api.Assertions.assertThatThrownBy(() -> scorecardService.guestNames(
                        juniorsManager, clubId, w.seniors1().getId(), null, PageRequest.of(0, 10)))
                .isInstanceOf(org.springframework.security.access.AccessDeniedException.class);
        org.assertj.core.api.Assertions.assertThatThrownBy(() -> scorecardService.oppositionNames(
                        juniorsManager, clubId, null, w.seniors1().getId(), null, "Hillside CC", null,
                        PageRequest.of(0, 10)))
                .isInstanceOf(org.springframework.security.access.AccessDeniedException.class);
        org.assertj.core.api.Assertions.assertThatThrownBy(() -> scorecardService.guestNames(
                        admin, clubId, other.seniors1().getId(), null, PageRequest.of(0, 10)))
                .isInstanceOf(com.cricketlegend.exception.NotFoundException.class);
        assertThat(scorecardService.guestNames(juniorsManager, clubId, w.juniorsTeam().getId(), null,
                PageRequest.of(0, 10)).getContent()).isEmpty();
    }

    @Test
    void oppositionNamesAreNarrowedToTheCallersSections() {
        saveOpposition(against(w, null, "Hillside CC", 3), "Senior Opp");
        saveOpposition(juniorsAgainst("Hillside CC", 2), "Junior Opp");
        Authentication seniorsManager = new TestingAuthenticationToken(
                fixtures.sectionManagerSubject(w.seniors()), "n/a", "ROLE_manager");
        Authentication juniorsManager = new TestingAuthenticationToken(
                fixtures.sectionManagerSubject(w.juniors()), "n/a", "ROLE_manager");

        assertThat(scorecardService.oppositionNames(seniorsManager, clubId, null, null, null, "Hillside CC", null,
                PageRequest.of(0, 10)).getContent()).extracting(OppositionNameDto::displayName)
                .containsExactly("Senior Opp");
        assertThat(scorecardService.oppositionNames(juniorsManager, clubId, null, null, null, "Hillside CC", null,
                PageRequest.of(0, 10)).getContent()).extracting(OppositionNameDto::displayName)
                .containsExactly("Junior Opp");
        assertThat(scorecardService.oppositionNames(admin, clubId, null, null, null, "Hillside CC", null,
                PageRequest.of(0, 10)).getTotalElements()).isEqualTo(2);
    }
}
