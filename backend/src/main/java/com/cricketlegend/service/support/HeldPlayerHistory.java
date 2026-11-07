package com.cricketlegend.service.support;

import com.cricketlegend.dto.PlayerDashboardDto;
import com.cricketlegend.dto.PlayerMatchRowDto;
import java.util.List;
import java.util.UUID;

/**
 * docs/specs/147: everything the Player Hub "My stats" figures and the match drill are built from, read once for a held
 * player in the Player Hub scope: the whole-scope counters, the counted matches (newest {@code
 * DashboardLimits#HISTORY_CAP}, oldest first, as full match rows), the batting rows with their position, bowler and field
 * facts, the batters the player dismissed, the per-season counters (the Season filter ignored) and the Dashboard series
 * built from the same rows. Pure data: no Spring, repository, entity, caller or access information.
 */
public record HeldPlayerHistory(
        PlayerStatsCounters counters,
        boolean truncated,
        List<PlayerMatchRowDto> rowsOldestFirst,
        List<PlayerStatsCalculator.RawBattingDetail> battingDetail,
        List<PlayerStatsCalculator.WicketDetail> wicketDetail,
        List<SeasonRaw> seasons,
        PlayerDashboardDto series) {

    /** One season's additive counters before the season's label and start are attached. */
    public record SeasonRaw(UUID seasonId, long matches, long innings, long dismissals, long runs, long wickets) {
    }
}
