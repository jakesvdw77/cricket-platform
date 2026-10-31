package com.cricketlegend.service.support;

import static org.assertj.core.api.Assertions.assertThat;

import com.cricketlegend.domain.ImportEntityAction;
import com.cricketlegend.domain.ImportIssueSeverity;
import com.cricketlegend.domain.ImportOutcome;
import com.cricketlegend.domain.ImportRowAction;
import com.cricketlegend.domain.ImportRowOrigin;
import com.cricketlegend.domain.ImportRowStatus;
import com.cricketlegend.dto.ImportDecisionsDto;
import com.cricketlegend.dto.ImportDecisionsDto.Acknowledgement;
import com.cricketlegend.dto.ImportIssueDto;
import com.cricketlegend.dto.ImportRowDto;
import com.cricketlegend.dto.PlannedChangeDto;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.Test;

/** docs/specs/097: what blocks, what needs a tick, and the counters on the batch. */
class ImportReviewTest {

    private static ImportIssueDto error(String code, Integer... rows) {
        return new ImportIssueDto(code, ImportIssueSeverity.ERROR, List.of(rows), null, "m", null);
    }

    private static ImportIssueDto warning(String code, Integer... rows) {
        return new ImportIssueDto(code, ImportIssueSeverity.WARNING, List.of(rows), null, "m", null);
    }

    private static ImportDecisionsDto excluding(Integer... rows) {
        return new ImportDecisionsDto(List.of(rows), null, null, null, false, null, null, null, null);
    }

    private static ImportDecisionsDto acknowledging(Acknowledgement... acks) {
        return new ImportDecisionsDto(null, null, null, null, false, List.of(acks), null, null, null);
    }

    @Test
    void anErrorOnlyOnExcludedRowsNoLongerBlocksButAFileLevelErrorAlwaysDoes() {
        assertThat(ImportReview.blockingErrors(List.of(error("DATE_INVALID", 2)), Set.of())).hasSize(1);
        assertThat(ImportReview.blockingErrors(List.of(error("DATE_INVALID", 2)), Set.of(2))).isEmpty();
        assertThat(ImportReview.blockingErrors(List.of(error("DATE_INVALID", 2, 3)), Set.of(2))).hasSize(1);
        assertThat(ImportReview.blockingErrors(List.of(error("FILE_REJECTED")), Set.of(2))).hasSize(1);
    }

    @Test
    void aWarningNeedsAnAcknowledgementByCodeOrByEveryAffectedRow() {
        List<ImportIssueDto> issues = List.of(warning("VENUE_MISSING", 2, 3));
        assertThat(ImportReview.unacknowledgedWarnings(issues, ImportDecisionsDto.empty(), Set.of())).hasSize(1);
        assertThat(ImportReview.unacknowledgedWarnings(issues,
                acknowledging(new Acknowledgement("VENUE_MISSING", null)), Set.of())).isEmpty();
        assertThat(ImportReview.unacknowledgedWarnings(issues,
                acknowledging(new Acknowledgement("VENUE_MISSING", List.of())), Set.of())).isEmpty();
        assertThat(ImportReview.unacknowledgedWarnings(issues,
                acknowledging(new Acknowledgement("VENUE_MISSING", List.of(2))), Set.of())).hasSize(1);
        assertThat(ImportReview.unacknowledgedWarnings(issues,
                acknowledging(new Acknowledgement("VENUE_MISSING", List.of(2, 3))), Set.of())).isEmpty();
        assertThat(ImportReview.unacknowledgedWarnings(issues,
                acknowledging(new Acknowledgement("OTHER_CODE", null)), Set.of())).hasSize(1);
    }

    @Test
    void excludingTheAffectedRowsClearsTheWarning() {
        assertThat(ImportReview.unacknowledgedWarnings(List.of(warning("VENUE_MISSING", 2)),
                excluding(2), Set.of(2))).isEmpty();
    }

    @Test
    void confirmableNeedsZeroErrorsAndEveryWarningAcknowledged() {
        List<ImportIssueDto> issues = List.of(warning("W", 2));
        assertThat(ImportReview.confirmable(issues, ImportDecisionsDto.empty(), Set.of())).isFalse();
        assertThat(ImportReview.confirmable(issues, acknowledging(new Acknowledgement("W", null)), Set.of())).isTrue();
        assertThat(ImportReview.confirmable(List.of(error("E", 2), warning("W", 3)),
                acknowledging(new Acknowledgement("W", null)), Set.of())).isFalse();
        assertThat(ImportReview.confirmable(List.of(), ImportDecisionsDto.empty(), Set.of())).isTrue();
    }

    private static ImportRowDto row(int n, ImportRowStatus status, ImportOutcome outcome, ImportRowOrigin origin) {
        return new ImportRowDto(n, null, Map.of(), status, outcome, ImportRowAction.CREATE, List.of(), null, origin, null);
    }

    @Test
    void exclusionsMarkTheRowsAndEffectiveRowsDropThem() {
        List<ImportRowDto> rows = List.of(row(2, ImportRowStatus.OK, ImportOutcome.NEW, null),
                row(3, ImportRowStatus.OK, ImportOutcome.NEW, null));
        List<ImportRowDto> marked = ImportReview.applyExclusions(rows, excluding(3));
        assertThat(marked.get(0).action()).isEqualTo(ImportRowAction.CREATE);
        assertThat(marked.get(1).action()).isEqualTo(ImportRowAction.EXCLUDED);
        assertThat(ImportReview.effectiveRows(marked)).extracting(ImportRowDto::rowNumber).containsExactly(2);
    }

    @Test
    void countersCoverEveryCategoryIncludingEditedAndAdded() {
        List<ImportRowDto> rows = List.of(
                row(2, ImportRowStatus.OK, ImportOutcome.NEW, ImportRowOrigin.FILE),
                row(3, ImportRowStatus.WARNING, ImportOutcome.NEW, ImportRowOrigin.EDITED),
                row(4, ImportRowStatus.ERROR, ImportOutcome.NEW, ImportRowOrigin.ADDED),
                row(5, ImportRowStatus.OK, ImportOutcome.DUPLICATE, null),
                row(6, ImportRowStatus.SKIPPED_NOT_OURS, ImportOutcome.SKIPPED_NOT_OURS, null),
                row(7, ImportRowStatus.OK, ImportOutcome.NEW, null));
        List<ImportRowDto> withExclusion = ImportReview.applyExclusions(rows, excluding(7));
        List<PlannedChangeDto> planned = List.of(
                new PlannedChangeDto(ImportEntityAction.CREATED, "MATCH", "a", 2, null, null),
                new PlannedChangeDto(ImportEntityAction.CREATED, "MATCH", "b", 3, null, null),
                new PlannedChangeDto(ImportEntityAction.UPDATED, "MATCH", "c", 5, null, null));
        Map<String, Object> counts = ImportReview.counts(withExclusion, planned);
        assertThat(counts).containsEntry("rows", 6).containsEntry("ok", 2).containsEntry("warnings", 1)
                .containsEntry("errors", 1).containsEntry("created", 2L).containsEntry("updated", 1L)
                .containsEntry("duplicates", 1).containsEntry("skippedNotOurs", 1).containsEntry("excluded", 1)
                .containsEntry("edited", 1).containsEntry("added", 1);
    }
}
