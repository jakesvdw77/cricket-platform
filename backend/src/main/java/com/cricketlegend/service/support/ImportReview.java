package com.cricketlegend.service.support;

import com.cricketlegend.domain.ImportIssueSeverity;
import com.cricketlegend.domain.ImportOutcome;
import com.cricketlegend.domain.ImportRowAction;
import com.cricketlegend.domain.ImportRowOrigin;
import com.cricketlegend.domain.ImportRowStatus;
import com.cricketlegend.dto.ImportDecisionsDto;
import com.cricketlegend.dto.ImportIssueDto;
import com.cricketlegend.dto.ImportRowDto;
import com.cricketlegend.dto.PlannedChangeDto;
import com.cricketlegend.domain.ImportEntityAction;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * The generic review rules of docs/specs/097-import-framework.md, in one place: which issues block, which warnings are
 * still unacknowledged, and the counters. Issues that only concern excluded rows are ignored (an exclusion is the way
 * to fix a row); an issue with no row numbers concerns the whole file and is never ignored.
 */
public final class ImportReview {

    private ImportReview() {
    }

    /** Rows the user excluded, as a set of row numbers. */
    public static Set<Integer> excluded(ImportDecisionsDto decisions) {
        return new HashSet<>(decisions.excludedRows());
    }

    /** Marks the user's excluded rows with action EXCLUDED (the handler is never asked to model exclusion). */
    public static List<ImportRowDto> applyExclusions(List<ImportRowDto> rows, ImportDecisionsDto decisions) {
        Set<Integer> excluded = excluded(decisions);
        return rows.stream()
                .map(row -> excluded.contains(row.rowNumber())
                        ? row.withResult(row.status(), row.outcome(), ImportRowAction.EXCLUDED, row.issueCodes(), row.existingRef())
                        : row)
                .toList();
    }

    /** Rows that will be imported: everything not excluded (skipped and duplicate rows stay, their action is SKIP). */
    public static List<ImportRowDto> effectiveRows(List<ImportRowDto> rows) {
        return rows.stream().filter(row -> row.action() != ImportRowAction.EXCLUDED).toList();
    }

    public static List<ImportIssueDto> blockingErrors(List<ImportIssueDto> issues, Set<Integer> excluded) {
        return issues.stream()
                .filter(issue -> issue.severity() == ImportIssueSeverity.ERROR && concernsLiveRow(issue, excluded))
                .toList();
    }

    /** Warnings on live rows that no acknowledgement covers (by code for all rows, or listing every affected row). */
    public static List<ImportIssueDto> unacknowledgedWarnings(
            List<ImportIssueDto> issues, ImportDecisionsDto decisions, Set<Integer> excluded) {
        return issues.stream()
                .filter(issue -> issue.severity() == ImportIssueSeverity.WARNING && concernsLiveRow(issue, excluded))
                .filter(issue -> !acknowledged(issue, decisions, excluded))
                .toList();
    }

    public static boolean confirmable(
            List<ImportIssueDto> issues, ImportDecisionsDto decisions, Set<Integer> excluded) {
        return blockingErrors(issues, excluded).isEmpty() && unacknowledgedWarnings(issues, decisions, excluded).isEmpty();
    }

    /** The counters shown on the batch and kept in {@code import_batch.counts}. */
    public static Map<String, Object> counts(List<ImportRowDto> rows, List<PlannedChangeDto> planned) {
        int ok = 0;
        int warnings = 0;
        int errors = 0;
        int skippedNotOurs = 0;
        int excluded = 0;
        int duplicates = 0;
        int edited = 0;
        int added = 0;
        for (ImportRowDto row : rows) {
            if (row.action() == ImportRowAction.EXCLUDED) {
                excluded++;
                continue;
            }
            if (row.origin() == ImportRowOrigin.EDITED) {
                edited++;
            } else if (row.origin() == ImportRowOrigin.ADDED) {
                added++;
            }
            if (row.status() == ImportRowStatus.SKIPPED_NOT_OURS || row.outcome() == ImportOutcome.SKIPPED_NOT_OURS) {
                skippedNotOurs++;
                continue;
            }
            if (row.outcome() == ImportOutcome.DUPLICATE) {
                duplicates++;
            }
            switch (row.status()) {
                case ERROR -> errors++;
                case WARNING -> warnings++;
                default -> ok++;
            }
        }
        long created = planned.stream().filter(change -> change.action() == ImportEntityAction.CREATED).count();
        long updated = planned.stream().filter(change -> change.action() == ImportEntityAction.UPDATED).count();
        Map<String, Object> counts = new LinkedHashMap<>();
        counts.put("rows", rows.size());
        counts.put("ok", ok);
        counts.put("warnings", warnings);
        counts.put("errors", errors);
        counts.put("created", created);
        counts.put("updated", updated);
        counts.put("duplicates", duplicates);
        counts.put("skippedNotOurs", skippedNotOurs);
        counts.put("excluded", excluded);
        counts.put("edited", edited);
        counts.put("added", added);
        return counts;
    }

    private static boolean concernsLiveRow(ImportIssueDto issue, Set<Integer> excluded) {
        return issue.rowNumbers().isEmpty() || issue.rowNumbers().stream().anyMatch(row -> !excluded.contains(row));
    }

    private static boolean acknowledged(ImportIssueDto issue, ImportDecisionsDto decisions, Set<Integer> excluded) {
        for (ImportDecisionsDto.Acknowledgement ack : decisions.acknowledgedWarnings()) {
            if (!issue.code().equals(ack.code())) {
                continue;
            }
            if (ack.rowNumbers() == null || ack.rowNumbers().isEmpty()) {
                return true;
            }
            Set<Integer> covered = new HashSet<>(ack.rowNumbers());
            if (issue.rowNumbers().stream().filter(row -> !excluded.contains(row)).allMatch(covered::contains)
                    && !issue.rowNumbers().isEmpty()) {
                return true;
            }
        }
        return false;
    }
}
