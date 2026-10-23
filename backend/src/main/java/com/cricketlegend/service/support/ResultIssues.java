package com.cricketlegend.service.support;

import com.cricketlegend.domain.ResultIssueSeverity;
import com.cricketlegend.domain.ResultSide;
import com.cricketlegend.domain.ResultWizardStep;
import com.cricketlegend.dto.ResultIssueDto;
import java.util.ArrayList;
import java.util.List;

/** docs/specs/101: the collector of typed validation issues the result rules write into (code, step, side, severity). */
final class ResultIssues {

    private final List<ResultIssueDto> issues = new ArrayList<>();

    void error(ResultValidator.ErrorCode code, ResultWizardStep step, ResultSide side, String message) {
        issues.add(new ResultIssueDto(code.name(), step, side, ResultIssueSeverity.ERROR, message));
    }

    void warning(ResultValidator.WarningCode code, ResultWizardStep step, ResultSide side, String message) {
        issues.add(new ResultIssueDto(code.name(), step, side, ResultIssueSeverity.WARNING, message));
    }

    /** docs/specs/118: a warning about one registered player, so the client can act on that player. */
    void warning(
            ResultValidator.WarningCode code, ResultWizardStep step, ResultSide side, String message,
            java.util.UUID playerProfileId) {
        issues.add(new ResultIssueDto(
                code.name(), step, side, ResultIssueSeverity.WARNING, message, playerProfileId));
    }

    void info(ResultValidator.WarningCode code, ResultWizardStep step, ResultSide side, String message) {
        issues.add(new ResultIssueDto(code.name(), step, side, ResultIssueSeverity.INFO, message));
    }

    boolean hasErrors() {
        return issues.stream().anyMatch(i -> i.severity() == ResultIssueSeverity.ERROR);
    }

    List<ResultIssueDto> all() {
        return List.copyOf(issues);
    }

    List<String> errorMessages() {
        return issues.stream().filter(i -> i.severity() == ResultIssueSeverity.ERROR).map(ResultIssueDto::message).toList();
    }
}
