package com.cricketlegend.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

import com.cricketlegend.domain.DayPart;
import com.cricketlegend.domain.Match;
import com.cricketlegend.domain.Section;
import com.cricketlegend.domain.SectionAvailabilityRound;
import com.cricketlegend.domain.SectionAvailabilityWindow;
import com.cricketlegend.domain.SquadMode;
import com.cricketlegend.domain.Team;
import com.cricketlegend.dto.SectionAvailabilityFixtureGroupDto;
import com.cricketlegend.dto.SectionAvailabilityFixtureMatchDto;
import com.cricketlegend.repository.LeagueRepository;
import com.cricketlegend.repository.MatchRepository;
import com.cricketlegend.repository.SectionAvailabilityRoundRepository;
import com.cricketlegend.repository.SectionAvailabilityWindowRepository;
import com.cricketlegend.repository.SectionRepository;
import com.cricketlegend.repository.TeamRepository;
import com.cricketlegend.service.impl.SectionAvailabilityFixtureGroupResolverImpl;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

/**
 * Unit tests for SectionAvailabilityFixtureGroupResolverImpl — the fixture-group-selection
 * revision's one genuinely new piece of logic (docs/specs/063-section-availability-and-flexible-
 * squads.md): distinct-calendar-date-adjacency clustering (a weekend groups, a two-day-gap date
 * starts its own group), a match already covered by an existing window flagged {@code
 * alreadyPolled} with the correct existing-round reference, and a match excluded when its team
 * isn't a {@code FLEXIBLE} team of the requested section.
 */
@ExtendWith(MockitoExtension.class)
class SectionAvailabilityFixtureGroupResolverImplTest {

    @Mock
    private MatchRepository matchRepository;

    @Mock
    private TeamRepository teamRepository;

    @Mock
    private SectionRepository sectionRepository;

    @Mock
    private LeagueRepository leagueRepository;

    @Mock
    private SectionAvailabilityWindowRepository sectionAvailabilityWindowRepository;

    @Mock
    private SectionAvailabilityRoundRepository sectionAvailabilityRoundRepository;

    @Mock
    private SectionAvailabilityMatchResolver matchResolver;

    private SectionAvailabilityFixtureGroupResolverImpl resolver;

    private final UUID clubId = UUID.randomUUID();
    private final UUID sectionId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        resolver = new SectionAvailabilityFixtureGroupResolverImpl(
                matchRepository,
                teamRepository,
                sectionRepository,
                leagueRepository,
                sectionAvailabilityWindowRepository,
                sectionAvailabilityRoundRepository,
                matchResolver);
        when(sectionRepository.findById(sectionId))
                .thenReturn(Optional.of(Section.builder().id(sectionId).clubId(clubId).name("Under 13").active(true).build()));
    }

    private Team flexibleTeam(UUID id) {
        return Team.builder().id(id).sectionId(sectionId).name("U13 Colts").squadMode(SquadMode.FLEXIBLE).build();
    }

    private Match matchWithHomeTeam(UUID matchId, UUID teamId, Instant matchDate) {
        return Match.builder().id(matchId).clubId(clubId).homeTeamId(teamId).awayTeamName("Occasionals")
                .matchDate(matchDate).build();
    }

    @Test
    void aSaturdayAndSundayMatchClusterIntoOneGroup() {
        UUID teamId = UUID.randomUUID();
        UUID saturdayMatchId = UUID.randomUUID();
        UUID sundayMatchId = UUID.randomUUID();
        Team team = flexibleTeam(teamId);
        Match saturdayMatch = matchWithHomeTeam(saturdayMatchId, teamId, Instant.parse("2026-10-03T09:00:00Z"));
        Match sundayMatch = matchWithHomeTeam(sundayMatchId, teamId, Instant.parse("2026-10-04T09:00:00Z"));
        when(matchRepository.findUpcomingFlexibleMatchesBySection(eq(clubId), eq(sectionId), any()))
                .thenReturn(List.of(saturdayMatch, sundayMatch));
        when(teamRepository.findById(teamId)).thenReturn(Optional.of(team));
        when(matchResolver.resolveWindowKey(team, saturdayMatch)).thenReturn(
                new SectionAvailabilityMatchResolver.WindowKey(sectionId, LocalDate.of(2026, 10, 3), DayPart.MORNING));
        when(matchResolver.resolveWindowKey(team, sundayMatch)).thenReturn(
                new SectionAvailabilityMatchResolver.WindowKey(sectionId, LocalDate.of(2026, 10, 4), DayPart.MORNING));
        when(sectionAvailabilityWindowRepository.findBySectionIdAndWindowDateAndDayPart(any(), any(), any()))
                .thenReturn(Optional.empty());

        List<SectionAvailabilityFixtureGroupDto> groups = resolver.resolveGroups(clubId, sectionId);

        assertThat(groups).hasSize(1);
        assertThat(groups.get(0).startDate()).isEqualTo(LocalDate.of(2026, 10, 3));
        assertThat(groups.get(0).endDate()).isEqualTo(LocalDate.of(2026, 10, 4));
        assertThat(groups.get(0).matches()).extracting(SectionAvailabilityFixtureMatchDto::matchId)
                .containsExactly(saturdayMatchId, sundayMatchId);
    }

    @Test
    void aMorningAndAfternoonMatchOnTheSameDateClusterIntoOneGroup() {
        UUID teamId = UUID.randomUUID();
        UUID morningMatchId = UUID.randomUUID();
        UUID afternoonMatchId = UUID.randomUUID();
        Team team = flexibleTeam(teamId);
        Match morningMatch = matchWithHomeTeam(morningMatchId, teamId, Instant.parse("2026-10-03T08:00:00Z"));
        Match afternoonMatch = matchWithHomeTeam(afternoonMatchId, teamId, Instant.parse("2026-10-03T12:00:00Z"));
        when(matchRepository.findUpcomingFlexibleMatchesBySection(eq(clubId), eq(sectionId), any()))
                .thenReturn(List.of(morningMatch, afternoonMatch));
        when(teamRepository.findById(teamId)).thenReturn(Optional.of(team));
        when(matchResolver.resolveWindowKey(team, morningMatch)).thenReturn(
                new SectionAvailabilityMatchResolver.WindowKey(sectionId, LocalDate.of(2026, 10, 3), DayPart.MORNING));
        when(matchResolver.resolveWindowKey(team, afternoonMatch)).thenReturn(
                new SectionAvailabilityMatchResolver.WindowKey(sectionId, LocalDate.of(2026, 10, 3), DayPart.AFTERNOON));
        when(sectionAvailabilityWindowRepository.findBySectionIdAndWindowDateAndDayPart(any(), any(), any()))
                .thenReturn(Optional.empty());

        List<SectionAvailabilityFixtureGroupDto> groups = resolver.resolveGroups(clubId, sectionId);

        assertThat(groups).hasSize(1);
        assertThat(groups.get(0).matches()).extracting(SectionAvailabilityFixtureMatchDto::matchId)
                .containsExactly(morningMatchId, afternoonMatchId);
    }

    @Test
    void aMatchWhoseHomeAndAwayTeamAreTheSameTeamAppearsOnce() {
        UUID teamId = UUID.randomUUID();
        UUID matchId = UUID.randomUUID();
        Team team = flexibleTeam(teamId);
        Match match = Match.builder().id(matchId).clubId(clubId).homeTeamId(teamId).awayTeamId(teamId)
                .matchDate(Instant.parse("2026-10-03T12:00:00Z")).build();
        when(matchRepository.findUpcomingFlexibleMatchesBySection(eq(clubId), eq(sectionId), any()))
                .thenReturn(List.of(match));
        when(teamRepository.findById(teamId)).thenReturn(Optional.of(team));
        when(matchResolver.resolveWindowKey(team, match)).thenReturn(
                new SectionAvailabilityMatchResolver.WindowKey(sectionId, LocalDate.of(2026, 10, 3), DayPart.AFTERNOON));
        when(sectionAvailabilityWindowRepository.findBySectionIdAndWindowDateAndDayPart(any(), any(), any()))
                .thenReturn(Optional.empty());

        List<SectionAvailabilityFixtureGroupDto> groups = resolver.resolveGroups(clubId, sectionId);

        assertThat(groups).hasSize(1);
        assertThat(groups.get(0).matches()).hasSize(1);
    }

    @Test
    void aTwoDayGapMatchStartsItsOwnGroup() {
        UUID teamId = UUID.randomUUID();
        UUID saturdayMatchId = UUID.randomUUID();
        UUID tuesdayMatchId = UUID.randomUUID();
        Team team = flexibleTeam(teamId);
        Match saturdayMatch = matchWithHomeTeam(saturdayMatchId, teamId, Instant.parse("2026-10-03T09:00:00Z"));
        Match tuesdayMatch = matchWithHomeTeam(tuesdayMatchId, teamId, Instant.parse("2026-10-06T18:00:00Z"));
        when(matchRepository.findUpcomingFlexibleMatchesBySection(eq(clubId), eq(sectionId), any()))
                .thenReturn(List.of(saturdayMatch, tuesdayMatch));
        when(teamRepository.findById(teamId)).thenReturn(Optional.of(team));
        when(matchResolver.resolveWindowKey(team, saturdayMatch)).thenReturn(
                new SectionAvailabilityMatchResolver.WindowKey(sectionId, LocalDate.of(2026, 10, 3), DayPart.MORNING));
        when(matchResolver.resolveWindowKey(team, tuesdayMatch)).thenReturn(
                new SectionAvailabilityMatchResolver.WindowKey(sectionId, LocalDate.of(2026, 10, 6), DayPart.AFTERNOON));
        when(sectionAvailabilityWindowRepository.findBySectionIdAndWindowDateAndDayPart(any(), any(), any()))
                .thenReturn(Optional.empty());

        List<SectionAvailabilityFixtureGroupDto> groups = resolver.resolveGroups(clubId, sectionId);

        assertThat(groups).hasSize(2);
        assertThat(groups.get(0).matches()).extracting(SectionAvailabilityFixtureMatchDto::matchId)
                .containsExactly(saturdayMatchId);
        assertThat(groups.get(1).matches()).extracting(SectionAvailabilityFixtureMatchDto::matchId)
                .containsExactly(tuesdayMatchId);
    }

    @Test
    void aMatchAlreadyCoveredByAnExistingWindowIsFlaggedAlreadyPolledWithTheExistingRoundReference() {
        UUID teamId = UUID.randomUUID();
        UUID matchId = UUID.randomUUID();
        UUID existingWindowId = UUID.randomUUID();
        UUID existingRoundId = UUID.randomUUID();
        Team team = flexibleTeam(teamId);
        Match match = matchWithHomeTeam(matchId, teamId, Instant.parse("2026-10-03T09:00:00Z"));
        SectionAvailabilityMatchResolver.WindowKey key =
                new SectionAvailabilityMatchResolver.WindowKey(sectionId, LocalDate.of(2026, 10, 3), DayPart.MORNING);
        when(matchRepository.findUpcomingFlexibleMatchesBySection(eq(clubId), eq(sectionId), any()))
                .thenReturn(List.of(match));
        when(teamRepository.findById(teamId)).thenReturn(Optional.of(team));
        when(matchResolver.resolveWindowKey(team, match)).thenReturn(key);
        when(sectionAvailabilityWindowRepository.findBySectionIdAndWindowDateAndDayPart(
                        key.sectionId(), key.windowDate(), key.dayPart()))
                .thenReturn(Optional.of(SectionAvailabilityWindow.builder()
                        .id(existingWindowId).roundId(existingRoundId).sectionId(sectionId)
                        .windowDate(key.windowDate()).dayPart(key.dayPart()).open(true).build()));
        when(sectionAvailabilityRoundRepository.findById(existingRoundId))
                .thenReturn(Optional.of(SectionAvailabilityRound.builder()
                        .id(existingRoundId).clubId(clubId).sectionId(sectionId).description("Already open poll")
                        .firstMatchDate(key.windowDate()).lastMatchDate(key.windowDate()).autoClose(true).open(true)
                        .build()));

        List<SectionAvailabilityFixtureGroupDto> groups = resolver.resolveGroups(clubId, sectionId);

        assertThat(groups).hasSize(1);
        SectionAvailabilityFixtureMatchDto row = groups.get(0).matches().get(0);
        assertThat(row.alreadyPolled()).isTrue();
        assertThat(row.existingRoundId()).isEqualTo(existingRoundId);
        assertThat(row.existingRoundDescription()).isEqualTo("Already open poll");
    }

    @Test
    void aMatchIsExcludedWhenItsTeamIsNotAFlexibleTeamOfTheRequestedSection() {
        UUID teamId = UUID.randomUUID();
        UUID matchId = UUID.randomUUID();
        Match match = matchWithHomeTeam(matchId, teamId, Instant.parse("2026-10-03T09:00:00Z"));
        // A STATIC team somehow returned by the repository query (defensive branch — the real repo
        // query already filters this, this proves the resolver's own defensive re-check too).
        Team staticTeam = Team.builder().id(teamId).sectionId(sectionId).name("1st XI").squadMode(SquadMode.STATIC).build();
        when(matchRepository.findUpcomingFlexibleMatchesBySection(eq(clubId), eq(sectionId), any()))
                .thenReturn(List.of(match));
        when(teamRepository.findById(teamId)).thenReturn(Optional.of(staticTeam));

        List<SectionAvailabilityFixtureGroupDto> groups = resolver.resolveGroups(clubId, sectionId);

        assertThat(groups).isEmpty();
    }
}
