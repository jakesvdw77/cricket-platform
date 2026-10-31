package com.cricketlegend.service.support.schedule;

import static com.cricketlegend.service.support.schedule.ScheduleTestSupport.LEAGUE;
import static com.cricketlegend.service.support.schedule.ScheduleTestSupport.SEASON_RANGE;
import static com.cricketlegend.service.support.schedule.ScheduleTestSupport.ZONE;
import static com.cricketlegend.service.support.schedule.ScheduleTestSupport.ctx;
import static com.cricketlegend.service.support.schedule.ScheduleTestSupport.ctxWith;
import static com.cricketlegend.service.support.schedule.ScheduleTestSupport.excluded;
import static com.cricketlegend.service.support.schedule.ScheduleTestSupport.existing;
import static com.cricketlegend.service.support.schedule.ScheduleTestSupport.freeText;
import static com.cricketlegend.service.support.schedule.ScheduleTestSupport.league;
import static com.cricketlegend.service.support.schedule.ScheduleTestSupport.ours;
import static com.cricketlegend.service.support.schedule.ScheduleTestSupport.row;
import static org.assertj.core.api.Assertions.assertThat;

import com.cricketlegend.domain.ImportIssueSeverity;
import com.cricketlegend.domain.ImportOutcome;
import com.cricketlegend.domain.ImportRowAction;
import com.cricketlegend.domain.ImportRowStatus;
import com.cricketlegend.domain.ImportScopeMode;
import com.cricketlegend.dto.ImportIssueDto;
import com.cricketlegend.service.support.schedule.LeagueScheduleValidator.Context;
import com.cricketlegend.service.support.schedule.LeagueScheduleValidator.DateRange;
import com.cricketlegend.service.support.schedule.LeagueScheduleValidator.Result;
import com.cricketlegend.service.support.schedule.LeagueScheduleValidator.Row;
import com.cricketlegend.service.support.schedule.LeagueScheduleValidator.RowResult;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;

/**
 * docs/specs/098, "Validation list": each rule code raised, each in ALL and OURS_ONLY where the mode matters. Pure, so
 * no Spring and no database: parsed rows, resolved sides and existing matches are built by hand.
 */
class LeagueScheduleValidatorTest {

    private static final ImportScopeMode ALL = ImportScopeMode.ALL;
    private static final ImportScopeMode OURS_ONLY = ImportScopeMode.OURS_ONLY;

    private final ResolvedSide us1 = ours("Villagers 1");
    private final ResolvedSide us2 = ours("Villagers 2");
    private final ResolvedSide police = league("Police 1");
    private final ResolvedSide laudium = league("Laudium 1");
    private final ResolvedSide brits = league("Brits 1");
    private final ResolvedSide pretoria = league("Pretoria 1");

    // ---- helpers ----

    private static RowResult of(Result r, int rowNumber) {
        return r.rows().stream().filter(x -> x.rowNumber() == rowNumber).findFirst().orElseThrow();
    }

    private static List<String> codes(Result r) {
        return r.issues().stream().map(ImportIssueDto::code).toList();
    }

    private static boolean has(Result r, String code) {
        return codes(r).contains(code);
    }

    private static boolean has(Result r, String code, int rowNumber) {
        return r.issues().stream().anyMatch(i -> i.code().equals(code) && i.rowNumbers().contains(rowNumber));
    }

    private static ImportIssueDto issue(Result r, String code) {
        return r.issues().stream().filter(i -> i.code().equals(code)).findFirst().orElseThrow();
    }

    private static boolean hasNote(Result r, String code) {
        return r.notes().stream().anyMatch(n -> n.code().equals(code));
    }

    private static Result validate(Context ctx, Row... rows) {
        return LeagueScheduleValidator.validate(List.of(rows), ctx);
    }

    private Row clean() {
        return row(2, "2026-09-13", "08:00", us1, police, "Brits Oval");
    }

    // ---- a clean row ----

    @Test
    void aCleanRowIsOkNewAndCreated() {
        Result r = validate(ctx(ALL), clean());
        RowResult row = of(r, 2);
        assertThat(row.status()).isEqualTo(ImportRowStatus.OK);
        assertThat(row.outcome()).isEqualTo(ImportOutcome.NEW);
        assertThat(row.action()).isEqualTo(ImportRowAction.CREATE);
        assertThat(row.issueCodes()).isEmpty();
        assertThat(row.start()).isEqualTo(ScheduleTestSupport.at("2026-09-13", "08:00"));
        assertThat(r.issues()).isEmpty();
        assertThat(r.hasErrors()).isFalse();
    }

    @Test
    void anExcludedRowRaisesNothingAndCountsForNothing() {
        Row bad = excluded(row(2, "not a date", "25:00", null, null, ""));
        Result r = validate(ctx(ALL), bad);
        assertThat(r.issues()).isEmpty();
        assertThat(of(r, 2).action()).isEqualTo(ImportRowAction.EXCLUDED);
        assertThat(of(r, 2).outcome()).isNull();
    }

    // ---- file level ----

    @Test
    void fileLevelFindingsAreRaisedWithNoRowNumbers() {
        Context c = new Context(ALL, ZONE, LEAGUE, UUID.randomUUID(), "2026/27", SEASON_RANGE, null, 14, List.of(),
                List.of(), Set.of(), false, "This league is inactive. Activate it before importing a schedule.",
                "Premier, 2025/26", "You imported this file on 1 Oct 2026");
        Result r = validate(c, clean());
        assertThat(issue(r, "LEAGUE_OR_SEASON_INVALID").severity()).isEqualTo(ImportIssueSeverity.ERROR);
        assertThat(issue(r, "LEAGUE_OR_SEASON_INVALID").rowNumbers()).isEmpty();
        assertThat(issue(r, "TEMPLATE_SCOPE_MISMATCH").severity()).isEqualTo(ImportIssueSeverity.WARNING);
        assertThat(issue(r, "TEMPLATE_SCOPE_MISMATCH").message()).contains("Premier, 2025/26");
        assertThat(issue(r, "FILE_IMPORTED_BEFORE").severity()).isEqualTo(ImportIssueSeverity.WARNING);
    }

    // ---- dates and times ----

    @Test
    void anUnreadableOrMissingDateIsAnError() {
        Result r = validate(ctx(ALL), row(2, "09/13/2026", "08:00", us1, police, "V"), row(3, "", "08:00", us1, laudium, "V"));
        assertThat(has(r, "DATE_INVALID", 2)).isTrue();
        assertThat(has(r, "DATE_INVALID", 3)).isTrue();
        assertThat(of(r, 2).status()).isEqualTo(ImportRowStatus.ERROR);
        assertThat(r.hasErrors()).isTrue();
    }

    @Test
    void aDateOutsideTheSeasonIsAnError() {
        Result r = validate(ctx(ALL), row(2, "2026-08-30", "08:00", us1, police, "V"));
        assertThat(has(r, "DATE_OUTSIDE_SEASON", 2)).isTrue();
        assertThat(issue(r, "DATE_OUTSIDE_SEASON").message()).contains("2026/27");
    }

    @Test
    void moreThanHalfOutsideTheSeasonAddsAFileLevelError() {
        Result r = validate(ctx(ALL),
                row(2, "2025-09-14", "08:00", us1, police, "V"), row(3, "2025-09-21", "08:00", us1, laudium, "V"),
                row(4, "2026-09-13", "08:00", us1, brits, "V"));
        ImportIssueDto file = issue(r, "FILE_DATES_OUTSIDE_SEASON");
        assertThat(file.rowNumbers()).isEmpty();
        assertThat(file.message()).contains("2 of 3").contains("wrong season");
        Result onlyOne = validate(ctx(ALL), row(2, "2025-09-14", "08:00", us1, police, "V"),
                row(3, "2026-09-13", "08:00", us1, laudium, "V"));
        assertThat(has(onlyOne, "FILE_DATES_OUTSIDE_SEASON")).isFalse();
    }

    @Test
    void aDateInsideTheSeasonButOutsideTheLeagueDatesHasItsOwnError() {
        DateRange leagueDates = new DateRange(LocalDate.of(2026, 10, 1), LocalDate.of(2027, 2, 28));
        Result r = validate(ctx(ALL, SEASON_RANGE, leagueDates), row(2, "2026-09-13", "08:00", us1, police, "V"));
        assertThat(has(r, "DATE_OUTSIDE_LEAGUE_DATES", 2)).isTrue();
        assertThat(has(r, "DATE_OUTSIDE_SEASON")).isFalse();
        assertThat(issue(r, "DATE_OUTSIDE_LEAGUE_DATES").hint()).contains("Extend the league dates");
    }

    @Test
    void anExcelDateNumberIsAWarning() {
        // 46278 is 13 Sep 2026
        Result r = validate(ctx(ALL), row(2, "46278", "08:00", us1, police, "V"));
        assertThat(has(r, "DATE_EXCEL_NUMBER", 2)).isTrue();
        assertThat(issue(r, "DATE_EXCEL_NUMBER").severity()).isEqualTo(ImportIssueSeverity.WARNING);
        assertThat(of(r, 2).status()).isEqualTo(ImportRowStatus.WARNING);
    }

    @Test
    void numericDatesReadableBothWaysRaiseTheDayFirstWarningAndTwoDigitYearsOnlyANote() {
        Result r = validate(ctx(ALL), row(2, "3/10/26", "08:00", us1, police, "V"));
        assertThat(has(r, "DATE_DAY_FIRST", 2)).isTrue();
        assertThat(hasNote(r, "DATE_TWO_DIGIT_YEAR")).isTrue();
        assertThat(has(r, "DATE_TWO_DIGIT_YEAR")).isFalse();
    }

    @Test
    void aMissingOrBadTimeIsAnError() {
        Result r = validate(ctx(ALL), row(2, "2026-09-13", "", us1, police, "V"), row(3, "2026-09-13", "24:00", us1, laudium, "V"));
        assertThat(has(r, "TIME_INVALID", 2)).isTrue();
        assertThat(has(r, "TIME_INVALID", 3)).isTrue();
    }

    @Test
    void aTimeThatDoesNotExistBecauseOfADaylightSavingGapIsAnError() {
        Context london = new Context(ALL, ZoneId.of("Europe/London"), LEAGUE, ScheduleTestSupport.SEASON, "2026/27",
                new DateRange(LocalDate.of(2026, 3, 1), LocalDate.of(2026, 10, 31)), null, 14, List.of(), List.of(),
                Set.of(), false, null, null, null);
        Result r = validate(london, row(2, "2026-03-29", "01:30", us1, police, "V"));
        assertThat(has(r, "TIME_INVALID", 2)).isTrue();
        assertThat(issue(r, "TIME_INVALID").message()).contains("clocks change");
    }

    // ---- teams ----

    @Test
    void aBlankTeamIsMissing() {
        Result r = validate(ctx(ALL), row(2, "2026-09-13", "08:00", "", null, "Police 1", police, "V"));
        assertThat(has(r, "TEAM_MISSING", 2)).isTrue();
    }

    @Test
    void anUnlinkedNameIsUnresolved() {
        Result r = validate(ctx(ALL), row(2, "2026-09-13", "08:00", "Villagers 1", us1, "POLICE 1", null, "V"));
        assertThat(has(r, "TEAM_UNRESOLVED", 2)).isTrue();
        assertThat(issue(r, "TEAM_UNRESOLVED").message()).contains("POLICE 1");
    }

    @Test
    void aTeamPlayingItselfIsAnErrorIncludingTwoNamesResolvedToOneTeam() {
        Result r = validate(ctx(ALL), row(2, "2026-09-13", "08:00", "Police 1", police, "POLICE ONE", police, "V"));
        assertThat(has(r, "TEAM_SAME_BOTH_SIDES", 2)).isTrue();
    }

    @Test
    void aTeamToCreateThatCollidesWithAnInactiveLeagueTeamIsAnError() {
        ResolvedSide clash = ResolvedSide.toCreate("Brits Vets 1", new ResolvedSide.Collision("Brits Vets 1", true));
        Result r = validate(ctx(ALL), row(2, "2026-09-13", "08:00", us1, clash, "V"));
        assertThat(has(r, "TEAM_NAME_COLLISION", 2)).isTrue();
        assertThat(issue(r, "TEAM_NAME_COLLISION").message()).contains("(inactive)").contains("reactivate");
    }

    @Test
    void aLinkedInactiveLeagueTeamIsAnError() {
        ResolvedSide inactive = ResolvedSide.leagueTeam(UUID.randomUUID(), "Old Team", false, Set.of());
        Result r = validate(ctx(ALL), row(2, "2026-09-13", "08:00", us1, inactive, "V"));
        assertThat(has(r, "TEAM_INACTIVE", 2)).isTrue();
    }

    // ---- duplicates inside the file ----

    @Test
    void aRepeatedRowIsADuplicateAndAChangedRepeatIsAConflict() {
        Result dup = validate(ctx(ALL), row(2, "2026-09-13", "08:00", us1, police, "V"),
                row(3, "2026-09-13", "08:00", police, us1, "v"));
        assertThat(has(dup, "DUPLICATE_ROW_IN_FILE", 3)).isTrue();
        assertThat(has(dup, "DUPLICATE_ROW_IN_FILE", 2)).isFalse();
        assertThat(of(dup, 3).action()).isEqualTo(ImportRowAction.SKIP);

        Result conflict = validate(ctx(ALL), row(2, "2026-09-13", "08:00", us1, police, "V"),
                row(3, "2026-09-13", "11:00", us1, police, "V"));
        assertThat(has(conflict, "CONFLICTING_ROW_IN_FILE", 3)).isTrue();
        assertThat(issue(conflict, "CONFLICTING_ROW_IN_FILE").message()).contains("Row 3").contains("Row 2");
    }

    @Test
    void messagesNameAddedRowsAsNew() {
        Result r = validate(ctx(ALL), row(2, "2026-09-13", "08:00", us1, police, "V"),
                row(1001, "2026-09-13", "08:00", us1, police, "V"));
        assertThat(issue(r, "DUPLICATE_ROW_IN_FILE").message()).startsWith("New 1 repeats Row 2");
    }

    // ---- own team overlap and same date ----

    @Test
    void anOwnTeamTwiceWithinTwoHoursIsAnErrorInBothModes() {
        for (ImportScopeMode mode : List.of(ALL, OURS_ONLY)) {
            Result r = validate(ctx(mode), row(2, "2026-09-13", "08:00", us1, police, "A"),
                    row(3, "2026-09-13", "09:30", us1, laudium, "B"));
            assertThat(has(r, "OWN_TEAM_OVERLAP", 2)).as(mode.name()).isTrue();
            assertThat(has(r, "OWN_TEAM_OVERLAP", 3)).as(mode.name()).isTrue();
        }
    }

    @Test
    void exactlyTwoHoursApartIsNotAnOverlapButIsASameDateWarning() {
        Result r = validate(ctx(ALL), row(2, "2026-09-13", "08:00", us1, police, "A"),
                row(3, "2026-09-13", "10:00", us1, laudium, "B"));
        assertThat(has(r, "OWN_TEAM_OVERLAP")).isFalse();
        assertThat(has(r, "OWN_TEAM_SAME_DATE", 2)).isTrue();
        assertThat(has(r, "OWN_TEAM_SAME_DATE", 3)).isTrue();
    }

    @Test
    void anOwnTeamOverlapIsFoundAgainstAnExistingMatchInAnotherLeague() {
        ExistingMatch other = existing(UUID.randomUUID(), "2026-09-13", "08:30", "Elsewhere", us1, brits, Set.of());
        for (ImportScopeMode mode : List.of(ALL, OURS_ONLY)) {
            Result r = validate(ctx(mode, other), row(2, "2026-09-13", "08:00", us1, police, "A"));
            assertThat(has(r, "OWN_TEAM_OVERLAP", 2)).as(mode.name()).isTrue();
            assertThat(issue(r, "OWN_TEAM_OVERLAP").message()).contains("an existing match");
        }
    }

    @Test
    void anInactiveExistingMatchDoesNotOverlap() {
        ExistingMatch live = existing(UUID.randomUUID(), "2026-09-13", "08:30", "Elsewhere", us1, brits, Set.of());
        ExistingMatch inactive = new ExistingMatch(live.id(), live.leagueId(), live.seasonId(), live.start(), live.venue(),
                live.home(), live.away(), false, Set.of());
        assertThat(has(validate(ctx(ALL, inactive), row(2, "2026-09-13", "08:00", us1, police, "A")), "OWN_TEAM_OVERLAP"))
                .isFalse();
    }

    // ---- venue clash ----

    @Test
    void theUsersSampleThreeMatchesAtOneVenueIsFine() {
        Result r = validate(ctx(ALL), row(2, "2026-09-13", "08:00", police, laudium, "BRITS OVAL"),
                row(3, "2026-09-13", "11:00", brits, pretoria, "BRITS OVAL"),
                row(4, "2026-09-13", "14:30", league("A"), league("B"), "BRITS OVAL"));
        assertThat(has(r, "VENUE_TIME_CLASH")).isFalse();
    }

    @Test
    void venueClashThresholdIsExactlyOneHundredAndEightyMinutes() {
        Result exactly = validate(ctx(OURS_ONLY), row(2, "2026-09-13", "08:00", us1, police, "Brits Oval"),
                row(3, "2026-09-13", "11:00", us2, laudium, "brits  oval"));
        assertThat(has(exactly, "VENUE_TIME_CLASH")).as("180 minutes passes").isFalse();
        Result closer = validate(ctx(OURS_ONLY), row(2, "2026-09-13", "08:00", us1, police, "Brits Oval"),
                row(3, "2026-09-13", "10:59", us2, laudium, "Brits-Oval"));
        assertThat(has(closer, "VENUE_TIME_CLASH", 2)).as("179 minutes clashes, after normalising the venue").isTrue();
        assertThat(has(closer, "VENUE_TIME_CLASH", 3)).isTrue();
    }

    @Test
    void aVenueClashWithAnExistingMatchOfAnyCreatorIsRaised() {
        ExistingMatch other = existing(UUID.randomUUID(), "2026-09-13", "09:00", "Brits Oval", brits, pretoria, Set.of());
        Result r = validate(ctx(ALL, other), row(2, "2026-09-13", "08:00", us1, police, "Brits Oval"));
        assertThat(has(r, "VENUE_TIME_CLASH", 2)).isTrue();
        assertThat(issue(r, "VENUE_TIME_CLASH").message()).contains("an existing match");
    }

    // ---- weekday ----

    @Test
    void aRowOnAnotherWeekdayThanTheUsualOneIsFlagged() {
        Result r = validate(ctx(ALL),
                row(2, "2026-09-13", "08:00", police, laudium, "V"), row(3, "2026-09-20", "08:00", brits, pretoria, "V"),
                row(4, "2026-09-27", "08:00", police, brits, "V"), row(5, "2026-09-15", "08:00", laudium, pretoria, "V"));
        assertThat(has(r, "WEEKDAY_MISMATCH", 5)).isTrue();
        assertThat(has(r, "WEEKDAY_MISMATCH", 2)).isFalse();
        assertThat(issue(r, "WEEKDAY_MISMATCH").message()).contains("Sundays").contains("Tuesday");
    }

    @Test
    void noUsualWeekdayBelowSixtyPercent() {
        Result r = validate(ctx(ALL), row(2, "2026-09-13", "08:00", police, laudium, "V"),
                row(3, "2026-09-14", "08:00", brits, pretoria, "V"));
        assertThat(has(r, "WEEKDAY_MISMATCH")).isFalse();
    }

    @Test
    void aWeekdayWordThatContradictsTheDateIsFlagged() {
        Result r = validate(ctx(ALL), row(2, "Mon 13 Sep 2026", "08:00", police, laudium, "V"));
        assertThat(has(r, "WEEKDAY_MISMATCH", 2)).isTrue();
        assertThat(issue(r, "WEEKDAY_MISMATCH").message()).contains("Monday").contains("Sunday");
        assertThat(has(validate(ctx(ALL), row(2, "Sun 13 Sep 2026", "08:00", police, laudium, "V")), "WEEKDAY_MISMATCH")).isFalse();
    }

    // ---- derby, two names, affiliation, venue ----

    @Test
    void twoOfOurOwnTeamsOrTwoNumbersOfOneClubIsADerbyWarning() {
        Result bothOurs = validate(ctx(ALL), row(2, "2026-09-13", "08:00", us1, us2, "V"));
        assertThat(has(bothOurs, "SAME_CLUB_DERBY", 2)).isTrue();
        Result sheetNames = validate(ctx(ALL), row(2, "2026-09-13", "08:00", "LAUDIUM 1", league("Laudium 1"),
                "LAUDIUM 2", league("Laudium 2"), "V"));
        assertThat(has(sheetNames, "SAME_CLUB_DERBY", 2)).isTrue();
        assertThat(issue(sheetNames, "SAME_CLUB_DERBY").severity()).isEqualTo(ImportIssueSeverity.WARNING);
        assertThat(has(validate(ctx(ALL), row(2, "2026-09-13", "08:00", us1, police, "V")), "SAME_CLUB_DERBY")).isFalse();
    }

    @Test
    void twoSheetNamesLinkedToOneTeamIsAWarning() {
        Result r = validate(ctx(ALL), row(2, "2026-09-13", "08:00", "POLICE 1", police, "Brits", brits, "V"),
                row(3, "2026-09-20", "08:00", "POLICE ONE", police, "Pretoria", pretoria, "V"));
        assertThat(has(r, "TWO_NAMES_ONE_TEAM")).isTrue();
        assertThat(issue(r, "TWO_NAMES_ONE_TEAM").message()).contains("POLICE 1").contains("POLICE ONE");
    }

    @Test
    void anOwnTeamNotAffiliatedToTheLeagueIsAWarning() {
        ResolvedSide unaffiliated = ResolvedSide.ownTeam(UUID.randomUUID(), "Villagers 3", false, Set.of());
        Result r = validate(ctx(ALL), row(2, "2026-09-13", "08:00", unaffiliated, police, "V"));
        assertThat(has(r, "OWN_TEAM_NOT_AFFILIATED", 2)).isTrue();
        assertThat(issue(r, "OWN_TEAM_NOT_AFFILIATED").message()).contains("does not affiliate");
    }

    @Test
    void aMissingVenueIsAWarning() {
        Result r = validate(ctx(ALL), row(2, "2026-09-13", "08:00", us1, police, " "));
        assertThat(has(r, "VENUE_MISSING", 2)).isTrue();
        assertThat(of(r, 2).status()).isEqualTo(ImportRowStatus.WARNING);
    }

    @Test
    void aVenueSpelledDifferentlyFromAKnownOneUsesTheKnownSpellingAsANote() {
        Context c = ctxWith(ALL, List.of("Brits Oval"), Set.of(), false);
        Result r = validate(c, row(2, "2026-09-13", "08:00", us1, police, "BRITS-OVAL"));
        assertThat(of(r, 2).venue()).isEqualTo("Brits Oval");
        assertThat(hasNote(r, "VENUE_SPELLING")).isTrue();
        assertThat(has(r, "VENUE_SPELLING")).as("a note is not an issue to acknowledge").isFalse();
        assertThat(of(r, 2).status()).isEqualTo(ImportRowStatus.OK);
    }

    // ---- round rules: ALL only ----

    @Test
    void aTeamTwiceOnOneDateIsAWarningInAllAndNotRaisedInOursOnly() {
        Row first = row(2, "2026-09-13", "08:00", police, laudium, "V");
        Row second = row(3, "2026-09-13", "14:30", police, brits, "W");
        Result all = validate(ctx(ALL), first, second);
        assertThat(has(all, "TEAM_TWICE_SAME_DATE", 2)).isTrue();
        assertThat(issue(all, "TEAM_TWICE_SAME_DATE").message()).contains("Police 1").contains("2 times");
        Result oursOnly = validate(ctx(OURS_ONLY), row(2, "2026-09-13", "08:00", us1, laudium, "V"),
                row(3, "2026-09-13", "14:30", us1, brits, "W"));
        assertThat(has(oursOnly, "TEAM_TWICE_SAME_DATE")).isFalse();
        assertThat(has(oursOnly, "OWN_TEAM_SAME_DATE")).as("own-team rules still raised").isTrue();
    }

    @Test
    void aTeamMissingOnADateWhereHalfThePlayIsAWarningInAllOnly() {
        // four teams in the file; on the 20th only two of them play, so the others are "missing"
        List<Row> rows = List.of(
                row(2, "2026-09-13", "08:00", police, laudium, "V"), row(3, "2026-09-13", "11:00", brits, pretoria, "W"),
                row(4, "2026-09-20", "08:00", police, laudium, "V"));
        Result all = LeagueScheduleValidator.validate(rows, ctx(ALL));
        List<ImportIssueDto> missing = all.issues().stream().filter(i -> i.code().equals("TEAM_MISSING_ON_DATE")).toList();
        assertThat(missing).hasSize(2);
        assertThat(missing).anyMatch(i -> i.message().contains("Brits 1")).anyMatch(i -> i.message().contains("Pretoria 1"));
        assertThat(missing).allMatch(i -> i.rowNumbers().equals(List.of(4)));

        Result oursOnly = LeagueScheduleValidator.validate(List.of(
                row(2, "2026-09-13", "08:00", us1, laudium, "V"), row(3, "2026-09-20", "08:00", us2, brits, "V")),
                ctx(OURS_ONLY));
        assertThat(has(oursOnly, "TEAM_MISSING_ON_DATE")).isFalse();
    }

    @Test
    void aSkippedOrExcludedRowDoesNotCountTowardsTheRound() {
        List<Row> rows = List.of(row(2, "2026-09-13", "08:00", police, laudium, "V"),
                excluded(row(3, "2026-09-13", "11:00", police, brits, "W")));
        assertThat(has(LeagueScheduleValidator.validate(rows, ctx(ALL)), "TEAM_TWICE_SAME_DATE")).isFalse();
    }

    // ---- OURS_ONLY ----

    @Test
    void aRowWithNoTeamOfOursIsSkippedNotOursWithANoteInOursOnlyAndImportedInAll() {
        Row foreign = row(2, "2026-09-13", "08:00", police, laudium, "V");
        Result oursOnly = validate(ctx(OURS_ONLY), foreign, row(3, "2026-09-13", "11:00", us1, brits, "W"));
        RowResult skipped = of(oursOnly, 2);
        assertThat(skipped.status()).isEqualTo(ImportRowStatus.SKIPPED_NOT_OURS);
        assertThat(skipped.outcome()).isEqualTo(ImportOutcome.SKIPPED_NOT_OURS);
        assertThat(skipped.action()).isEqualTo(ImportRowAction.SKIP);
        assertThat(oursOnly.notes()).anyMatch(n -> n.code().equals("SKIPPED_NOT_OURS") && n.rowNumbers().equals(List.of(2))
                && n.message().startsWith("1 of 2 rows"));
        assertThat(of(oursOnly, 3).action()).isEqualTo(ImportRowAction.CREATE);

        Result all = validate(ctx(ALL), foreign);
        assertThat(of(all, 2).action()).isEqualTo(ImportRowAction.CREATE);
        assertThat(of(all, 2).status()).isEqualTo(ImportRowStatus.OK);
    }

    @Test
    void aSkippedNotOursRowRaisesNoErrorsEvenWithBadValues() {
        Result r = validate(ctx(OURS_ONLY), row(2, "garbage", "99:99", "Police 1", league("Police 1"), "Laudium 1",
                league("Laudium 1"), ""));
        assertThat(r.issues()).isEmpty();
        assertThat(of(r, 2).status()).isEqualTo(ImportRowStatus.SKIPPED_NOT_OURS);
    }

    // ---- existing matches: identity outcomes through the validator ----

    @Test
    void anIdenticalExistingMatchIsADuplicateSkippedWithANote() {
        ExistingMatch same = existing("2026-09-13", "08:00", "Brits Oval", us1, police);
        Result r = validate(ctx(ALL, same), clean());
        RowResult row = of(r, 2);
        assertThat(row.outcome()).isEqualTo(ImportOutcome.DUPLICATE);
        assertThat(row.action()).isEqualTo(ImportRowAction.SKIP);
        assertThat(row.existingMatchId()).isEqualTo(same.id());
        assertThat(hasNote(r, "ALREADY_EXISTS")).isTrue();
        assertThat(r.issues()).isEmpty();
    }

    @Test
    void aDifferingTimeIsDiffersAndSkippedUnlessOptedIn() {
        ExistingMatch other = existing("2026-09-13", "11:00", "Brits Oval", us1, police);
        Result skipped = validate(ctx(ALL, other), clean());
        assertThat(of(skipped, 2).outcome()).isEqualTo(ImportOutcome.DIFFERS);
        assertThat(of(skipped, 2).action()).isEqualTo(ImportRowAction.SKIP);
        assertThat(of(skipped, 2).differences()).extracting("field").containsExactly("TIME");
        assertThat(hasNote(skipped, "ROW_DIFFERS")).isTrue();

        Result perRow = validate(ctxWith(ALL, List.of(), Set.of(2), false, other), clean());
        assertThat(of(perRow, 2).action()).isEqualTo(ImportRowAction.UPDATE);
        Result all = validate(ctxWith(ALL, List.of(), Set.of(), true, other), clean());
        assertThat(of(all, 2).action()).isEqualTo(ImportRowAction.UPDATE);
    }

    @Test
    void anUpdateThatMovesTheTimeOfAMatchWithADependantIsBlocked() {
        ExistingMatch withPoll = existing(LEAGUE, "2026-09-13", "11:00", "Brits Oval", us1, police, Set.of("POLL"));
        Result r = validate(ctxWith(ALL, List.of(), Set.of(2), false, withPoll), clean());
        assertThat(has(r, "UPDATE_BLOCKED", 2)).isTrue();
        assertThat(of(r, 2).action()).isEqualTo(ImportRowAction.SKIP);
        assertThat(issue(r, "UPDATE_BLOCKED").message()).contains("POLL");
        // not asked for: only a note, no error
        Result notAsked = validate(ctx(ALL, withPoll), clean());
        assertThat(has(notAsked, "UPDATE_BLOCKED")).isFalse();
    }

    @Test
    void aVenueOnlyUpdateOfAMatchWithADependantIsAWarning() {
        ExistingMatch withPoll = existing(LEAGUE, "2026-09-13", "08:00", "Old Oval", us1, police, Set.of("POLL"));
        Result r = validate(ctxWith(ALL, List.of(), Set.of(2), false, withPoll), clean());
        assertThat(of(r, 2).action()).isEqualTo(ImportRowAction.UPDATE);
        assertThat(has(r, "ROW_DIFFERS", 2)).isTrue();
        assertThat(issue(r, "ROW_DIFFERS").severity()).isEqualTo(ImportIssueSeverity.WARNING);
    }

    @Test
    void theSamePairOnAnotherDateWithinTheWindowIsAPossibleDuplicate() {
        ExistingMatch nearby = existing("2026-09-20", "08:00", "Brits Oval", us1, police);
        Result r = validate(ctx(ALL, nearby), clean());
        assertThat(of(r, 2).outcome()).isEqualTo(ImportOutcome.POSSIBLE_DUPLICATE);
        assertThat(has(r, "POSSIBLE_DUPLICATE_NEARBY", 2)).isTrue();
    }

    @Test
    void aSimilarFreeTextOpponentIsAPossibleDuplicate() {
        ExistingMatch manual = freeText("2026-09-16", "08:00", "Brits Oval", us1, "Polise 1");
        Result r = validate(ctx(ALL, manual), clean());
        assertThat(has(r, "POSSIBLE_DUPLICATE_FREE_TEXT", 2)).isTrue();
    }

    @Test
    void anExactFreeTextOpponentOnTheSameDateIsTheSameMatch() {
        ExistingMatch manual = freeText("2026-09-13", "08:00", "Brits Oval", us1, "POLICE 1");
        Result r = validate(ctx(ALL, manual), clean());
        assertThat(of(r, 2).outcome()).isEqualTo(ImportOutcome.DUPLICATE);
    }

    @Test
    void morePairMeetingsThanTheFileMaximumIsAWarning() {
        ExistingMatch far = existing("2026-12-20", "08:00", "Brits Oval", us1, police);
        Result r = validate(ctx(ALL, far), clean());
        assertThat(has(r, "MEETINGS_EXCEED", 2)).isTrue();
        assertThat(of(r, 2).outcome()).isEqualTo(ImportOutcome.POSSIBLE_DUPLICATE);
        assertThat(issue(r, "MEETINGS_EXCEED").message()).contains("2 times").contains("1");
    }

    @Test
    void aFileWhereEveryPairMeetsTwiceIsNotFlagged() {
        Result r = validate(ctx(ALL), row(2, "2026-09-13", "08:00", us1, police, "V"),
                row(3, "2026-12-20", "08:00", police, us1, "V"));
        assertThat(has(r, "MEETINGS_EXCEED")).isFalse();
    }

    @Test
    void anExistingMatchOfAnotherLeagueNeverCountsForIdentity() {
        ExistingMatch otherLeague = existing(UUID.randomUUID(), "2026-09-13", "08:00", "Brits Oval", us1, police, Set.of());
        Result r = validate(ctx(ALL, otherLeague), clean());
        assertThat(of(r, 2).outcome()).isEqualTo(ImportOutcome.NEW);
    }
}
