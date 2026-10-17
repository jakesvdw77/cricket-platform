package com.cricketlegend.service;

import static com.cricketlegend.support.ScorecardDtos.award;
import static com.cricketlegend.support.ScorecardDtos.bat;
import static com.cricketlegend.support.ScorecardDtos.by;
import static com.cricketlegend.support.ScorecardDtos.derived;
import static com.cricketlegend.support.ScorecardDtos.field;
import static com.cricketlegend.support.ScorecardDtos.figures;
import static com.cricketlegend.support.ScorecardDtos.guest;
import static com.cricketlegend.support.ScorecardDtos.inKind;
import static com.cricketlegend.support.ScorecardDtos.opposition;
import static com.cricketlegend.support.ScorecardDtos.override;
import static com.cricketlegend.support.ScorecardDtos.registered;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.cricketlegend.AbstractIntegrationTest;
import com.cricketlegend.domain.AwardType;
import com.cricketlegend.domain.CreditSource;
import com.cricketlegend.domain.DismissalType;
import com.cricketlegend.domain.FeaturedOverride;
import com.cricketlegend.domain.InningsKind;
import com.cricketlegend.domain.Match;
import com.cricketlegend.domain.PlayerProfile;
import com.cricketlegend.domain.ResultDetailLevel;
import com.cricketlegend.domain.ResultOutcomeType;
import com.cricketlegend.domain.ResultSide;
import com.cricketlegend.domain.ResultStatus;
import com.cricketlegend.domain.ScorecardStatus;
import com.cricketlegend.dto.BattingEntryDto;
import com.cricketlegend.dto.BowlingEntryDto;
import com.cricketlegend.dto.FieldingEntryDto;
import com.cricketlegend.dto.InningsDto;
import com.cricketlegend.dto.MatchResultDto;
import com.cricketlegend.dto.ResultDraft;
import com.cricketlegend.dto.ResultIssueDto;
import com.cricketlegend.dto.ResultListCriteria;
import com.cricketlegend.dto.ResultListItemDto;
import com.cricketlegend.dto.ResultPlayerDto;
import com.cricketlegend.dto.ResultValidationDto;
import com.cricketlegend.dto.ScorecardDto;
import com.cricketlegend.exception.InvalidResultException;
import com.cricketlegend.exception.OppositionPlayerNotLinkableException;
import com.cricketlegend.exception.PlayerAlreadyInResultException;
import com.cricketlegend.exception.ResultPublishedException;
import com.cricketlegend.exception.ValidationException;
import com.cricketlegend.service.ResultService;
import com.cricketlegend.support.ManagerOverviewFixtures;
import com.cricketlegend.support.ManagerOverviewFixtures.World;
import com.cricketlegend.support.ScorecardCard;
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
import org.springframework.data.domain.PageRequest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.core.Authentication;

/**
 * Service-tier integration tests for docs/specs/101-match-results-our-side-scorecard.md against real Postgres,
 * deliberately without an ambient transaction (so {@code open-in-view=false} and the per-call transaction boundaries
 * are the real ones): a team list with no innings and no outcome, partial innings figures, in-place innings
 * reconcile across a re-save and a toss-driven resequence, rows with no how-out, the derived credits recomputed in the
 * save transaction, the derby round trip, removal of an opposition row, standouts frozen at publish, the link route.
 */
@SpringBootTest
@Import(AbstractIntegrationTest.class)
class ScorecardResultIntegrationTest {

    private static final ResultSide H = ResultSide.HOME;
    private static final ResultSide A = ResultSide.AWAY;
    private static final ResultListCriteria NO_FILTERS =
            new ResultListCriteria(null, null, null, null, null, null, null, null, null, null);

    @Autowired
    private ResultService resultService;

    @Autowired
    private ScorecardService scorecardService;

    @Autowired
    private JdbcTemplate jdbc;

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

    // ---- helpers ----

    private Match vsOpposition() {
        return fixtures.match(w, w.seniors1(), null, Instant.now().minus(Duration.ofDays(1)));
    }

    private Match derbyMatch() {
        return fixtures.match(w, w.seniors1(), w.seniors2(), Instant.now().minus(Duration.ofDays(1)));
    }

    private ScorecardCard realise(ScorecardCard card) {
        return card.realise(key -> fixtures.sectionPlayer(w, w.seniors1(), key).getId());
    }

    private MatchResultDto save(Match match, ScorecardCard card) {
        return resultService.upsertDraft(admin, clubId, match.getId(), card.draft());
    }

    private ScorecardDto read(Match match) {
        return scorecardService.read(admin, clubId, match.getId());
    }

    private static ResultDraft listOnly(ResultPlayerDto... players) {
        return new ResultDraft(null, null, null, null, null, null, null, null, null, null, null, null, null, null,
                new ScorecardDto(List.of(players), null, null, null, null, null, null));
    }

    private static ResultDraft withInnings(ScorecardCard card, List<InningsDto> innings, ScorecardDto scorecard) {
        ResultDraft d = card.draft();
        return new ResultDraft(d.outcomeType(), d.decidedBy(), d.winningSide(), d.marginType(), d.marginValue(), null,
                null, null, null, null, null, null, null, innings, scorecard);
    }

    private static InningsDto resequenced(InningsDto i, int sequence) {
        return new InningsDto(sequence, i.kind(), i.battingSide(), i.runs(), i.wickets(), i.balls(), null, null, null,
                i.wides(), i.noBalls(), i.byes(), i.legByes(), i.penaltyRuns(), i.nonBowlerWickets());
    }

    private UUID playerId(ScorecardDto read, UUID profileId) {
        return read.players().stream().filter(p -> profileId.equals(p.playerProfileId())).findFirst().orElseThrow().id();
    }

    private UUID playerId(ScorecardDto read, String displayName) {
        return read.players().stream().filter(p -> displayName.equals(p.displayName())).findFirst().orElseThrow().id();
    }

    private static InvalidResultException invalid(Runnable action) {
        try {
            action.run();
        } catch (InvalidResultException e) {
            return e;
        }
        throw new AssertionError("expected an InvalidResultException");
    }

    private static List<String> codes(InvalidResultException e) {
        return e.getIssues().stream().map(ResultIssueDto::code).toList();
    }

    // ---- a team list on its own, and the detail level ----

    @Test
    void aTeamListWithNoInningsAndNoOutcomeSavesReadsBackAndShowsInTheResultsList() {
        Match match = vsOpposition();
        PlayerProfile ann = fixtures.sectionPlayer(w, w.seniors1(), "Ann");

        MatchResultDto saved = resultService.upsertDraft(admin, clubId, match.getId(),
                listOnly(registered(H, "p1", ann.getId()), opposition(A, "o1", "Smith")));

        assertThat(saved.status()).isEqualTo(ResultStatus.DRAFT);
        assertThat(saved.outcomeType()).isNull();
        assertThat(saved.innings()).isEmpty();
        assertThat(saved.hasScorecard()).isTrue();
        assertThat(saved.hasOppositionScorecard()).isTrue();
        ScorecardDto read = read(match);
        assertThat(read.players()).extracting(ResultPlayerDto::side).containsExactlyInAnyOrder(H, A);
        assertThat(read.status()).extracting(s -> s.status()).containsOnly(ScorecardStatus.PARTIAL);
        assertThat(resultService.get(admin, clubId, match.getId()).hasScorecard()).isTrue();
        assertThat(resultService.list(admin, clubId, NO_FILTERS, PageRequest.of(0, 10)).getContent())
                .singleElement().satisfies(item -> assertThat(item.result().hasScorecard()).isTrue());
        // it cannot be published without an outcome
        assertThat(codes(invalid(() -> resultService.publish(admin, clubId, match.getId(), true))))
                .contains("OUTCOME_MISSING");
    }

    @Test
    void detailLevelFollowsTheTeamListsAndIsNeverFullInADerby() {
        Match match = vsOpposition();
        MatchResultDto summary = resultService.upsertDraft(admin, clubId, match.getId(),
                new ResultDraft(null, null, null, null, null, null, null, null, null, null, null, null, null, null));
        assertThat(summary.detailLevel()).isEqualTo(ResultDetailLevel.SUMMARY);

        PlayerProfile ann = fixtures.sectionPlayer(w, w.seniors1(), "Ann");
        assertThat(resultService.upsertDraft(admin, clubId, match.getId(), listOnly(registered(H, "p1", ann.getId())))
                .detailLevel()).isEqualTo(ResultDetailLevel.OUR_SIDE);
        assertThat(resultService.upsertDraft(admin, clubId, match.getId(),
                listOnly(registered(H, "p1", ann.getId()), opposition(A, "o1", "Smith"))).detailLevel())
                .isEqualTo(ResultDetailLevel.FULL);
        // a save that leaves the scorecard untouched keeps the level
        assertThat(resultService.upsertDraft(admin, clubId, match.getId(),
                new ResultDraft(ResultOutcomeType.ABANDONED, null, null, null, null, null, null, null, null, null, null,
                        null, null, null)).detailLevel()).isEqualTo(ResultDetailLevel.FULL);
        // an opposition-only list is saved (as a draft that cannot be published)
        assertThat(resultService.upsertDraft(admin, clubId, match.getId(), listOnly(opposition(A, "o1", "Smith")))
                .detailLevel()).isEqualTo(ResultDetailLevel.FULL);

        Match derby = derbyMatch();
        PlayerProfile bob = fixtures.sectionPlayer(w, w.seniors1(), "Bob");
        assertThat(resultService.upsertDraft(admin, clubId, derby.getId(),
                listOnly(registered(H, "p1", ann.getId()), registered(A, "p2", bob.getId()))).detailLevel())
                .isEqualTo(ResultDetailLevel.OUR_SIDE);
    }

    @Test
    void anOppositionRowIsRefusedWhereTheSideIsOursAndAnOursRowWhereItIsNot() {
        PlayerProfile ann = fixtures.sectionPlayer(w, w.seniors1(), "Ann");
        Match derby = derbyMatch();
        assertThat(codes(invalid(() -> resultService.upsertDraft(admin, clubId, derby.getId(),
                listOnly(opposition(A, "o1", "Smith")))))).containsExactly("OPPOSITION_NOT_ALLOWED");

        Match match = vsOpposition();
        assertThat(codes(invalid(() -> resultService.upsertDraft(admin, clubId, match.getId(),
                listOnly(opposition(H, "o1", "Smith")))))).containsExactly("OPPOSITION_NOT_ALLOWED");
        assertThat(codes(invalid(() -> resultService.upsertDraft(admin, clubId, match.getId(),
                listOnly(registered(A, "p1", ann.getId())))))).containsExactly("SCORECARD_PLAYER_NOT_OURS");
        assertThat(codes(invalid(() -> resultService.upsertDraft(admin, clubId, match.getId(),
                listOnly(guest(A, "p1", "Sam")))))).containsExactly("SCORECARD_PLAYER_NOT_OURS");
    }

    @Test
    void aPlayerOfAnotherClubIsRefused() {
        World other = fixtures.world();
        PlayerProfile stranger = fixtures.player(other, "Stranger", true);
        Match match = vsOpposition();

        assertThat(codes(invalid(() -> resultService.upsertDraft(admin, clubId, match.getId(),
                listOnly(registered(H, "p1", stranger.getId())))))).containsExactly("SCORECARD_PLAYER_OTHER_CLUB");
    }

    @Test
    void aSuperOverEntryIsRefusedButSuperOverTotalsStillSave() {
        Match match = vsOpposition();
        ScorecardCard card = realise(ScorecardCard.oursBat()).batting("b1", e -> inKind(e, InningsKind.SUPER_OVER));

        assertThat(codes(invalid(() -> save(match, card)))).contains("SCORECARD_SUPER_OVER_NOT_SUPPORTED");
        assertThat(jdbc.queryForObject("select count(*) from match_result where match_id = ?", Integer.class,
                match.getId())).isZero();
    }

    // ---- innings reconcile in place ----

    @Test
    void entriesSurviveAReSaveAndATossDrivenResequenceBecauseInningsAreReconciledInPlace() {
        Match match = vsOpposition();
        ScorecardCard card = realise(ScorecardCard.oursBat());
        MatchResultDto first = save(match, card);
        List<UUID> inningsIds = jdbc.queryForList(
                "select id from match_innings where match_result_id = ? order by batting_side", UUID.class, first.id());
        int battingBefore = jdbc.queryForObject("select count(*) from batting_entry", Integer.class);
        assertThat(inningsIds).hasSize(2);

        // re-saving the Scores step (the scorecard untouched) deletes nothing
        resultService.upsertDraft(admin, clubId, match.getId(), withInnings(card, card.draft().innings(), null));
        // the toss flips the batting order: the two innings swap sequence numbers
        resultService.upsertDraft(admin, clubId, match.getId(), withInnings(card,
                List.of(resequenced(card.second, 1), resequenced(card.first, 2)), null));

        assertThat(jdbc.queryForList("select id from match_innings where match_result_id = ? order by batting_side",
                UUID.class, first.id())).containsExactlyElementsOf(inningsIds);
        assertThat(jdbc.queryForObject("select sequence from match_innings where match_result_id = ? and batting_side = 'HOME'",
                Integer.class, first.id())).isEqualTo(2);
        assertThat(jdbc.queryForObject("select count(*) from batting_entry", Integer.class)).isEqualTo(battingBefore);
        ScorecardDto read = read(match);
        assertThat(read.batting()).hasSize(11);
        assertThat(read.bowling()).hasSize(5);
        assertThat(read.batting()).extracting(BattingEntryDto::battingSide).containsOnly(H);
    }

    @Test
    void partialInningsFiguresPersistAndEntriesSurviveFillingThemInLater() {
        Match match = vsOpposition();
        ScorecardCard card = realise(ScorecardCard.oursBat()).firstInnings(200, null, null);
        card.second = new InningsDto(2, InningsKind.REGULAR, A, null, null, null, null, null, null);

        MatchResultDto saved = save(match, card);

        assertThat(saved.innings()).hasSize(2);
        assertThat(saved.innings().get(0).runs()).isEqualTo(200);
        assertThat(saved.innings().get(0).wickets()).isNull();
        assertThat(saved.innings().get(0).balls()).isNull();
        assertThat(saved.innings().get(1).runs()).isNull();
        assertThat(read(match).batting()).hasSize(11);
        // publishing needs the figures
        assertThat(codes(invalid(() -> resultService.publish(admin, clubId, match.getId(), true))))
                .contains("INNINGS_FIGURES_MISSING");

        // filling the figures in later (the scorecard untouched) keeps every entry
        MatchResultDto filled = resultService.upsertDraft(admin, clubId, match.getId(), withInnings(card.firstInnings(200, 8, 120),
                List.of(card.first, new InningsDto(2, InningsKind.REGULAR, A, 150, 10, 120, null, null, null)), null));
        assertThat(filled.innings().get(0).wickets()).isEqualTo(8);
        assertThat(filled.innings().get(1).runs()).isEqualTo(150);
        assertThat(read(match).batting()).hasSize(11);
        assertThat(read(match).bowling()).hasSize(5);
    }

    @Test
    void removingAnInningsRemovesItsEntries() {
        Match match = vsOpposition();
        ScorecardCard card = realise(ScorecardCard.oursBat());
        MatchResultDto saved = save(match, card);

        resultService.upsertDraft(admin, clubId, match.getId(),
                withInnings(card, List.of(card.second), new ScorecardDto(card.players, null, null, null, null, null, null)));

        assertThat(jdbc.queryForObject("select count(*) from match_innings where match_result_id = ?", Integer.class,
                saved.id())).isEqualTo(1);
        assertThat(read(match).batting()).isEmpty();
        assertThat(read(match).bowling()).isEmpty();
    }

    // ---- rows with no how-out ----

    @Test
    void aBattingRowWithNoHowOutPersistsAndPublishingRefusesIt() {
        Match match = vsOpposition();
        ScorecardCard card = realise(ScorecardCard.oursBat()).batting("b9", e -> bat(H, "b9", null, 3, null, 9));

        save(match, card);

        assertThat(read(match).batting()).anySatisfy(e -> {
            assertThat(e.howOut()).isNull();
            assertThat(e.runs()).isEqualTo(3);
        });
        InvalidResultException e = invalid(() -> resultService.publish(admin, clubId, match.getId(), true));
        assertThat(codes(e)).contains("HOW_OUT_MISSING");
        assertThat(resultService.get(admin, clubId, match.getId()).status()).isEqualTo(ResultStatus.DRAFT);
    }

    // ---- the whole-scorecard replace ----

    @Test
    void replacingTheScorecardIsIdempotentAndAFailedSaveLeavesTheStoredOneUntouched() {
        Match match = vsOpposition();
        ScorecardCard card = realise(ScorecardCard.oursBat());
        save(match, card);
        ScorecardDto once = read(match);
        // the stored scorecard re-sent with its ids changes nothing
        ScorecardDto sent = new ScorecardDto(once.players(), once.batting(), once.bowling(), once.fielding(),
                once.awards(), null, null);
        resultService.upsertDraft(admin, clubId, match.getId(), withInnings(card, card.draft().innings(), sent));
        ScorecardDto twice = read(match);
        assertThat(twice.players()).extracting(ResultPlayerDto::id)
                .containsExactlyInAnyOrderElementsOf(once.players().stream().map(ResultPlayerDto::id).toList());
        assertThat(twice.batting()).hasSameSizeAs(once.batting());
        assertThat(twice.bowling()).hasSameSizeAs(once.bowling());

        // a body naming another club's player is refused whole
        World other = fixtures.world();
        PlayerProfile stranger = fixtures.player(other, "Stranger", true);
        ScorecardCard bad = realise(ScorecardCard.oursBat()).player("b1", p -> registered(H, "b1", stranger.getId()));
        invalid(() -> save(match, bad));
        assertThat(read(match).players()).extracting(ResultPlayerDto::id)
                .containsExactlyInAnyOrderElementsOf(once.players().stream().map(ResultPlayerDto::id).toList());
        assertThat(read(match).batting()).hasSameSizeAs(once.batting());
    }

    // ---- derived credits ----

    @Test
    void derivedCreditsAreRecomputedInTheSaveTransactionAndManualOnesAreNeverTouched() {
        Match match = derbyMatch();
        ScorecardCard card = realise(ScorecardCard.derby());
        card.batting("b1", e -> by(bat(H, "b1", DismissalType.CAUGHT, 50, null, 1), "w1", "w6"));
        card.batting("b8", e -> bat(H, "b8", DismissalType.RETIRED_OUT, 5, null, 8));
        card.bowling("w1", e -> derived(figures(e, 24, 0, 39, 99)));
        card.bowling("w5", e -> figures(e, 24, 0, 39, 0));
        card.fielding.add(field(H, "w8", 5, 0, 0));
        UUID w6 = card.profiles.get("w6");
        UUID w1 = card.profiles.get("w1");
        UUID w8 = card.profiles.get("w8");

        save(match, card);

        ScorecardDto once = read(match);
        // w1's DERIVED wickets are what the dismissals credit (b1 caught, b2 bowled), not the typed 99
        assertThat(once.bowling()).filteredOn(b -> b.resultPlayerId().equals(playerId(once, w1))).singleElement()
                .satisfies(b -> {
                    assertThat(b.wickets()).isEqualTo(2);
                    assertThat(b.wicketsSource()).isEqualTo(CreditSource.DERIVED);
                    assertThat(b.derivedWickets()).isEqualTo(2);
                });
        // w6 had no fielding row and gets a DERIVED one at one catch; w8's MANUAL row is as typed
        assertThat(once.fielding()).filteredOn(f -> f.resultPlayerId().equals(playerId(once, w6))).singleElement()
                .satisfies(f -> {
                    assertThat(f.catches()).isEqualTo(1);
                    assertThat(f.creditsSource()).isEqualTo(CreditSource.DERIVED);
                });
        assertThat(once.fielding()).filteredOn(f -> f.resultPlayerId().equals(playerId(once, w8))).singleElement()
                .satisfies(f -> {
                    assertThat(f.catches()).isEqualTo(5);
                    assertThat(f.creditsSource()).isEqualTo(CreditSource.MANUAL);
                });
        // the retired-out batter is a counted non-bowler wicket, derived from the batting rows
        assertThat(once.innings()).filteredOn(i -> i.battingSide() == H).singleElement().satisfies(i -> {
            assertThat(i.nonBowlerWickets()).isEqualTo(1);
            assertThat(i.nonBowlerWicketsDerived()).isTrue();
        });

        // saving again is idempotent
        resultService.upsertDraft(admin, clubId, match.getId(), withInnings(card, card.draft().innings(),
                new ScorecardDto(once.players(), once.batting(), once.bowling(), once.fielding(), once.awards(), null, null)));
        assertThat(read(match).fielding()).hasSameSizeAs(once.fielding());
    }

    @Test
    void aDerivedFieldingRowWhoseCreditsFallToZeroIsRemovedOnTheNextSave() {
        Match match = vsOpposition();
        ScorecardCard card = realise(ScorecardCard.oursBat())
                .batting("b1", e -> by(bat(H, "b1", DismissalType.CAUGHT, 50, null, 1), "w1", "w6"));
        card.bowling("w1", e -> derived(figures(e, 24, 0, 39, 0)));
        save(match, card);
        assertThat(jdbc.queryForObject("select count(*) from fielding_entry where credits_source = 'DERIVED'",
                Integer.class)).isEqualTo(1);

        ScorecardDto stored = read(match);
        // keep the stored rows (ids) for the unchanged part and replace only the dismissal
        List<BattingEntryDto> batting = stored.batting().stream().map(e -> e.howOut() == DismissalType.CAUGHT
                ? new BattingEntryDto(e.id(), e.battingSide(), e.inningsKind(), e.resultPlayerId(), null, e.position(),
                        DismissalType.BOWLED, e.runs(), e.balls(), e.fours(), e.sixes(), e.bowlerPlayerId(), null, null,
                        null, null)
                : e).toList();
        resultService.upsertDraft(admin, clubId, match.getId(), withInnings(card, card.draft().innings(),
                new ScorecardDto(stored.players(), batting, stored.bowling(), stored.fielding(), stored.awards(), null,
                        null)));

        assertThat(jdbc.queryForObject("select count(*) from fielding_entry where credits_source = 'DERIVED'",
                Integer.class)).isZero();
    }

    // ---- removing an opposition player ----

    @Test
    void removingAnOppositionRowClearsTheDismissalsCascadesItsRowsAndTheAwardKeepsItsName() {
        Match match = vsOpposition();
        ScorecardCard card = realise(ScorecardCard.oursBat());
        card.awards.add(award(AwardType.PLAYER_OF_MATCH, A, "w1"));
        save(match, card);
        ScorecardDto saved = read(match);
        UUID w1 = playerId(saved, "Bowler 1");
        assertThat(saved.awards()).singleElement().satisfies(a -> assertThat(a.playerName()).isEqualTo("Bowler 1"));
        assertThat(jdbc.queryForObject("select count(*) from batting_entry where bowler_result_player_id = ?",
                Integer.class, w1)).isEqualTo(2);

        jdbc.update("delete from result_player where id = ?", w1);

        assertThat(jdbc.queryForObject("select count(*) from batting_entry where bowler_result_player_id = ?",
                Integer.class, w1)).isZero();
        assertThat(jdbc.queryForObject("select count(*) from batting_entry where how_out = 'BOWLED'", Integer.class))
                .isEqualTo(8);
        assertThat(jdbc.queryForObject("select count(*) from bowling_entry where result_player_id = ?", Integer.class, w1))
                .isZero();
        ScorecardDto after = read(match);
        assertThat(after.awards()).singleElement().satisfies(a -> {
            assertThat(a.playerName()).isEqualTo("Bowler 1");
            assertThat(a.resultPlayerId()).isNull();
        });
    }

    @Test
    void anAwardNameIsTheRegisteredPlayersNameAndAFreeTextOfficialKeepsTheTypedOne() {
        Match match = vsOpposition();
        ScorecardCard card = realise(ScorecardCard.oursBat());
        card.awards.add(award(AwardType.TEAM_PLAYER_OF_MATCH, H, "b1"));
        card.awards.add(com.cricketlegend.support.ScorecardDtos.namedAward(AwardType.PLAYER_OF_MATCH, A, "Sam Opp"));

        save(match, card);

        assertThat(read(match).awards()).extracting(a -> a.awardType() + ":" + a.playerName())
                .containsExactlyInAnyOrder("TEAM_PLAYER_OF_MATCH:b1 Player", "PLAYER_OF_MATCH:Sam Opp");
        assertThat(resultService.list(admin, clubId, NO_FILTERS, PageRequest.of(0, 10)).getContent())
                .singleElement().extracting(ResultListItemDto::playerOfTheMatch).isEqualTo("Sam Opp");
    }

    // ---- the derby ----

    @Test
    void aDerbyRoundTripsWithOneOfficialAndTwoTeamAwardsAndDismissalsBetweenTheTwoLists() {
        Match match = derbyMatch();
        ScorecardCard card = realise(ScorecardCard.derby())
                .batting("b1", e -> by(bat(H, "b1", DismissalType.CAUGHT, 50, null, 1), "w1", "w6"));
        card.awards.add(award(AwardType.PLAYER_OF_MATCH, A, "w1"));
        card.awards.add(award(AwardType.TEAM_PLAYER_OF_MATCH, H, "b1"));
        card.awards.add(award(AwardType.TEAM_PLAYER_OF_MATCH, A, "w2"));

        MatchResultDto saved = save(match, card);

        assertThat(saved.detailLevel()).isEqualTo(ResultDetailLevel.OUR_SIDE);
        assertThat(saved.hasOppositionScorecard()).isFalse();
        ScorecardDto read = read(match);
        assertThat(read.awards()).hasSize(3);
        assertThat(read.players()).hasSize(22);
        // the dismissal between two registered lists derived the registered bowler's wicket and the fielder's catch
        UUID w6 = playerId(read, card.profiles.get("w6"));
        assertThat(read.batting()).filteredOn(e -> e.howOut() == DismissalType.CAUGHT).singleElement()
                .satisfies(e -> {
                    assertThat(e.fielderPlayerId()).isEqualTo(w6.toString());
                    assertThat(e.bowlerPlayerId()).isEqualTo(playerId(read, card.profiles.get("w1")).toString());
                });
        assertThat(read.fielding()).anySatisfy(f -> {
            assertThat(f.resultPlayerId()).isEqualTo(w6);
            assertThat(f.derivedCatches()).isEqualTo(1);
        });
        // each side only has one of its two halves (batting or bowling) entered
        assertThat(read.status()).extracting(s -> s.status()).containsOnly(ScorecardStatus.PARTIAL);
        // it publishes
        assertThat(resultService.publish(admin, clubId, match.getId(), false).status()).isEqualTo(ResultStatus.PUBLISHED);
    }

    @Test
    void aPlayerOnBothSidesOfADerbyNeedsAnAcknowledgementToPublish() {
        Match match = derbyMatch();
        PlayerProfile shared = fixtures.sectionPlayer(w, w.seniors1(), "Shared");
        ScorecardCard card = realise(ScorecardCard.derby());
        card.player("b11", p -> registered(H, "b11", shared.getId()));
        card.player("w11", p -> registered(A, "w11", shared.getId()));
        save(match, card);

        ResultValidationDto validation = resultService.validate(admin, clubId, match.getId(), null);
        assertThat(validation.issues()).extracting(ResultIssueDto::code).contains("PLAYER_ON_BOTH_SIDES");
        InvalidResultException unacknowledged = invalid(() -> resultService.publish(admin, clubId, match.getId(), false));
        assertThat(unacknowledged.getWarnings()).isNotEmpty();
        assertThat(resultService.publish(admin, clubId, match.getId(), true).status()).isEqualTo(ResultStatus.PUBLISHED);
    }

    // ---- standouts ----

    @Test
    void standoutsAreSuggestedWithOverridesFrozenAtPublishAndClearedAtUnpublish() {
        Match match = derbyMatch();
        ScorecardCard card = realise(ScorecardCard.derby());
        card.batting("b1", e -> override(e, FeaturedOverride.HIDE));
        card.batting("b3", e -> override(e, FeaturedOverride.FEATURE));
        card.batting("b11", e -> override(e, FeaturedOverride.FEATURE));
        card.bowling("w5", e -> com.cricketlegend.support.ScorecardDtos.override(e, FeaturedOverride.FEATURE));
        save(match, card);

        ScorecardDto draft = read(match);
        BattingEntryDto b1 = batter(draft, "b1");
        assertThat(b1.suggested()).isTrue();
        assertThat(b1.featured()).as("hidden").isFalse();
        assertThat(batter(draft, "b2").suggested()).as("20% is not a quarter").isFalse();
        assertThat(batter(draft, "b3").featured()).as("added by the manager").isTrue();
        assertThat(batter(draft, "b11").suggested()).as("did not bat").isFalse();
        assertThat(batter(draft, "b11").featured()).isFalse();
        assertThat(draft.bowling()).filteredOn(b -> b.suggested()).hasSize(3);
        assertThat(draft.bowling()).filteredOn(b -> b.featured()).hasSize(4);
        assertThat(jdbc.queryForObject("select count(*) from batting_entry where featured is not null", Integer.class))
                .as("a draft stores only the override").isZero();

        resultService.publish(admin, clubId, match.getId(), false);

        assertThat(jdbc.queryForObject("select count(*) from batting_entry where featured is null", Integer.class))
                .isZero();
        assertThat(jdbc.queryForObject("select count(*) from batting_entry where featured = true", Integer.class))
                .isEqualTo(batterFeatured(read(match)));
        assertThat(batter(read(match), "b1").featured()).isFalse();

        resultService.unpublish(admin, clubId, match.getId());

        assertThat(jdbc.queryForObject("select count(*) from batting_entry where featured is not null", Integer.class))
                .isZero();
        assertThat(jdbc.queryForObject("select count(*) from bowling_entry where featured is not null", Integer.class))
                .isZero();
        assertThat(jdbc.queryForObject("select count(*) from batting_entry where featured_override is not null",
                Integer.class)).as("overrides are kept").isEqualTo(3);
        // and an override survives a re-save of the stored scorecard
        ScorecardDto stored = read(match);
        resultService.upsertDraft(admin, clubId, match.getId(), withInnings(card, card.draft().innings(),
                new ScorecardDto(stored.players(), stored.batting(), stored.bowling(), stored.fielding(), stored.awards(),
                        null, null)));
        assertThat(batter(read(match), "b1").featured()).isFalse();
    }

    private BattingEntryDto batter(ScorecardDto read, String key) {
        // the derby card's batters are registered "<key> Player"; their rows are found through their player
        UUID id = read.players().stream().filter(p -> key.equals(p.firstName())).findFirst().orElseThrow().id();
        return read.batting().stream().filter(e -> e.resultPlayerId().equals(id)).findFirst().orElseThrow();
    }

    private long batterFeatured(ScorecardDto read) {
        return read.batting().stream().filter(BattingEntryDto::featured).count();
    }

    @Test
    void theOppositionIsNeverASuggestionAndCarriesNoFeaturedFlag() {
        Match match = vsOpposition();
        save(match, realise(ScorecardCard.oursBat()));

        ScorecardDto read = read(match);

        assertThat(read.bowling()).allSatisfy(b -> {
            assertThat(b.suggested()).isNull();
            assertThat(b.featured()).isNull();
        });
        assertThat(read.batting()).allSatisfy(b -> assertThat(b.suggested()).isNotNull());
    }

    // ---- the link route ----

    private String managerSubject() {
        return fixtures.sectionManagerSubject(w.seniors());
    }

    @Test
    void aGuestIsLinkedOnADraftAndOnAPublishedResultAndOnlyThatWriteIsAllowedThere() {
        Match match = vsOpposition();
        ScorecardCard card = realise(ScorecardCard.oursBat());
        card.player("b11", p -> guest(H, "b11", "Sam Guest"));
        card.players.add(guest(H, "g2", "Tim Guest"));
        save(match, card);
        String subject = managerSubject();
        Authentication manager = new TestingAuthenticationToken(subject, "n/a");
        UUID person = jdbc.queryForObject("select id from person where keycloak_user_id = ?", UUID.class, subject);
        PlayerProfile sam = fixtures.sectionPlayer(w, w.seniors1(), "Sam");
        PlayerProfile tim = fixtures.sectionPlayer(w, w.seniors1(), "Tim");
        ScorecardDto stored = read(match);

        ResultPlayerDto linked = scorecardService.link(manager, clubId, match.getId(), playerId(stored, "Sam Guest"),
                sam.getId());

        assertThat(linked.playerProfileId()).isEqualTo(sam.getId());
        assertThat(linked.linkedBy()).isEqualTo(person);
        assertThat(linked.linkedAt()).isNotNull();
        assertThat(linked.firstName()).isEqualTo("Sam");
        // the entries stayed attached to the same row
        assertThat(read(match).batting()).hasSize(11);

        resultService.publish(admin, clubId, match.getId(), true);
        ResultPlayerDto afterPublish = scorecardService.link(manager, clubId, match.getId(), playerId(stored, "Tim Guest"),
                tim.getId());
        assertThat(afterPublish.linkedBy()).isEqualTo(person);
        assertThatThrownBy(() -> resultService.upsertDraft(admin, clubId, match.getId(), card.draft()))
                .isInstanceOf(ResultPublishedException.class);
    }

    @Test
    void theLinkRouteRefusesTheOppositionAnAlreadyLinkedPlayerAForeignProfileAndADuplicateOnTheSide() {
        Match match = vsOpposition();
        ScorecardCard card = realise(ScorecardCard.oursBat());
        card.player("b11", p -> guest(H, "b11", "Sam Guest"));
        save(match, card);
        ScorecardDto stored = read(match);
        UUID guestId = playerId(stored, "Sam Guest");
        PlayerProfile sam = fixtures.sectionPlayer(w, w.seniors1(), "Sam");
        World other = fixtures.world();
        PlayerProfile stranger = fixtures.player(other, "Stranger", true);

        assertThatThrownBy(() -> scorecardService.link(admin, clubId, match.getId(), playerId(stored, "Bowler 1"), sam.getId()))
                .isInstanceOf(OppositionPlayerNotLinkableException.class);
        assertThatThrownBy(() -> scorecardService.link(admin, clubId, match.getId(), guestId, stranger.getId()))
                .isInstanceOf(ValidationException.class).hasMessageContaining("does not belong to this club");
        assertThatThrownBy(() -> scorecardService.link(admin, clubId, match.getId(), guestId, card.profiles.get("b1")))
                .isInstanceOf(PlayerAlreadyInResultException.class);
        assertThatThrownBy(() -> scorecardService.link(admin, clubId, match.getId(), playerId(stored, card.profiles.get("b2")),
                sam.getId())).isInstanceOf(ValidationException.class).hasMessageContaining("already linked");
        scorecardService.link(admin, clubId, match.getId(), guestId, sam.getId());
        // and nothing was written by the refused calls
        assertThat(jdbc.queryForObject("select count(*) from result_player where linked_at is not null", Integer.class))
                .isEqualTo(1);
    }

    @Test
    void theLinkRouteBelongsToTheClubAndSectionOfTheMatch() {
        Match match = vsOpposition();
        ScorecardCard card = realise(ScorecardCard.oursBat());
        card.player("b11", p -> guest(H, "b11", "Sam Guest"));
        save(match, card);
        UUID guestId = playerId(read(match), "Sam Guest");
        PlayerProfile sam = fixtures.sectionPlayer(w, w.seniors1(), "Sam");
        World other = fixtures.world();
        Authentication otherClub = new TestingAuthenticationToken(fixtures.sectionManagerSubject(other.seniors()), "n/a");
        Authentication juniors = new TestingAuthenticationToken(fixtures.sectionManagerSubject(w.juniors()), "n/a");

        assertThatThrownBy(() -> scorecardService.link(otherClub, other.club().getId(), match.getId(), guestId, sam.getId()))
                .isInstanceOf(RuntimeException.class);
        assertThatThrownBy(() -> scorecardService.link(otherClub, clubId, match.getId(), guestId, sam.getId()))
                .isInstanceOf(RuntimeException.class);
        assertThatThrownBy(() -> scorecardService.link(juniors, clubId, match.getId(), guestId, sam.getId()))
                .isInstanceOf(org.springframework.security.access.AccessDeniedException.class);
        assertThat(jdbc.queryForObject("select count(*) from result_player where linked_at is not null", Integer.class))
                .isZero();
    }

    @Test
    void readingAndSavingAScorecardAreNarrowedToTheCallersSections() {
        Match match = vsOpposition();
        save(match, realise(ScorecardCard.oursBat()));
        Authentication juniors = new TestingAuthenticationToken(fixtures.sectionManagerSubject(w.juniors()), "n/a");
        Authentication seniors = new TestingAuthenticationToken(managerSubject(), "n/a");

        assertThatThrownBy(() -> scorecardService.read(juniors, clubId, match.getId()))
                .isInstanceOf(org.springframework.security.access.AccessDeniedException.class);
        assertThatThrownBy(() -> scorecardService.prefill(juniors, clubId, match.getId()))
                .isInstanceOf(org.springframework.security.access.AccessDeniedException.class);
        assertThatThrownBy(() -> resultService.upsertDraft(juniors, clubId, match.getId(), listOnly()))
                .isInstanceOf(org.springframework.security.access.AccessDeniedException.class);
        assertThat(scorecardService.read(seniors, clubId, match.getId()).players()).hasSize(22);
    }

    // ---- docs/specs/113: section and age of the registered players of our sides ----

    private Match vsOppositionInLeagueWithMaxAge(int maxAge) {
        com.cricketlegend.domain.League league = fixtures.league(w, 11);
        jdbc.update("update league set max_age = ? where id = ?", maxAge, league.getId());
        return fixtures.match(w, w.seniors1(), null, Instant.now().minus(Duration.ofDays(1)), true, league);
    }

    @Test
    void theWizardSaveRefusesAPlayerOfAnotherSectionAndAcceptsOneOfTheTeamsSectionOrADescendant() {
        Match match = vsOpposition();
        PlayerProfile junior = fixtures.sectionPlayer(w, w.juniorsTeam(), "Jo");
        com.cricketlegend.domain.Section colts = fixtures.childSection(w.club(), w.seniors(), "Colts");
        PlayerProfile colt = fixtures.player(w, "Cal", true);
        fixtures.tag(colts, colt);

        InvalidResultException refused = invalid(() -> resultService.upsertDraft(admin, clubId, match.getId(),
                listOnly(registered(H, "p1", junior.getId()))));

        assertThat(codes(refused)).containsExactly("PLAYER_NOT_IN_SECTION");
        assertThat(refused.getIssues()).singleElement().satisfies(i -> {
            assertThat(i.step()).isEqualTo(com.cricketlegend.domain.ResultWizardStep.TEAMS);
            assertThat(i.side()).isEqualTo(H);
            assertThat(i.message()).isEqualTo("Jo Player is not in the Seniors section.");
        });
        assertThat(jdbc.queryForObject("select count(*) from result_player rp join match_result mr on mr.id = rp.match_result_id"
                + " where mr.match_id = ?", Integer.class, match.getId())).isZero();

        resultService.upsertDraft(admin, clubId, match.getId(), listOnly(registered(H, "p1", colt.getId())));
        assertThat(read(match).players()).singleElement().satisfies(p -> assertThat(p.playerProfileId()).isEqualTo(colt.getId()));
    }

    @Test
    void theWizardSaveRefusesAPlayerOutsideTheLeaguesAgeRule() {
        Match match = vsOppositionInLeagueWithMaxAge(18);
        PlayerProfile adult = fixtures.eligiblePlayer(w, w.seniors1(), "Ada");
        PlayerProfile kid = fixtures.eligiblePlayer(w, w.seniors1(), "Kit", java.time.LocalDate.of(2020, 1, 1));

        InvalidResultException refused = invalid(() -> resultService.upsertDraft(admin, clubId, match.getId(),
                listOnly(registered(H, "p1", adult.getId()))));

        assertThat(codes(refused)).containsExactly("PLAYER_AGE_INELIGIBLE");
        resultService.upsertDraft(admin, clubId, match.getId(), listOnly(registered(H, "p1", kid.getId())));
        assertThat(read(match).players()).hasSize(1);
    }

    @Test
    void aStoredPlayerWhoNoLongerQualifiesStaysEditableButValidationReportsAnErrorAndPublishingIsBlocked() {
        Match match = vsOpposition();
        ScorecardCard card = realise(ScorecardCard.oursBat());
        save(match, card);
        ScorecardDto stored = read(match);
        UUID leaver = stored.players().stream().filter(p -> "b1".equals(p.clientKey()) || p.side() == H)
                .findFirst().orElseThrow().playerProfileId();
        jdbc.update("delete from player_section where player_profile_id = ?", leaver);

        // the draft is saved again as it is: the stored player is not re-checked
        resultService.upsertDraft(admin, clubId, match.getId(), card.draft().copyWithScorecard(stored));

        var validation = resultService.validate(admin, clubId, match.getId(), null);
        assertThat(validation.issues()).filteredOn(i -> "PLAYER_NOT_IN_SECTION".equals(i.code())).singleElement()
                .satisfies(i -> {
                    assertThat(i.severity()).isEqualTo(com.cricketlegend.domain.ResultIssueSeverity.ERROR);
                    assertThat(i.side()).isEqualTo(H);
                });
        assertThat(validation.canPublish()).isFalse();
        assertThat(codes(invalid(() -> resultService.publish(admin, clubId, match.getId(), true))))
                .contains("PLAYER_NOT_IN_SECTION");
    }

    @Test
    void guestsAndTheOppositionAreNeverCheckedAndALinkOfAnIneligiblePlayerIsRefused() {
        Match match = vsOpposition();
        resultService.upsertDraft(admin, clubId, match.getId(),
                listOnly(guest(H, "g1", "Sam Guest"), opposition(A, "o1", "Rob Brown")));
        ScorecardDto stored = read(match);
        PlayerProfile junior = fixtures.sectionPlayer(w, w.juniorsTeam(), "Jo");
        PlayerProfile senior = fixtures.sectionPlayer(w, w.seniors1(), "Sid");
        UUID guestRow = playerId(stored, "Sam Guest");

        InvalidResultException refused = invalid(() -> scorecardService.link(admin, clubId, match.getId(), guestRow, junior.getId()));

        assertThat(codes(refused)).containsExactly("PLAYER_NOT_IN_SECTION");
        assertThat(read(match).players()).filteredOn(p -> p.id().equals(guestRow))
                .singleElement().satisfies(p -> assertThat(p.playerProfileId()).isNull());
        assertThat(scorecardService.link(admin, clubId, match.getId(), guestRow, senior.getId()).playerProfileId())
                .isEqualTo(senior.getId());
    }
}
