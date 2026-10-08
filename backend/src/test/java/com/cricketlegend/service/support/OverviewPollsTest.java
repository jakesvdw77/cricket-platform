package com.cricketlegend.service.support;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.cricketlegend.config.AccessService;
import com.cricketlegend.domain.AvailabilityPollType;
import com.cricketlegend.domain.AvailabilityPollTypeFilter;
import com.cricketlegend.domain.AvailabilityStatus;
import com.cricketlegend.domain.Match;
import com.cricketlegend.domain.MatchAvailabilityPoll;
import com.cricketlegend.domain.PlayerAvailability;
import com.cricketlegend.domain.PlayerProfile;
import com.cricketlegend.domain.PlayerSection;
import com.cricketlegend.domain.SectionAvailabilityResponse;
import com.cricketlegend.domain.SectionAvailabilityRound;
import com.cricketlegend.domain.SectionAvailabilityWindow;
import com.cricketlegend.domain.Team;
import com.cricketlegend.domain.TeamSquadMember;
import com.cricketlegend.dto.OverviewPollDto;
import com.cricketlegend.repository.MatchAvailabilityPollRepository;
import com.cricketlegend.repository.MatchRepository;
import com.cricketlegend.repository.PlayerAvailabilityRepository;
import com.cricketlegend.repository.PlayerProfileRepository;
import com.cricketlegend.repository.PlayerSectionRepository;
import com.cricketlegend.repository.SectionAvailabilityResponseRepository;
import com.cricketlegend.repository.SectionAvailabilityRoundRepository;
import com.cricketlegend.repository.SectionAvailabilityWindowRepository;
import com.cricketlegend.repository.TeamRepository;
import com.cricketlegend.repository.TeamSquadMemberRepository;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

/**
 * Unit tests for OverviewPolls (docs/specs/079-manager-shell-and-overview.md): squad and group poll
 * audience and reply counting, titles, scoping by accessible section, inactive matches left out.
 */
@ExtendWith(MockitoExtension.class)
class OverviewPollsTest {

    private static final UUID CLUB_ID = UUID.randomUUID();
    private static final UUID SENIORS = UUID.randomUUID();
    private static final UUID JUNIORS = UUID.randomUUID();
    private static final UUID SEASON = UUID.randomUUID();

    @Mock
    private MatchAvailabilityPollRepository pollRepository;

    @Mock
    private PlayerAvailabilityRepository playerAvailabilityRepository;

    @Mock
    private TeamSquadMemberRepository squadRepository;

    @Mock
    private MatchRepository matchRepository;

    @Mock
    private TeamRepository teamRepository;

    @Mock
    private SectionAvailabilityRoundRepository roundRepository;

    @Mock
    private SectionAvailabilityWindowRepository windowRepository;

    @Mock
    private SectionAvailabilityResponseRepository responseRepository;

    @Mock
    private PlayerSectionRepository playerSectionRepository;

    @Mock
    private PlayerProfileRepository playerProfileRepository;

    @Mock
    private AccessService accessService;

    @Mock
    private AvailabilityPollFilters pollFilters;

    private OverviewPolls polls;
    private final Team home = Team.builder().id(UUID.randomUUID()).clubId(CLUB_ID).sectionId(SENIORS)
            .name("Villagers 1").build();

    @BeforeEach
    void setUp() {
        polls = new OverviewPolls(pollRepository, playerAvailabilityRepository, squadRepository, matchRepository,
                teamRepository, roundRepository, windowRepository, responseRepository, playerSectionRepository,
                playerProfileRepository, accessService, pollFilters);
        lenient().when(pollRepository.findOpenByMatchClubId(CLUB_ID)).thenReturn(List.of());
        lenient().when(roundRepository.findByClubIdAndOpenTrue(CLUB_ID)).thenReturn(List.of());
    }

    private Match match(boolean active) {
        return Match.builder().id(UUID.randomUUID()).clubId(CLUB_ID).homeTeamId(home.getId())
                .awayTeamName("Occasionals").seasonId(SEASON).matchDate(Instant.parse("2031-06-07T10:00:00Z"))
                .active(active).build();
    }

    private MatchAvailabilityPoll squadPoll(Match match, Instant closeAt) {
        return MatchAvailabilityPoll.builder().id(UUID.randomUUID()).matchId(match.getId()).teamId(home.getId())
                .open(true).scheduledCloseAt(closeAt).build();
    }

    private TeamSquadMember member(UUID playerId) {
        return TeamSquadMember.builder().teamId(home.getId()).seasonId(SEASON).playerProfileId(playerId).build();
    }

    private PlayerAvailability answer(MatchAvailabilityPoll poll, UUID playerId) {
        return PlayerAvailability.builder().pollId(poll.getId()).playerProfileId(playerId)
                .status(AvailabilityStatus.AVAILABLE).build();
    }

    @Test
    void noOpenPollsLoadsNothingElse() {
        assertThat(polls.openPolls(CLUB_ID, Optional.empty())).isEmpty();

        verifyNoInteractions(matchRepository, teamRepository, squadRepository, playerAvailabilityRepository,
                windowRepository, responseRepository, playerSectionRepository, playerProfileRepository);
    }

    @Test
    void squadPollCountsSquadMembersAndOnlyTheirAnswers() {
        Match match = match(true);
        Instant closeAt = Instant.parse("2031-06-06T10:00:00Z");
        MatchAvailabilityPoll poll = squadPoll(match, closeAt);
        UUID a = UUID.randomUUID();
        UUID b = UUID.randomUUID();
        UUID c = UUID.randomUUID();
        UUID leftTheSquad = UUID.randomUUID();
        when(pollRepository.findOpenByMatchClubId(CLUB_ID)).thenReturn(List.of(poll));
        when(matchRepository.findAllById(anyCollection())).thenReturn(List.of(match));
        when(teamRepository.findAllById(anyCollection())).thenReturn(List.of(home));
        when(squadRepository.findByTeamIdInAndSeasonIdIn(anyCollection(), anyCollection()))
                .thenReturn(List.of(member(a), member(b), member(c)));
        when(playerAvailabilityRepository.findByPollIdIn(anyCollection()))
                .thenReturn(List.of(answer(poll, a), answer(poll, leftTheSquad)));

        List<OverviewPollDto> result = polls.openPolls(CLUB_ID, Optional.empty());

        assertThat(result).singleElement().satisfies(dto -> {
            assertThat(dto.kind()).isEqualTo(AvailabilityPollType.SQUAD);
            assertThat(dto.id()).isEqualTo(poll.getId());
            assertThat(dto.matchId()).isEqualTo(match.getId());
            assertThat(dto.totalCount()).isEqualTo(3);
            assertThat(dto.repliedCount()).isEqualTo(1);
            assertThat(dto.scheduledCloseAt()).isEqualTo(closeAt);
            assertThat(dto.title()).startsWith("Villagers 1 v Occasionals, ");
        });
    }

    @Test
    void squadPollOfADeactivatedMatchIsLeftOut() {
        Match inactive = match(false);
        when(pollRepository.findOpenByMatchClubId(CLUB_ID)).thenReturn(List.of(squadPoll(inactive, null)));
        when(matchRepository.findAllById(anyCollection())).thenReturn(List.of(inactive));
        when(teamRepository.findAllById(anyCollection())).thenReturn(List.of(home));

        assertThat(polls.openPolls(CLUB_ID, Optional.empty())).isEmpty();
        verifyNoInteractions(squadRepository, playerAvailabilityRepository);
    }

    @Test
    void squadPollIsKeptOnlyWhenItsMatchResolvesToASectionTheCallerAdministers() {
        Match mine = match(true);
        Match elsewhere = match(true);
        MatchAvailabilityPoll minePoll = squadPoll(mine, null);
        MatchAvailabilityPoll elsewherePoll = squadPoll(elsewhere, null);
        when(pollRepository.findOpenByMatchClubId(CLUB_ID)).thenReturn(List.of(minePoll, elsewherePoll));
        when(matchRepository.findAllById(anyCollection())).thenReturn(List.of(mine, elsewhere));
        when(teamRepository.findAllById(anyCollection())).thenReturn(List.of(home));
        Map<UUID, Team> teams = Map.of(home.getId(), home);
        // both matches use the same home team here, so tell them apart by the away side (null for both):
        // resolve the first call to SENIORS and the second to JUNIORS
        when(accessService.resolveMatchSectionIds(CLUB_ID, home.getId(), null, teams))
                .thenReturn(Set.of(SENIORS), Set.of(JUNIORS));
        when(squadRepository.findByTeamIdInAndSeasonIdIn(anyCollection(), anyCollection())).thenReturn(List.of());
        when(playerAvailabilityRepository.findByPollIdIn(anyCollection())).thenReturn(List.of());

        List<OverviewPollDto> result = polls.openPolls(CLUB_ID, Optional.of(Set.of(JUNIORS)));

        assertThat(result).extracting(OverviewPollDto::id).containsExactly(elsewherePoll.getId());
    }

    @Test
    void groupPollCountsActiveTaggedPlayersAndRepliedMeansEveryWindowAnswered() {
        UUID roundId = UUID.randomUUID();
        Instant closeAt = Instant.parse("2031-06-06T10:00:00Z");
        SectionAvailabilityRound round = SectionAvailabilityRound.builder().id(roundId).clubId(CLUB_ID)
                .sectionId(SENIORS).description("Sat 7 Jun - Seniors").firstMatchDate(LocalDate.of(2031, 6, 7))
                .lastMatchDate(LocalDate.of(2031, 6, 7)).open(true).scheduledCloseAt(closeAt).build();
        UUID w1 = UUID.randomUUID();
        UUID w2 = UUID.randomUUID();
        UUID both = UUID.randomUUID();
        UUID onlyFirst = UUID.randomUUID();
        UUID none = UUID.randomUUID();
        UUID inactive = UUID.randomUUID();
        when(roundRepository.findByClubIdAndOpenTrue(CLUB_ID)).thenReturn(List.of(round));
        when(windowRepository.findByRoundIdIn(anyCollection())).thenReturn(List.of(
                SectionAvailabilityWindow.builder().id(w1).roundId(roundId).build(),
                SectionAvailabilityWindow.builder().id(w2).roundId(roundId).build()));
        when(responseRepository.findByWindowIdIn(anyCollection())).thenReturn(List.of(
                SectionAvailabilityResponse.builder().windowId(w1).playerProfileId(both).build(),
                SectionAvailabilityResponse.builder().windowId(w2).playerProfileId(both).build(),
                SectionAvailabilityResponse.builder().windowId(w1).playerProfileId(onlyFirst).build()));
        when(playerSectionRepository.findBySectionIdIn(anyCollection())).thenReturn(List.of(
                PlayerSection.builder().playerProfileId(both).sectionId(SENIORS).build(),
                PlayerSection.builder().playerProfileId(onlyFirst).sectionId(SENIORS).build(),
                PlayerSection.builder().playerProfileId(none).sectionId(SENIORS).build(),
                PlayerSection.builder().playerProfileId(inactive).sectionId(SENIORS).build()));
        when(playerProfileRepository.findAllById(anyCollection())).thenReturn(List.of(
                PlayerProfile.builder().id(both).active(true).build(),
                PlayerProfile.builder().id(onlyFirst).active(true).build(),
                PlayerProfile.builder().id(none).active(true).build(),
                PlayerProfile.builder().id(inactive).active(false).build()));

        List<OverviewPollDto> result = polls.openPolls(CLUB_ID, Optional.empty());

        assertThat(result).singleElement().satisfies(dto -> {
            assertThat(dto.kind()).isEqualTo(AvailabilityPollType.GROUP);
            assertThat(dto.id()).isEqualTo(roundId);
            assertThat(dto.matchId()).isNull();
            assertThat(dto.title()).isEqualTo("Sat 7 Jun - Seniors");
            assertThat(dto.totalCount()).isEqualTo(3);
            assertThat(dto.repliedCount()).isEqualTo(1);
            assertThat(dto.scheduledCloseAt()).isEqualTo(closeAt);
        });
    }

    @Test
    void groupPollOfASectionTheCallerDoesNotAdministerIsLeftOut() {
        SectionAvailabilityRound round = SectionAvailabilityRound.builder().id(UUID.randomUUID()).clubId(CLUB_ID)
                .sectionId(SENIORS).description("Seniors").open(true).build();
        when(roundRepository.findByClubIdAndOpenTrue(CLUB_ID)).thenReturn(List.of(round));

        assertThat(polls.openPolls(CLUB_ID, Optional.of(Set.of(JUNIORS)))).isEmpty();
        verifyNoInteractions(windowRepository, responseRepository, playerSectionRepository);
    }

    @Test
    void groupPollWithNobodyTaggedHasAnEmptyAudience() {
        SectionAvailabilityRound round = SectionAvailabilityRound.builder().id(UUID.randomUUID()).clubId(CLUB_ID)
                .sectionId(SENIORS).description("Seniors").open(true).build();
        when(roundRepository.findByClubIdAndOpenTrue(CLUB_ID)).thenReturn(List.of(round));
        when(windowRepository.findByRoundIdIn(anyCollection())).thenReturn(List.of());
        when(playerSectionRepository.findBySectionIdIn(anyCollection())).thenReturn(List.of());

        assertThat(polls.openPolls(CLUB_ID, Optional.empty())).singleElement().satisfies(dto -> {
            assertThat(dto.totalCount()).isZero();
            assertThat(dto.repliedCount()).isZero();
        });
    }

    @Test
    void squadPollWithPlayersExposesSquadAndOnlySquadMembersWhoAnswered() {
        Match match = match(true);
        MatchAvailabilityPoll poll = squadPoll(match, null);
        UUID a = UUID.randomUUID();
        UUID b = UUID.randomUUID();
        UUID leftTheSquad = UUID.randomUUID();
        when(pollRepository.findOpenByMatchClubId(CLUB_ID)).thenReturn(List.of(poll));
        when(matchRepository.findAllById(anyCollection())).thenReturn(List.of(match));
        when(teamRepository.findAllById(anyCollection())).thenReturn(List.of(home));
        when(squadRepository.findByTeamIdInAndSeasonIdIn(anyCollection(), anyCollection()))
                .thenReturn(List.of(member(a), member(b)));
        when(playerAvailabilityRepository.findByPollIdIn(anyCollection()))
                .thenReturn(List.of(answer(poll, a), answer(poll, leftTheSquad)));

        List<OverviewPolls.OpenPoll> result = polls.openPollsWithPlayers(CLUB_ID, Optional.empty());

        assertThat(result).singleElement().satisfies(open -> {
            assertThat(open.audience()).containsExactlyInAnyOrder(a, b);
            assertThat(open.responded()).containsExactly(a);
            assertThat(open.poll().repliedCount()).isEqualTo(1);
            assertThat(open.awaiting()).containsExactly(b);
            assertThat(open.open()).isTrue();
        });
    }

    @Test
    void groupPollWithPlayersCountsAnAnswerToAnySingleWindowAsResponded() {
        UUID roundId = UUID.randomUUID();
        SectionAvailabilityRound round = SectionAvailabilityRound.builder().id(roundId).clubId(CLUB_ID)
                .sectionId(SENIORS).description("Seniors").open(true).build();
        UUID w1 = UUID.randomUUID();
        UUID w2 = UUID.randomUUID();
        UUID both = UUID.randomUUID();
        UUID onlyFirst = UUID.randomUUID();
        UUID none = UUID.randomUUID();
        when(roundRepository.findByClubIdAndOpenTrue(CLUB_ID)).thenReturn(List.of(round));
        when(windowRepository.findByRoundIdIn(anyCollection())).thenReturn(List.of(
                SectionAvailabilityWindow.builder().id(w1).roundId(roundId).build(),
                SectionAvailabilityWindow.builder().id(w2).roundId(roundId).build()));
        when(responseRepository.findByWindowIdIn(anyCollection())).thenReturn(List.of(
                SectionAvailabilityResponse.builder().windowId(w1).playerProfileId(both).build(),
                SectionAvailabilityResponse.builder().windowId(w2).playerProfileId(both).build(),
                SectionAvailabilityResponse.builder().windowId(w1).playerProfileId(onlyFirst).build()));
        when(playerSectionRepository.findBySectionIdIn(anyCollection())).thenReturn(List.of(
                PlayerSection.builder().playerProfileId(both).sectionId(SENIORS).build(),
                PlayerSection.builder().playerProfileId(onlyFirst).sectionId(SENIORS).build(),
                PlayerSection.builder().playerProfileId(none).sectionId(SENIORS).build()));
        when(playerProfileRepository.findAllById(anyCollection())).thenReturn(List.of(
                PlayerProfile.builder().id(both).active(true).build(),
                PlayerProfile.builder().id(onlyFirst).active(true).build(),
                PlayerProfile.builder().id(none).active(true).build()));

        List<OverviewPolls.OpenPoll> result = polls.openPollsWithPlayers(CLUB_ID, Optional.empty());

        assertThat(result).singleElement().satisfies(open -> {
            assertThat(open.audience()).containsExactlyInAnyOrder(both, onlyFirst, none);
            assertThat(open.responded()).containsExactlyInAnyOrder(both, onlyFirst);
            // the poll's own figure still needs every window
            assertThat(open.poll().repliedCount()).isEqualTo(1);
            // awaiting = audience minus the 'replied every window' set
            assertThat(open.awaiting()).containsExactlyInAnyOrder(onlyFirst, none);
            assertThat(open.awaiting()).hasSize((int) (open.poll().totalCount() - open.poll().repliedCount()));
        });
    }

    // ---- docs/specs/083: filters and closed polls ----

    private static AvailabilityPollFilter filter(
            UUID leagueId, Set<UUID> sectionIds, UUID teamId, AvailabilityPollTypeFilter type, boolean includeClosed) {
        return new AvailabilityPollFilter(leagueId, sectionIds, teamId, type, includeClosed);
    }

    private Match matchInLeague(UUID leagueId) {
        return Match.builder().id(UUID.randomUUID()).clubId(CLUB_ID).homeTeamId(home.getId())
                .awayTeamName("Occasionals").leagueId(leagueId).seasonId(SEASON)
                .matchDate(Instant.parse("2031-06-07T10:00:00Z")).active(true).build();
    }

    private void stubSquadWorld(List<MatchAvailabilityPoll> open, List<MatchAvailabilityPoll> closed, Match... matches) {
        when(pollRepository.findOpenByMatchClubId(CLUB_ID)).thenReturn(open);
        lenient().when(pollRepository.findClosedByMatchClubId(CLUB_ID)).thenReturn(closed);
        when(matchRepository.findAllById(anyCollection())).thenReturn(List.of(matches));
        when(teamRepository.findAllById(anyCollection())).thenReturn(List.of(home));
        lenient().when(squadRepository.findByTeamIdInAndSeasonIdIn(anyCollection(), anyCollection()))
                .thenReturn(List.of());
        lenient().when(playerAvailabilityRepository.findByPollIdIn(anyCollection())).thenReturn(List.of());
    }

    @Test
    void squadPollsAreNarrowedByLeague() {
        UUID league = UUID.randomUUID();
        Match inLeague = matchInLeague(league);
        Match otherLeague = matchInLeague(UUID.randomUUID());
        Match noLeague = matchInLeague(null);
        MatchAvailabilityPoll keep = squadPoll(inLeague, null);
        stubSquadWorld(List.of(keep, squadPoll(otherLeague, null), squadPoll(noLeague, null)), List.of(),
                inLeague, otherLeague, noLeague);

        List<OverviewPolls.OpenPoll> result = polls.pollsWithPlayers(
                CLUB_ID, Optional.empty(), filter(league, null, null, AvailabilityPollTypeFilter.ALL, false));

        assertThat(result).extracting(open -> open.poll().id()).containsExactly(keep.getId());
    }

    @Test
    void squadPollsAreNarrowedByTeam() {
        Match match = match(true);
        UUID otherTeam = UUID.randomUUID();
        MatchAvailabilityPoll mine = squadPoll(match, null);
        MatchAvailabilityPoll theirs = MatchAvailabilityPoll.builder().id(UUID.randomUUID()).matchId(match.getId())
                .teamId(otherTeam).open(true).build();
        stubSquadWorld(List.of(mine, theirs), List.of(), match);

        List<OverviewPolls.OpenPoll> result = polls.pollsWithPlayers(
                CLUB_ID, Optional.empty(), filter(null, null, home.getId(), AvailabilityPollTypeFilter.SQUAD, false));

        assertThat(result).extracting(open -> open.poll().id()).containsExactly(mine.getId());
    }

    @Test
    void squadPollsAreNarrowedBySectionThroughTheMatchsOwnClubSections() {
        Match seniorsMatch = match(true);
        Match juniorsMatch = match(true);
        MatchAvailabilityPoll seniorsPoll = squadPoll(seniorsMatch, null);
        MatchAvailabilityPoll juniorsPoll = squadPoll(juniorsMatch, null);
        stubSquadWorld(List.of(seniorsPoll, juniorsPoll), List.of(), seniorsMatch, juniorsMatch);
        Map<UUID, Team> teams = Map.of(home.getId(), home);
        when(accessService.resolveMatchSectionIds(CLUB_ID, home.getId(), null, teams))
                .thenReturn(Set.of(SENIORS), Set.of(JUNIORS));

        List<OverviewPolls.OpenPoll> result = polls.pollsWithPlayers(CLUB_ID, Optional.empty(),
                filter(null, Set.of(JUNIORS), null, AvailabilityPollTypeFilter.ALL, false));

        assertThat(result).extracting(open -> open.poll().id()).containsExactly(juniorsPoll.getId());
    }

    @Test
    void typeGroupLeavesSquadPollsUnloadedAndTypeSquadLeavesGroupRoundsUnloaded() {
        when(roundRepository.findByClubIdAndOpenTrue(CLUB_ID)).thenReturn(List.of());

        polls.pollsWithPlayers(CLUB_ID, Optional.empty(), filter(null, null, null, AvailabilityPollTypeFilter.GROUP, false));
        verifyNoInteractions(pollRepository);

        polls.pollsWithPlayers(CLUB_ID, Optional.empty(), filter(null, null, null, AvailabilityPollTypeFilter.SQUAD, false));
        org.mockito.Mockito.verify(pollRepository).findOpenByMatchClubId(CLUB_ID);
        org.mockito.Mockito.verify(roundRepository, org.mockito.Mockito.times(1)).findByClubIdAndOpenTrue(CLUB_ID);
    }

    @Test
    void closedSquadPollsAreOnlyReturnedWhenAskedForAndAreMarkedClosed() {
        Match match = match(true);
        MatchAvailabilityPoll open = squadPoll(match, null);
        MatchAvailabilityPoll closed = MatchAvailabilityPoll.builder().id(UUID.randomUUID()).matchId(match.getId())
                .teamId(home.getId()).open(false).build();
        stubSquadWorld(List.of(open), List.of(closed), match);

        List<OverviewPolls.OpenPoll> openOnly = polls.pollsWithPlayers(
                CLUB_ID, Optional.empty(), AvailabilityPollFilter.OPEN_ONLY);
        List<OverviewPolls.OpenPoll> withClosed = polls.pollsWithPlayers(
                CLUB_ID, Optional.empty(), filter(null, null, null, AvailabilityPollTypeFilter.ALL, true));

        assertThat(openOnly).extracting(p -> p.poll().id()).containsExactly(open.getId());
        assertThat(withClosed).extracting(p -> p.poll().id()).containsExactly(open.getId(), closed.getId());
        assertThat(withClosed).extracting(OverviewPolls.OpenPoll::open).containsExactly(true, false);
    }

    @Test
    void closedSquadPollsAreCappedAtTheFiftyMostRecentThatMatch() {
        Match match = match(true);
        List<MatchAvailabilityPoll> closed = new ArrayList<>();
        for (int i = 0; i < AvailabilityPollFilter.CLOSED_POLLS_LIMIT + 5; i++) {
            closed.add(MatchAvailabilityPoll.builder().id(UUID.randomUUID()).matchId(match.getId())
                    .teamId(home.getId()).open(false).build());
        }
        MatchAvailabilityPoll open = squadPoll(match, null);
        stubSquadWorld(List.of(open), closed, match);

        List<OverviewPolls.OpenPoll> result = polls.pollsWithPlayers(
                CLUB_ID, Optional.empty(), filter(null, null, null, AvailabilityPollTypeFilter.ALL, true));

        assertThat(result).hasSize(1 + AvailabilityPollFilter.CLOSED_POLLS_LIMIT);
        assertThat(result.stream().filter(OverviewPolls.OpenPoll::open)).hasSize(1);
        assertThat(result.stream().skip(1).map(p -> p.poll().id()).toList())
                .containsExactlyElementsOf(closed.subList(0, AvailabilityPollFilter.CLOSED_POLLS_LIMIT).stream()
                        .map(MatchAvailabilityPoll::getId).toList());
    }

    private SectionAvailabilityRound round(UUID sectionId, boolean open, LocalDate lastMatchDate) {
        return SectionAvailabilityRound.builder().id(UUID.randomUUID()).clubId(CLUB_ID).sectionId(sectionId)
                .description("r").open(open).lastMatchDate(lastMatchDate).build();
    }

    private void stubEmptyGroupDetail() {
        lenient().when(windowRepository.findByRoundIdIn(anyCollection())).thenReturn(List.of());
        lenient().when(playerSectionRepository.findBySectionIdIn(anyCollection())).thenReturn(List.of());
    }

    @Test
    void groupRoundsAreNarrowedBySection() {
        SectionAvailabilityRound seniors = round(SENIORS, true, null);
        SectionAvailabilityRound juniors = round(JUNIORS, true, null);
        when(roundRepository.findByClubIdAndOpenTrue(CLUB_ID)).thenReturn(List.of(seniors, juniors));
        stubEmptyGroupDetail();

        List<OverviewPolls.OpenPoll> result = polls.pollsWithPlayers(CLUB_ID, Optional.empty(),
                filter(null, Set.of(JUNIORS), null, AvailabilityPollTypeFilter.GROUP, false));

        assertThat(result).extracting(p -> p.poll().id()).containsExactly(juniors.getId());
        verifyNoInteractions(pollFilters);
    }

    @Test
    void groupRoundsAreNarrowedByTheLeagueAndTeamOfTheirSlotMatches() {
        UUID league = UUID.randomUUID();
        SectionAvailabilityRound inLeague = round(SENIORS, true, null);
        SectionAvailabilityRound otherLeague = round(SENIORS, true, null);
        SectionAvailabilityRound noSlots = round(SENIORS, true, null);
        when(roundRepository.findByClubIdAndOpenTrue(CLUB_ID)).thenReturn(List.of(inLeague, otherLeague, noSlots));
        Match leagueMatch = matchInLeague(league);
        Match elsewhere = matchInLeague(UUID.randomUUID());
        when(pollFilters.slotMatchesByRoundId(anyCollection())).thenReturn(Map.of(
                inLeague.getId(), List.of(elsewhere, leagueMatch), otherLeague.getId(), List.of(elsewhere)));
        stubEmptyGroupDetail();

        List<OverviewPolls.OpenPoll> byLeague = polls.pollsWithPlayers(CLUB_ID, Optional.empty(),
                filter(league, null, null, AvailabilityPollTypeFilter.GROUP, false));
        List<OverviewPolls.OpenPoll> byTeam = polls.pollsWithPlayers(CLUB_ID, Optional.empty(),
                filter(null, null, home.getId(), AvailabilityPollTypeFilter.GROUP, false));
        List<OverviewPolls.OpenPoll> byUnknownTeam = polls.pollsWithPlayers(CLUB_ID, Optional.empty(),
                filter(null, null, UUID.randomUUID(), AvailabilityPollTypeFilter.GROUP, false));

        assertThat(byLeague).extracting(p -> p.poll().id()).containsExactly(inLeague.getId());
        assertThat(byTeam).extracting(p -> p.poll().id()).containsExactlyInAnyOrder(inLeague.getId(), otherLeague.getId());
        assertThat(byUnknownTeam).isEmpty();
    }

    @Test
    void closedRoundsAreReturnedMostRecentFirstCappedAndMarkedClosed() {
        SectionAvailabilityRound open = round(SENIORS, true, LocalDate.of(2031, 1, 1));
        List<SectionAvailabilityRound> all = new ArrayList<>(List.of(open));
        for (int i = 0; i < AvailabilityPollFilter.CLOSED_POLLS_LIMIT + 3; i++) {
            all.add(round(SENIORS, false, LocalDate.of(2030, 1, 1).plusDays(i)));
        }
        SectionAvailabilityRound newest = all.get(all.size() - 1);
        when(roundRepository.findByClubId(CLUB_ID)).thenReturn(all);
        stubEmptyGroupDetail();

        List<OverviewPolls.OpenPoll> result = polls.pollsWithPlayers(CLUB_ID, Optional.empty(),
                filter(null, null, null, AvailabilityPollTypeFilter.GROUP, true));

        assertThat(result).hasSize(1 + AvailabilityPollFilter.CLOSED_POLLS_LIMIT);
        assertThat(result.get(0).open()).isTrue();
        assertThat(result.get(1).poll().id()).isEqualTo(newest.getId());
        assertThat(result.stream().skip(1)).allMatch(p -> !p.open());
    }

    @Test
    void openOnlyFilterKeepsTodaysQueries() {
        polls.pollsWithPlayers(CLUB_ID, Optional.empty(), AvailabilityPollFilter.OPEN_ONLY);

        org.mockito.Mockito.verify(pollRepository).findOpenByMatchClubId(CLUB_ID);
        org.mockito.Mockito.verify(roundRepository).findByClubIdAndOpenTrue(CLUB_ID);
        org.mockito.Mockito.verify(pollRepository, org.mockito.Mockito.never()).findClosedByMatchClubId(CLUB_ID);
        org.mockito.Mockito.verify(roundRepository, org.mockito.Mockito.never()).findByClubId(CLUB_ID);
        verifyNoInteractions(pollFilters);
    }
}
