package com.cricketlegend.service.support;

import com.cricketlegend.dto.LeagueDto;

/**
 * One league of the Leagues list for a season, with the figure only the quick filters and the summary need (a top-level
 * type because {@code service.impl} allows only {@code *Impl} classes). See docs/specs/091-leagues-gold-standard.md.
 */
public record LeagueListRow(LeagueDto dto, int weekMatchCount) {

    /** An active league with no teams entered or no matches scheduled in the season. */
    public boolean needsAttention() {
        return dto.active()
                && (dto.teams() == null || dto.teams().isEmpty() || dto.matchCount() == null || dto.matchCount() == 0);
    }
}
