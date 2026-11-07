package com.cricketlegend.service.support;

import com.cricketlegend.domain.DismissalType;
import com.cricketlegend.domain.ResultOutcomeType;
import com.cricketlegend.domain.ResultSide;
import com.cricketlegend.repository.PlayerStatsFactsRepository.BattingDetailView;
import com.cricketlegend.repository.PlayerStatsFactsRepository.ResultVenueView;
import com.cricketlegend.repository.PlayerStatsFactsRepository.BowlingCreditView;
import com.cricketlegend.repository.PlayerStatsFactsRepository.MatchAwardView;
import com.cricketlegend.repository.PlayerStatsFactsRepository.MatchBattingView;
import com.cricketlegend.repository.PlayerStatsFactsRepository.MatchBowlingView;
import com.cricketlegend.repository.PlayerStatsFactsRepository.MatchFieldingView;
import com.cricketlegend.repository.PlayerStatsFactsRepository.MatchHeaderView;
import com.cricketlegend.repository.PlayerStatsFactsRepository.SeasonCountersView;
import com.cricketlegend.repository.PlayerStatsFactsRepository.WicketDetailView;
import java.time.Instant;

/**
 * docs/specs/115-player-match-list.md: turns the rows of the match-list queries into the plain inputs of {@link
 * PlayerMatchRowBuilder}, so the builder stays free of repository types. It copies values and parses the stored
 * enum names; nothing is decided here.
 */
public final class PlayerMatchFactsReader {

    private PlayerMatchFactsReader() {}

    public static PlayerMatchRowBuilder.MatchHeader toHeader(MatchHeaderView v) {
        return new PlayerMatchRowBuilder.MatchHeader(
                v.getResultId(),
                v.getMatchId(),
                Instant.ofEpochMilli(v.getMatchEpochMillis()),
                v.getBallsPerOver(),
                ResultOutcomeType.valueOf(v.getOutcome()),
                v.getWinningSide() == null ? null : ResultSide.valueOf(v.getWinningSide()),
                Boolean.TRUE.equals(v.getDerby()),
                Boolean.TRUE.equals(v.getOnHome()),
                Boolean.TRUE.equals(v.getOnAway()),
                v.getLeagueId(),
                v.getLeagueName(),
                v.getHomeTeamId(),
                v.getHomeTeamName(),
                v.getAwayTeamId(),
                v.getAwayTeamName(),
                v.getOpponentName(),
                Boolean.TRUE.equals(v.getHasBattingCard()),
                Boolean.TRUE.equals(v.getHasBowlingCard()));
    }

    public static PlayerMatchRowBuilder.BattingFact toBatting(MatchBattingView v) {
        return new PlayerMatchRowBuilder.BattingFact(
                v.getResultId(),
                v.getRuns(),
                v.getBalls(),
                v.getFours(),
                v.getSixes(),
                DismissalType.valueOf(v.getHowOut()));
    }

    public static PlayerMatchRowBuilder.BowlingFact toBowling(MatchBowlingView v) {
        return new PlayerMatchRowBuilder.BowlingFact(
                v.getResultId(),
                n(v.getBalls()),
                n(v.getMaidens()),
                n(v.getRuns()),
                n(v.getWickets()),
                v.getDots(),
                v.getWides(),
                v.getNoBalls());
    }

    /** docs/specs/117: a bowling row with the dismissals of its innings that name the bowler. */
    public static PlayerStatsCalculator.BowlingCredit toCredit(BowlingCreditView v) {
        return new PlayerStatsCalculator.BowlingCredit(
                v.getBowlingEntryId(),
                n(v.getWickets()),
                v.getHowOut() == null ? null : DismissalType.valueOf(v.getHowOut()),
                n(v.getCredited()));
    }

    public static PlayerMatchRowBuilder.FieldingFact toFielding(MatchFieldingView v) {
        return new PlayerMatchRowBuilder.FieldingFact(
                v.getResultId(), n(v.getCatches()), n(v.getStumpings()), n(v.getRunOuts()));
    }

    public static PlayerMatchRowBuilder.AwardFact toAward(MatchAwardView v) {
        return new PlayerMatchRowBuilder.AwardFact(
                v.getResultId(), n(v.getPlayerOfMatch()), n(v.getTeamPlayerOfMatch()));
    }

    /** docs/specs/147: a counted batting row with its innings sequence, position, bowler and field facts. */
    public static PlayerStatsCalculator.RawBattingDetail toBattingDetail(BattingDetailView v) {
        return new PlayerStatsCalculator.RawBattingDetail(
                v.getResultId(),
                n(v.getInningsSequence()),
                v.getPosition(),
                v.getRuns(),
                v.getBalls(),
                v.getFours(),
                v.getSixes(),
                DismissalType.valueOf(v.getHowOut()),
                v.getBowlerName(),
                v.getSeasonId(),
                Boolean.TRUE.equals(v.getFieldKnown()),
                Boolean.TRUE.equals(v.getClubField()),
                v.getAreaId(),
                v.getAreaName());
    }

    /** docs/specs/147 amendment 2: the playing area of a counted match. */
    public static PlayerStatsCalculator.ResultVenue toResultVenue(ResultVenueView v) {
        return new PlayerStatsCalculator.ResultVenue(
                v.getResultId(), v.getAreaId(), v.getAreaName(), Boolean.TRUE.equals(v.getClubField()));
    }

    /** docs/specs/147: a batter the player dismissed. */
    public static PlayerStatsCalculator.WicketDetail toWicketDetail(WicketDetailView v) {
        return new PlayerStatsCalculator.WicketDetail(
                v.getResultId(), v.getPosition(), DismissalType.valueOf(v.getHowOut()), v.getFielderName());
    }

    /** docs/specs/147: one season's additive counters. */
    public static HeldPlayerHistory.SeasonRaw toSeasonRaw(SeasonCountersView v) {
        return new HeldPlayerHistory.SeasonRaw(
                v.getSeasonId(), n(v.getMatches()), n(v.getInnings()), n(v.getDismissals()), n(v.getRuns()), n(v.getWickets()));
    }

    private static int n(Integer value) {
        return value == null ? 0 : value;
    }

    private static long n(Long value) {
        return value == null ? 0L : value;
    }
}
