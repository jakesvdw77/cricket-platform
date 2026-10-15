package com.cricketlegend.dto;

import com.cricketlegend.domain.ResultStatus;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * docs/specs/104-match-results-import-adaptors.md: the outcome of a resolve, which saved one DRAFT result. {@code
 * exactness} is per section ({@code match}, {@code teams}, {@code toss}, {@code result}, {@code innings[n]}, {@code
 * awards}, {@code players}); {@code counts} are our players' names by level; {@code validation} is the unchanged
 * result validation of the saved draft (including an unconfirmed guess as an error).
 */
public record ImportResolveDto(
        UUID matchId,
        ResultStatus resultStatus,
        Map<String, ImportExactness> exactness,
        ImportCountsDto counts,
        List<ImportNoteDto> notes,
        ResultValidationDto validation) {
}
