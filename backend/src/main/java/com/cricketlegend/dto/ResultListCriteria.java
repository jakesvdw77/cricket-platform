package com.cricketlegend.dto;

import com.cricketlegend.domain.ResultListFocus;
import com.cricketlegend.domain.ResultOutcomeType;
import com.cricketlegend.domain.ResultStatus;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/**
 * docs/specs/100-match-results-core.md: the Results list filters, the Matches filters plus {@code outcome},
 * {@code status}, {@code focus} and an inclusive {@code from}/{@code to} date range (server-local days).
 */
public record ResultListCriteria(
        UUID sectionId,
        UUID leagueId,
        UUID seasonId,
        UUID teamId,
        String search,
        List<ResultOutcomeType> outcomes,
        ResultStatus status,
        ResultListFocus focus,
        LocalDate from,
        LocalDate to) {
}
