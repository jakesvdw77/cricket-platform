package com.cricketlegend.dto;

import java.util.List;

/**
 * docs/specs/101-match-results-our-side-scorecard.md: our side's scorecard (one or two ours sides). The same shape is
 * the optional {@code scorecard} section of a {@link ResultDraft}: on write only {@code players}, {@code batting},
 * {@code bowling}, {@code fielding} and {@code awards} are read (the extras breakdown travels on the innings); {@code
 * innings} and {@code status} are read-only. Absent on a draft means "untouched"; present replaces the whole scorecard.
 */
public record ScorecardDto(
        List<ResultPlayerDto> players,
        List<BattingEntryDto> batting,
        List<BowlingEntryDto> bowling,
        List<FieldingEntryDto> fielding,
        List<MatchAwardDto> awards,
        List<ScorecardInningsDto> innings,
        List<ScorecardSideStatusDto> status) {

    public ScorecardDto {
        players = players == null ? List.of() : List.copyOf(players);
        batting = batting == null ? List.of() : List.copyOf(batting);
        bowling = bowling == null ? List.of() : List.copyOf(bowling);
        fielding = fielding == null ? List.of() : List.copyOf(fielding);
        awards = awards == null ? List.of() : List.copyOf(awards);
        innings = innings == null ? List.of() : List.copyOf(innings);
        status = status == null ? List.of() : List.copyOf(status);
    }

    /** True when no player was recorded: such a scorecard is the same as none. */
    @com.fasterxml.jackson.annotation.JsonIgnore
    public boolean isEmpty() {
        return players.isEmpty();
    }
}
