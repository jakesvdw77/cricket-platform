package com.cricketlegend.dto;

import com.cricketlegend.domain.ResultIssueSeverity;
import com.cricketlegend.domain.ResultSide;
import com.cricketlegend.domain.ResultWizardStep;
import java.util.UUID;

/**
 * docs/specs/101-match-results-our-side-scorecard.md: one validation issue with a stable {@code code} (a {@code
 * ResultValidator.ErrorCode} or {@code WarningCode} name; the Review step matches on it, never on the message), the
 * wizard {@code step} to fix it on, the {@code side} of the scorecard it belongs to (null for match-level issues) and
 * its {@code severity}. docs/specs/113 adds the errors {@code PLAYER_NOT_IN_SECTION} and {@code PLAYER_AGE_INELIGIBLE}. docs/specs/118 adds the optional {@code playerProfileId} (set on {@code PLAYER_NOT_IN_SQUAD}, null otherwise). The plain {@code errors}/{@code warnings} string lists beside it stay for current callers.
 */
public record ResultIssueDto(
        String code, ResultWizardStep step, ResultSide side, ResultIssueSeverity severity, String message,
        UUID playerProfileId) {

    /** An issue that is not about one player ({@code playerProfileId} null). */
    public ResultIssueDto(
            String code, ResultWizardStep step, ResultSide side, ResultIssueSeverity severity, String message) {
        this(code, step, side, severity, message, null);
    }
}
