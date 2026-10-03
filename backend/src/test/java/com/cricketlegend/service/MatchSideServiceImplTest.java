package com.cricketlegend.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.cricketlegend.config.AccessService;
import com.cricketlegend.domain.Match;
import com.cricketlegend.domain.MatchSide;
import com.cricketlegend.domain.MatchSidePlayer;
import com.cricketlegend.domain.PlayingRole;
import com.cricketlegend.domain.Team;
import com.cricketlegend.dto.AddMatchSidePlayerRequest;
import com.cricketlegend.dto.CreateMatchSideRequest;
import com.cricketlegend.dto.SelectionLimitsDto;
import com.cricketlegend.dto.UpdateMatchSidePlayerRequest;
import com.cricketlegend.dto.UpdateMatchSideRequest;
import com.cricketlegend.exception.ConflictException;
import com.cricketlegend.exception.NotFoundException;
import com.cricketlegend.exception.PlayerNotInSquadException;
import com.cricketlegend.exception.PlayerTakenForSlotException;
import com.cricketlegend.exception.PlayingXiCapExceededException;
import com.cricketlegend.exception.SelectionIncompleteException;
import com.cricketlegend.exception.TwelfthManNotAllowedException;
import com.cricketlegend.exception.ValidationException;
import com.cricketlegend.mapper.MatchSideMapper;
import com.cricketlegend.repository.MatchRepository;
import com.cricketlegend.repository.MatchSidePlayerRepository;
import com.cricketlegend.repository.MatchSideRepository;
import com.cricketlegend.service.impl.MatchSideServiceImpl;
import com.cricketlegend.service.support.SelectionRules;
import com.cricketlegend.service.support.SelectionSideWriter;
import java.time.Instant;
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
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;

/**
 * Unit tests for MatchSideServiceImpl's orchestration per docs/specs/029-league-management.md and
 * docs/specs/076-team-selection.md. The selection rules themselves (limits, pool membership, age,
 * the slot and said-unavailable blocks) live in {@link SelectionRules}; here they are mocked, so
 * these tests cover what the service does with their answers: duplicate and total-cap checks, the
 * lock before the rules, batting positions kept contiguous (a real {@link SelectionSideWriter}
 * over the mocked row repository), captain/keeper/twelfth-man handling, the announce rule, and
 * the announced-flag side effects of every edit.
 */
@ExtendWith(MockitoExtension.class)
class MatchSideServiceImplTest {

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
    private MatchSideMapper matchSideMapper;

    @Mock
    private AccessService accessService;

    private MatchSideServiceImpl service;
    private final Authentication authentication = new TestingAuthenticationToken(
            "club-admin-subject", null, List.of(new SimpleGrantedAuthority("ROLE_someone_else")));

    @BeforeEach
    void setUp() {
        service = new MatchSideServiceImpl(
                matchRepository, matchSideRepository, matchSidePlayerRepository, selectionRules,
                new SelectionSideWriter(matchSidePlayerRepository), matchSideMapper, accessService);
        org.mockito.Mockito.lenient().when(matchSideMapper.toDto(any(), any(), any(), any())).thenReturn(null);
        org.mockito.Mockito.lenient().when(selectionRules.limits(any())).thenReturn(ELEVEN_PLUS_TWELFTH);
    }

    private Match matchWithoutLeague(UUID clubId, UUID matchId, UUID homeTeamId, UUID awayTeamId, UUID seasonId) {
        return Match.builder().id(matchId).clubId(clubId).homeTeamId(homeTeamId).awayTeamId(awayTeamId)
                .seasonId(seasonId).matchDate(Instant.now()).active(true).build();
    }

    private MatchSide side(UUID id, UUID matchId, UUID teamId) {
        return MatchSide.builder().id(id).matchId(matchId).teamId(teamId).build();
    }

    private MatchSidePlayer row(UUID sideId, UUID playerId, Integer battingOrder) {
        return MatchSidePlayer.builder().id(UUID.randomUUID()).matchSideId(sideId).playerProfileId(playerId)
                .battingOrder(battingOrder).role(PlayingRole.BATSMAN).build();
    }

    private List<MatchSidePlayer> rows(UUID sideId, int count) {
        java.util.ArrayList<MatchSidePlayer> rows = new java.util.ArrayList<>();
        for (int i = 1; i <= count; i++) {
            rows.add(row(sideId, UUID.randomUUID(), i));
        }
        return rows;
    }

    // --- createSide ---

    @Test
    void createSideForOneOfTheMatchsOwnTeamIdsSucceeds() {
        UUID clubId = UUID.randomUUID();
        UUID matchId = UUID.randomUUID();
        UUID homeTeamId = UUID.randomUUID();
        UUID awayTeamId = UUID.randomUUID();
        UUID seasonId = UUID.randomUUID();
        Match match = matchWithoutLeague(clubId, matchId, homeTeamId, awayTeamId, seasonId);
        when(matchRepository.findById(matchId)).thenReturn(Optional.of(match));
        when(matchSideRepository.existsByMatchIdAndTeamId(matchId, homeTeamId)).thenReturn(false);
        when(matchSideRepository.save(any(MatchSide.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(matchSidePlayerRepository.findByMatchSideIdOrderByBattingOrderAsc(any())).thenReturn(List.of());

        service.createSide(authentication, clubId, matchId, new CreateMatchSideRequest(homeTeamId));

        verify(matchSideRepository).save(any(MatchSide.class));
    }

    @Test
    void createSideForATeamIdNotOnTheMatchThrowsValidationException() {
        UUID clubId = UUID.randomUUID();
        UUID matchId = UUID.randomUUID();
        Match match = matchWithoutLeague(clubId, matchId, UUID.randomUUID(), UUID.randomUUID(), UUID.randomUUID());
        when(matchRepository.findById(matchId)).thenReturn(Optional.of(match));

        assertThatThrownBy(() -> service.createSide(authentication, clubId, matchId, new CreateMatchSideRequest(UUID.randomUUID())))
                .isInstanceOf(ValidationException.class);
        verify(matchSideRepository, never()).save(any());
    }

    @Test
    void createSideWhenOneAlreadyExistsForThatTeamThrowsConflictException() {
        UUID clubId = UUID.randomUUID();
        UUID matchId = UUID.randomUUID();
        UUID homeTeamId = UUID.randomUUID();
        Match match = matchWithoutLeague(clubId, matchId, homeTeamId, UUID.randomUUID(), UUID.randomUUID());
        when(matchRepository.findById(matchId)).thenReturn(Optional.of(match));
        when(matchSideRepository.existsByMatchIdAndTeamId(matchId, homeTeamId)).thenReturn(true);

        assertThatThrownBy(() -> service.createSide(authentication, clubId, matchId, new CreateMatchSideRequest(homeTeamId)))
                .isInstanceOf(ConflictException.class);
        verify(matchSideRepository, never()).save(any());
    }

    // 070: a league-team side has no teamId, so it can never become a MatchSide/playing XI.
    @Test
    void createSideForALeagueTeamSideIsRejectedAndNeverSaved() {
        UUID clubId = UUID.randomUUID();
        UUID matchId = UUID.randomUUID();
        UUID ownTeamId = UUID.randomUUID();
        UUID leagueTeamId = UUID.randomUUID();
        Match match = Match.builder().id(matchId).clubId(clubId).homeTeamId(ownTeamId)
                .awayTeamName("Hillside CC").awayLeagueTeamId(leagueTeamId)
                .seasonId(UUID.randomUUID()).matchDate(Instant.now()).active(true).build();
        when(matchRepository.findById(matchId)).thenReturn(Optional.of(match));

        // Neither the league team's own id nor any other id equals the match's home/away team id.
        assertThatThrownBy(() -> service.createSide(authentication, clubId, matchId, new CreateMatchSideRequest(leagueTeamId)))
                .isInstanceOf(ValidationException.class);
        assertThatThrownBy(() -> service.createSide(authentication, clubId, matchId, new CreateMatchSideRequest(UUID.randomUUID())))
                .isInstanceOf(ValidationException.class);
        verify(matchSideRepository, never()).save(any());
    }

    // --- addPlayer ---

    @Test
    void addPlayerAlreadyOnTheSideThrowsConflictException() {
        UUID clubId = UUID.randomUUID();
        UUID matchId = UUID.randomUUID();
        UUID teamId = UUID.randomUUID();
        UUID playerId = UUID.randomUUID();
        Match match = matchWithoutLeague(clubId, matchId, teamId, UUID.randomUUID(), UUID.randomUUID());
        MatchSide matchSide = side(UUID.randomUUID(), matchId, teamId);
        when(matchRepository.findById(matchId)).thenReturn(Optional.of(match));
        when(matchSideRepository.findById(matchSide.getId())).thenReturn(Optional.of(matchSide));
        when(matchSidePlayerRepository.existsByMatchSideIdAndPlayerProfileId(matchSide.getId(), playerId))
                .thenReturn(true);

        AddMatchSidePlayerRequest request = new AddMatchSidePlayerRequest(playerId, PlayingRole.BATSMAN);

        assertThatThrownBy(() -> service.addPlayer(authentication, clubId, matchId, matchSide.getId(), request))
                .isInstanceOf(ConflictException.class);
        verify(matchSidePlayerRepository, never()).save(any());
    }

    @Test
    void addPlayerBeyondTheMostThatCanBeSelectedThrowsPlayingXiCapExceededException() {
        UUID clubId = UUID.randomUUID();
        UUID matchId = UUID.randomUUID();
        UUID teamId = UUID.randomUUID();
        Match match = matchWithoutLeague(clubId, matchId, teamId, UUID.randomUUID(), UUID.randomUUID());
        MatchSide matchSide = side(UUID.randomUUID(), matchId, teamId);
        when(matchRepository.findById(matchId)).thenReturn(Optional.of(match));
        when(matchSideRepository.findById(matchSide.getId())).thenReturn(Optional.of(matchSide));
        when(matchSidePlayerRepository.findByMatchSideIdOrderByBattingOrderAsc(matchSide.getId()))
                .thenReturn(rows(matchSide.getId(), 12));

        AddMatchSidePlayerRequest request = new AddMatchSidePlayerRequest(UUID.randomUUID(), PlayingRole.BATSMAN);

        assertThatThrownBy(() -> service.addPlayer(authentication, clubId, matchId, matchSide.getId(), request))
                .isInstanceOf(PlayingXiCapExceededException.class)
                .hasMessageContaining("Team is full: 12");
        verify(matchSidePlayerRepository, never()).save(any());
    }

    @Test
    void addPlayerTakesTheLockBeforeTheRulesAndPropagatesTheRulesRejection() {
        UUID clubId = UUID.randomUUID();
        UUID matchId = UUID.randomUUID();
        UUID teamId = UUID.randomUUID();
        UUID playerId = UUID.randomUUID();
        Match match = matchWithoutLeague(clubId, matchId, teamId, UUID.randomUUID(), UUID.randomUUID());
        MatchSide matchSide = side(UUID.randomUUID(), matchId, teamId);
        when(matchRepository.findById(matchId)).thenReturn(Optional.of(match));
        when(matchSideRepository.findById(matchSide.getId())).thenReturn(Optional.of(matchSide));
        doThrow(new PlayerTakenForSlotException("taken")).when(selectionRules)
                .requireSelectable(match, teamId, playerId);

        AddMatchSidePlayerRequest request = new AddMatchSidePlayerRequest(playerId, PlayingRole.BATSMAN);
        assertThatThrownBy(() -> service.addPlayer(authentication, clubId, matchId, matchSide.getId(), request))
                .isInstanceOf(PlayerTakenForSlotException.class);

        org.mockito.InOrder order = org.mockito.Mockito.inOrder(selectionRules);
        order.verify(selectionRules).lockPlayers(Set.of(playerId));
        order.verify(selectionRules).requireSelectable(match, teamId, playerId);
        verify(matchSidePlayerRepository, never()).save(any());
    }

    @Test
    void addPlayerOutsideThePoolPropagatesPlayerNotInSquadException() {
        UUID clubId = UUID.randomUUID();
        UUID matchId = UUID.randomUUID();
        UUID teamId = UUID.randomUUID();
        UUID playerId = UUID.randomUUID();
        Match match = matchWithoutLeague(clubId, matchId, teamId, UUID.randomUUID(), UUID.randomUUID());
        MatchSide matchSide = side(UUID.randomUUID(), matchId, teamId);
        when(matchRepository.findById(matchId)).thenReturn(Optional.of(match));
        when(matchSideRepository.findById(matchSide.getId())).thenReturn(Optional.of(matchSide));
        doThrow(new PlayerNotInSquadException("not in pool")).when(selectionRules)
                .requireSelectable(match, teamId, playerId);

        assertThatThrownBy(() -> service.addPlayer(authentication, clubId, matchId, matchSide.getId(),
                new AddMatchSidePlayerRequest(playerId, PlayingRole.BATSMAN)))
                .isInstanceOf(PlayerNotInSquadException.class);
    }

    @Test
    void addPlayerGetsTheNextBattingPositionWhilePlacesRemain() {
        UUID clubId = UUID.randomUUID();
        UUID matchId = UUID.randomUUID();
        UUID teamId = UUID.randomUUID();
        UUID playerId = UUID.randomUUID();
        Match match = matchWithoutLeague(clubId, matchId, teamId, UUID.randomUUID(), UUID.randomUUID());
        MatchSide matchSide = side(UUID.randomUUID(), matchId, teamId);
        when(matchRepository.findById(matchId)).thenReturn(Optional.of(match));
        when(matchSideRepository.findById(matchSide.getId())).thenReturn(Optional.of(matchSide));
        when(matchSidePlayerRepository.findByMatchSideIdOrderByBattingOrderAsc(matchSide.getId()))
                .thenReturn(rows(matchSide.getId(), 3));
        when(matchSidePlayerRepository.save(any(MatchSidePlayer.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        service.addPlayer(authentication, clubId, matchId, matchSide.getId(),
                new AddMatchSidePlayerRequest(playerId, PlayingRole.BOWLER));

        org.mockito.ArgumentCaptor<MatchSidePlayer> saved = org.mockito.ArgumentCaptor.forClass(MatchSidePlayer.class);
        verify(matchSidePlayerRepository).save(saved.capture());
        assertThat(saved.getValue().getBattingOrder()).isEqualTo(4);
        assertThat(saved.getValue().getRole()).isEqualTo(PlayingRole.BOWLER);
    }

    @Test
    void addPlayerWhenAllBattingPlacesAreUsedLeavesThePlayerWithoutAPosition() {
        UUID clubId = UUID.randomUUID();
        UUID matchId = UUID.randomUUID();
        UUID teamId = UUID.randomUUID();
        Match match = matchWithoutLeague(clubId, matchId, teamId, UUID.randomUUID(), UUID.randomUUID());
        MatchSide matchSide = side(UUID.randomUUID(), matchId, teamId);
        when(matchRepository.findById(matchId)).thenReturn(Optional.of(match));
        when(matchSideRepository.findById(matchSide.getId())).thenReturn(Optional.of(matchSide));
        when(matchSidePlayerRepository.findByMatchSideIdOrderByBattingOrderAsc(matchSide.getId()))
                .thenReturn(rows(matchSide.getId(), 11));
        when(matchSidePlayerRepository.save(any(MatchSidePlayer.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        service.addPlayer(authentication, clubId, matchId, matchSide.getId(),
                new AddMatchSidePlayerRequest(UUID.randomUUID(), PlayingRole.BATSMAN));

        org.mockito.ArgumentCaptor<MatchSidePlayer> saved = org.mockito.ArgumentCaptor.forClass(MatchSidePlayer.class);
        verify(matchSidePlayerRepository).save(saved.capture());
        assertThat(saved.getValue().getBattingOrder()).isNull();
    }

    // --- updateSide: captain/keeper/twelfth man ---

    private MatchSide stubSide(UUID clubId, UUID matchId, UUID teamId, List<MatchSidePlayer> currentRows) {
        Match match = matchWithoutLeague(clubId, matchId, teamId, UUID.randomUUID(), UUID.randomUUID());
        MatchSide matchSide = side(UUID.randomUUID(), matchId, teamId);
        when(matchRepository.findById(matchId)).thenReturn(Optional.of(match));
        when(matchSideRepository.findById(matchSide.getId())).thenReturn(Optional.of(matchSide));
        org.mockito.Mockito.lenient().when(matchSidePlayerRepository
                .findByMatchSideIdOrderByBattingOrderAsc(matchSide.getId())).thenReturn(currentRows);
        return matchSide;
    }

    @Test
    void updateSideWithCaptainNotSelectedThrowsValidationException() {
        UUID clubId = UUID.randomUUID();
        UUID matchId = UUID.randomUUID();
        MatchSide matchSide = stubSide(clubId, matchId, UUID.randomUUID(), List.of());

        UpdateMatchSideRequest request = new UpdateMatchSideRequest(UUID.randomUUID(), null, null);

        assertThatThrownBy(() -> service.updateSide(authentication, clubId, matchId, matchSide.getId(), request))
                .isInstanceOf(ValidationException.class);
        verify(matchSideRepository, never()).save(any());
    }

    @Test
    void updateSideWithTheSamePlayerAsTwelfthManAndCaptainThrowsValidationException() {
        UUID clubId = UUID.randomUUID();
        UUID matchId = UUID.randomUUID();
        UUID playerId = UUID.randomUUID();
        MatchSide matchSide = stubSide(clubId, matchId, UUID.randomUUID(), List.of());

        UpdateMatchSideRequest request = new UpdateMatchSideRequest(playerId, null, playerId);

        assertThatThrownBy(() -> service.updateSide(authentication, clubId, matchId, matchSide.getId(), request))
                .isInstanceOf(ValidationException.class);
        verify(matchSideRepository, never()).save(any());
    }

    @Test
    void updateSideWithATwelfthManWhereTheLimitsHaveNoneThrowsTwelfthManNotAllowedException() {
        UUID clubId = UUID.randomUUID();
        UUID matchId = UUID.randomUUID();
        MatchSide matchSide = stubSide(clubId, matchId, UUID.randomUUID(), List.of());
        when(selectionRules.limits(any())).thenReturn(new SelectionLimitsDto(11, false, 11));

        UpdateMatchSideRequest request = new UpdateMatchSideRequest(null, null, UUID.randomUUID());

        assertThatThrownBy(() -> service.updateSide(authentication, clubId, matchId, matchSide.getId(), request))
                .isInstanceOf(TwelfthManNotAllowedException.class);
        verify(matchSideRepository, never()).save(any());
    }

    @Test
    void updateSideWithANotYetSelectedTwelfthManAddsHimThroughTheLockAndTheRules() {
        UUID clubId = UUID.randomUUID();
        UUID matchId = UUID.randomUUID();
        UUID teamId = UUID.randomUUID();
        UUID twelfthManId = UUID.randomUUID();
        MatchSide matchSide = stubSide(clubId, matchId, teamId, List.of());
        when(matchSideRepository.save(matchSide)).thenReturn(matchSide);
        when(matchSidePlayerRepository.save(any(MatchSidePlayer.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        service.updateSide(authentication, clubId, matchId, matchSide.getId(),
                new UpdateMatchSideRequest(null, null, twelfthManId));

        verify(selectionRules).lockPlayers(Set.of(twelfthManId));
        verify(selectionRules).requireSelectable(any(Match.class), org.mockito.ArgumentMatchers.eq(teamId),
                org.mockito.ArgumentMatchers.eq(twelfthManId));
        org.mockito.ArgumentCaptor<MatchSidePlayer> saved = org.mockito.ArgumentCaptor.forClass(MatchSidePlayer.class);
        verify(matchSidePlayerRepository).save(saved.capture());
        assertThat(saved.getValue().getPlayerProfileId()).isEqualTo(twelfthManId);
        assertThat(saved.getValue().getBattingOrder()).isNull();
        assertThat(matchSide.getTwelfthManPlayerId()).isEqualTo(twelfthManId);
    }

    @Test
    void updateSideWithANotYetSelectedTwelfthManOnAFullSideThrowsPlayingXiCapExceededException() {
        UUID clubId = UUID.randomUUID();
        UUID matchId = UUID.randomUUID();
        UUID teamId = UUID.randomUUID();
        UUID sideId = UUID.randomUUID();
        MatchSide matchSide = stubSide(clubId, matchId, teamId, rows(sideId, 12));

        assertThatThrownBy(() -> service.updateSide(authentication, clubId, matchId, matchSide.getId(),
                new UpdateMatchSideRequest(null, null, UUID.randomUUID())))
                .isInstanceOf(PlayingXiCapExceededException.class);
        verify(matchSideRepository, never()).save(any());
    }

    @Test
    void updateSideDesignatingASelectedPlayerAsTwelfthManRemovesHisPositionAndCompactsTheRest() {
        UUID clubId = UUID.randomUUID();
        UUID matchId = UUID.randomUUID();
        UUID sideId = UUID.randomUUID();
        List<MatchSidePlayer> current = rows(sideId, 3);
        UUID twelfthManId = current.get(1).getPlayerProfileId();
        MatchSide matchSide = stubSide(clubId, matchId, UUID.randomUUID(), current);
        when(matchSideRepository.save(matchSide)).thenReturn(matchSide);

        service.updateSide(authentication, clubId, matchId, matchSide.getId(),
                new UpdateMatchSideRequest(null, null, twelfthManId));

        assertThat(current.get(0).getBattingOrder()).isEqualTo(1);
        assertThat(current.get(1).getBattingOrder()).isNull();
        assertThat(current.get(2).getBattingOrder()).isEqualTo(2);
        assertThat(matchSide.getTwelfthManPlayerId()).isEqualTo(twelfthManId);
        verify(selectionRules, never()).requireSelectable(any(), any(), any());
    }

    @Test
    void updateSideWithValidCaptainKeeperAndTwelfthManSucceeds() {
        UUID clubId = UUID.randomUUID();
        UUID matchId = UUID.randomUUID();
        UUID sideId = UUID.randomUUID();
        List<MatchSidePlayer> current = rows(sideId, 3);
        UUID captainId = current.get(0).getPlayerProfileId();
        UUID keeperId = current.get(1).getPlayerProfileId();
        UUID twelfthManId = current.get(2).getPlayerProfileId();
        MatchSide matchSide = stubSide(clubId, matchId, UUID.randomUUID(), current);
        when(matchSideRepository.save(matchSide)).thenReturn(matchSide);

        service.updateSide(authentication, clubId, matchId, matchSide.getId(),
                new UpdateMatchSideRequest(captainId, keeperId, twelfthManId));

        assertThat(matchSide.getCaptainPlayerId()).isEqualTo(captainId);
        assertThat(matchSide.getWicketKeeperPlayerId()).isEqualTo(keeperId);
        assertThat(matchSide.getTwelfthManPlayerId()).isEqualTo(twelfthManId);
    }

    // --- removePlayer ---

    @Test
    void removePlayerClearsCaptainAndKeeperWhenTheyPointedAtTheRemovedPlayer() {
        UUID clubId = UUID.randomUUID();
        UUID matchId = UUID.randomUUID();
        UUID teamId = UUID.randomUUID();
        UUID playerId = UUID.randomUUID();
        Match match = matchWithoutLeague(clubId, matchId, teamId, UUID.randomUUID(), UUID.randomUUID());
        MatchSide matchSide = side(UUID.randomUUID(), matchId, teamId);
        matchSide.setCaptainPlayerId(playerId);
        matchSide.setWicketKeeperPlayerId(playerId);
        when(matchRepository.findById(matchId)).thenReturn(Optional.of(match));
        when(matchSideRepository.findById(matchSide.getId())).thenReturn(Optional.of(matchSide));
        when(matchSidePlayerRepository.findByMatchSideIdAndPlayerProfileId(matchSide.getId(), playerId))
                .thenReturn(Optional.of(MatchSidePlayer.builder().id(UUID.randomUUID())
                        .matchSideId(matchSide.getId()).playerProfileId(playerId).battingOrder(1)
                        .role(PlayingRole.BATSMAN).build()));
        when(matchSideRepository.save(matchSide)).thenReturn(matchSide);
        when(matchSidePlayerRepository.findByMatchSideIdOrderByBattingOrderAsc(matchSide.getId()))
                .thenReturn(List.of());

        service.removePlayer(authentication, clubId, matchId, matchSide.getId(), playerId, false);

        assertThat(matchSide.getCaptainPlayerId()).isNull();
        assertThat(matchSide.getWicketKeeperPlayerId()).isNull();
        verify(matchSidePlayerRepository).deleteByMatchSideIdAndPlayerProfileId(matchSide.getId(), playerId);
    }

    @Test
    void removeAPlayerNotOnTheSideThrowsNotFoundException() {
        UUID clubId = UUID.randomUUID();
        UUID matchId = UUID.randomUUID();
        UUID teamId = UUID.randomUUID();
        UUID playerId = UUID.randomUUID();
        Match match = matchWithoutLeague(clubId, matchId, teamId, UUID.randomUUID(), UUID.randomUUID());
        MatchSide matchSide = side(UUID.randomUUID(), matchId, teamId);
        when(matchRepository.findById(matchId)).thenReturn(Optional.of(match));
        when(matchSideRepository.findById(matchSide.getId())).thenReturn(Optional.of(matchSide));
        when(matchSidePlayerRepository.findByMatchSideIdAndPlayerProfileId(matchSide.getId(), playerId))
                .thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.removePlayer(authentication, clubId, matchId, matchSide.getId(), playerId, false))
                .isInstanceOf(NotFoundException.class);
        verify(matchSidePlayerRepository, never()).deleteByMatchSideIdAndPlayerProfileId(any(), any());
    }

    // --- reorderPlayers ---

    @Test
    void removePlayerCompactsTheRemainingBattingPositionsAndClearsTheTwelfthMan() {
        UUID clubId = UUID.randomUUID();
        UUID matchId = UUID.randomUUID();
        UUID sideId = UUID.randomUUID();
        List<MatchSidePlayer> current = rows(sideId, 3);
        UUID removedId = current.get(1).getPlayerProfileId();
        MatchSide matchSide = stubSide(clubId, matchId, UUID.randomUUID(), current);
        matchSide.setTwelfthManPlayerId(removedId);
        when(matchSidePlayerRepository.findByMatchSideIdAndPlayerProfileId(
                matchSide.getId(), removedId)).thenReturn(Optional.of(current.get(1)));
        when(matchSideRepository.save(matchSide)).thenReturn(matchSide);
        // the delete drops the row from what the next read returns
        org.mockito.Mockito.doAnswer(invocation -> {
            current.remove(1);
            return null;
        }).when(matchSidePlayerRepository).deleteByMatchSideIdAndPlayerProfileId(any(), any());

        service.removePlayer(authentication, clubId, matchId, matchSide.getId(),
                removedId, false);

        assertThat(current).extracting(MatchSidePlayer::getBattingOrder).containsExactly(1, 2);
        assertThat(matchSide.getTwelfthManPlayerId()).isNull();
    }

    @Test
    void reorderWithAPlayerWhoIsNotSelectedThrowsValidationException() {
        UUID clubId = UUID.randomUUID();
        UUID matchId = UUID.randomUUID();
        UUID teamId = UUID.randomUUID();
        UUID sideId = UUID.randomUUID();
        MatchSide matchSide = stubSide(clubId, matchId, teamId, List.of(row(sideId, UUID.randomUUID(), 1)));

        assertThatThrownBy(() -> service.reorderPlayers(authentication, clubId, matchId, matchSide.getId(),
                new com.cricketlegend.dto.ReorderMatchSidePlayersRequest(List.of(UUID.randomUUID()))))
                .isInstanceOf(ValidationException.class);
    }

    @Test
    void reorderWithDuplicatesOrMoreThanTheBattingPlacesThrowsValidationException() {
        UUID clubId = UUID.randomUUID();
        UUID matchId = UUID.randomUUID();
        UUID sideId = UUID.randomUUID();
        List<MatchSidePlayer> current = rows(sideId, 12);
        MatchSide matchSide = stubSide(clubId, matchId, UUID.randomUUID(), current);
        UUID first = current.get(0).getPlayerProfileId();

        assertThatThrownBy(() -> service.reorderPlayers(authentication, clubId, matchId, matchSide.getId(),
                new com.cricketlegend.dto.ReorderMatchSidePlayersRequest(List.of(first, first))))
                .isInstanceOf(ValidationException.class);
        assertThatThrownBy(() -> service.reorderPlayers(authentication, clubId, matchId, matchSide.getId(),
                new com.cricketlegend.dto.ReorderMatchSidePlayersRequest(
                        current.stream().map(MatchSidePlayer::getPlayerProfileId).toList())))
                .isInstanceOf(ValidationException.class);
    }

    @Test
    void reorderWithTheExactCurrentPlayerSetReassignsBattingOrder() {
        UUID clubId = UUID.randomUUID();
        UUID matchId = UUID.randomUUID();
        UUID sideId = UUID.randomUUID();
        List<MatchSidePlayer> current = rows(sideId, 2);
        MatchSide matchSide = stubSide(clubId, matchId, UUID.randomUUID(), current);

        service.reorderPlayers(authentication, clubId, matchId, matchSide.getId(),
                new com.cricketlegend.dto.ReorderMatchSidePlayersRequest(
                        List.of(current.get(1).getPlayerProfileId(), current.get(0).getPlayerProfileId())));

        assertThat(current.get(1).getBattingOrder()).isEqualTo(1);
        assertThat(current.get(0).getBattingOrder()).isEqualTo(2);
    }

    @Test
    void reorderWithAWaitingPlayerGivesHimAPositionAndDropsTheOthersNotListed() {
        UUID clubId = UUID.randomUUID();
        UUID matchId = UUID.randomUUID();
        UUID sideId = UUID.randomUUID();
        List<MatchSidePlayer> current = new java.util.ArrayList<>(rows(sideId, 2));
        MatchSidePlayer waiting = row(sideId, UUID.randomUUID(), null);
        current.add(waiting);
        MatchSide matchSide = stubSide(clubId, matchId, UUID.randomUUID(), current);

        service.reorderPlayers(authentication, clubId, matchId, matchSide.getId(),
                new com.cricketlegend.dto.ReorderMatchSidePlayersRequest(
                        List.of(waiting.getPlayerProfileId(), current.get(0).getPlayerProfileId())));

        assertThat(waiting.getBattingOrder()).isEqualTo(1);
        assertThat(current.get(0).getBattingOrder()).isEqualTo(2);
        assertThat(current.get(1).getBattingOrder()).isNull();
    }

    @Test
    void reorderWithTheTwelfthManListedUndesignatesHim() {
        UUID clubId = UUID.randomUUID();
        UUID matchId = UUID.randomUUID();
        UUID sideId = UUID.randomUUID();
        List<MatchSidePlayer> current = new java.util.ArrayList<>(rows(sideId, 2));
        MatchSidePlayer twelfth = row(sideId, UUID.randomUUID(), null);
        current.add(twelfth);
        MatchSide matchSide = stubSide(clubId, matchId, UUID.randomUUID(), current);
        matchSide.setTwelfthManPlayerId(twelfth.getPlayerProfileId());
        when(matchSideRepository.save(matchSide)).thenReturn(matchSide);

        service.reorderPlayers(authentication, clubId, matchId, matchSide.getId(),
                new com.cricketlegend.dto.ReorderMatchSidePlayersRequest(List.of(
                        current.get(0).getPlayerProfileId(), current.get(1).getPlayerProfileId(),
                        twelfth.getPlayerProfileId())));

        assertThat(twelfth.getBattingOrder()).isEqualTo(3);
        assertThat(matchSide.getTwelfthManPlayerId()).isNull();
    }

    // --- 040 / 076: announce/unannounce ---

    private MatchSide stubAnnounceSide(UUID clubId, UUID matchId, List<MatchSidePlayer> currentRows) {
        MatchSide matchSide = stubSide(clubId, matchId, UUID.randomUUID(), currentRows);
        org.mockito.Mockito.lenient().when(selectionRules.team(matchSide.getTeamId()))
                .thenReturn(Team.builder().id(matchSide.getTeamId()).name("Villagers 1").build());
        org.mockito.Mockito.lenient().when(matchSideRepository.save(matchSide)).thenReturn(matchSide);
        return matchSide;
    }

    @Test
    void announceASideWithEveryPlayerPositionedSetsAnnouncedTrue() {
        UUID clubId = UUID.randomUUID();
        UUID matchId = UUID.randomUUID();
        MatchSide matchSide = stubAnnounceSide(clubId, matchId, rows(UUID.randomUUID(), 11));

        service.announce(authentication, clubId, matchId, matchSide.getId());

        assertThat(matchSide.isAnnounced()).isTrue();
        verify(matchSideRepository).save(matchSide);
    }

    @Test
    void announceIgnoresTheTwelfthManHavingNoPositionAndDoesNotRequireACaptain() {
        UUID clubId = UUID.randomUUID();
        UUID matchId = UUID.randomUUID();
        List<MatchSidePlayer> current = new java.util.ArrayList<>(rows(UUID.randomUUID(), 11));
        MatchSidePlayer twelfth = row(UUID.randomUUID(), UUID.randomUUID(), null);
        current.add(twelfth);
        MatchSide matchSide = stubAnnounceSide(clubId, matchId, current);
        matchSide.setTwelfthManPlayerId(twelfth.getPlayerProfileId());

        service.announce(authentication, clubId, matchId, matchSide.getId());

        assertThat(matchSide.isAnnounced()).isTrue();
    }

    @Test
    void announceASideWithZeroPlayersThrowsValidationException() {
        UUID clubId = UUID.randomUUID();
        UUID matchId = UUID.randomUUID();
        MatchSide matchSide = stubAnnounceSide(clubId, matchId, List.of());

        assertThatThrownBy(() -> service.announce(authentication, clubId, matchId, matchSide.getId()))
                .isInstanceOf(ValidationException.class)
                .isNotInstanceOf(SelectionIncompleteException.class);
        verify(matchSideRepository, never()).save(any());
    }

    @Test
    void announceNamesThePlayersWithoutABattingPosition() {
        UUID clubId = UUID.randomUUID();
        UUID matchId = UUID.randomUUID();
        UUID sideId = UUID.randomUUID();
        List<MatchSidePlayer> current = new java.util.ArrayList<>(rows(sideId, 2));
        MatchSidePlayer waitingA = row(sideId, UUID.randomUUID(), null);
        MatchSidePlayer waitingB = row(sideId, UUID.randomUUID(), null);
        current.add(waitingA);
        current.add(waitingB);
        MatchSide matchSide = stubAnnounceSide(clubId, matchId, current);
        when(selectionRules.playerNames(any())).thenReturn(Map.of(
                waitingA.getPlayerProfileId(), "Thabo Naidoo", waitingB.getPlayerProfileId(), "Anton de Villiers"));

        assertThatThrownBy(() -> service.announce(authentication, clubId, matchId, matchSide.getId()))
                .isInstanceOf(SelectionIncompleteException.class)
                .hasMessage("Cannot announce Villagers 1: 2 players have no batting position "
                        + "(Anton de Villiers, Thabo Naidoo).");
        verify(matchSideRepository, never()).save(any());
    }

    @Test
    void announceShowsOnlyThreeNamesThenTheCountOfTheRest() {
        UUID clubId = UUID.randomUUID();
        UUID matchId = UUID.randomUUID();
        UUID sideId = UUID.randomUUID();
        List<MatchSidePlayer> current = new java.util.ArrayList<>();
        java.util.Map<UUID, String> names = new java.util.HashMap<>();
        for (int i = 0; i < 7; i++) {
            MatchSidePlayer waiting = row(sideId, UUID.randomUUID(), null);
            current.add(waiting);
            names.put(waiting.getPlayerProfileId(), "Player " + i);
        }
        MatchSide matchSide = stubAnnounceSide(clubId, matchId, current);
        when(selectionRules.playerNames(any())).thenReturn(names);

        assertThatThrownBy(() -> service.announce(authentication, clubId, matchId, matchSide.getId()))
                .isInstanceOf(SelectionIncompleteException.class)
                .hasMessage("Cannot announce Villagers 1: 7 players have no batting position "
                        + "(Player 0, Player 1, Player 2 and 4 more).");
    }

    @Test
    void announceASideWithMoreThanTheMostAllowedNamesTheLimit() {
        UUID clubId = UUID.randomUUID();
        UUID matchId = UUID.randomUUID();
        MatchSide matchSide = stubAnnounceSide(clubId, matchId, rows(UUID.randomUUID(), 13));

        assertThatThrownBy(() -> service.announce(authentication, clubId, matchId, matchSide.getId()))
                .isInstanceOf(SelectionIncompleteException.class)
                .hasMessage("Cannot announce Villagers 1: 13 players are selected; the most allowed is 12.");
    }

    @Test
    void announceASideWithMorePositionedPlayersThanPlacesNamesThePlaces() {
        UUID clubId = UUID.randomUUID();
        UUID matchId = UUID.randomUUID();
        MatchSide matchSide = stubAnnounceSide(clubId, matchId, rows(UUID.randomUUID(), 12));

        assertThatThrownBy(() -> service.announce(authentication, clubId, matchId, matchSide.getId()))
                .isInstanceOf(SelectionIncompleteException.class)
                .hasMessage("Cannot announce Villagers 1: 12 players are selected but only 11 places exist; "
                        + "choose the 12th man or remove one.");
    }

    void unannounceAnAnnouncedSideClearsTheFlagWithNoPrecondition() {
        UUID clubId = UUID.randomUUID();
        UUID matchId = UUID.randomUUID();
        UUID teamId = UUID.randomUUID();
        Match match = matchWithoutLeague(clubId, matchId, teamId, UUID.randomUUID(), UUID.randomUUID());
        MatchSide matchSide = side(UUID.randomUUID(), matchId, teamId);
        matchSide.setAnnounced(true);
        when(matchRepository.findById(matchId)).thenReturn(Optional.of(match));
        when(matchSideRepository.findById(matchSide.getId())).thenReturn(Optional.of(matchSide));
        when(matchSideRepository.save(matchSide)).thenReturn(matchSide);
        when(matchSidePlayerRepository.findByMatchSideIdOrderByBattingOrderAsc(matchSide.getId()))
                .thenReturn(List.of());

        service.unannounce(authentication, clubId, matchId, matchSide.getId());

        assertThat(matchSide.isAnnounced()).isFalse();
        verify(matchSideRepository).save(matchSide);
    }

    @Test
    void addPlayerToAPreviouslyAnnouncedSideUnannouncesIt() {
        UUID clubId = UUID.randomUUID();
        UUID matchId = UUID.randomUUID();
        MatchSide matchSide = stubSide(clubId, matchId, UUID.randomUUID(), List.of());
        matchSide.setAnnounced(true);
        when(matchSidePlayerRepository.save(any(MatchSidePlayer.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));
        when(matchSideRepository.save(matchSide)).thenReturn(matchSide);

        service.addPlayer(authentication, clubId, matchId, matchSide.getId(),
                new AddMatchSidePlayerRequest(UUID.randomUUID(), PlayingRole.BATSMAN));

        assertThat(matchSide.isAnnounced()).isFalse();
        verify(matchSideRepository).save(matchSide);
    }

    @Test
    void removePlayerWithKeepAnnouncedLeavesAnAnnouncedSideAnnounced() {
        UUID clubId = UUID.randomUUID();
        UUID matchId = UUID.randomUUID();
        UUID sideId = UUID.randomUUID();
        List<MatchSidePlayer> current = rows(sideId, 2);
        UUID removedId = current.get(0).getPlayerProfileId();
        MatchSide matchSide = stubSide(clubId, matchId, UUID.randomUUID(), current);
        matchSide.setAnnounced(true);
        when(matchSidePlayerRepository.findByMatchSideIdAndPlayerProfileId(matchSide.getId(), removedId))
                .thenReturn(Optional.of(current.get(0)));

        service.removePlayer(authentication, clubId, matchId, matchSide.getId(), removedId, true);

        assertThat(matchSide.isAnnounced()).isTrue();
    }

    @Test
    void updatePlayerRoleOnAPreviouslyAnnouncedSideUnannouncesIt() {
        UUID clubId = UUID.randomUUID();
        UUID matchId = UUID.randomUUID();
        UUID teamId = UUID.randomUUID();
        UUID playerId = UUID.randomUUID();
        Match match = matchWithoutLeague(clubId, matchId, teamId, UUID.randomUUID(), UUID.randomUUID());
        MatchSide matchSide = side(UUID.randomUUID(), matchId, teamId);
        matchSide.setAnnounced(true);
        MatchSidePlayer player = MatchSidePlayer.builder().id(UUID.randomUUID()).matchSideId(matchSide.getId())
                .playerProfileId(playerId).battingOrder(1).role(PlayingRole.BATSMAN).build();
        when(matchRepository.findById(matchId)).thenReturn(Optional.of(match));
        when(matchSideRepository.findById(matchSide.getId())).thenReturn(Optional.of(matchSide));
        when(matchSidePlayerRepository.findByMatchSideIdAndPlayerProfileId(matchSide.getId(), playerId))
                .thenReturn(Optional.of(player));
        when(matchSideRepository.save(matchSide)).thenReturn(matchSide);
        when(matchSidePlayerRepository.findByMatchSideIdOrderByBattingOrderAsc(matchSide.getId()))
                .thenReturn(List.of());

        service.updatePlayerRole(authentication, clubId, matchId, matchSide.getId(), playerId,
                new UpdateMatchSidePlayerRequest(PlayingRole.BOWLER));

        assertThat(matchSide.isAnnounced()).isFalse();
        verify(matchSideRepository).save(matchSide);
    }

    @Test
    void updatePlayerRoleOnAnAlreadyUnannouncedSideDoesNotSpuriouslyResaveTheAnnouncedFlag() {
        UUID clubId = UUID.randomUUID();
        UUID matchId = UUID.randomUUID();
        UUID teamId = UUID.randomUUID();
        UUID playerId = UUID.randomUUID();
        Match match = matchWithoutLeague(clubId, matchId, teamId, UUID.randomUUID(), UUID.randomUUID());
        MatchSide matchSide = side(UUID.randomUUID(), matchId, teamId);
        MatchSidePlayer player = MatchSidePlayer.builder().id(UUID.randomUUID()).matchSideId(matchSide.getId())
                .playerProfileId(playerId).battingOrder(1).role(PlayingRole.BATSMAN).build();
        when(matchRepository.findById(matchId)).thenReturn(Optional.of(match));
        when(matchSideRepository.findById(matchSide.getId())).thenReturn(Optional.of(matchSide));
        when(matchSidePlayerRepository.findByMatchSideIdAndPlayerProfileId(matchSide.getId(), playerId))
                .thenReturn(Optional.of(player));
        when(matchSidePlayerRepository.findByMatchSideIdOrderByBattingOrderAsc(matchSide.getId()))
                .thenReturn(List.of());

        service.updatePlayerRole(authentication, clubId, matchId, matchSide.getId(), playerId,
                new UpdateMatchSidePlayerRequest(PlayingRole.BOWLER));

        assertThat(matchSide.isAnnounced()).isFalse();
        verify(matchSideRepository, never()).save(any());
    }

    @Test
    void removePlayerOnAPreviouslyAnnouncedSideUnannouncesIt() {
        UUID clubId = UUID.randomUUID();
        UUID matchId = UUID.randomUUID();
        UUID teamId = UUID.randomUUID();
        UUID playerId = UUID.randomUUID();
        Match match = matchWithoutLeague(clubId, matchId, teamId, UUID.randomUUID(), UUID.randomUUID());
        MatchSide matchSide = side(UUID.randomUUID(), matchId, teamId);
        matchSide.setAnnounced(true);
        when(matchRepository.findById(matchId)).thenReturn(Optional.of(match));
        when(matchSideRepository.findById(matchSide.getId())).thenReturn(Optional.of(matchSide));
        when(matchSidePlayerRepository.findByMatchSideIdAndPlayerProfileId(matchSide.getId(), playerId))
                .thenReturn(Optional.of(MatchSidePlayer.builder().id(UUID.randomUUID())
                        .matchSideId(matchSide.getId()).playerProfileId(playerId).battingOrder(1)
                        .role(PlayingRole.BATSMAN).build()));
        when(matchSideRepository.save(matchSide)).thenReturn(matchSide);
        when(matchSidePlayerRepository.findByMatchSideIdOrderByBattingOrderAsc(matchSide.getId()))
                .thenReturn(List.of());

        service.removePlayer(authentication, clubId, matchId, matchSide.getId(), playerId, false);

        assertThat(matchSide.isAnnounced()).isFalse();
        verify(matchSideRepository).save(matchSide);
    }

    @Test
    void removePlayerOnAnAlreadyUnannouncedSideWithNoOtherChangesDoesNotSpuriouslyResaveTheSide() {
        UUID clubId = UUID.randomUUID();
        UUID matchId = UUID.randomUUID();
        UUID teamId = UUID.randomUUID();
        UUID playerId = UUID.randomUUID();
        Match match = matchWithoutLeague(clubId, matchId, teamId, UUID.randomUUID(), UUID.randomUUID());
        MatchSide matchSide = side(UUID.randomUUID(), matchId, teamId);
        when(matchRepository.findById(matchId)).thenReturn(Optional.of(match));
        when(matchSideRepository.findById(matchSide.getId())).thenReturn(Optional.of(matchSide));
        when(matchSidePlayerRepository.findByMatchSideIdAndPlayerProfileId(matchSide.getId(), playerId))
                .thenReturn(Optional.of(MatchSidePlayer.builder().id(UUID.randomUUID())
                        .matchSideId(matchSide.getId()).playerProfileId(playerId).battingOrder(1)
                        .role(PlayingRole.BATSMAN).build()));
        when(matchSidePlayerRepository.findByMatchSideIdOrderByBattingOrderAsc(matchSide.getId()))
                .thenReturn(List.of());

        service.removePlayer(authentication, clubId, matchId, matchSide.getId(), playerId, false);

        assertThat(matchSide.isAnnounced()).isFalse();
        verify(matchSideRepository, never()).save(any());
    }

    @Test
    void reorderPlayersOnAPreviouslyAnnouncedSideUnannouncesIt() {
        UUID clubId = UUID.randomUUID();
        UUID matchId = UUID.randomUUID();
        UUID teamId = UUID.randomUUID();
        Match match = matchWithoutLeague(clubId, matchId, teamId, UUID.randomUUID(), UUID.randomUUID());
        MatchSide matchSide = side(UUID.randomUUID(), matchId, teamId);
        matchSide.setAnnounced(true);
        UUID playerAId = UUID.randomUUID();
        UUID playerBId = UUID.randomUUID();
        MatchSidePlayer playerA = MatchSidePlayer.builder().id(UUID.randomUUID()).matchSideId(matchSide.getId())
                .playerProfileId(playerAId).battingOrder(1).role(PlayingRole.BATSMAN).build();
        MatchSidePlayer playerB = MatchSidePlayer.builder().id(UUID.randomUUID()).matchSideId(matchSide.getId())
                .playerProfileId(playerBId).battingOrder(2).role(PlayingRole.BOWLER).build();
        when(matchRepository.findById(matchId)).thenReturn(Optional.of(match));
        when(matchSideRepository.findById(matchSide.getId())).thenReturn(Optional.of(matchSide));
        when(matchSidePlayerRepository.findByMatchSideIdOrderByBattingOrderAsc(matchSide.getId()))
                .thenReturn(List.of(playerA, playerB));
        when(matchSideRepository.save(matchSide)).thenReturn(matchSide);

        service.reorderPlayers(authentication, clubId, matchId, matchSide.getId(),
                new com.cricketlegend.dto.ReorderMatchSidePlayersRequest(List.of(playerBId, playerAId)));

        assertThat(matchSide.isAnnounced()).isFalse();
        verify(matchSideRepository).save(matchSide);
    }

    @Test
    void reorderPlayersOnAnAlreadyUnannouncedSideDoesNotSpuriouslyResaveTheAnnouncedFlag() {
        UUID clubId = UUID.randomUUID();
        UUID matchId = UUID.randomUUID();
        UUID teamId = UUID.randomUUID();
        Match match = matchWithoutLeague(clubId, matchId, teamId, UUID.randomUUID(), UUID.randomUUID());
        MatchSide matchSide = side(UUID.randomUUID(), matchId, teamId);
        UUID playerAId = UUID.randomUUID();
        UUID playerBId = UUID.randomUUID();
        MatchSidePlayer playerA = MatchSidePlayer.builder().id(UUID.randomUUID()).matchSideId(matchSide.getId())
                .playerProfileId(playerAId).battingOrder(1).role(PlayingRole.BATSMAN).build();
        MatchSidePlayer playerB = MatchSidePlayer.builder().id(UUID.randomUUID()).matchSideId(matchSide.getId())
                .playerProfileId(playerBId).battingOrder(2).role(PlayingRole.BOWLER).build();
        when(matchRepository.findById(matchId)).thenReturn(Optional.of(match));
        when(matchSideRepository.findById(matchSide.getId())).thenReturn(Optional.of(matchSide));
        when(matchSidePlayerRepository.findByMatchSideIdOrderByBattingOrderAsc(matchSide.getId()))
                .thenReturn(List.of(playerA, playerB));

        service.reorderPlayers(authentication, clubId, matchId, matchSide.getId(),
                new com.cricketlegend.dto.ReorderMatchSidePlayersRequest(List.of(playerBId, playerAId)));

        assertThat(matchSide.isAnnounced()).isFalse();
        verify(matchSideRepository, never()).save(any());
    }

    // updateSide's own save() was already unconditional before 040 (029's original shape) — unlike
    // addPlayer/updatePlayerRole/removePlayer/reorderPlayers, which only gained a save() call as
    // part of 040's own guarded un-announce side effect. So there's no "spurious resave" for this
    // method to avoid; this test only proves the announced flag stays false on an already-
    // unannounced side, not anything about save() being skipped.
    @Test
    void updateSideOnAnAlreadyUnannouncedSideLeavesTheAnnouncedFlagFalse() {
        UUID clubId = UUID.randomUUID();
        UUID matchId = UUID.randomUUID();
        UUID teamId = UUID.randomUUID();
        Match match = matchWithoutLeague(clubId, matchId, teamId, UUID.randomUUID(), UUID.randomUUID());
        MatchSide matchSide = side(UUID.randomUUID(), matchId, teamId);
        when(matchRepository.findById(matchId)).thenReturn(Optional.of(match));
        when(matchSideRepository.findById(matchSide.getId())).thenReturn(Optional.of(matchSide));
        when(matchSideRepository.save(matchSide)).thenReturn(matchSide);
        when(matchSidePlayerRepository.findByMatchSideIdOrderByBattingOrderAsc(matchSide.getId()))
                .thenReturn(List.of());

        UpdateMatchSideRequest request = new UpdateMatchSideRequest(null, null, null);
        service.updateSide(authentication, clubId, matchId, matchSide.getId(), request);

        assertThat(matchSide.isAnnounced()).isFalse();
        verify(matchSideRepository).save(matchSide);
    }
    // --- 035: section-scoped access ---

    @Test
    void createSideThrowsAccessDeniedWhenCallerCannotAdministerAnyOfTheMatchsResolvedSections() {
        UUID clubId = UUID.randomUUID();
        UUID matchId = UUID.randomUUID();
        UUID homeTeamId = UUID.randomUUID();
        Match match = matchWithoutLeague(clubId, matchId, homeTeamId, UUID.randomUUID(), UUID.randomUUID());
        when(matchRepository.findById(matchId)).thenReturn(Optional.of(match));
        java.util.Set<UUID> resolvedSections = java.util.Set.of(UUID.randomUUID());
        when(accessService.resolveMatchSectionIds(clubId, match.getHomeTeamId(), match.getAwayTeamId()))
                .thenReturn(resolvedSections);
        org.mockito.Mockito.doThrow(new org.springframework.security.access.AccessDeniedException("denied"))
                .when(accessService)
                .assertCanAdministerAnySection(authentication, clubId, resolvedSections);

        assertThatThrownBy(() -> service.createSide(
                        authentication, clubId, matchId, new CreateMatchSideRequest(homeTeamId)))
                .isInstanceOf(org.springframework.security.access.AccessDeniedException.class);
        verify(matchSideRepository, never()).save(any());
    }
}
