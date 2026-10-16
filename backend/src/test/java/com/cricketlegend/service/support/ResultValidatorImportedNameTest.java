package com.cricketlegend.service.support;

import static org.assertj.core.api.Assertions.assertThat;

import com.cricketlegend.domain.ImportMatchLevel;
import com.cricketlegend.domain.ResultIssueSeverity;
import com.cricketlegend.domain.ResultSide;
import com.cricketlegend.domain.ResultWizardStep;
import com.cricketlegend.dto.ResultDraft;
import com.cricketlegend.dto.ResultIssueDto;
import com.cricketlegend.dto.ResultPlayerDto;
import com.cricketlegend.dto.ResultValidationDto;
import com.cricketlegend.service.support.ResultValidator.ErrorCode;
import com.cricketlegend.support.ScorecardCard;
import java.util.List;
import java.util.function.UnaryOperator;
import org.junit.jupiter.api.Test;

/**
 * docs/specs/104 Test Plan, {@code IMPORTED_NAME_UNCONFIRMED}: raised once per unconfirmed row of ours, blocks publish,
 * and is gone once the row no longer carries the flag (confirm, swap and link all clear it, proved in {@code
 * ScorecardServiceImportFlagTest}); never raised for a guest, an exact or remembered match, or the opposition, none of
 * which carry the flag. A save keeps the flag, so the structural check does not raise it.
 */
class ResultValidatorImportedNameTest {

    private static final String HOME = "Riverside";
    private static final String AWAY = "Hillside";

    private final ResultValidator validator = new ResultValidator();

    private static UnaryOperator<ResultPlayerDto> flagged(ImportMatchLevel level) {
        return p -> new ResultPlayerDto(p.id(), p.clientKey(), p.side(), p.playerProfileId(), "Nazar A", p.plannedBattingOrder(),
                p.replacedPlayerProfileId(), p.substitute(), p.opposition(), p.firstName(), p.lastName(), p.guest(),
                p.linkedBy(), p.linkedAt(), level);
    }

    private ResultValidationDto validate(ScorecardCard card) {
        return validator.validate(card.draft(), HOME, AWAY, card.context);
    }

    private static List<ResultIssueDto> unconfirmed(ResultValidationDto dto) {
        return dto.issues().stream().filter(i -> i.code().equals(ErrorCode.IMPORTED_NAME_UNCONFIRMED.name())).toList();
    }

    @Test
    void aCleanCardWithNoFlagsRaisesNothing() {
        ResultValidationDto dto = validate(ScorecardCard.oursBat());

        assertThat(unconfirmed(dto)).isEmpty();
        assertThat(dto.canPublish()).isTrue();
    }

    @Test
    void anUnconfirmedRuleBasedGuessIsAnErrorOnTheTeamsStepThatBlocksPublish() {
        ResultValidationDto dto = validate(ScorecardCard.oursBat().player("b3", flagged(ImportMatchLevel.NORMALISED)));

        assertThat(unconfirmed(dto)).singleElement().satisfies(issue -> {
            assertThat(issue.severity()).isEqualTo(ResultIssueSeverity.ERROR);
            assertThat(issue.step()).isEqualTo(ResultWizardStep.TEAMS);
            assertThat(issue.side()).isEqualTo(ResultSide.HOME);
            assertThat(issue.message()).startsWith("File said 'Nazar A', matched to ").endsWith("Confirm or change this player.");
        });
        assertThat(dto.canPublish()).isFalse();
        assertThat(dto.errors()).isNotEmpty();
    }

    @Test
    void aProvisionallyLinkedSuggestionBlocksPublishToo() {
        ResultValidationDto dto = validate(ScorecardCard.oursBat().player("b1", flagged(ImportMatchLevel.AI_SUGGESTED)));

        assertThat(unconfirmed(dto)).hasSize(1);
        assertThat(dto.canPublish()).isFalse();
    }

    @Test
    void eachUnconfirmedRowIsItsOwnErrorAcrossBothSides() {
        ResultValidationDto dto = validate(ScorecardCard.derby()
                .player("b1", flagged(ImportMatchLevel.NORMALISED))
                .player("b2", flagged(ImportMatchLevel.NORMALISED))
                .player("w1", flagged(ImportMatchLevel.NORMALISED)));

        assertThat(unconfirmed(dto)).hasSize(3);
        assertThat(unconfirmed(dto)).extracting(ResultIssueDto::side)
                .containsExactlyInAnyOrder(ResultSide.HOME, ResultSide.HOME, ResultSide.AWAY);
    }

    @Test
    void onceTheFlagIsClearedTheErrorIsGone() {
        ScorecardCard card = ScorecardCard.oursBat().player("b3", flagged(ImportMatchLevel.NORMALISED));
        assertThat(validate(card).canPublish()).isFalse();

        card.player("b3", p -> new ResultPlayerDto(p.id(), p.clientKey(), p.side(), p.playerProfileId(), p.displayName(),
                p.plannedBattingOrder(), p.replacedPlayerProfileId(), p.substitute(), p.opposition(), p.firstName(),
                p.lastName(), p.guest(), p.linkedBy(), p.linkedAt(), null));

        assertThat(unconfirmed(validate(card))).isEmpty();
        assertThat(validate(card).canPublish()).isTrue();
    }

    @Test
    void anOppositionRowIsNeverRaisedEvenIfSomehowFlagged() {
        ResultValidationDto dto = validate(ScorecardCard.oursBat().player("w1", flagged(ImportMatchLevel.NORMALISED)));

        assertThat(unconfirmed(dto)).isEmpty();
    }

    @Test
    void aGuestWithNoFlagIsNotRaised() {
        ScorecardCard card = ScorecardCard.oursBat().player("b3", p -> new ResultPlayerDto(p.id(), p.clientKey(), p.side(), null,
                "Zane Quirk", p.plannedBattingOrder(), null, false, false, null, null, true, null, null, null));

        assertThat(unconfirmed(validate(card))).isEmpty();
    }

    @Test
    void aSaveKeepsTheFlagSoTheStructuralCheckDoesNotRaiseIt() {
        ScorecardCard card = ScorecardCard.oursBat().player("b3", flagged(ImportMatchLevel.NORMALISED));
        ResultDraft draft = card.draft();

        List<ResultIssueDto> structural = validator.structuralIssueList(draft, HOME, AWAY, card.context);

        assertThat(structural).noneMatch(i -> i.code().equals(ErrorCode.IMPORTED_NAME_UNCONFIRMED.name()));
    }
}
