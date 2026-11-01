package com.cricketlegend.service.impl;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

import com.cricketlegend.domain.Match;
import com.cricketlegend.domain.Team;
import com.cricketlegend.dto.ScheduleFindingDto;
import com.cricketlegend.exception.ScheduleRuleException;
import com.cricketlegend.repository.MatchRepository;
import com.cricketlegend.repository.TeamRepository;
import com.cricketlegend.service.MatchScheduleRules.Candidate;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

/**
 * docs/specs/132-match-scheduling-rules.md, Test Plan: every code at its boundary, swapped sides, free-text names,
 * blank venue, inactive and edited matches ignored, no-league matches, acknowledged and unacknowledged warnings.
 */
@ExtendWith(MockitoExtension.class)
class MatchScheduleRulesImplTest {

    private static final ZoneId ZONE = ZoneId.systemDefault();
    private static final String DAY = "2027-03-06";

    @Mock
    private MatchRepository matchRepository;

    @Mock
    private TeamRepository teamRepository;

    private MatchScheduleRulesImpl rules;
    private final UUID club = UUID.randomUUID();
    private final UUID league = UUID.randomUUID();
    private final UUID season = UUID.randomUUID();
    private final UUID u13 = UUID.randomUUID();
    private final UUID u15 = UUID.randomUUID();
    private final UUID leagueTeamA = UUID.randomUUID();
    private final UUID leagueTeamB = UUID.randomUUID();
    private final UUID leagueTeamC = UUID.randomUUID();
    private final List<Match> stored = new ArrayList<>();

    @BeforeEach
    void setUp() {
        rules = new MatchScheduleRulesImpl(matchRepository, teamRepository);
        org.mockito.Mockito.lenient().when(matchRepository.findActiveInWindow(eq(club), any(), any())).thenAnswer(inv -> List.copyOf(stored));
        org.mockito.Mockito.lenient().when(teamRepository.findAllById(any())).thenReturn(List.of(
                Team.builder().id(u13).name("Riverside U13").build(),
                Team.builder().id(u15).name("Riverside U15").build()));
    }

    private static Instant at(String date, String time) {
        return LocalDateTime.of(LocalDate.parse(date), LocalTime.parse(time)).atZone(ZONE).toInstant();
    }

    private Match store(UUID leagueId, String date, String time, String venue, UUID homeTeam, UUID homeLeagueTeam,
            String homeName, UUID awayTeam, UUID awayLeagueTeam, String awayName, boolean active) {
        Match m = Match.builder().id(UUID.randomUUID()).clubId(club).leagueId(leagueId).seasonId(season)
                .matchDate(at(date, time)).venue(venue)
                .homeTeamId(homeTeam).homeLeagueTeamId(homeLeagueTeam).homeTeamName(homeName)
                .awayTeamId(awayTeam).awayLeagueTeamId(awayLeagueTeam).awayTeamName(awayName).active(active).build();
        stored.add(m);
        return m;
    }

    /** Riverside U13 v Harlequins (free text) in the league. */
    private Match ownMatch(String time) {
        return store(league, DAY, time, null, u13, null, null, null, null, "Harlequins", true);
    }

    private Candidate own(String date, String time, String venue, String opponent) {
        return new Candidate(league, season, at(date, time), venue, u13, null, null, null, null, opponent);
    }

    private Candidate leagueSides(String date, String time, String venue, UUID home, String homeName, UUID away,
            String awayName) {
        return new Candidate(league, season, at(date, time), venue, null, home, homeName, null, away, awayName);
    }

    private List<String> codes(List<ScheduleFindingDto> findings) {
        return findings.stream().map(ScheduleFindingDto::code).toList();
    }

    // ---- own team overlap and same date --------------------------------------------------------------------------

    @Test
    void ownTeamFortyMinutesBeforeIsAnErrorNamingTheOtherMatch() {
        Match other = ownMatch("09:30");
        List<ScheduleFindingDto> findings = rules.check(club, own(DAY, "10:00", null, "Zebras"), null);

        assertThat(findings).hasSize(1);
        ScheduleFindingDto f = findings.get(0);
        assertThat(f.code()).isEqualTo("OWN_TEAM_OVERLAP");
        assertThat(f.severity()).isEqualTo("ERROR");
        assertThat(f.field()).isEqualTo("time");
        assertThat(f.otherMatchId()).isEqualTo(other.getId());
        assertThat(f.message()).isEqualTo(
                "Riverside U13 already plays Harlequins at 09:30 on 6 Mar 2027, less than 2 hours from 10:00.");
    }

    @Test
    void ownTeamGapBoundariesAre119Error120And121Warning() {
        ownMatch("09:00");
        assertThat(codes(rules.check(club, own(DAY, "10:59", null, "Zebras"), null))).containsExactly("OWN_TEAM_OVERLAP");
        assertThat(codes(rules.check(club, own(DAY, "11:00", null, "Zebras"), null))).containsExactly("OWN_TEAM_SAME_DATE");
        assertThat(codes(rules.check(club, own(DAY, "11:01", null, "Zebras"), null))).containsExactly("OWN_TEAM_SAME_DATE");
        ScheduleFindingDto warning = rules.check(club, own(DAY, "11:00", null, "Zebras"), null).get(0);
        assertThat(warning.severity()).isEqualTo("WARNING");
        assertThat(warning.field()).isEqualTo("date");
    }

    @Test
    void ownTeamOverlapAppliesAcrossLeaguesAndForTheEarlierMatchToo() {
        store(UUID.randomUUID(), DAY, "10:00", null, u13, null, null, null, null, "Other league side", true);
        assertThat(codes(rules.check(club, own(DAY, "09:30", null, "Zebras"), null))).containsExactly("OWN_TEAM_OVERLAP");
    }

    @Test
    void anotherDayIsNoOwnTeamFinding() {
        ownMatch("09:30");
        assertThat(rules.check(club, own("2027-03-07", "09:30", null, "Zebras"), null)).isEmpty();
    }

    // ---- venue ---------------------------------------------------------------------------------------------------

    @Test
    void venueGapBoundariesAre179Warning180And181None() {
        store(league, DAY, "09:00", "Main Oval", null, leagueTeamA, "A", null, leagueTeamB, "B", true);
        assertThat(codes(rules.check(club,
                leagueSides(DAY, "11:59", "Main Oval", leagueTeamC, "C", UUID.randomUUID(), "D"), null)))
                .containsExactly("VENUE_TIME_CLASH");
        assertThat(rules.check(club,
                leagueSides(DAY, "12:00", "Main Oval", leagueTeamC, "C", UUID.randomUUID(), "D"), null)).isEmpty();
        assertThat(rules.check(club,
                leagueSides(DAY, "12:01", "Main Oval", leagueTeamC, "C", UUID.randomUUID(), "D"), null)).isEmpty();
    }

    @Test
    void venueIsComparedAfterCaseSpacingAndPunctuationAndABlankVenueNeverClashes() {
        store(league, DAY, "09:00", "Main  Oval.", null, leagueTeamA, "A", null, leagueTeamB, "B", true);
        store(league, DAY, "09:00", null, null, UUID.randomUUID(), "E", null, UUID.randomUUID(), "F", true);
        assertThat(codes(rules.check(club,
                leagueSides(DAY, "10:00", "main oval", leagueTeamC, "C", UUID.randomUUID(), "D"), null)))
                .containsExactly("VENUE_TIME_CLASH");
        assertThat(rules.check(club, leagueSides(DAY, "09:00", "", leagueTeamC, "C", UUID.randomUUID(), "D"), null))
                .isEmpty();
        assertThat(rules.check(club, leagueSides(DAY, "09:00", null, leagueTeamC, "C", UUID.randomUUID(), "D"), null))
                .isEmpty();
    }

    // ---- identity ------------------------------------------------------------------------------------------------

    @Test
    void sameTeamsDateAndTimeIsAnErrorReportedOnceNotAlsoAsAnOverlap() {
        Match other = ownMatch("07:30");
        List<ScheduleFindingDto> findings = rules.check(club, own(DAY, "07:30", null, "Harlequins"), null);

        assertThat(findings).hasSize(1);
        assertThat(findings.get(0).code()).isEqualTo("DUPLICATE_MATCH");
        assertThat(findings.get(0).severity()).isEqualTo("ERROR");
        assertThat(findings.get(0).field()).isEqualTo("teams");
        assertThat(findings.get(0).otherMatchId()).isEqualTo(other.getId());
        assertThat(findings.get(0).message()).contains("Riverside U13 v Harlequins")
                .contains("6 Mar 2027").contains("07:30");
    }

    @Test
    void sameTeamsSameDayAtAnotherTimeIsAWarning() {
        store(league, DAY, "09:00", null, null, leagueTeamA, "A", null, leagueTeamB, "B", true);
        List<ScheduleFindingDto> findings = rules.check(club,
                leagueSides(DAY, "15:00", null, leagueTeamA, "A", leagueTeamB, "B"), null);
        assertThat(findings).extracting(ScheduleFindingDto::code).containsExactly("DUPLICATE_SAME_DAY");
        assertThat(findings.get(0).severity()).isEqualTo("WARNING");
    }

    @Test
    void swappedSidesAtTheSameTimeIsAWarningNotAnError() {
        store(league, DAY, "09:00", null, null, leagueTeamA, "A", null, leagueTeamB, "B", true);
        assertThat(codes(rules.check(club, leagueSides(DAY, "09:00", null, leagueTeamB, "B", leagueTeamA, "A"), null)))
                .containsExactly("DUPLICATE_SAME_DAY");
    }

    @Test
    void sameTimeAtAnotherVenueIsStillTheSameMatch() {
        store(league, DAY, "09:00", "Main Oval", null, leagueTeamA, "A", null, leagueTeamB, "B", true);
        assertThat(codes(rules.check(club, leagueSides(DAY, "09:00", "Back Field", leagueTeamA, "A", leagueTeamB, "B"), null)))
                .contains("DUPLICATE_MATCH");
    }

    @Test
    void theSamePairWithin14DaysIsAWarningAndOutsideItIsNot() {
        store(league, "2027-03-16", "09:00", null, null, leagueTeamA, "A", null, leagueTeamB, "B", true);
        List<ScheduleFindingDto> near = rules.check(club,
                leagueSides(DAY, "09:00", null, leagueTeamA, "A", leagueTeamB, "B"), null);
        assertThat(codes(near)).containsExactly("POSSIBLE_DUPLICATE_NEARBY");
        assertThat(near.get(0).severity()).isEqualTo("WARNING");
        assertThat(rules.check(club, leagueSides("2027-02-20", "09:00", null, leagueTeamA, "A", leagueTeamB, "B"), null))
                .isEmpty();
    }

    @Test
    void aFreeTextOpponentIsMatchedByNormalisedName() {
        ownMatch("07:30");
        assertThat(codes(rules.check(club, own(DAY, "07:30", null, "  HARLEQUINS "), null)))
                .containsExactly("DUPLICATE_MATCH");
    }

    @Test
    void aDifferentFreeTextOpponentIsNoDuplicate() {
        ownMatch("07:30");
        assertThat(codes(rules.check(club, own("2027-03-07", "07:30", null, "Zebras"), null))).isEmpty();
    }

    @Test
    void matchesWithNoLeagueAreOnlyComparedWithOtherNoLeagueMatches() {
        store(null, DAY, "09:00", null, null, null, "Lions", null, null, "Tigers", true);
        Candidate noLeague = new Candidate(null, season, at(DAY, "09:00"), null, null, null, "Lions", null, null, "Tigers");
        Candidate inLeague = new Candidate(league, season, at(DAY, "09:00"), null, null, null, "Lions", null, null, "Tigers");
        assertThat(codes(rules.check(club, noLeague, null))).containsExactly("DUPLICATE_MATCH");
        assertThat(rules.check(club, inLeague, null)).isEmpty();
    }

    // ---- ignored matches -----------------------------------------------------------------------------------------

    @Test
    void anInactiveMatchIsIgnoredInEveryComparison() {
        store(league, DAY, "09:30", "Main Oval", u13, null, null, null, null, "Harlequins", false);
        assertThat(rules.check(club, own(DAY, "09:30", "Main Oval", "Harlequins"), null)).isEmpty();
    }

    @Test
    void theEditedMatchIsExcludedSoSavingItUnchangedNeverClashesWithItself() {
        Match self = ownMatch("09:30");
        assertThat(rules.check(club, own(DAY, "09:30", null, "Harlequins"), self.getId())).isEmpty();
        assertThat(codes(rules.check(club, own(DAY, "09:30", null, "Harlequins"), UUID.randomUUID())))
                .containsExactly("DUPLICATE_MATCH");
    }

    // ---- batch ---------------------------------------------------------------------------------------------------

    @Test
    void aLaterMatchOfABatchSeesTheEarlierOnesAndAnEarlierOneSeesNothing() {
        List<List<ScheduleFindingDto>> findings = rules.checkBatch(club, List.of(
                own(DAY, "09:30", null, "Harlequins"), own(DAY, "10:00", null, "Zebras")));

        assertThat(findings.get(0)).isEmpty();
        assertThat(codes(findings.get(1))).containsExactly("OWN_TEAM_OVERLAP");
        assertThat(findings.get(1).get(0).otherMatchId()).isNull(); // an earlier batch item has no id to link
        assertThat(findings.get(1).get(0).message()).contains("Harlequins at 09:30");
    }

    @Test
    void anInBatchRepeatIsADuplicate() {
        List<List<ScheduleFindingDto>> findings = rules.checkBatch(club, List.of(
                own(DAY, "09:30", null, "Harlequins"), own(DAY, "09:30", null, "Harlequins")));
        assertThat(codes(findings.get(1))).containsExactly("DUPLICATE_MATCH");
    }

    @Test
    void anEmptyBatchReadsNothing() {
        assertThat(rules.checkBatch(club, List.of())).isEmpty();
    }

    // ---- enforce -------------------------------------------------------------------------------------------------

    private static ScheduleFindingDto warning(String code) {
        return new ScheduleFindingDto(code, "WARNING", "w " + code, "date", null);
    }

    private static ScheduleFindingDto error(String code) {
        return new ScheduleFindingDto(code, "ERROR", "e " + code, "time", null);
    }

    @Test
    void noFindingsPassesAndAcknowledgedWarningsPass() {
        assertThatCode(() -> rules.enforce(List.of(), null)).doesNotThrowAnyException();
        assertThatCode(() -> rules.enforce(List.of(warning("A"), warning("B")), List.of("B", "A", "C")))
                .doesNotThrowAnyException();
    }

    @Test
    void anUnacknowledgedWarningThrowsAndNeedsConfirmation() {
        assertThatThrownBy(() -> rules.enforce(List.of(warning("A"), warning("B")), List.of("A")))
                .isInstanceOfSatisfying(ScheduleRuleException.class, e -> {
                    assertThat(e.needsConfirmation()).isTrue();
                    assertThat(e.getFindings()).hasSize(2);
                    assertThat(e.getMessage()).isEqualTo("w A");
                });
        assertThatThrownBy(() -> rules.enforce(List.of(warning("A")), null)).isInstanceOf(ScheduleRuleException.class);
    }

    @Test
    void anErrorIsNeverOverriddenByAcknowledgement() {
        assertThatThrownBy(() -> rules.enforce(List.of(error("E"), warning("A")), List.of("E", "A")))
                .isInstanceOfSatisfying(ScheduleRuleException.class, e -> {
                    assertThat(e.needsConfirmation()).isFalse();
                    assertThat(e.getFindings()).hasSize(2);
                });
    }

    @Test
    void errorsAreListedBeforeWarnings() {
        ownMatch("09:30");
        store(league, DAY, "09:30", "Main Oval", null, leagueTeamA, "A", null, leagueTeamB, "B", true);
        Candidate c = new Candidate(league, season, at(DAY, "10:00"), "Main Oval", u13, null, null, null, null, "Zebras");
        List<ScheduleFindingDto> findings = rules.check(club, c, null);
        assertThat(codes(findings)).containsExactly("OWN_TEAM_OVERLAP", "VENUE_TIME_CLASH");
    }

    // ---- past date (docs/specs/132) -------------------------------------------------------------------------------

    @Test
    void aMatchBeforeTheStartOfTodayRaisesAConfirmablePastDateWarning() {
        Instant yesterday = LocalDate.now(ZONE).minusDays(1).atTime(18, 0).atZone(ZONE).toInstant();
        Candidate c = new Candidate(league, season, yesterday, null, u13, null, null, null, null, "Zebras");

        List<ScheduleFindingDto> findings = rules.check(club, c, null);

        assertThat(findings).hasSize(1);
        assertThat(findings.get(0).code()).isEqualTo("PAST_DATE");
        assertThat(findings.get(0).severity()).isEqualTo("WARNING");
        assertThat(findings.get(0).message()).isEqualTo("This match is dated in the past.");
        assertThatCode(() -> rules.enforce(findings, List.of("PAST_DATE"))).doesNotThrowAnyException();
        assertThatThrownBy(() -> rules.enforce(findings, List.of())).isInstanceOf(ScheduleRuleException.class);
    }

    @Test
    void earlierTodayIsNotPastButYesterdayLateIsAndFutureIsNot() {
        Instant earlierToday = LocalDate.now(ZONE).atStartOfDay(ZONE).toInstant();
        Instant tomorrow = LocalDate.now(ZONE).plusDays(1).atTime(10, 0).atZone(ZONE).toInstant();
        Instant lastNight = LocalDate.now(ZONE).atStartOfDay(ZONE).minusMinutes(1).toInstant();
        assertThat(codes(rules.check(club, new Candidate(league, season, earlierToday, null, u13, null, null, null, null, "Zebras"), null))).isEmpty();
        assertThat(codes(rules.check(club, new Candidate(league, season, tomorrow, null, u13, null, null, null, null, "Zebras"), null))).isEmpty();
        assertThat(codes(rules.check(club, new Candidate(league, season, lastNight, null, u13, null, null, null, null, "Zebras"), null)))
                .containsExactly("PAST_DATE");
    }

    @Test
    void pastDateIsLeftOutWhenTheCallerSaysTheDateDidNotChange() {
        Instant past = LocalDate.now(ZONE).minusDays(3).atTime(10, 0).atZone(ZONE).toInstant();
        Candidate c = new Candidate(league, season, past, null, u13, null, null, null, null, "Zebras");
        assertThat(codes(rules.check(club, c, null, false))).isEmpty();
    }

    @Test
    void batchRaisesPastDateForPastItemsOnly() {
        Instant past = LocalDate.now(ZONE).minusDays(3).atTime(10, 0).atZone(ZONE).toInstant();
        Instant future = LocalDate.now(ZONE).plusDays(30).atTime(10, 0).atZone(ZONE).toInstant();
        List<List<ScheduleFindingDto>> out = rules.checkBatch(club, List.of(
                new Candidate(league, season, past, null, u13, null, null, null, null, "Zebras"),
                new Candidate(league, season, future, null, u15, null, null, null, null, "Lions")));
        assertThat(codes(out.get(0))).containsExactly("PAST_DATE");
        assertThat(codes(out.get(1))).isEmpty();
    }
}
