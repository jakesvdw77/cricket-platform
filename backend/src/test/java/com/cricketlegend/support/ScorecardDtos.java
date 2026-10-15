package com.cricketlegend.support;

import com.cricketlegend.domain.AwardType;
import com.cricketlegend.domain.CreditSource;
import com.cricketlegend.domain.DismissalType;
import com.cricketlegend.domain.FeaturedOverride;
import com.cricketlegend.domain.InningsKind;
import com.cricketlegend.domain.ResultSide;
import com.cricketlegend.dto.BattingEntryDto;
import com.cricketlegend.dto.BowlingEntryDto;
import com.cricketlegend.dto.FieldingEntryDto;
import com.cricketlegend.dto.MatchAwardDto;
import com.cricketlegend.dto.ResultPlayerDto;
import java.util.UUID;

/**
 * Terse builders for the docs/specs/101 scorecard DTOs, shared by the validator unit tests and the service-tier
 * integration tests. Players are new rows identified by a client key; entries refer to a player by that key and the
 * dismissal's bowler and fielder by key too.
 */
public final class ScorecardDtos {

    private ScorecardDtos() {}

    // ---- players ----

    /** A registered player of one of our sides, new on the scorecard under {@code key}. */
    public static ResultPlayerDto registered(ResultSide side, String key, UUID profileId) {
        return new ResultPlayerDto(null, key, side, profileId, null, null, null, false, false, null, null, false, null,
                null);
    }

    public static ResultPlayerDto registered(ResultSide side, String key) {
        return registered(side, key, UUID.randomUUID());
    }

    /** A free-text guest of one of our sides. */
    public static ResultPlayerDto guest(ResultSide side, String key, String name) {
        return new ResultPlayerDto(null, key, side, null, name, null, null, false, false, null, null, false, null, null);
    }

    /** A name-only player of the opposition. */
    public static ResultPlayerDto opposition(ResultSide side, String key, String name) {
        return new ResultPlayerDto(null, key, side, null, name, null, null, false, true, null, null, false, null, null);
    }

    public static ResultPlayerDto substitute(ResultPlayerDto p) {
        return new ResultPlayerDto(p.id(), p.clientKey(), p.side(), p.playerProfileId(), p.displayName(),
                p.plannedBattingOrder(), p.replacedPlayerProfileId(), true, p.opposition(), p.firstName(), p.lastName(),
                p.guest(), p.linkedBy(), p.linkedAt());
    }

    public static ResultPlayerDto withId(ResultPlayerDto p, UUID id) {
        return new ResultPlayerDto(id, null, p.side(), p.playerProfileId(), p.displayName(), p.plannedBattingOrder(),
                p.replacedPlayerProfileId(), p.substitute(), p.opposition(), p.firstName(), p.lastName(), p.guest(),
                p.linkedBy(), p.linkedAt());
    }

    // ---- batting ----

    public static BattingEntryDto bat(
            ResultSide battingSide, String key, DismissalType how, Integer runs, Integer balls, Integer position) {
        return new BattingEntryDto(null, battingSide, InningsKind.REGULAR, null, key, position, how, runs, balls, null,
                null, null, null, null, null, null);
    }

    /** The batting row with the dismissal's bowler and fielder (player keys or ids; null for none). */
    public static BattingEntryDto by(BattingEntryDto e, String bowler, String fielder) {
        return new BattingEntryDto(e.id(), e.battingSide(), e.inningsKind(), e.resultPlayerId(), e.playerClientKey(),
                e.position(), e.howOut(), e.runs(), e.balls(), e.fours(), e.sixes(), bowler, fielder,
                e.featuredOverride(), e.suggested(), e.featured());
    }

    public static BattingEntryDto boundaries(BattingEntryDto e, Integer fours, Integer sixes) {
        return new BattingEntryDto(e.id(), e.battingSide(), e.inningsKind(), e.resultPlayerId(), e.playerClientKey(),
                e.position(), e.howOut(), e.runs(), e.balls(), fours, sixes, e.bowlerPlayerId(), e.fielderPlayerId(),
                e.featuredOverride(), e.suggested(), e.featured());
    }

    public static BattingEntryDto override(BattingEntryDto e, FeaturedOverride override) {
        return new BattingEntryDto(e.id(), e.battingSide(), e.inningsKind(), e.resultPlayerId(), e.playerClientKey(),
                e.position(), e.howOut(), e.runs(), e.balls(), e.fours(), e.sixes(), e.bowlerPlayerId(),
                e.fielderPlayerId(), override, e.suggested(), e.featured());
    }

    public static BattingEntryDto inKind(BattingEntryDto e, InningsKind kind) {
        return new BattingEntryDto(e.id(), e.battingSide(), kind, e.resultPlayerId(), e.playerClientKey(),
                e.position(), e.howOut(), e.runs(), e.balls(), e.fours(), e.sixes(), e.bowlerPlayerId(),
                e.fielderPlayerId(), e.featuredOverride(), e.suggested(), e.featured());
    }

    // ---- bowling ----

    /** A bowling row of the side that bowls in the innings in which {@code battingSide} batted. */
    public static BowlingEntryDto bowl(
            ResultSide battingSide, String key, int balls, int maidens, int runs, int wickets) {
        return new BowlingEntryDto(null, battingSide, InningsKind.REGULAR, null, key, null, balls, maidens, runs,
                wickets, null, null, null, CreditSource.MANUAL, null, null, null, null);
    }

    public static BowlingEntryDto extrasAndDots(BowlingEntryDto e, Integer wides, Integer noBalls, Integer dots) {
        return new BowlingEntryDto(e.id(), e.battingSide(), e.inningsKind(), e.resultPlayerId(), e.playerClientKey(),
                e.bowlingOrder(), e.balls(), e.maidens(), e.runs(), e.wickets(), wides, noBalls, dots,
                e.wicketsSource(), e.featuredOverride(), e.suggested(), e.featured(), e.derivedWickets());
    }

    public static BowlingEntryDto figures(BowlingEntryDto e, int balls, int maidens, int runs, int wickets) {
        return new BowlingEntryDto(e.id(), e.battingSide(), e.inningsKind(), e.resultPlayerId(), e.playerClientKey(),
                e.bowlingOrder(), balls, maidens, runs, wickets, e.wides(), e.noBalls(), e.dots(), e.wicketsSource(),
                e.featuredOverride(), e.suggested(), e.featured(), e.derivedWickets());
    }

    public static BowlingEntryDto derived(BowlingEntryDto e) {
        return new BowlingEntryDto(e.id(), e.battingSide(), e.inningsKind(), e.resultPlayerId(), e.playerClientKey(),
                e.bowlingOrder(), e.balls(), e.maidens(), e.runs(), e.wickets(), e.wides(), e.noBalls(), e.dots(),
                CreditSource.DERIVED, e.featuredOverride(), e.suggested(), e.featured(), e.derivedWickets());
    }

    public static BowlingEntryDto override(BowlingEntryDto e, FeaturedOverride override) {
        return new BowlingEntryDto(e.id(), e.battingSide(), e.inningsKind(), e.resultPlayerId(), e.playerClientKey(),
                e.bowlingOrder(), e.balls(), e.maidens(), e.runs(), e.wickets(), e.wides(), e.noBalls(), e.dots(),
                e.wicketsSource(), override, e.suggested(), e.featured(), e.derivedWickets());
    }

    // ---- fielding ----

    public static FieldingEntryDto field(ResultSide battingSide, String key, int catches, int stumpings, int runOuts) {
        return new FieldingEntryDto(null, battingSide, InningsKind.REGULAR, null, key, catches, stumpings, runOuts,
                CreditSource.MANUAL, null, null, null, null, null, null);
    }

    public static FieldingEntryDto derived(FieldingEntryDto e) {
        return new FieldingEntryDto(e.id(), e.battingSide(), e.inningsKind(), e.resultPlayerId(), e.playerClientKey(),
                e.catches(), e.stumpings(), e.runOuts(), CreditSource.DERIVED, e.featuredOverride(), e.suggested(),
                e.featured(), e.derivedCatches(), e.derivedStumpings(), e.derivedRunOuts());
    }

    public static FieldingEntryDto override(FieldingEntryDto e, FeaturedOverride override) {
        return new FieldingEntryDto(e.id(), e.battingSide(), e.inningsKind(), e.resultPlayerId(), e.playerClientKey(),
                e.catches(), e.stumpings(), e.runOuts(), e.creditsSource(), override, e.suggested(), e.featured(),
                e.derivedCatches(), e.derivedStumpings(), e.derivedRunOuts());
    }

    // ---- awards ----

    /** An award to a player of the scorecard (by key). */
    public static MatchAwardDto award(AwardType type, ResultSide side, String key) {
        return new MatchAwardDto(null, type, side, null, key, null, null);
    }

    /** An official award to a free-text name. */
    public static MatchAwardDto namedAward(AwardType type, ResultSide side, String name) {
        return new MatchAwardDto(null, type, side, null, null, name, null);
    }
}
