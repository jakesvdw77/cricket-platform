package com.cricketlegend.dto;

import com.cricketlegend.dto.LeaderboardTableDto.LeaderboardBasis;
import com.cricketlegend.dto.LeaderboardTableDto.LeaderboardCell;
import com.cricketlegend.dto.LeaderboardTableDto.LeaderboardMinimum;
import com.cricketlegend.dto.LeaderboardTableDto.LeaderboardPageInfo;
import com.cricketlegend.dto.LeaderboardTableDto.LeaderboardSort;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * docs/specs/147, "MyLeaderboardTableDto": one page of a Player Hub standings table (group = batting, bowling or
 * fielding) for a player the caller holds. It is {@link LeaderboardTableDto} (columns, sort, minimum, basis, page, rows)
 * with these Hub changes: each column carries {@code more} (folded behind "More Columns", a server constant), each row
 * carries {@code mine} (the held player's own row), {@code me} is the held player's row and place even when it is not on
 * the returned page (null when the player has no listed figure in scope), the scope has no section, and no row carries a
 * player id (the Hub names a player only by name; the client keys rows by page and index). Names are full names (the
 * signed-in Hub only). Every figure is the {@code PlayerStatsCalculator} figure of the same player. With rankings switched
 * off by {@code HubRankingPolicy} the table is empty (no rows, {@code me} null), never a 404.
 */
public record MyLeaderboardTableDto(
        String group,
        List<MyLeaderboardColumn> columns,
        LeaderboardSort sort,
        MyLeaderboardScope scope,
        LeaderboardMinimum minimum,
        LeaderboardBasis basis,
        LeaderboardPageInfo page,
        List<MyLeaderboardRow> rows,
        MyLeaderboardMe me) {

    /** The filters the figures were computed for. */
    public record MyLeaderboardScope(UUID seasonId, UUID leagueId, UUID teamId) {
    }

    /** As {@code LeaderboardColumnInfo}, plus {@code more}: the column is folded behind "More Columns". */
    public record MyLeaderboardColumn(
            String code,
            String label,
            String longLabel,
            boolean sortable,
            String direction,
            String minimumKind,
            boolean more) {
    }

    /**
     * One player's row. {@code rank} is null for the unranked group. {@code mine} is true for the held player. Cells are
     * keyed by column code.
     */
    public record MyLeaderboardRow(
            Integer rank,
            boolean mine,
            String firstName,
            String lastName,
            String teamName,
            boolean smallSample,
            Map<String, LeaderboardCell> values) {
    }

    /**
     * The held player's row. {@code position} is its zero-based place in the whole ordered list and {@code page} the page
     * (at the requested size) that holds it, so "Jump to" can load that page first.
     */
    public record MyLeaderboardMe(int position, int page, MyLeaderboardRow row) {
    }
}
