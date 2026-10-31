package com.cricketlegend.service.support.schedule;

import static com.cricketlegend.service.support.schedule.ScheduleTestSupport.LEAGUE;
import static com.cricketlegend.service.support.schedule.ScheduleTestSupport.SEASON;
import static com.cricketlegend.service.support.schedule.ScheduleTestSupport.ZONE;
import static com.cricketlegend.service.support.schedule.ScheduleTestSupport.existing;
import static com.cricketlegend.service.support.schedule.ScheduleTestSupport.freeText;
import static com.cricketlegend.service.support.schedule.ScheduleTestSupport.league;
import static com.cricketlegend.service.support.schedule.ScheduleTestSupport.ours;
import static org.assertj.core.api.Assertions.assertThat;

import com.cricketlegend.domain.ImportOutcome;
import com.cricketlegend.service.support.schedule.LeagueScheduleIdentity.Evaluation;
import com.cricketlegend.service.support.schedule.LeagueScheduleIdentity.InFileFinding;
import com.cricketlegend.service.support.schedule.LeagueScheduleIdentity.PairMatch;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;

/** docs/specs/098, "Match identity": the key is the unordered pair of resolved sides plus the local date. */
class LeagueScheduleIdentityTest {

    private final ResolvedSide us = ours("Villagers 1");
    private final ResolvedSide police = league("Police 1");

    private ScheduleFixture fixture(int row, ResolvedSide home, ResolvedSide away, String date, String time, String venue) {
        return new ScheduleFixture(row, home, away, LocalDate.parse(date), LocalTime.parse(time), venue);
    }

    private Evaluation evaluate(ScheduleFixture f, ExistingMatch... existing) {
        return LeagueScheduleIdentity.evaluate(LEAGUE, SEASON, f, List.of(existing), ZONE, 14);
    }

    @Test
    void sameKeyWhenHomeAndAwayAreSwapped() {
        ScheduleFixture a = fixture(2, us, police, "2026-09-13", "08:00", "V");
        ScheduleFixture b = fixture(3, police, us, "2026-09-13", "11:00", "W");
        assertThat(LeagueScheduleIdentity.key(LEAGUE, SEASON, a)).isEqualTo(LeagueScheduleIdentity.key(LEAGUE, SEASON, b));
        assertThat(LeagueScheduleIdentity.key(LEAGUE, SEASON, fixture(4, us, police, "2026-09-20", "08:00", "V")))
                .isNotEqualTo(LeagueScheduleIdentity.key(LEAGUE, SEASON, a));
        assertThat(LeagueScheduleIdentity.key(LEAGUE, SEASON, fixture(5, null, police, "2026-09-13", "08:00", "V"))).isNull();
    }

    @Test
    void sameTimeAndVenueIsADuplicate() {
        ExistingMatch m = existing("2026-09-13", "08:00", "Brits Oval", us, police);
        Evaluation e = evaluate(fixture(2, us, police, "2026-09-13", "08:00", "brits  oval"), m);
        assertThat(e.outcome()).isEqualTo(ImportOutcome.DUPLICATE);
        assertThat(e.existing().id()).isEqualTo(m.id());
        assertThat(e.differences()).isEmpty();
    }

    @Test
    void aDifferentTimeIsDiffersWithTheOldAndNewTime() {
        ExistingMatch m = existing("2026-09-13", "11:00", "Brits Oval", us, police);
        Evaluation e = evaluate(fixture(2, us, police, "2026-09-13", "08:00", "Brits Oval"), m);
        assertThat(e.outcome()).isEqualTo(ImportOutcome.DIFFERS);
        assertThat(e.timeChanges()).isTrue();
        assertThat(e.venueChanges()).isFalse();
        assertThat(e.differences()).singleElement().satisfies(d -> {
            assertThat(d.field()).isEqualTo("TIME");
            assertThat(d.oldValue()).isEqualTo("11:00");
            assertThat(d.newValue()).isEqualTo("08:00");
        });
    }

    @Test
    void aDifferentVenueIsDiffersButABlankVenueNeverIs() {
        ExistingMatch m = existing("2026-09-13", "08:00", "Brits Oval", us, police);
        Evaluation moved = evaluate(fixture(2, us, police, "2026-09-13", "08:00", "Laudium Oval"), m);
        assertThat(moved.outcome()).isEqualTo(ImportOutcome.DIFFERS);
        assertThat(moved.venueChanges()).isTrue();
        assertThat(evaluate(fixture(2, us, police, "2026-09-13", "08:00", ""), m).outcome()).isEqualTo(ImportOutcome.DUPLICATE);
    }

    @Test
    void homeAndAwaySwappedIsDiffersAndNotUpdatable() {
        ExistingMatch m = existing("2026-09-13", "08:00", "Brits Oval", police, us);
        Evaluation e = evaluate(fixture(2, us, police, "2026-09-13", "08:00", "Brits Oval"), m);
        assertThat(e.outcome()).isEqualTo(ImportOutcome.DIFFERS);
        assertThat(e.swapped()).isTrue();
        assertThat(e.differences()).extracting("field").containsExactly("HOME_AWAY");
        assertThat(e.timeChanges()).isFalse();
        assertThat(e.venueChanges()).isFalse();
    }

    @Test
    void theSamePairOnAnotherDateIsNewButWarnsInsideTheWindowOnly() {
        ScheduleFixture f = fixture(2, us, police, "2026-09-13", "08:00", "V");
        Evaluation inside = evaluate(f, existing("2026-09-27", "08:00", "V", us, police));
        assertThat(inside.outcome()).isEqualTo(ImportOutcome.POSSIBLE_DUPLICATE);
        assertThat(inside.possibles()).singleElement().satisfies(p -> {
            assertThat(p.code()).isEqualTo(LeagueScheduleIdentity.POSSIBLE_NEARBY);
            assertThat(p.dates()).containsExactly(LocalDate.parse("2026-09-27"));
            assertThat(p.message()).contains("27 Sep 2026");
        });
        Evaluation outside = evaluate(f, existing("2026-09-28", "08:00", "V", us, police));
        assertThat(outside.outcome()).isEqualTo(ImportOutcome.NEW);
    }

    @Test
    void aManualFreeTextMatchWithTheSameNameIsTreatedAsExisting() {
        ExistingMatch manual = freeText("2026-09-13", "08:00", "Brits Oval", us, "POLICE 1");
        assertThat(evaluate(fixture(2, us, police, "2026-09-13", "08:00", "Brits Oval"), manual).outcome())
                .isEqualTo(ImportOutcome.DUPLICATE);
        ExistingMatch manualOtherTime = freeText("2026-09-13", "10:00", "Brits Oval", us, "Police 1");
        assertThat(evaluate(fixture(2, us, police, "2026-09-13", "08:00", "Brits Oval"), manualOtherTime).outcome())
                .isEqualTo(ImportOutcome.DIFFERS);
    }

    @Test
    void aKnownAliasOfTheResolvedSideMatchesAFreeTextName() {
        ResolvedSide aliased = ResolvedSide.leagueTeam(UUID.randomUUID(), "Police 1", true, Set.of("SAPS One"));
        ExistingMatch manual = freeText("2026-09-13", "08:00", "V", us, "SAPS One");
        assertThat(evaluate(fixture(2, us, aliased, "2026-09-13", "08:00", "V"), manual).outcome())
                .isEqualTo(ImportOutcome.DUPLICATE);
    }

    @Test
    void aSimilarFreeTextNameOnTheSameDateIsOnlyAPossibleDuplicateNotTheSameMatch() {
        ExistingMatch manual = freeText("2026-09-14", "08:00", "V", us, "Polise 1");
        Evaluation e = evaluate(fixture(2, us, police, "2026-09-13", "08:00", "V"), manual);
        assertThat(e.outcome()).isEqualTo(ImportOutcome.POSSIBLE_DUPLICATE);
        assertThat(e.possibles()).singleElement().satisfies(p -> assertThat(p.code()).isEqualTo(LeagueScheduleIdentity.POSSIBLE_FREE_TEXT));
        ExistingMatch sameDay = freeText("2026-09-13", "08:00", "V", us, "Polise 1");
        assertThat(evaluate(fixture(2, us, police, "2026-09-13", "08:00", "V"), sameDay).outcome())
                .as("similar is never the same").isEqualTo(ImportOutcome.POSSIBLE_DUPLICATE);
    }

    @Test
    void anOtherLeagueOrSeasonIsIgnored() {
        ScheduleFixture f = fixture(2, us, police, "2026-09-13", "08:00", "V");
        assertThat(evaluate(f, existing(UUID.randomUUID(), "2026-09-13", "08:00", "V", us, police, Set.of())).outcome())
                .isEqualTo(ImportOutcome.NEW);
    }

    @Test
    void pairMatchDistinguishesSameSwappedSimilarAndNone() {
        ScheduleFixture f = fixture(2, us, police, "2026-09-13", "08:00", "V");
        assertThat(LeagueScheduleIdentity.pairMatch(f, existing("2026-09-13", "08:00", "V", us, police))).isEqualTo(PairMatch.SAME);
        assertThat(LeagueScheduleIdentity.pairMatch(f, existing("2026-09-13", "08:00", "V", police, us))).isEqualTo(PairMatch.SWAPPED);
        assertThat(LeagueScheduleIdentity.pairMatch(f, freeText("2026-09-13", "08:00", "V", us, "Polise 1"))).isEqualTo(PairMatch.SIMILAR);
        assertThat(LeagueScheduleIdentity.pairMatch(f, existing("2026-09-13", "08:00", "V", us, league("Brits 1")))).isEqualTo(PairMatch.NONE);
    }

    @Test
    void existingMeetingsCountsThePairWhateverTheDateAndHonoursIgnore() {
        ScheduleFixture f = fixture(2, us, police, "2026-09-13", "08:00", "V");
        ExistingMatch one = existing("2026-10-04", "08:00", "V", us, police);
        ExistingMatch two = existing("2026-11-04", "08:00", "V", police, us);
        ExistingMatch other = existing("2026-11-11", "08:00", "V", us, league("Brits 1"));
        assertThat(LeagueScheduleIdentity.existingMeetings(LEAGUE, SEASON, f, List.of(one, two, other), Set.of())).isEqualTo(2);
        assertThat(LeagueScheduleIdentity.existingMeetings(LEAGUE, SEASON, f, List.of(one, two, other), Set.of(one.id()))).isEqualTo(1);
    }

    @Test
    void duplicatesInTheFileKeepTheFirstRowAndNameBothRows() {
        List<InFileFinding> findings = LeagueScheduleIdentity.duplicatesInFile(LEAGUE, SEASON, List.of(
                fixture(2, us, police, "2026-09-13", "08:00", "Brits Oval"),
                fixture(3, police, us, "2026-09-13", "08:00", "BRITS OVAL"),
                fixture(4, us, police, "2026-09-13", "14:00", "Brits Oval"),
                fixture(5, us, police, "2026-09-20", "08:00", "Brits Oval")));
        assertThat(findings).extracting(InFileFinding::rowNumber).containsExactly(3, 4);
        assertThat(findings.get(0).code()).isEqualTo(LeagueScheduleIdentity.DUPLICATE_IN_FILE);
        assertThat(findings.get(0).firstRowNumber()).isEqualTo(2);
        assertThat(findings.get(1).code()).isEqualTo(LeagueScheduleIdentity.CONFLICTING_IN_FILE);
    }

    @Test
    void venuesAreComparedAfterCasePunctuationAndAccents() {
        assertThat(LeagueScheduleIdentity.normaliseVenue("Hofmeyr Park-A")).isEqualTo("hofmeyrparka");
        assertThat(LeagueScheduleIdentity.normaliseVenue("Café Oval")).isEqualTo("cafeoval");
        assertThat(LeagueScheduleIdentity.normaliseVenue(null)).isEmpty();
    }
}
