package com.cricketlegend.support;

import com.cricketlegend.domain.DismissalType;
import com.cricketlegend.domain.InningsKind;
import com.cricketlegend.domain.ResultOutcomeType;
import com.cricketlegend.domain.TossDecision;
import com.cricketlegend.dto.ImportedResultDto;
import com.cricketlegend.dto.ImportedResultDto.Awards;
import com.cricketlegend.dto.ImportedResultDto.Batting;
import com.cricketlegend.dto.ImportedResultDto.Bowling;
import com.cricketlegend.dto.ImportedResultDto.Extras;
import com.cricketlegend.dto.ImportedResultDto.Innings;
import com.cricketlegend.dto.ImportedResultDto.Match;
import com.cricketlegend.dto.ImportedResultDto.PlayerEntry;
import com.cricketlegend.dto.ImportedResultDto.Result;
import com.cricketlegend.dto.ImportedResultDto.Source;
import com.cricketlegend.dto.ImportedResultDto.Team;
import com.cricketlegend.dto.ImportedResultDto.Toss;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

/**
 * Terse builders for the docs/specs/104 common import document, shared by the validator, adaptor and processor unit
 * tests. Every name is invented. {@link #builder()} starts from a document that raises no validation error.
 */
public final class ImportedResults {

    private ImportedResults() {}

    public static Team team(String key, String name) {
        return new Team(key, name, null, null);
    }

    public static Batting bat(String player, DismissalType how, String bowler, String fielder, Integer runs, Integer balls) {
        return new Batting(player, null, how, bowler, fielder, runs, balls, null, null);
    }

    public static Batting notOut(String player, Integer runs, Integer balls) {
        return bat(player, DismissalType.NOT_OUT, null, null, runs, balls);
    }

    public static Bowling bowl(String player, String overs, Integer maidens, Integer runs, Integer wickets) {
        return new Bowling(player, overs, maidens, runs, wickets, null, null, null);
    }

    public static Innings innings(String battingTeam, Integer runs, Integer wickets, String overs,
                                  List<Batting> batting, List<String> didNotBat, List<Bowling> bowling) {
        return new Innings(battingTeam, null, runs, wickets, overs, null, batting, didNotBat, bowling, null, null, null);
    }

    public static Innings withKind(Innings i, InningsKind kind) {
        return new Innings(i.battingTeam(), kind, i.runs(), i.wickets(), i.overs(), i.extras(), i.batting(),
                i.didNotBat(), i.bowling(), i.fallOfWickets(), i.overByOver(), i.exactness());
    }

    public static Innings withExtras(Innings i, Extras extras) {
        return new Innings(i.battingTeam(), i.kind(), i.runs(), i.wickets(), i.overs(), extras, i.batting(),
                i.didNotBat(), i.bowling(), i.fallOfWickets(), i.overByOver(), i.exactness());
    }

    public static Result won(String winner, Integer scheduledOvers) {
        return new Result(ResultOutcomeType.WON, winner, null, null, null, scheduledOvers, null, null, null);
    }

    public static Builder builder() {
        return new Builder();
    }

    /** A mutable builder; the default document has two teams, a locator and nothing else. */
    public static final class Builder {
        private Integer schemaVersion = 1;
        private Source source = new Source(null, "EXAMPLE", "match-1", null);
        private Match match = new Match(null, LocalDate.of(2026, 10, 10), null, "Main Oval", null, null);
        private List<Team> teams = new ArrayList<>(List.of(team("A", "Home Club 1"), team("B", "Visitors 1")));
        private Toss toss;
        private Result result;
        private List<Innings> innings;
        private List<PlayerEntry> players;
        private Awards awards;

        public Builder schemaVersion(Integer v) { this.schemaVersion = v; return this; }
        public Builder source(Source v) { this.source = v; return this; }
        public Builder match(Match v) { this.match = v; return this; }
        public Builder teams(Team... v) { this.teams = new ArrayList<>(java.util.Arrays.asList(v)); return this; }
        public Builder toss(String wonBy, TossDecision decision) { this.toss = new Toss(wonBy, decision, null); return this; }
        public Builder result(Result v) { this.result = v; return this; }
        public Builder innings(Innings... v) { this.innings = new ArrayList<>(java.util.Arrays.asList(v)); return this; }
        public Builder players(PlayerEntry... v) { this.players = new ArrayList<>(java.util.Arrays.asList(v)); return this; }
        public Builder awards(Awards v) { this.awards = v; return this; }

        public ImportedResultDto build() {
            return new ImportedResultDto(schemaVersion, source, match, teams, toss, result, innings, players, awards);
        }
    }

    /** A valid one-innings-each document with a few rows, for tests that need "a real" scorecard. */
    public static ImportedResultDto fullScorecard() {
        return builder()
                .toss("B", TossDecision.BAT)
                .result(new Result(ResultOutcomeType.WON, "A", null,
                        new ImportedResultDto.Margin(com.cricketlegend.domain.ResultMarginType.RUNS, 24), null, 40, null, null, null))
                .innings(
                        withExtras(innings("B", 180, 9, "40.0",
                                List.of(bat("Jon Smith", DismissalType.CAUGHT, "Cees Meyer", "Abel Nazar", 42, 51),
                                        bat("Pat Jones", DismissalType.RUN_OUT, null, "Abel Nazar", 10, 14),
                                        notOut("Rob Brown", 30, 28)),
                                List.of("Tim Hill"),
                                List.of(bowl("Cees Meyer", "8.0", 1, 31, 3))), new Extras(6, 1, 2, 1, 0)),
                        innings("A", 150, 10, "38.3",
                                List.of(bat("Abel Nazar", DismissalType.BOWLED, "Jon Smith", null, 60, 55)),
                                List.of(), List.of(bowl("Jon Smith", "9.0", 0, 40, 2))))
                .build();
    }
}
