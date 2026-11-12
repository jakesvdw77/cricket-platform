package com.cricketlegend.service.support;

import com.cricketlegend.service.support.LeaderboardBoard.Group;
import java.util.Set;

/**
 * docs/specs/147, "MyLeaderboardTableDto": which standings columns the Player Hub folds behind "More Columns". A server
 * constant (the client never decides): batting Balls, SR, Outs and 100+; bowling Mdn, Dots, SR, 4W and 5W; fielding none.
 * The sorted column is always shown by the client whatever this says. Pure.
 */
public final class HubLeaderboardColumns {

    private static final Set<LeaderboardColumn> MORE = Set.of(
            LeaderboardColumn.BAT_BALLS,
            LeaderboardColumn.BAT_STRIKE_RATE,
            LeaderboardColumn.BAT_OUTS,
            LeaderboardColumn.BAT_HUNDRED_PLUS,
            LeaderboardColumn.BOWL_MAIDENS,
            LeaderboardColumn.BOWL_DOTS,
            LeaderboardColumn.BOWL_STRIKE_RATE,
            LeaderboardColumn.BOWL_FOUR_W,
            LeaderboardColumn.BOWL_FIVE_W);

    private HubLeaderboardColumns() {}

    /** Whether the column is folded behind "More Columns" in the Player Hub. */
    public static boolean isMore(LeaderboardColumn column) {
        return MORE.contains(column);
    }

    /** Whether the group has any folded column (fielding has none). */
    public static boolean hasMore(Group group) {
        return LeaderboardColumn.of(group).stream().anyMatch(MORE::contains);
    }
}
