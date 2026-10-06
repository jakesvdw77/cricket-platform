package com.cricketlegend.service.support;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.cricketlegend.domain.League;
import com.cricketlegend.domain.LeagueFormat;
import com.cricketlegend.domain.LeagueSource;
import com.cricketlegend.domain.Match;
import com.cricketlegend.domain.MatchSide;
import com.cricketlegend.domain.MatchSidePlayer;
import com.cricketlegend.domain.PlayingRole;
import com.cricketlegend.domain.Team;
import com.cricketlegend.repository.LeagueRepository;
import com.cricketlegend.repository.MatchRepository;
import com.cricketlegend.repository.MatchSidePlayerRepository;
import com.cricketlegend.repository.MatchSideRepository;
import com.cricketlegend.repository.TeamRepository;
import com.cricketlegend.service.impl.SectionAvailabilityMatchResolverImpl;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

/**
 * Unit tests for {@link MatchSlots}, the slot rule matrix of docs/specs/076-team-selection.md
 * section 5 and its Test Plan. The repositories are mocked and answer like the real ones for the ids
 * asked (the window query is only checked for its bounds here; that another club's and a
 * deactivated match never come back is the query's own filter, proven in {@code
 * MatchSelectionIntegrationTest}). Instants are built in {@code ZoneId.systemDefault()}, the zone the
 * rule itself uses, so the tests hold on any machine.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class MatchSlotsTest {

    private static final ZoneId ZONE = ZoneId.systemDefault();
    /** A Saturday far enough from any DST change for the date arithmetic below to stay readable. */
    private static final LocalDate SAT = LocalDate.of(2026, 6, 6);

    @Mock
    private MatchRepository matchRepository;

    @Mock
    private MatchSideRepository matchSideRepository;

    @Mock
    private MatchSidePlayerRepository matchSidePlayerRepository;

    @Mock
    private LeagueRepository leagueRepository;

    @Mock
    private TeamRepository teamRepository;

    private MatchSlots slots;
    private final UUID clubId = UUID.randomUUID();
    private final UUID seasonId = UUID.randomUUID();
    private final UUID player = UUID.randomUUID();
    private final Team ownTeam = team("Villagers 1");
    private final Team otherTeam = team("Villagers 2");
    private final List<Match> windowMatches = new ArrayList<>();
    private final List<MatchSide> sides = new ArrayList<>();
    private final List<MatchSidePlayer> rows = new ArrayList<>();

    @BeforeEach
    void setUp() {
        slots = new MatchSlots(matchRepository, matchSideRepository, matchSidePlayerRepository, leagueRepository,
                teamRepository, new SectionAvailabilityMatchResolverImpl());
        when(matchRepository.findActiveInWindow(eq(clubId), any(), any())).thenAnswer(i -> List.copyOf(windowMatches));
        when(matchSideRepository.findByMatchIdIn(any())).thenAnswer(i -> {
            Collection<UUID> ids = i.getArgument(0);
            return sides.stream().filter(side -> ids.contains(side.getMatchId())).toList();
        });
        when(matchSidePlayerRepository.findByMatchSideIdIn(any())).thenAnswer(i -> {
            Collection<UUID> ids = i.getArgument(0);
            return rows.stream().filter(row -> ids.contains(row.getMatchSideId())).toList();
        });
        when(teamRepository.findAllById(any())).thenReturn(List.of(ownTeam, otherTeam));
        when(leagueRepository.findAllById(any())).thenAnswer(i -> {
            Iterable<UUID> ids = i.getArgument(0);
            Set<UUID> wanted = new java.util.HashSet<>();
            ids.forEach(wanted::add);
            return knownLeagues.stream().filter(l -> wanted.contains(l.getId())).toList();
        });
    }

    private Team team(String name) {
        return Team.builder().id(UUID.randomUUID()).clubId(clubId).sectionId(UUID.randomUUID()).name(name)
                .active(true).build();
    }

    private static Instant at(int daysAfterSat, int hour, int minute) {
        return LocalDateTime.of(SAT.plusDays(daysAfterSat), LocalTime.of(hour, minute)).atZone(ZONE).toInstant();
    }

    private League league(LeagueFormat format) {
        League league = League.builder().id(UUID.randomUUID()).clubId(clubId).name("L " + format)
                .source(LeagueSource.INTERNAL).maxPlayingXiSize(11).format(format).active(true).build();
        when(leagueRepository.findById(league.getId())).thenReturn(java.util.Optional.of(league));
        knownLeagues.add(league);
        return league;
    }

    private final List<League> knownLeagues = new ArrayList<>();

    /** The match the selection is being made for (no sides of its own unless a test adds them). */
    private Match thisMatch(LeagueFormat format, Instant when) {
        return match(format, when, ownTeam, null);
    }

    private Match match(LeagueFormat format, Instant when, Team home, Team away) {
        Match match = Match.builder().id(UUID.randomUUID()).clubId(clubId).homeTeamId(home.getId())
                .awayTeamId(away == null ? null : away.getId()).awayTeamName(away == null ? "Opp" : null)
                .leagueId(format == null ? null : league(format).getId()).seasonId(seasonId).matchDate(when)
                .active(true).build();
        return match;
    }

    /** Puts {@code player} on {@code team}'s side of {@code match}, which the window query returns. */
    private MatchSide select(Match match, Team team, Integer battingOrder, boolean announced) {
        if (!windowMatches.contains(match)) {
            windowMatches.add(match);
        }
        MatchSide side = MatchSide.builder().id(UUID.randomUUID()).matchId(match.getId()).teamId(team.getId())
                .announced(announced).build();
        sides.add(side);
        rows.add(MatchSidePlayer.builder().matchSideId(side.getId()).playerProfileId(player)
                .battingOrder(battingOrder).role(PlayingRole.BATSMAN).build());
        return side;
    }

    private boolean collides(Match thisMatch, Match other) {
        select(other, otherTeam, 1, false);
        return slots.taken(thisMatch, ownTeam.getId(), Set.of(player)).containsKey(player);
    }

    private boolean collides(LeagueFormat thisFormat, Instant thisWhen, LeagueFormat otherFormat, Instant otherWhen) {
        return collides(thisMatch(thisFormat, thisWhen), match(otherFormat, otherWhen, otherTeam, null));
    }

    // --- day part and the one-slot formats ---

    @Test
    void elevenFiftyNineIsMorningAndTwelveIsAfternoon() {
        assertThat(slots.slotText(at(0, 11, 59))).isEqualTo("Sat 6 Jun (morning)");
        assertThat(slots.slotText(at(0, 12, 0))).isEqualTo("Sat 6 Jun (afternoon)");
    }

    @Test
    void theSameSlotCollides() {
        assertThat(collides(LeagueFormat.T20, at(0, 9, 0), LeagueFormat.T20, at(0, 10, 30))).isTrue();
        assertThat(collides(LeagueFormat.T20, at(0, 12, 0), LeagueFormat.T20, at(0, 16, 0))).isTrue();
    }

    @Test
    void morningAndAfternoonOfTheSameDayDoNotCollide() {
        assertThat(collides(LeagueFormat.T20, at(0, 11, 59), LeagueFormat.T20, at(0, 12, 0))).isFalse();
    }

    @Test
    void differentDaysDoNotCollide() {
        assertThat(collides(LeagueFormat.T20, at(0, 9, 0), LeagueFormat.T20, at(1, 9, 0))).isFalse();
    }

    @Test
    void t20T30UnsetFormatAndNoLeagueAreEachASingleSlot() {
        Match unsetFormatLeague = match(null, at(0, 9, 0), otherTeam, null);
        unsetFormatLeague.setLeagueId(league(null).getId());
        assertThat(collides(thisMatch(LeagueFormat.T30, at(0, 9, 0)), unsetFormatLeague)).isTrue();
        sides.clear();
        rows.clear();
        windowMatches.clear();
        // Same morning, but this match is a one-slot afternoon match: the unset-format match stays in the morning.
        unsetFormatLeague = match(null, at(0, 9, 0), otherTeam, null);
        unsetFormatLeague.setLeagueId(league(null).getId());
        assertThat(collides(thisMatch(null, at(0, 15, 0)), unsetFormatLeague)).isFalse();
    }

    // --- whole-day formats ---

    @Test
    void aOneDayMatchInTheMorningBlocksAnAfternoonT20() {
        assertThat(collides(LeagueFormat.T20, at(0, 14, 0), LeagueFormat.ONE_DAY, at(0, 9, 0))).isTrue();
    }

    @Test
    void anAfternoonT20BlocksNothingInTheMorning() {
        assertThat(collides(LeagueFormat.T20, at(0, 9, 0), LeagueFormat.T20, at(0, 14, 0))).isFalse();
    }

    @Test
    void t45AndT50TakeBothSlotsOfTheirDate() {
        assertThat(collides(LeagueFormat.T20, at(0, 14, 0), LeagueFormat.T45, at(0, 9, 0))).isTrue();
        assertThat(collides(LeagueFormat.T20, at(0, 9, 0), LeagueFormat.T50, at(0, 14, 0))).isTrue();
        assertThat(collides(LeagueFormat.T20, at(1, 9, 0), LeagueFormat.T50, at(0, 14, 0))).isFalse();
    }

    @Test
    void thisMatchBeingAWholeDayFormatBlocksTheOthersMorningAndAfternoon() {
        assertThat(collides(LeagueFormat.T50, at(0, 9, 0), LeagueFormat.T20, at(0, 15, 0))).isTrue();
    }

    @Test
    void aFiveDayMatchFourDaysEarlierBlocksAndOneSixDaysEarlierDoesNot() {
        assertThat(collides(LeagueFormat.T20, at(4, 9, 0), LeagueFormat.FIVE_DAY, at(0, 9, 0))).isTrue();
        sides.clear();
        rows.clear();
        windowMatches.clear();
        assertThat(collides(LeagueFormat.T20, at(6, 9, 0), LeagueFormat.FIVE_DAY, at(0, 9, 0))).isFalse();
    }

    @Test
    void aFiveDayMatchFiveDaysEarlierHasEndedTheDayBefore() {
        assertThat(collides(LeagueFormat.T20, at(5, 9, 0), LeagueFormat.FIVE_DAY, at(0, 9, 0))).isFalse();
    }

    @Test
    void aThreeDayMatchTwoDaysEarlierBlocksButThreeDaysEarlierDoesNot() {
        assertThat(collides(LeagueFormat.T20, at(2, 9, 0), LeagueFormat.THREE_DAY, at(0, 9, 0))).isTrue();
        sides.clear();
        rows.clear();
        windowMatches.clear();
        assertThat(collides(LeagueFormat.T20, at(3, 9, 0), LeagueFormat.THREE_DAY, at(0, 9, 0))).isFalse();
    }

    @Test
    void aMatchLaterInThisThreeDayMatchsSpanIsBlocked() {
        assertThat(collides(LeagueFormat.THREE_DAY, at(0, 9, 0), LeagueFormat.T20, at(2, 15, 0))).isTrue();
        sides.clear();
        rows.clear();
        windowMatches.clear();
        assertThat(collides(LeagueFormat.THREE_DAY, at(0, 9, 0), LeagueFormat.T20, at(3, 9, 0))).isFalse();
    }

    @Test
    void theWindowQueryReachesFourDaysBackAndToTheEndOfThisMatchsSpan() {
        slots.taken(thisMatch(LeagueFormat.FIVE_DAY, at(0, 9, 0)), ownTeam.getId(), Set.of(player));

        ArgumentCaptor<Instant> from = ArgumentCaptor.forClass(Instant.class);
        ArgumentCaptor<Instant> to = ArgumentCaptor.forClass(Instant.class);
        verify(matchRepository).findActiveInWindow(eq(clubId), from.capture(), to.capture());
        assertThat(from.getValue()).isEqualTo(SAT.minusDays(4).atStartOfDay(ZONE).toInstant());
        assertThat(to.getValue()).isEqualTo(SAT.plusDays(5).atStartOfDay(ZONE).toInstant());
    }

    // --- midnight rollover ---

    @Test
    void aTwentyThreeThirtyKickoffIsInTheAfternoonOfItsOwnLocalDate() {
        assertThat(collides(LeagueFormat.T20, at(0, 23, 30), LeagueFormat.T20, at(0, 14, 0))).isTrue();
        sides.clear();
        rows.clear();
        windowMatches.clear();
        assertThat(collides(LeagueFormat.T20, at(0, 23, 30), LeagueFormat.T20, at(1, 0, 30))).isFalse();
        assertThat(slots.slotText(at(0, 23, 30))).isEqualTo("Sat 6 Jun (afternoon)");
    }

    @Test
    void aOneDayMatchAtTwentyThreeThirtyDoesNotSpillIntoTheNextMorning() {
        assertThat(collides(LeagueFormat.T20, at(1, 9, 0), LeagueFormat.ONE_DAY, at(0, 23, 30))).isFalse();
    }

    // --- whose rows count ---

    @Test
    void theOtherSideOfTheSameMatchCountsAndIsFlaggedSameMatch() {
        Match derby = match(LeagueFormat.T20, at(0, 9, 0), ownTeam, otherTeam);
        select(derby, otherTeam, 3, false);

        Map<UUID, TakenBy> taken = slots.taken(derby, ownTeam.getId(), Set.of(player));

        assertThat(taken.get(player).sameMatch()).isTrue();
        assertThat(taken.get(player).teamId()).isEqualTo(otherTeam.getId());
        assertThat(taken.get(player).matchId()).isEqualTo(derby.getId());
    }

    @Test
    void theTwelfthManRowWithNoBattingPositionCountsAsTaken() {
        Match other = match(LeagueFormat.T20, at(0, 9, 0), otherTeam, null);
        select(other, otherTeam, null, false);

        assertThat(slots.taken(thisMatch(LeagueFormat.T20, at(0, 9, 0)), ownTeam.getId(), Set.of(player)))
                .containsKey(player);
    }

    @Test
    void theOwnSideOfThisMatchIsExcludedButADuplicateElsewhereIsStillReported() {
        Match mine = thisMatch(LeagueFormat.T20, at(0, 9, 0));
        select(mine, ownTeam, 1, false);
        assertThat(slots.taken(mine, ownTeam.getId(), Set.of(player))).isEmpty();

        Match other = match(LeagueFormat.T20, at(0, 9, 0), otherTeam, null);
        select(other, otherTeam, 1, true);

        TakenBy taken = slots.taken(mine, ownTeam.getId(), Set.of(player)).get(player);
        assertThat(taken).isNotNull();
        assertThat(taken.matchId()).isEqualTo(other.getId());
        assertThat(taken.sameMatch()).isFalse();
    }

    @Test
    void takenCarriesTheHoldingTeamSlotTextAndAnnouncedFlag() {
        Match other = match(LeagueFormat.T20, at(0, 9, 0), otherTeam, null);
        MatchSide side = select(other, otherTeam, 1, true);

        TakenBy taken = slots.taken(thisMatch(LeagueFormat.T20, at(0, 10, 0)), ownTeam.getId(), Set.of(player))
                .get(player);

        assertThat(taken.teamName()).isEqualTo("Villagers 2");
        assertThat(taken.teamClubId()).isEqualTo(clubId);
        assertThat(taken.teamSectionId()).isEqualTo(otherTeam.getSectionId());
        assertThat(taken.sideId()).isEqualTo(side.getId());
        assertThat(taken.slotText()).isEqualTo("Sat 6 Jun (morning)");
        assertThat(taken.announced()).isTrue();
    }

    @Test
    void whenSeveralMatchesCollideTheEarliestWins() {
        Team third = team("Villagers 3");
        when(teamRepository.findAllById(any())).thenReturn(List.of(ownTeam, otherTeam, third));
        Match later = match(LeagueFormat.ONE_DAY, at(1, 9, 0), third, null);
        Match earlier = match(LeagueFormat.ONE_DAY, at(0, 9, 0), otherTeam, null);
        select(later, third, 1, false);
        select(earlier, otherTeam, 1, false);

        TakenBy taken = slots.taken(thisMatch(LeagueFormat.THREE_DAY, at(0, 9, 0)), ownTeam.getId(), Set.of(player))
                .get(player);

        assertThat(taken.matchId()).isEqualTo(earlier.getId());
    }

    @Test
    void onlyTheAskedPlayersAreReportedAndNoPlayersMeansNoQueries() {
        Match other = match(LeagueFormat.T20, at(0, 9, 0), otherTeam, null);
        select(other, otherTeam, 1, false);
        Match mine = thisMatch(LeagueFormat.T20, at(0, 9, 0));

        assertThat(slots.taken(mine, ownTeam.getId(), Set.of(UUID.randomUUID()))).isEmpty();
        assertThat(slots.taken(mine, ownTeam.getId(), Set.of())).isEmpty();
        org.mockito.Mockito.verify(matchRepository, org.mockito.Mockito.times(1))
                .findActiveInWindow(any(), any(), any());
    }
}
