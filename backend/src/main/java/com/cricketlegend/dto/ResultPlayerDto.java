package com.cricketlegend.dto;

import com.cricketlegend.domain.ImportMatchLevel;
import com.cricketlegend.domain.ResultSide;
import java.time.Instant;
import java.util.UUID;

/**
 * docs/specs/101-match-results-our-side-scorecard.md: who played for one of our sides. On write {@code id} is sent for
 * a player already on the scorecard and a new row carries a {@code clientKey} instead (entries refer to it by {@code
 * resultPlayerId} or {@code playerClientKey}); {@code firstName}, {@code lastName}, {@code guest}, {@code linkedBy}
 * and {@code linkedAt} are read-only. A guest has no {@code playerProfileId} and a {@code displayName}. {@code
 * opposition} marks a player of the side that is not ours: a name only (no profile, planned order, replaced player or
 * link), validated by the server against the match; {@code guest} is never true for one.
 *
 * <p>docs/specs/104: {@code importMatch} is set by an import on one of our players linked by a rule other than an exact
 * match or a remembered alias: a guess the manager must confirm before the result can be published. Read; on write it
 * can only be kept or cleared (null), never set or raised by a client.
 */
public record ResultPlayerDto(
        UUID id,
        String clientKey,
        ResultSide side,
        UUID playerProfileId,
        String displayName,
        Integer plannedBattingOrder,
        UUID replacedPlayerProfileId,
        boolean substitute,
        boolean opposition,
        String firstName,
        String lastName,
        boolean guest,
        UUID linkedBy,
        Instant linkedAt,
        ImportMatchLevel importMatch) {

    /** The shape before slice 104: no guess flag. */
    public ResultPlayerDto(
            UUID id, String clientKey, ResultSide side, UUID playerProfileId, String displayName,
            Integer plannedBattingOrder, UUID replacedPlayerProfileId, boolean substitute, boolean opposition,
            String firstName, String lastName, boolean guest, UUID linkedBy, Instant linkedAt) {
        this(id, clientKey, side, playerProfileId, displayName, plannedBattingOrder, replacedPlayerProfileId,
                substitute, opposition, firstName, lastName, guest, linkedBy, linkedAt, null);
    }
}
