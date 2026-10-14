package com.cricketlegend.dto;

import com.cricketlegend.domain.InningsKind;
import com.cricketlegend.domain.ResultSide;

/**
 * docs/specs/100-match-results-core.md: one innings' totals, as sent in a {@link ResultDraft} and as read back.
 * {@code balls} is balls faced, never decimal overs; {@code oversDisplay} (e.g. {@code 36.4}) is derived on read and
 * ignored on write. On write {@code sequence}, {@code kind} and {@code allOut} may be omitted: sequence follows the
 * list position, kind follows the sequence (1 and 2 regular, then super overs), and {@code allOut} follows wickets.
 */
public record InningsDto(
        Integer sequence,
        InningsKind kind,
        ResultSide battingSide,
        Integer runs,
        Integer wickets,
        Integer balls,
        Integer extras,
        Boolean allOut,
        String oversDisplay) {
}
