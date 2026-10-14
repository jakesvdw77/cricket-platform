package com.cricketlegend.service.support;

import com.cricketlegend.domain.BattingEntry;
import com.cricketlegend.domain.BowlingEntry;
import com.cricketlegend.domain.FieldingEntry;
import com.cricketlegend.domain.MatchInnings;
import com.cricketlegend.domain.ResultPlayer;
import java.util.List;

/** docs/specs/101: the stored scorecard of one result, loaded once: its regular innings, players and entries. */
public record ScorecardRows(
        List<MatchInnings> innings,
        List<ResultPlayer> players,
        List<BattingEntry> batting,
        List<BowlingEntry> bowling,
        List<FieldingEntry> fielding) {
}
