package com.cricketlegend.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.cricketlegend.config.AccessService;
import com.cricketlegend.domain.Match;
import com.cricketlegend.domain.MatchSide;
import com.cricketlegend.domain.MatchSidePlayer;
import com.cricketlegend.domain.PlayingRole;
import com.cricketlegend.domain.PollCoverageKind;
import com.cricketlegend.domain.SelectionAvailability;
import com.cricketlegend.domain.SelectionPoolBasis;
import com.cricketlegend.domain.SelectionRejectionReason;
import com.cricketlegend.domain.Team;
import com.cricketlegend.domain.TeamSquadMember;
import com.cricketlegend.dto.ApplySelectionRequest;
import com.cricketlegend.dto.SelectionEntryRequest;
import com.cricketlegend.dto.SelectionLimitsDto;
import com.cricketlegend.dto.SelectionPoolDto;
import com.cricketlegend.dto.SelectionPoolEntryDto;
import com.cricketlegend.dto.SelectionRejectionDto;
import com.cricketlegend.exception.NotFoundException;
import com.cricketlegend.exception.SelectionRejectedException;
import com.cricketlegend.exception.ValidationException;
import com.cricketlegend.mapper.MatchSideMapper;
import com.cricketlegend.mapper.SelectionMapper;
import com.cricketlegend.repository.MatchRepository;
import com.cricketlegend.repository.MatchSidePlayerRepository;
import com.cricketlegend.repository.MatchSideRepository;
import com.cricketlegend.service.MatchPollCoverageService.Coverage;
import com.cricketlegend.service.MatchPollCoverageService.Kind;
import com.cricketlegend.service.impl.MatchSelectionServiceImpl;
import com.cricketlegend.service.support.SelectionAvailabilityResolver;
import com.cricketlegend.service.support.SelectionEligibility;
import com.cricketlegend.service.support.SelectionEligibility.PlayerInfo;
import com.cricketlegend.service.support.SelectionEvaluation;
import com.cricketlegend.service.support.SelectionRejection;
import com.cricketlegend.service.support.SelectionRules;
import com.cricketlegend.service.support.SelectionSideWriter;
import com.cricketlegend.service.support.TakenBy;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mapstruct.factory.Mappers;
import org.mockito.InOrder;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.core.Authentication;

/**
 * Unit tests for MatchSelectionServiceImpl (docs/specs/076-team-selection.md Test Plan: apply
 * selection and pool). {@link SelectionRules} and {@link SelectionSideWriter} are mocked: the rules
 * have their own tests, so here the question is what the service does with their answers, above all
 * that a refusal persists nothing and reports every rejection, that only players being added are
 * re-validated (kept players are grandfathered), and which candidates the pool lists.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class MatchSelectionServiceImplTest {

    private static final SelectionLimitsDto ELEVEN_PLUS_TWELFTH = new SelectionLimitsDto(11, true, 12);

    @Mock
    private MatchRepository matchRepository;

    @Mock
    private MatchSideRepository matchSideRepository;

    @Mock
    private MatchSidePlayerRepository matchSidePlayerRepository;

    @Mock
    private SelectionRules selectionRules;

    @Mock
    private SelectionSideWriter sideWriter;

    @Mock
    private AccessService accessService;

    @Mock
    private SelectionEligibility eligibility;

    @Mock
    private SelectionAvailabilityResolver availabilityResolver;

    private MatchSelectionServiceImpl service;
    private final Authentication authentication = new TestingAuthenticationToken("manager", null);
    private final UUID clubId = UUID.randomUUID();
    private final UUID sectionId = UUID.randomUUID();
    private final Team team = Team.builder().id(UUID.randomUUID()).clubId(clubId).sectionId(sectionId)
            .name("Villagers 1").active(true).build();
    private final UUID awayTeamId = UUID.randomUUID();
    private final Match match = Match.builder().id(UUID.randomUUID()).clubId(clubId).homeTeamId(team.getId())
            .awayTeamId(awayTeamId).seasonId(UUID.randomUUID()).matchDate(Instant.now()).active(true).build();
    private final MatchSide side = MatchSide.builder().id(UUID.randomUUID()).matchId(match.getId())
            .teamId(team.getId()).build();
    private final Map<UUID, PlayerInfo> players = new LinkedHashMap<>();
    private final Map<UUID, SelectionRejection> rejections = new HashMap<>();
    private final Map<UUID, TakenBy> taken = new HashMap<>();
    private final Map<UUID, SelectionAvailability> availability = new HashMap<>();
    private final List<MatchSidePlayer> currentRows = new ArrayList<>();

    @BeforeEach
    void setUp() {
        service = new MatchSelectionServiceImpl(matchRepository, matchSideRepository, matchSidePlayerRepository,
                selectionRules, sideWriter, Mappers.getMapper(SelectionMapper.class), new MatchSideMapper(),
                accessService);
        when(matchRepository.findById(match.getId())).thenReturn(Optional.of(match));
        when(matchSideRepository.findById(side.getId())).thenReturn(Optional.of(side));
        when(matchSideRepository.findByMatchIdAndTeamId(match.getId(), team.getId())).thenReturn(Optional.of(side));
        when(matchSideRepository.save(any(MatchSide.class))).thenAnswer(i -> i.getArgument(0));
        when(matchSidePlayerRepository.findByMatchSideIdOrderByBattingOrderAsc(side.getId()))
                .thenAnswer(i -> List.copyOf(currentRows));
        when(selectionRules.limits(match)).thenReturn(ELEVEN_PLUS_TWELFTH);
        when(selectionRules.team(team.getId())).thenReturn(team);
        when(selectionRules.eligibility()).thenReturn(eligibility);
        when(selectionRules.availability()).thenReturn(availabilityResolver);
        when(selectionRules.playerNames(any())).thenAnswer(i -> {
            Map<UUID, String> names = new HashMap<>();
            ((java.util.Collection<UUID>) i.getArgument(0)).forEach(id -> names.put(id, nameOf(id)));
            return names;
        });
        when(selectionRules.playerInfo(any())).thenReturn(Map.of());
        when(selectionRules.evaluate(any(), any(), any())).thenAnswer(i -> {
            java.util.Collection<UUID> ids = i.getArgument(2);
            Map<UUID, SelectionRejection> mine = new HashMap<>();
            ids.stream().filter(rejections::containsKey).forEach(id -> mine.put(id, rejections.get(id)));
            return new SelectionEvaluation(Coverage.NONE, players, availability, taken, mine);
        });
        when(selectionRules.evaluate(any(), any(), any(), any(), any())).thenAnswer(i -> {
            java.util.Collection<UUID> ids = i.getArgument(2);
            Map<UUID, SelectionRejection> mine = new HashMap<>();
            ids.stream().filter(rejections::containsKey).forEach(id -> mine.put(id, rejections.get(id)));
            return new SelectionEvaluation(i.getArgument(3), players, availability, taken, mine);
        });
        when(availabilityResolver.coverage(match.getId(), team.getId())).thenReturn(Coverage.NONE);
        when(eligibility.loadPlayers(any())).thenAnswer(i -> players);
    }

    private String nameOf(UUID id) {
        return players.containsKey(id) ? players.get(id).fullName() : "Player " + id;
    }

    private UUID player(String first) {
        UUID id = UUID.randomUUID();
        players.put(id, new PlayerInfo(id, clubId, true, first, "Smith", null, null));
        return id;
    }

    private UUID selected(String first, Integer battingOrder, PlayingRole role) {
        UUID id = player(first);
        currentRows.add(MatchSidePlayer.builder().id(UUID.randomUUID()).matchSideId(side.getId())
                .playerProfileId(id).battingOrder(battingOrder).role(role).build());
        return id;
    }

    private void block(UUID id, SelectionRejectionReason reason) {
        rejections.put(id, new SelectionRejection(id, nameOf(id), reason, nameOf(id) + " blocked " + reason, null));
    }

    private static SelectionEntryRequest entry(UUID id) {
        return new SelectionEntryRequest(id, null, null);
    }

    private ApplySelectionRequest request(SelectionEntryRequest... entries) {
        return new ApplySelectionRequest(List.of(entries));
    }

    private void apply(SelectionEntryRequest... entries) {
        service.apply(authentication, clubId, match.getId(), side.getId(), request(entries));
    }

    private void assertNothingWritten() {
        verify(sideWriter, never()).removePlayers(any(), any());
        verify(sideWriter, never()).addPlayer(any(), any(), any(), any());
        verify(sideWriter, never()).assignOrder(any(), any());
        verify(matchSidePlayerRepository, never()).save(any());
        verify(matchSideRepository, never()).save(any());
    }

    // --- apply: adds, removes, keeps ---

    @Test
    void applyAddsRemovesAndKeepsAndAssignsTheBattingOrderOfTheKeptPlayers() {
        UUID a = selected("Ann", 1, PlayingRole.BATSMAN);
        UUID b = selected("Bob", 2, PlayingRole.BOWLER);
        UUID c = selected("Cal", 3, PlayingRole.BATSMAN);
        UUID d = player("Dan");
        UUID e = player("Eve");

        apply(entry(a), new SelectionEntryRequest(c, PlayingRole.ALL_ROUNDER, null),
                new SelectionEntryRequest(d, PlayingRole.BOWLER, null), entry(e));

        verify(sideWriter).removePlayers(side, List.of(b));
        verify(sideWriter).addPlayer(side.getId(), d, PlayingRole.BOWLER, null);
        verify(sideWriter).addPlayer(side.getId(), e, PlayingRole.BATSMAN, null);
        verify(sideWriter, never()).addPlayer(eq(side.getId()), eq(a), any(), any());
        assertThat(currentRows.get(2).getRole()).isEqualTo(PlayingRole.ALL_ROUNDER);
        verify(matchSidePlayerRepository).save(currentRows.get(2));
        // the new players wait without a position; the kept ones close ranks around the removed one
        verify(sideWriter).assignOrder(side.getId(), List.of(a, c));
    }

    @Test
    void applyWithAKeptPlayersNullRoleKeepsHisRole() {
        UUID a = selected("Ann", 1, PlayingRole.BOWLER);

        apply(entry(a));

        assertThat(currentRows.get(0).getRole()).isEqualTo(PlayingRole.BOWLER);
        verify(matchSidePlayerRepository, never()).save(any());
    }

    @Test
    void applyPlacesAnExplicitlyPositionedPlayerThereAndTheRestKeepTheirOrderAroundHim() {
        UUID a = selected("Ann", 1, PlayingRole.BATSMAN);
        UUID b = selected("Bob", 2, PlayingRole.BATSMAN);
        UUID d = player("Dan");

        apply(entry(a), entry(b), new SelectionEntryRequest(d, null, 1));

        verify(sideWriter).addPlayer(side.getId(), d, PlayingRole.BATSMAN, null);
        verify(sideWriter).assignOrder(side.getId(), List.of(d, a, b));
    }

    @Test
    void applyClosesGapsLeftByExplicitPositions() {
        UUID a = player("Ann");
        UUID b = player("Bob");

        apply(new SelectionEntryRequest(a, null, 3), new SelectionEntryRequest(b, null, 1));

        verify(sideWriter).assignOrder(side.getId(), List.of(b, a));
    }

    @Test
    void applyLeavesAKeptTwelfthManWithoutAPosition() {
        UUID a = selected("Ann", 1, PlayingRole.BATSMAN);
        UUID twelfth = selected("Tim", null, PlayingRole.BATSMAN);
        side.setTwelfthManPlayerId(twelfth);

        apply(entry(a), entry(twelfth));

        verify(sideWriter).assignOrder(side.getId(), List.of(a));
        verify(sideWriter).removePlayers(side, List.of());
    }

    @Test
    void applyAnEmptyListClearsTheSide() {
        UUID a = selected("Ann", 1, PlayingRole.BATSMAN);
        UUID b = selected("Bob", 2, PlayingRole.BATSMAN);

        apply();

        ArgumentCaptorHolder.removedIds(sideWriter, side, a, b);
        verify(sideWriter).assignOrder(side.getId(), List.of());
        verify(sideWriter, never()).addPlayer(any(), any(), any(), any());
    }

    @Test
    void applyReturnsTheSidesFinalRowsAndLimits() {
        UUID a = selected("Ann", 1, PlayingRole.BATSMAN);

        var dto = service.apply(authentication, clubId, match.getId(), side.getId(), request(entry(a)));

        assertThat(dto.id()).isEqualTo(side.getId());
        assertThat(dto.limits()).isEqualTo(ELEVEN_PLUS_TWELFTH);
        assertThat(dto.players()).extracting(p -> p.playerProfileId()).containsExactly(a);
    }

    // --- apply: validation only for added players ---

    @Test
    void applyValidatesOnlyThePlayersBeingAddedSoKeptPlayersAreGrandfathered() {
        UUID kept = selected("Old", 1, PlayingRole.BATSMAN);
        block(kept, SelectionRejectionReason.SAID_UNAVAILABLE);
        UUID added = player("New");

        apply(entry(kept), entry(added));

        verify(selectionRules).evaluate(match, team.getId(), List.of(added));
        verify(sideWriter).addPlayer(side.getId(), added, PlayingRole.BATSMAN, null);
    }

    @Test
    void applyTakesTheLocksOnTheAddedPlayersBeforeEvaluatingThem() {
        UUID added = player("New");

        apply(entry(added));

        InOrder order = inOrder(selectionRules);
        order.verify(selectionRules).lockPlayers(List.of(added));
        order.verify(selectionRules).evaluate(match, team.getId(), List.of(added));
    }

    // --- apply: atomicity and rejection reasons ---

    @Test
    void oneBlockedPlayerAmongFivePersistsNothingAndReturnsTheRejection() {
        List<UUID> ids = new ArrayList<>();
        for (String name : List.of("A", "B", "C", "D", "E")) {
            ids.add(player(name));
        }
        block(ids.get(2), SelectionRejectionReason.TAKEN_FOR_SLOT);

        assertThatThrownBy(() -> apply(ids.stream().map(MatchSelectionServiceImplTest::entry)
                .toArray(SelectionEntryRequest[]::new)))
                .isInstanceOfSatisfying(SelectionRejectedException.class, ex -> {
                    assertThat(ex.getMessage()).isEqualTo("1 player can't be selected");
                    assertThat(ex.getRejections()).extracting(SelectionRejectionDto::playerProfileId)
                            .containsExactly(ids.get(2));
                    assertThat(ex.getRejections().get(0).reason()).isEqualTo(SelectionRejectionReason.TAKEN_FOR_SLOT);
                });
        assertNothingWritten();
    }

    @Test
    void everyBlockedPlayerIsReportedWithItsReasonInOneResponse() {
        UUID age = player("Age");
        UUID gone = player("Gone");
        UUID unsure = player("Unsure");
        UUID outsider = player("Outsider");
        UUID busy = player("Busy");
        UUID fine = player("Fine");
        block(age, SelectionRejectionReason.AGE_INELIGIBLE);
        block(gone, SelectionRejectionReason.SAID_UNAVAILABLE);
        block(unsure, SelectionRejectionReason.NOT_CONFIRMED);
        block(outsider, SelectionRejectionReason.NOT_IN_POOL);
        block(busy, SelectionRejectionReason.TAKEN_FOR_SLOT);

        assertThatThrownBy(() -> apply(entry(age), entry(gone), entry(unsure), entry(outsider), entry(busy), entry(fine)))
                .isInstanceOfSatisfying(SelectionRejectedException.class, ex -> {
                    assertThat(ex.getMessage()).isEqualTo("5 players can't be selected");
                    assertThat(ex.getRejections()).extracting(SelectionRejectionDto::reason).containsExactlyInAnyOrder(
                            SelectionRejectionReason.AGE_INELIGIBLE, SelectionRejectionReason.SAID_UNAVAILABLE,
                            SelectionRejectionReason.NOT_CONFIRMED, SelectionRejectionReason.NOT_IN_POOL,
                            SelectionRejectionReason.TAKEN_FOR_SLOT);
                });
        assertNothingWritten();
    }

    @Test
    void aTakenRejectionCarriesWhereTheHolderIsAndWhetherTheCallerMayReleaseHim() {
        UUID busy = player("Busy");
        UUID holderTeamId = UUID.randomUUID();
        UUID holderSection = UUID.randomUUID();
        TakenBy holder = new TakenBy(holderTeamId, "Villagers 2", clubId, holderSection, UUID.randomUUID(),
                Instant.now(), "Sat 6 Jun (morning)", UUID.randomUUID(), false, true);
        rejections.put(busy, new SelectionRejection(busy, "Busy Smith", SelectionRejectionReason.TAKEN_FOR_SLOT,
                "m", holder));
        when(accessService.canAdministerSection(authentication, clubId, holderSection)).thenReturn(true);

        assertThatThrownBy(() -> apply(entry(busy))).isInstanceOfSatisfying(SelectionRejectedException.class, ex -> {
            var taken = ex.getRejections().get(0).taken();
            assertThat(taken.teamName()).isEqualTo("Villagers 2");
            assertThat(taken.announced()).isTrue();
            assertThat(taken.canRelease()).isTrue();
        });
    }

    @Test
    void moreEntriesThanTheMostSelectableIsTeamFullWithNoPlayerAndPersistsNothing() {
        SelectionEntryRequest[] thirteen = new SelectionEntryRequest[13];
        for (int i = 0; i < 13; i++) {
            thirteen[i] = entry(player("P" + i));
        }

        assertThatThrownBy(() -> apply(thirteen)).isInstanceOfSatisfying(SelectionRejectedException.class, ex -> {
            assertThat(ex.getMessage()).isEqualTo("Team is full: 12 is the most that can be selected");
            assertThat(ex.getRejections()).extracting(SelectionRejectionDto::reason)
                    .contains(SelectionRejectionReason.TEAM_FULL);
            SelectionRejectionDto full = ex.getRejections().stream()
                    .filter(r -> r.reason() == SelectionRejectionReason.TEAM_FULL).findFirst().orElseThrow();
            assertThat(full.playerProfileId()).isNull();
            assertThat(full.playerName()).isNull();
        });
        assertNothingWritten();
    }

    @Test
    void anExplicitPositionBelowOneAboveThePlacesOrUsedTwiceIsPositionInvalid() {
        UUID zero = player("Zero");
        UUID tooHigh = player("High");
        UUID first = player("First");
        UUID dupe = player("Dupe");

        assertThatThrownBy(() -> apply(new SelectionEntryRequest(zero, null, 0),
                new SelectionEntryRequest(tooHigh, null, 12), new SelectionEntryRequest(first, null, 2),
                new SelectionEntryRequest(dupe, null, 2)))
                .isInstanceOfSatisfying(SelectionRejectedException.class, ex -> {
                    assertThat(ex.getRejections()).extracting(SelectionRejectionDto::reason)
                            .containsOnly(SelectionRejectionReason.POSITION_INVALID);
                    assertThat(ex.getRejections()).extracting(SelectionRejectionDto::playerProfileId)
                            .containsExactlyInAnyOrder(zero, tooHigh, dupe);
                    assertThat(ex.getRejections()).extracting(SelectionRejectionDto::message).contains(
                            "Batting position 0 is outside 1 to 11", "Batting position 12 is outside 1 to 11",
                            "Batting position 2 is used more than once");
                });
        assertNothingWritten();
    }

    @Test
    void theTwelfthManCannotBeGivenABattingPosition() {
        UUID twelfth = selected("Tim", null, PlayingRole.BATSMAN);
        side.setTwelfthManPlayerId(twelfth);

        assertThatThrownBy(() -> apply(new SelectionEntryRequest(twelfth, null, 3)))
                .isInstanceOfSatisfying(SelectionRejectedException.class, ex ->
                        assertThat(ex.getRejections().get(0).message())
                                .isEqualTo("Tim Smith is the 12th man and has no batting position"));
        assertNothingWritten();
    }

    @Test
    void moreImpliedPositionsThanPlacesIsPositionInvalidWhenLeagueHasFewerPlaces() {
        when(selectionRules.limits(match)).thenReturn(new SelectionLimitsDto(2, false, 2));
        UUID a = selected("A", 1, PlayingRole.BATSMAN);
        UUID b = selected("B", 2, PlayingRole.BATSMAN);
        UUID c = selected("C", 3, PlayingRole.BATSMAN);

        assertThatThrownBy(() -> apply(entry(a), entry(b), entry(c)))
                .isInstanceOfSatisfying(SelectionRejectedException.class, ex ->
                        assertThat(ex.getRejections()).extracting(SelectionRejectionDto::reason)
                                .contains(SelectionRejectionReason.POSITION_INVALID));
        assertNothingWritten();
    }

    @Test
    void aRequestWithTheSamePlayerTwiceIsAValidationException() {
        UUID a = player("Ann");

        assertThatThrownBy(() -> apply(entry(a), entry(a))).isInstanceOf(ValidationException.class)
                .hasMessageContaining("twice");
        assertNothingWritten();
    }

    @Test
    void aNullEntryIsAValidationException() {
        List<SelectionEntryRequest> withNull = new ArrayList<>();
        withNull.add(null);

        assertThatThrownBy(() -> service.apply(authentication, clubId, match.getId(), side.getId(),
                new ApplySelectionRequest(withNull))).isInstanceOf(ValidationException.class);
        assertNothingWritten();
    }

    // --- apply: idempotence, announced, access ---

    @Test
    void reApplyingTheCurrentSelectionChangesNothing() {
        UUID a = selected("Ann", 1, PlayingRole.BATSMAN);
        UUID b = selected("Bob", 2, PlayingRole.BOWLER);

        apply(entry(a), entry(b));
        apply(entry(a), entry(b));

        verify(sideWriter, never()).addPlayer(any(), any(), any(), any());
        verify(selectionRules, never()).evaluate(any(), any(), any());
        verify(sideWriter, org.mockito.Mockito.times(2)).removePlayers(side, List.of());
        verify(sideWriter, org.mockito.Mockito.times(2)).assignOrder(side.getId(), List.of(a, b));
        assertThat(currentRows).extracting(MatchSidePlayer::getRole)
                .containsExactly(PlayingRole.BATSMAN, PlayingRole.BOWLER);
    }

    @Test
    void anAnnouncedSideIsUnannouncedByAnApply() {
        side.setAnnounced(true);
        UUID a = selected("Ann", 1, PlayingRole.BATSMAN);

        var dto = service.apply(authentication, clubId, match.getId(), side.getId(), request(entry(a)));

        assertThat(side.isAnnounced()).isFalse();
        assertThat(dto.announced()).isFalse();
        verify(matchSideRepository).save(side);
    }

    @Test
    void applyForAnotherClubsMatchOrAnotherMatchsSideIsNotFound() {
        assertThatThrownBy(() -> service.apply(authentication, UUID.randomUUID(), match.getId(), side.getId(), request()))
                .isInstanceOf(NotFoundException.class);
        MatchSide foreign = MatchSide.builder().id(UUID.randomUUID()).matchId(UUID.randomUUID())
                .teamId(team.getId()).build();
        when(matchSideRepository.findById(foreign.getId())).thenReturn(Optional.of(foreign));

        assertThatThrownBy(() -> service.apply(authentication, clubId, match.getId(), foreign.getId(), request()))
                .isInstanceOf(NotFoundException.class);
        assertNothingWritten();
    }

    @Test
    void applyByACallerWhoCannotAdministerTheMatchsSectionsIsDeniedBeforeAnyWork() {
        org.mockito.Mockito.doThrow(new AccessDeniedException("no")).when(accessService)
                .assertCanAdministerAnySection(any(), eq(clubId), any());

        assertThatThrownBy(() -> apply(entry(player("Ann")))).isInstanceOf(AccessDeniedException.class);
        assertNothingWritten();
        verify(selectionRules, never()).lockPlayers(any());
    }

    // --- pool ---

    private List<UUID> roster(String... names) {
        List<UUID> ids = new ArrayList<>();
        List<TeamSquadMember> members = new ArrayList<>();
        for (String name : names) {
            UUID id = player(name);
            ids.add(id);
            members.add(TeamSquadMember.builder().teamId(team.getId()).seasonId(match.getSeasonId())
                    .playerProfileId(id).jerseyNumber(ids.size()).build());
        }
        when(eligibility.roster(match, team)).thenReturn(members);
        when(eligibility.poolMemberIds(match, team)).thenReturn(new java.util.HashSet<>(ids));
        return ids;
    }

    private SelectionPoolDto pool(boolean wholeSection, String q) {
        return service.pool(authentication, clubId, match.getId(), team.getId(), wholeSection, q);
    }

    private static List<UUID> ids(SelectionPoolDto pool) {
        return pool.entries().stream().map(SelectionPoolEntryDto::playerProfileId).toList();
    }

    @Test
    void theDefaultPoolForARosterIsTheRosterSortedByNameWithBasisRoster() {
        List<UUID> ids = roster("Cal", "Ann", "Bob");

        SelectionPoolDto pool = pool(false, null);

        assertThat(pool.basis()).isEqualTo(SelectionPoolBasis.ROSTER);
        assertThat(pool.coveringPoll().kind()).isEqualTo(PollCoverageKind.NONE);
        assertThat(pool.truncated()).isFalse();
        assertThat(pool.sideId()).isEqualTo(side.getId());
        assertThat(ids(pool)).containsExactly(ids.get(1), ids.get(2), ids.get(0));
        assertThat(pool.entries().get(0).jerseyNumber()).isEqualTo(2);
    }

    @Test
    void theDefaultPoolForASquadPollIsTheRosterWithTheSquadPollCovering() {
        List<UUID> ids = roster("Ann", "Bob");
        UUID pollId = UUID.randomUUID();
        when(availabilityResolver.coverage(match.getId(), team.getId()))
                .thenReturn(new Coverage(Kind.SQUAD, pollId, null, null, "x"));

        SelectionPoolDto pool = pool(false, null);

        assertThat(pool.basis()).isEqualTo(SelectionPoolBasis.ROSTER);
        assertThat(pool.coveringPoll().kind()).isEqualTo(PollCoverageKind.SQUAD);
        assertThat(pool.coveringPoll().pollId()).isEqualTo(pollId);
        assertThat(ids(pool)).containsExactlyInAnyOrderElementsOf(ids);
    }

    @Test
    void theDefaultPoolForAGroupPollIsOnlyThosePoolMembersWhoSaidAvailable() {
        List<UUID> ids = roster("Ann", "Bob");
        UUID outsiderWhoSaidYes = player("Zed");
        Coverage group = new Coverage(Kind.GROUP, null, UUID.randomUUID(), UUID.randomUUID(), "Round");
        when(availabilityResolver.coverage(match.getId(), team.getId())).thenReturn(group);
        when(availabilityResolver.availableOnGroupPoll(group)).thenReturn(Set.of(ids.get(1), outsiderWhoSaidYes));

        SelectionPoolDto pool = pool(false, null);

        assertThat(pool.basis()).isEqualTo(SelectionPoolBasis.POLL_AVAILABLE);
        assertThat(pool.coveringPoll().kind()).isEqualTo(PollCoverageKind.GROUP);
        assertThat(ids(pool)).containsExactly(ids.get(1));
    }

    @Test
    void wholeSectionIsASupersetOfTheDefaultPool() {
        List<UUID> roster = roster("Ann");
        UUID tagged = player("Bob");
        when(eligibility.poolMemberIds(match, team)).thenReturn(Set.of(roster.get(0), tagged));

        assertThat(ids(pool(false, null))).containsExactly(roster.get(0));
        SelectionPoolDto whole = pool(true, null);

        assertThat(whole.wholeSection()).isTrue();
        assertThat(ids(whole)).containsExactly(roster.get(0), tagged);
    }

    @Test
    void selectedPlayersAreAlwaysListedEvenOffTheDefaultPoolOrTheSearch() {
        roster("Ann");
        UUID picked = selected("Zed", 1, PlayingRole.BATSMAN);
        when(eligibility.poolMemberIds(match, team)).thenReturn(Set.of());

        SelectionPoolDto searched = pool(false, "ann");

        assertThat(searched.entries()).extracting(SelectionPoolEntryDto::playerProfileId).contains(picked);
        SelectionPoolEntryDto entry = searched.entries().stream()
                .filter(e -> e.playerProfileId().equals(picked)).findFirst().orElseThrow();
        assertThat(entry.selected()).isTrue();
        assertThat(entry.selectable()).isTrue();
        assertThat(entry.reason()).isNull();
    }

    @Test
    void aSelectedPlayerWhoWouldNowBeRejectedIsStillListedSelectableAndWithNoReason() {
        roster();
        UUID grandfathered = selected("Old", 1, PlayingRole.BATSMAN);
        block(grandfathered, SelectionRejectionReason.SAID_UNAVAILABLE);

        SelectionPoolEntryDto entry = pool(false, null).entries().get(0);

        assertThat(entry.selected()).isTrue();
        assertThat(entry.selectable()).isTrue();
        assertThat(entry.reason()).isNull();
        assertThat(entry.reasonText()).isNull();
    }

    @Test
    void searchMatchesFirstOrLastNameCaseInsensitively() {
        List<UUID> ids = roster("Annabel", "Bob", "Carl");
        players.put(ids.get(2), new PlayerInfo(ids.get(2), clubId, true, "Carl", "Annan", null, null));

        assertThat(ids(pool(false, "  ANN "))).containsExactly(ids.get(0), ids.get(2));
        assertThat(ids(pool(false, "zzz"))).isEmpty();
    }

    @Test
    void inactiveAndAnotherClubsPlayersAreNotListed() {
        List<UUID> ids = roster("Ann", "Bob", "Cal");
        players.put(ids.get(1), new PlayerInfo(ids.get(1), clubId, false, "Bob", "Smith", null, null));
        players.put(ids.get(2), new PlayerInfo(ids.get(2), UUID.randomUUID(), true, "Cal", "Smith", null, null));

        assertThat(ids(pool(false, null))).containsExactly(ids.get(0));
    }

    @Test
    void thePoolIsCappedAtFiveHundredAndSaysTruncated() {
        String[] names = new String[501];
        for (int i = 0; i < 501; i++) {
            names[i] = String.format("P%04d", i);
        }
        List<UUID> ids = roster(names);

        SelectionPoolDto pool = pool(false, null);

        assertThat(pool.truncated()).isTrue();
        assertThat(pool.entries()).hasSize(500);
        assertThat(ids(pool)).doesNotContain(ids.get(500));
    }

    @Test
    void exactlyFiveHundredIsNotTruncated() {
        String[] names = new String[500];
        for (int i = 0; i < 500; i++) {
            names[i] = String.format("P%04d", i);
        }
        roster(names);

        SelectionPoolDto pool = pool(false, null);

        assertThat(pool.truncated()).isFalse();
        assertThat(pool.entries()).hasSize(500);
    }

    @Test
    void selectedPlayersAreNotSubjectToTheCap() {
        String[] names = new String[501];
        for (int i = 0; i < 501; i++) {
            names[i] = String.format("P%04d", i);
        }
        roster(names);
        UUID picked = selected("Zzz", 1, PlayingRole.BATSMAN);

        SelectionPoolDto pool = pool(false, null);

        assertThat(pool.entries()).hasSize(501);
        assertThat(ids(pool)).contains(picked);
    }

    @Test
    void aBlockedEntryCarriesItsReasonTextAndAvailability() {
        List<UUID> ids = roster("Ann");
        block(ids.get(0), SelectionRejectionReason.NOT_CONFIRMED);
        availability.put(ids.get(0), SelectionAvailability.UNSURE);

        SelectionPoolEntryDto entry = pool(false, null).entries().get(0);

        assertThat(entry.selectable()).isFalse();
        assertThat(entry.reason()).isEqualTo(SelectionRejectionReason.NOT_CONFIRMED);
        assertThat(entry.reasonText()).isEqualTo("Ann Smith blocked NOT_CONFIRMED");
        assertThat(entry.availability()).isEqualTo(SelectionAvailability.UNSURE);
    }

    private TakenBy heldBy(UUID teamClubId, UUID teamSectionId) {
        return new TakenBy(UUID.randomUUID(), "Villagers 2", teamClubId, teamSectionId, UUID.randomUUID(),
                Instant.now(), "Sat 6 Jun (morning)", UUID.randomUUID(), false, false);
    }

    @Test
    void canReleaseIsTrueWhenTheCallerMayAdministerTheOtherTeamsSectionAndFalseOtherwise() {
        List<UUID> ids = roster("Ann", "Bob");
        UUID manageable = UUID.randomUUID();
        UUID notManageable = UUID.randomUUID();
        taken.put(ids.get(0), heldBy(clubId, manageable));
        taken.put(ids.get(1), heldBy(clubId, notManageable));
        block(ids.get(0), SelectionRejectionReason.TAKEN_FOR_SLOT);
        block(ids.get(1), SelectionRejectionReason.TAKEN_FOR_SLOT);
        when(accessService.canAdministerSection(authentication, clubId, manageable)).thenReturn(true);
        when(accessService.canAdministerSection(authentication, clubId, notManageable)).thenReturn(false);

        SelectionPoolDto pool = pool(false, null);

        assertThat(pool.entries().get(0).taken().canRelease()).isTrue();
        assertThat(pool.entries().get(1).taken().canRelease()).isFalse();
    }

    @Test
    void canReleaseIsFalseForAnotherClubsTeamWithoutAskingTheAccessRules() {
        List<UUID> ids = roster("Ann");
        UUID foreignSection = UUID.randomUUID();
        taken.put(ids.get(0), heldBy(UUID.randomUUID(), foreignSection));
        block(ids.get(0), SelectionRejectionReason.TAKEN_FOR_SLOT);
        when(accessService.canAdministerSection(any(), any(), any())).thenReturn(true);

        assertThat(pool(false, null).entries().get(0).taken().canRelease()).isFalse();
        verify(accessService, never()).canAdministerSection(any(), any(), eq(foreignSection));
    }

    @Test
    void poolForATeamThatIsNotOneOfTheMatchsOwnIsAValidationException() {
        assertThatThrownBy(() -> service.pool(authentication, clubId, match.getId(), UUID.randomUUID(), false, null))
                .isInstanceOf(ValidationException.class);
    }

    @Test
    void poolWorksBeforeTheSideExists() {
        roster("Ann");
        when(matchSideRepository.findByMatchIdAndTeamId(match.getId(), team.getId())).thenReturn(Optional.empty());

        SelectionPoolDto pool = pool(false, null);

        assertThat(pool.sideId()).isNull();
        assertThat(pool.entries()).hasSize(1);
        verifyNoInteractions(sideWriter);
    }

    @Test
    void poolForAnotherClubsMatchIsNotFoundAndADeniedCallerGetsNoPool() {
        assertThatThrownBy(() -> service.pool(authentication, UUID.randomUUID(), match.getId(), team.getId(), false, null))
                .isInstanceOf(NotFoundException.class);
        org.mockito.Mockito.doThrow(new AccessDeniedException("no")).when(accessService)
                .assertCanAdministerAnySection(any(), eq(clubId), any());

        assertThatThrownBy(() -> pool(false, null)).isInstanceOf(AccessDeniedException.class);
        verify(selectionRules, never()).evaluate(any(), any(), anyList(), any(), any());
    }

    /** Verifies {@code removePlayers} was asked for exactly these two players, in any order. */
    private static final class ArgumentCaptorHolder {
        static void removedIds(SelectionSideWriter writer, MatchSide side, UUID a, UUID b) {
            @SuppressWarnings("unchecked")
            org.mockito.ArgumentCaptor<java.util.Collection<UUID>> captor =
                    org.mockito.ArgumentCaptor.forClass(java.util.Collection.class);
            verify(writer).removePlayers(eq(side), captor.capture());
            assertThat(captor.getValue()).containsExactlyInAnyOrder(a, b);
        }
    }
}
