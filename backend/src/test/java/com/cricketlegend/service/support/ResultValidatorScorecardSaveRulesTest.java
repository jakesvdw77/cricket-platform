package com.cricketlegend.service.support;

import static com.cricketlegend.support.ScorecardDtos.award;
import static com.cricketlegend.support.ScorecardDtos.bat;
import static com.cricketlegend.support.ScorecardDtos.bowl;
import static com.cricketlegend.support.ScorecardDtos.by;
import static com.cricketlegend.support.ScorecardDtos.extrasAndDots;
import static com.cricketlegend.support.ScorecardDtos.field;
import static com.cricketlegend.support.ScorecardDtos.guest;
import static com.cricketlegend.support.ScorecardDtos.inKind;
import static com.cricketlegend.support.ScorecardDtos.opposition;
import static com.cricketlegend.support.ScorecardDtos.override;
import static com.cricketlegend.support.ScorecardDtos.registered;
import static org.assertj.core.api.Assertions.assertThat;

import com.cricketlegend.domain.AwardType;
import com.cricketlegend.domain.DismissalType;
import com.cricketlegend.domain.FeaturedOverride;
import com.cricketlegend.domain.InningsKind;
import com.cricketlegend.domain.ResultIssueSeverity;
import com.cricketlegend.domain.ResultSide;
import com.cricketlegend.domain.ResultWizardStep;
import com.cricketlegend.dto.BattingEntryDto;
import com.cricketlegend.dto.ResultDraft;
import com.cricketlegend.dto.ResultIssueDto;
import com.cricketlegend.dto.ResultPlayerDto;
import com.cricketlegend.dto.ScorecardDto;
import com.cricketlegend.service.support.ResultValidator.ErrorCode;
import com.cricketlegend.support.ScorecardCard;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;

/**
 * docs/specs/101-match-results-our-side-scorecard.md Test Plan, backend unit: what a <em>save</em> refuses in a
 * scorecard (the structural half of {@link ResultValidator}), one case per error code with its {@code code}, {@code
 * step} and {@code side}, for both sides' entries. Pure logic, no Spring.
 */
class ResultValidatorScorecardSaveRulesTest {

    private static final String HOME = "Riverside";
    private static final String AWAY = "Hillside";
    private static final ResultSide H = ResultSide.HOME;
    private static final ResultSide A = ResultSide.AWAY;

    private final ResultValidator validator = new ResultValidator();

    private List<ResultIssueDto> save(ScorecardCard card) {
        return validator.structuralIssueList(card.draft(), HOME, AWAY, card.context);
    }

    private List<ResultIssueDto> save(ResultDraft draft) {
        return validator.structuralIssueList(draft, HOME, AWAY, ScorecardContext.none());
    }

    private static List<ResultIssueDto> withCode(List<ResultIssueDto> issues, ErrorCode code) {
        return issues.stream().filter(i -> i.code().equals(code.name())).toList();
    }

    private static void assertOneError(
            List<ResultIssueDto> issues, ErrorCode code, ResultWizardStep step, ResultSide side) {
        assertThat(withCode(issues, code)).singleElement().satisfies(issue -> {
            assertThat(issue.step()).isEqualTo(step);
            assertThat(issue.side()).isEqualTo(side);
            assertThat(issue.severity()).isEqualTo(ResultIssueSeverity.ERROR);
            assertThat(issue.message()).isNotBlank();
        });
    }

    private static ResultDraft playersOnly(ResultPlayerDto... players) {
        return new ResultDraft(null, null, null, null, null, null, null, null, null, null, null, null, null, null,
                new ScorecardDto(List.of(players), null, null, null, null, null, null));
    }

    // ---- a clean card, and a team list on its own ----

    @Test
    void aCleanCardRaisesNoStructuralIssueWhoeverBatsAndBowls() {
        assertThat(save(ScorecardCard.oursBat())).isEmpty();
        assertThat(save(ScorecardCard.oppositionBats())).isEmpty();
        assertThat(save(ScorecardCard.derby())).isEmpty();
    }

    @Test
    void aTeamListWithNoInningsAndNoOutcomeSaves() {
        ResultDraft draft = playersOnly(registered(H, "p1"), registered(H, "p2"), opposition(A, "o1", "Smith"));

        assertThat(save(draft)).isEmpty();
    }

    @Test
    void anEntryOnAnInningsThatIsNotInTheResultIsRefusedForBattingBowlingAndFielding() {
        ScorecardCard card = ScorecardCard.oursBat();
        card.first = null;
        ResultDraft noFirst = new ResultDraft(null, null, null, null, null, null, null, null, null, null, null, null,
                null, List.of(card.second), card.scorecard());

        List<ResultIssueDto> issues = save(noFirst);

        // the batting rows, the bowling rows and (below) the fielding rows of the missing innings
        assertThat(withCode(issues, ErrorCode.SCORECARD_INNINGS_MISSING))
                .extracting(ResultIssueDto::step)
                .contains(ResultWizardStep.BATTING, ResultWizardStep.BOWLING);
        assertThat(withCode(issues, ErrorCode.SCORECARD_INNINGS_MISSING)).extracting(ResultIssueDto::side)
                .containsOnly(H);

        ScorecardCard fielder = ScorecardCard.oursBat();
        fielder.batting.clear();
        fielder.bowling.clear();
        fielder.fielding.add(field(H, "w1", 1, 0, 0));
        ResultDraft noInnings = new ResultDraft(null, null, null, null, null, null, null, null, null, null, null, null,
                null, List.of(), fielder.scorecard());
        assertOneError(save(noInnings), ErrorCode.SCORECARD_INNINGS_MISSING, ResultWizardStep.BOWLING, H);
    }

    @Test
    void anEntryForASuperOverIsRefused() {
        ScorecardCard card = ScorecardCard.oursBat().batting("b1", e -> inKind(e, InningsKind.SUPER_OVER));

        assertOneError(save(card), ErrorCode.SCORECARD_SUPER_OVER_NOT_SUPPORTED, ResultWizardStep.BATTING, null);
    }

    // ---- players ----

    @Test
    void aNewPlayerNeedsAClientKey() {
        ResultPlayerDto noKey = new ResultPlayerDto(null, null, H, UUID.randomUUID(), null, null, null, false, false,
                null, null, false, null, null);

        assertOneError(save(playersOnly(noKey)), ErrorCode.SCORECARD_PLAYER_KEY_MISSING, ResultWizardStep.TEAMS, H);
    }

    @Test
    void twoPlayersCannotShareAKey() {
        assertOneError(save(playersOnly(registered(H, "p1"), registered(A, "p1"))),
                ErrorCode.SCORECARD_PLAYER_KEY_DUPLICATE, ResultWizardStep.TEAMS, A);
    }

    @Test
    void aPlayerNeedsASide() {
        ResultPlayerDto noSide = new ResultPlayerDto(null, "p1", null, UUID.randomUUID(), null, null, null, false, false,
                null, null, false, null, null);

        assertOneError(save(playersOnly(noSide)), ErrorCode.SCORECARD_PLAYER_SIDE_MISSING, ResultWizardStep.TEAMS, null);
    }

    @Test
    void aPlayerNeedsARegisteredPlayerOrAName() {
        ResultPlayerDto nobody = new ResultPlayerDto(null, "p1", H, null, "  ", null, null, false, false, null, null,
                false, null, null);

        assertOneError(save(playersOnly(nobody)), ErrorCode.SCORECARD_PLAYER_IDENTITY_MISSING, ResultWizardStep.TEAMS, H);
    }

    @Test
    void aRegisteredPlayerIsOnceAPerSideButMayBeOnBothSidesOfADerby() {
        UUID profile = UUID.randomUUID();

        assertOneError(save(playersOnly(registered(H, "p1", profile), registered(H, "p2", profile))),
                ErrorCode.SCORECARD_PLAYER_DUPLICATE, ResultWizardStep.TEAMS, H);
        assertThat(save(playersOnly(registered(H, "p1", profile), registered(A, "p2", profile)))).isEmpty();
    }

    @Test
    void twoGuestsWithTheSameNameOnASideAreRefusedIgnoringCaseAndSpacing() {
        List<ResultIssueDto> issues = save(playersOnly(guest(H, "g1", "John  Smith"), guest(H, "g2", " john smith ")));

        assertOneError(issues, ErrorCode.SCORECARD_PLAYER_DUPLICATE, ResultWizardStep.TEAMS, H);
        assertThat(issues.get(0).message()).contains("Two guests");
    }

    @Test
    void theSameGuestNameOnEachSideOfADerbyIsAllowed() {
        assertThat(save(playersOnly(guest(H, "g1", "John Smith"), guest(A, "g2", "John Smith")))).isEmpty();
    }

    @Test
    void aRowForAPlayerWhoIsNotOnTheScorecardIsRefused() {
        ScorecardCard card = ScorecardCard.oursBat();
        card.batting.add(bat(H, "ghost", DismissalType.NOT_OUT, 1, null, 12));

        assertOneError(save(card), ErrorCode.SCORECARD_PLAYER_UNKNOWN, ResultWizardStep.BATTING, H);
    }

    @Test
    void aRowForAPlayerOnTheOtherSidesListIsRefusedWhateverTheTable() {
        ScorecardCard batting = ScorecardCard.oursBat();
        batting.batting.add(bat(H, "w6", DismissalType.NOT_OUT, 1, null, 12));
        assertOneError(save(batting), ErrorCode.SCORECARD_PLAYER_SIDE_MISMATCH, ResultWizardStep.BATTING, H);

        // a bowler row belongs to the side that bowls: the one that did not bat in that innings
        ScorecardCard bowling = ScorecardCard.oursBat();
        bowling.bowling.add(bowl(H, "b9", 6, 0, 3, 0));
        assertOneError(save(bowling), ErrorCode.SCORECARD_PLAYER_SIDE_MISMATCH, ResultWizardStep.BOWLING, A);

        ScorecardCard fielding = ScorecardCard.oursBat();
        fielding.fielding.add(field(H, "b9", 1, 0, 0));
        assertOneError(save(fielding), ErrorCode.SCORECARD_PLAYER_SIDE_MISMATCH, ResultWizardStep.BOWLING, A);
    }

    @Test
    void aPlayerHasOneRowPerTablePerInnings() {
        ScorecardCard batting = ScorecardCard.oursBat();
        batting.batting.add(bat(H, "b1", DismissalType.NOT_OUT, 1, null, 11));
        assertOneError(save(batting), ErrorCode.SCORECARD_DUPLICATE_ENTRY, ResultWizardStep.BATTING, H);

        ScorecardCard bowling = ScorecardCard.oursBat();
        bowling.bowling.add(bowl(H, "w1", 6, 0, 3, 0));
        assertOneError(save(bowling), ErrorCode.SCORECARD_DUPLICATE_ENTRY, ResultWizardStep.BOWLING, A);

        ScorecardCard fielding = ScorecardCard.oursBat();
        fielding.fielding.add(field(H, "w1", 1, 0, 0));
        fielding.fielding.add(field(H, "w1", 0, 1, 0));
        assertOneError(save(fielding), ErrorCode.SCORECARD_DUPLICATE_ENTRY, ResultWizardStep.BOWLING, A);
    }

    // ---- figures ----

    @Test
    void negativeBattingBowlingAndFieldingFiguresAreRefused() {
        ScorecardCard batting = ScorecardCard.oursBat().batting("b1", e -> bat(H, "b1", DismissalType.NOT_OUT, -1, null, 1));
        assertOneError(save(batting), ErrorCode.SCORECARD_NEGATIVE_FIGURE, ResultWizardStep.BATTING, H);

        ScorecardCard bowling = ScorecardCard.oursBat().bowling("w1", e -> bowl(H, "w1", 24, 0, -3, 2));
        assertOneError(save(bowling), ErrorCode.SCORECARD_NEGATIVE_FIGURE, ResultWizardStep.BOWLING, A);

        ScorecardCard fielding = ScorecardCard.oursBat();
        fielding.fielding.add(field(H, "w1", 0, -1, 0));
        assertOneError(save(fielding), ErrorCode.SCORECARD_NEGATIVE_FIGURE, ResultWizardStep.BOWLING, A);
    }

    @Test
    void battingPositionsStartAtOneAndAreUniquePerSide() {
        ScorecardCard zero = ScorecardCard.oursBat().batting("b1", e -> bat(H, "b1", DismissalType.BOWLED, 50, null, 0));
        assertOneError(save(zero), ErrorCode.SCORECARD_POSITION_INVALID, ResultWizardStep.BATTING, H);

        ScorecardCard twice = ScorecardCard.oursBat().batting("b2", e -> bat(H, "b2", DismissalType.BOWLED, 40, null, 1));
        assertOneError(save(twice), ErrorCode.SCORECARD_POSITION_DUPLICATE, ResultWizardStep.BATTING, H);
    }

    @Test
    void dotBallsAreOptionalAndNeverAboveTheBallsBowled() {
        ScorecardCard over = ScorecardCard.oursBat().bowling("w1", e -> extrasAndDots(e, 1, 1, 25));
        assertOneError(save(over), ErrorCode.DOTS_EXCEED_BALLS, ResultWizardStep.BOWLING, A);

        assertThat(save(ScorecardCard.oursBat().bowling("w1", e -> extrasAndDots(e, 1, 1, 24)))).isEmpty();
        assertThat(save(ScorecardCard.oursBat().bowling("w1", e -> extrasAndDots(e, 1, 1, 0)))).isEmpty();
        assertThat(save(ScorecardCard.oursBat().bowling("w1", e -> extrasAndDots(e, 1, 1, null)))).isEmpty();
    }

    // ---- dismissals ----

    @Test
    void aBowlerOrFielderIsOnlyAllowedWhereTheWayOutAllowsThem() {
        // a run-out never has a bowler
        ScorecardCard runOut = ScorecardCard.oursBat()
                .batting("b1", e -> by(bat(H, "b1", DismissalType.RUN_OUT, 50, null, 1), "w1", "w2"));
        assertOneError(save(runOut), ErrorCode.DISMISSAL_DETAIL_NOT_ALLOWED, ResultWizardStep.BATTING, H);

        // a bowled has no fielder
        ScorecardCard bowled = ScorecardCard.oursBat()
                .batting("b1", e -> by(bat(H, "b1", DismissalType.BOWLED, 50, null, 1), "w1", "w2"));
        assertOneError(save(bowled), ErrorCode.DISMISSAL_DETAIL_NOT_ALLOWED, ResultWizardStep.BATTING, H);

        // a caught-and-bowled has the bowler only
        ScorecardCard caughtAndBowled = ScorecardCard.oursBat()
                .batting("b1", e -> by(bat(H, "b1", DismissalType.CAUGHT_AND_BOWLED, 50, null, 1), "w1", "w2"));
        assertOneError(save(caughtAndBowled), ErrorCode.DISMISSAL_DETAIL_NOT_ALLOWED, ResultWizardStep.BATTING, H);

        // not out takes neither, and a row with no way out chosen yet takes neither
        assertOneError(save(ScorecardCard.oursBat()
                        .batting("b9", e -> by(bat(H, "b9", DismissalType.NOT_OUT, 3, null, 9), "w1", null))),
                ErrorCode.DISMISSAL_DETAIL_NOT_ALLOWED, ResultWizardStep.BATTING, H);
        assertOneError(save(ScorecardCard.oursBat()
                        .batting("b9", e -> by(bat(H, "b9", null, 3, null, 9), "w1", null))),
                ErrorCode.DISMISSAL_DETAIL_NOT_ALLOWED, ResultWizardStep.BATTING, H);
    }

    @Test
    void everyKindOfDismissalThatMayNameAPlayerIsAccepted() {
        ScorecardCard card = ScorecardCard.oursBat()
                .batting("b1", e -> by(bat(H, "b1", DismissalType.CAUGHT, 50, null, 1), "w1", "w2"))
                .batting("b2", e -> by(bat(H, "b2", DismissalType.CAUGHT_AND_BOWLED, 40, null, 2), "w1", null))
                .batting("b3", e -> by(bat(H, "b3", DismissalType.STUMPED, 30, null, 3), "w2", "w6"))
                .batting("b4", e -> by(bat(H, "b4", DismissalType.RUN_OUT, 20, null, 4), null, "w7"))
                .batting("b5", e -> by(bat(H, "b5", DismissalType.LBW, 20, null, 5), "w3", null))
                .batting("b6", e -> by(bat(H, "b6", DismissalType.HIT_WICKET, 10, null, 6), "w3", null));

        assertThat(save(card)).isEmpty();
    }

    @Test
    void aDismissalPlayerMustBeOnTheFieldingSide() {
        // the bowler is a batter of the same innings: the batting side cannot dismiss itself
        ScorecardCard card = ScorecardCard.oursBat()
                .batting("b1", e -> by(bat(H, "b1", DismissalType.BOWLED, 50, null, 1), "b2", null));

        assertOneError(save(card), ErrorCode.DISMISSAL_PLAYER_WRONG_SIDE, ResultWizardStep.BATTING, H);
    }

    @Test
    void aDismissalPlayerMustBeOnTheScorecard() {
        ScorecardCard card = ScorecardCard.oursBat()
                .batting("b1", e -> by(bat(H, "b1", DismissalType.BOWLED, 50, null, 1), "nobody", null));

        assertOneError(save(card), ErrorCode.SCORECARD_PLAYER_UNKNOWN, ResultWizardStep.BATTING, H);
    }

    @Test
    void dismissalsWorkTheSameForTheOppositionsBattersAndInADerby() {
        ScorecardCard opposition = ScorecardCard.oppositionBats()
                .batting("b1", e -> by(bat(H, "b1", DismissalType.RUN_OUT, 50, null, 1), "w1", null));
        assertOneError(save(opposition), ErrorCode.DISMISSAL_DETAIL_NOT_ALLOWED, ResultWizardStep.BATTING, H);

        ScorecardCard derby = ScorecardCard.derby()
                .batting("b1", e -> by(bat(H, "b1", DismissalType.BOWLED, 50, null, 1), "b2", null));
        assertOneError(save(derby), ErrorCode.DISMISSAL_PLAYER_WRONG_SIDE, ResultWizardStep.BATTING, H);
    }

    // ---- the opposition ----

    @Test
    void anOppositionPlayerIsANameOnly() {
        UUID profile = UUID.randomUUID();
        ResultPlayerDto withProfile = new ResultPlayerDto(null, "o1", A, profile, "Smith", null, null, false, true, null,
                null, false, null, null);
        ResultPlayerDto noName = new ResultPlayerDto(null, "o2", A, null, null, null, null, false, true, null, null,
                false, null, null);
        ResultPlayerDto planned = new ResultPlayerDto(null, "o3", A, null, "Jones", 4, null, false, true, null, null,
                false, null, null);
        ResultPlayerDto replaced = new ResultPlayerDto(null, "o4", A, null, "Brown", null, profile, false, true, null,
                null, false, null, null);

        for (ResultPlayerDto bad : List.of(withProfile, noName, planned, replaced)) {
            assertThat(withCode(save(playersOnly(bad)), ErrorCode.OPPOSITION_PLAYER_INVALID))
                    .as(bad.clientKey()).singleElement().satisfies(issue -> {
                        assertThat(issue.step()).isEqualTo(ResultWizardStep.TEAMS);
                        assertThat(issue.side()).isEqualTo(A);
                    });
        }
        assertThat(save(playersOnly(opposition(A, "o5", "Clean Name")))).isEmpty();
    }

    @Test
    void anOppositionEntryTakesNoStandoutOverrideButOursDo() {
        // opposition bowl, so the override sits on a bowling row and on a fielding row of the opposition
        ScorecardCard card = ScorecardCard.oursBat().bowling("w1", e -> override(e, FeaturedOverride.FEATURE));
        card.fielding.add(override(field(H, "w2", 1, 0, 0), FeaturedOverride.HIDE));
        assertThat(withCode(save(card), ErrorCode.OPPOSITION_NO_STANDOUTS)).hasSize(2)
                .allSatisfy(issue -> {
                    assertThat(issue.step()).isEqualTo(ResultWizardStep.BOWLING);
                    assertThat(issue.side()).isEqualTo(A);
                });

        ScorecardCard batters = ScorecardCard.oppositionBats()
                .batting("b1", e -> override(e, FeaturedOverride.FEATURE));
        assertOneError(save(batters), ErrorCode.OPPOSITION_NO_STANDOUTS, ResultWizardStep.BATTING, H);

        ScorecardCard ours = ScorecardCard.oursBat().batting("b1", e -> override(e, FeaturedOverride.FEATURE));
        assertThat(save(ours)).isEmpty();
    }

    // ---- awards ----

    @Test
    void onlyOneOfficialAwardAndOneTeamAwardPerSideAreAllowed() {
        ScorecardCard twoOfficial = ScorecardCard.derby();
        twoOfficial.awards.add(award(AwardType.PLAYER_OF_MATCH, H, "b1"));
        twoOfficial.awards.add(award(AwardType.PLAYER_OF_MATCH, A, "w1"));
        assertOneError(save(twoOfficial), ErrorCode.AWARD_DUPLICATE_OFFICIAL, ResultWizardStep.AWARDS, null);

        ScorecardCard twoForASide = ScorecardCard.derby();
        twoForASide.awards.add(award(AwardType.TEAM_PLAYER_OF_MATCH, H, "b1"));
        twoForASide.awards.add(award(AwardType.TEAM_PLAYER_OF_MATCH, H, "b2"));
        assertOneError(save(twoForASide), ErrorCode.AWARD_DUPLICATE_TEAM, ResultWizardStep.AWARDS, H);

        // a derby: one official and a team award for each side is fine
        ScorecardCard derby = ScorecardCard.derby();
        derby.awards.add(award(AwardType.PLAYER_OF_MATCH, A, "w1"));
        derby.awards.add(award(AwardType.TEAM_PLAYER_OF_MATCH, H, "b1"));
        derby.awards.add(award(AwardType.TEAM_PLAYER_OF_MATCH, A, "w2"));
        assertThat(save(derby)).isEmpty();
    }

    @Test
    void aTeamAwardMustBeOneOfOurOwnPlayersOnThatSide() {
        ScorecardCard opposition = ScorecardCard.oursBat();
        opposition.awards.add(award(AwardType.TEAM_PLAYER_OF_MATCH, A, "w1"));
        assertOneError(save(opposition), ErrorCode.AWARD_SIDE_NOT_OURS, ResultWizardStep.AWARDS, A);

        ScorecardCard otherSide = ScorecardCard.derby();
        otherSide.awards.add(award(AwardType.TEAM_PLAYER_OF_MATCH, H, "w1"));
        assertOneError(save(otherSide), ErrorCode.SCORECARD_PLAYER_SIDE_MISMATCH, ResultWizardStep.AWARDS, H);
    }

    @Test
    void anAwardNamingAPlayerWhoIsNotOnTheScorecardIsRefusedButAFreeTextOfficialIsNot() {
        ScorecardCard unknown = ScorecardCard.oursBat();
        unknown.awards.add(award(AwardType.PLAYER_OF_MATCH, H, "nobody"));
        assertOneError(save(unknown), ErrorCode.SCORECARD_PLAYER_UNKNOWN, ResultWizardStep.AWARDS, H);

        ScorecardCard free = ScorecardCard.oursBat();
        free.awards.add(com.cricketlegend.support.ScorecardDtos.namedAward(AwardType.PLAYER_OF_MATCH, A, "Sam Opp"));
        assertThat(save(free)).isEmpty();
    }

    @ParameterizedTest
    @EnumSource(value = DismissalType.class, names = {"RUN_OUT", "HANDLED_BALL", "OBSTRUCTING_FIELD", "HIT_BALL_TWICE",
        "TIMED_OUT", "RETIRED_OUT", "NOT_OUT", "DID_NOT_BAT", "RETIRED_NOT_OUT"})
    void noWayOutThatIsNotBowlerCreditedTakesABowler(DismissalType how) {
        BattingEntryDto row = by(bat(H, "b1", how, how == DismissalType.DID_NOT_BAT ? null : 5, null, null), "w1", null);
        ScorecardCard card = ScorecardCard.oursBat().batting("b1", e -> row);

        assertThat(withCode(save(card), ErrorCode.DISMISSAL_DETAIL_NOT_ALLOWED)).hasSize(1);
    }
}
