package com.cricketlegend.exception;

import com.cricketlegend.dto.ScheduleFindingDto;
import java.util.List;

/**
 * A match save refused by the shared scheduling rules (docs/specs/132-match-scheduling-rules.md): an error finding, or
 * a warning the request did not acknowledge. HTTP 409 via {@link ConflictException}; {@code GlobalExceptionHandler}
 * adds {@code findings} and {@code needsConfirmation} (true when every finding is a warning) to the problem body.
 */
public class ScheduleRuleException extends ConflictException {

    private final transient List<ScheduleFindingDto> findings;

    public ScheduleRuleException(List<ScheduleFindingDto> findings) {
        super(findings.get(0).message());
        this.findings = List.copyOf(findings);
    }

    public List<ScheduleFindingDto> getFindings() {
        return findings;
    }

    public boolean needsConfirmation() {
        return findings.stream().noneMatch(ScheduleFindingDto::isError);
    }
}
