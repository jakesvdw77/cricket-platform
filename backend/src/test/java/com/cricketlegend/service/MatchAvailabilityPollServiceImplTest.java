package com.cricketlegend.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.cricketlegend.config.AccessService;
import com.cricketlegend.domain.AvailabilityStatus;
import com.cricketlegend.domain.Match;
import com.cricketlegend.domain.MatchAvailabilityPoll;
import com.cricketlegend.domain.PlayerAvailability;
import com.cricketlegend.dto.CreateMatchAvailabilityPollRequest;
import com.cricketlegend.dto.MatchAvailabilityPollResponsesDto;
import com.cricketlegend.dto.OpenAvailabilityPollDto;
import com.cricketlegend.dto.PlayerAvailabilityRowDto;
import com.cricketlegend.exception.ConflictException;
import com.cricketlegend.exception.InvalidStatusTransitionException;
import com.cricketlegend.exception.NotFoundException;
import com.cricketlegend.exception.ValidationException;
import com.cricketlegend.mapper.MatchAvailabilityPollMapper;
import com.cricketlegend.repository.MatchAvailabilityPollRepository;
import com.cricketlegend.repository.MatchRepository;
import com.cricketlegend.repository.PlayerAvailabilityRepository;
import com.cricketlegend.service.impl.MatchAvailabilityPollServiceImpl;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;

/**
 * Unit tests for MatchAvailabilityPollServiceImpl's business rules from
 * docs/specs/032-match-availability-polls.md: {@code create} restricted to the match's own two
 * team ids (400) and rejecting a duplicate {@code (match, team)} poll (409); {@code open}/{@code
 * close} transitions and their {@code InvalidStatusTransitionException} (409) "already in that
 * state" guards; {@code getResponses} resolving the full season-scoped squad with correct counts,
 * including zero-response members. Extended per docs/specs/035-section-scoped-access.md for
 * {@code assertCanAdministerAnySection} being consulted on every existing method, and per
 * docs/specs/034-availability-polls-dashboard.md/035's amendment for {@code listOpenForClub}.
 */
@ExtendWith(MockitoExtension.class)
class MatchAvailabilityPollServiceImplTest {

    @Mock
    private MatchRepository matchRepository;

    @Mock
    private MatchAvailabilityPollRepository matchAvailabilityPollRepository;

    @Mock
    private PlayerAvailabilityRepository playerAvailabilityRepository;

    @Mock
    private AvailabilityPollSquadResolver squadResolver;

    @Mock
    private MatchAvailabilityPollMapper matchAvailabilityPollMapper;

    @Mock
    private AccessService accessService;

    private MatchAvailabilityPollServiceImpl service;
    private final Authentication authentication = new TestingAuthenticationToken(
            "club-admin-subject", null, List.of(new SimpleGrantedAuthority("ROLE_someone_else")));

    @BeforeEach
    void setUp() {
        service = new MatchAvailabilityPollServiceImpl(
                matchRepository,
                matchAvailabilityPollRepository,
                playerAvailabilityRepository,
                squadResolver,
                matchAvailabilityPollMapper,
                accessService);
    }

    private Match match(UUID clubId, UUID matchId, UUID homeTeamId, UUID awayTeamId, UUID seasonId) {
        return Match.builder()
                .id(matchId)
                .clubId(clubId)
                .homeTeamId(homeTeamId)
                .awayTeamId(awayTeamId)
                .seasonId(seasonId)
                .matchDate(Instant.now())
                .active(true)
                .build();
    }

    private MatchAvailabilityPoll poll(UUID id, UUID matchId, UUID teamId, boolean open) {
        return MatchAvailabilityPoll.builder().id(id).matchId(matchId).teamId(teamId).open(open).build();
    }

    // --- create ---

    @Test
    void createForOneOfTheMatchsOwnTeamIdsSucceeds() {
        UUID clubId = UUID.randomUUID();
        UUID matchId = UUID.randomUUID();
        UUID homeTeamId = UUID.randomUUID();
        UUID awayTeamId = UUID.randomUUID();
        UUID seasonId = UUID.randomUUID();
        Match match = match(clubId, matchId, homeTeamId, awayTeamId, seasonId);
        when(matchRepository.findById(matchId)).thenReturn(Optional.of(match));
        when(matchAvailabilityPollRepository.existsByMatchIdAndTeamId(matchId, homeTeamId)).thenReturn(false);
        when(matchAvailabilityPollRepository.save(any(MatchAvailabilityPoll.class)))
                .thenAnswer(invocation -> {
                    MatchAvailabilityPoll saved = invocation.getArgument(0);
                    saved.setId(UUID.randomUUID());
                    return saved;
                });
        when(squadResolver.resolveSquadRows(eq(homeTeamId), eq(seasonId))).thenReturn(List.of());

        service.create(authentication, clubId, matchId, new CreateMatchAvailabilityPollRequest(homeTeamId));

        ArgumentCaptor<MatchAvailabilityPoll> savedCaptor = ArgumentCaptor.forClass(MatchAvailabilityPoll.class);
        verify(matchAvailabilityPollRepository).save(savedCaptor.capture());
        MatchAvailabilityPoll saved = savedCaptor.getValue();
        assertThat(saved.getMatchId()).isEqualTo(matchId);
        assertThat(saved.getTeamId()).isEqualTo(homeTeamId);
        assertThat(saved.isOpen()).isTrue();
    }

    @Test
    void createReturns400WhenTeamIdIsNotOneOfTheMatchsOwnTeams() {
        UUID clubId = UUID.randomUUID();
        UUID matchId = UUID.randomUUID();
        UUID homeTeamId = UUID.randomUUID();
        UUID awayTeamId = UUID.randomUUID();
        UUID unrelatedTeamId = UUID.randomUUID();
        UUID seasonId = UUID.randomUUID();
        Match match = match(clubId, matchId, homeTeamId, awayTeamId, seasonId);
        when(matchRepository.findById(matchId)).thenReturn(Optional.of(match));

        assertThatThrownBy(() -> service.create(
                        authentication, clubId, matchId, new CreateMatchAvailabilityPollRequest(unrelatedTeamId)))
                .isInstanceOf(ValidationException.class);

        verify(matchAvailabilityPollRepository, never()).save(any());
    }

    @Test
    void createReturns409WhenAPollForThatTeamAlreadyExists() {
        UUID clubId = UUID.randomUUID();
        UUID matchId = UUID.randomUUID();
        UUID homeTeamId = UUID.randomUUID();
        UUID awayTeamId = UUID.randomUUID();
        UUID seasonId = UUID.randomUUID();
        Match match = match(clubId, matchId, homeTeamId, awayTeamId, seasonId);
        when(matchRepository.findById(matchId)).thenReturn(Optional.of(match));
        when(matchAvailabilityPollRepository.existsByMatchIdAndTeamId(matchId, homeTeamId)).thenReturn(true);

        assertThatThrownBy(() -> service.create(
                        authentication, clubId, matchId, new CreateMatchAvailabilityPollRequest(homeTeamId)))
                .isInstanceOf(ConflictException.class);

        verify(matchAvailabilityPollRepository, never()).save(any());
    }

    @Test
    void createReturns404WhenMatchBelongsToADifferentClub() {
        UUID matchId = UUID.randomUUID();
        Match match = match(UUID.randomUUID(), matchId, UUID.randomUUID(), UUID.randomUUID(), UUID.randomUUID());
        when(matchRepository.findById(matchId)).thenReturn(Optional.of(match));

        assertThatThrownBy(() -> service.create(
                        authentication,
                        UUID.randomUUID(),
                        matchId,
                        new CreateMatchAvailabilityPollRequest(UUID.randomUUID())))
                .isInstanceOf(NotFoundException.class);
    }

    @Test
    void createThrowsAccessDeniedWhenCallerCannotAdministerAnyOfTheMatchsResolvedSections() {
        UUID clubId = UUID.randomUUID();
        UUID matchId = UUID.randomUUID();
        UUID homeTeamId = UUID.randomUUID();
        UUID awayTeamId = UUID.randomUUID();
        UUID seasonId = UUID.randomUUID();
        Match match = match(clubId, matchId, homeTeamId, awayTeamId, seasonId);
        when(matchRepository.findById(matchId)).thenReturn(Optional.of(match));
        Set<UUID> resolvedSections = Set.of(UUID.randomUUID());
        when(accessService.resolveMatchSectionIds(clubId, homeTeamId, awayTeamId)).thenReturn(resolvedSections);
        org.mockito.Mockito.doThrow(new org.springframework.security.access.AccessDeniedException("denied"))
                .when(accessService)
                .assertCanAdministerAnySection(authentication, clubId, resolvedSections);

        assertThatThrownBy(() -> service.create(
                        authentication, clubId, matchId, new CreateMatchAvailabilityPollRequest(homeTeamId)))
                .isInstanceOf(org.springframework.security.access.AccessDeniedException.class);
        verify(matchAvailabilityPollRepository, never()).save(any());
    }

    // --- open/close ---

    @Test
    void openTransitionsAClosedPollToOpen() {
        UUID clubId = UUID.randomUUID();
        UUID matchId = UUID.randomUUID();
        UUID teamId = UUID.randomUUID();
        UUID pollId = UUID.randomUUID();
        UUID seasonId = UUID.randomUUID();
        Match match = match(clubId, matchId, teamId, UUID.randomUUID(), seasonId);
        MatchAvailabilityPoll closedPoll = poll(pollId, matchId, teamId, false);
        when(matchRepository.findById(matchId)).thenReturn(Optional.of(match));
        when(matchAvailabilityPollRepository.findById(pollId)).thenReturn(Optional.of(closedPoll));
        when(matchAvailabilityPollRepository.save(any(MatchAvailabilityPoll.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));
        when(squadResolver.resolveSquadRows(eq(teamId), eq(seasonId))).thenReturn(List.of());

        service.open(authentication, clubId, matchId, pollId);

        assertThat(closedPoll.isOpen()).isTrue();
    }

    @Test
    void openReturns409WhenPollIsAlreadyOpen() {
        UUID clubId = UUID.randomUUID();
        UUID matchId = UUID.randomUUID();
        UUID teamId = UUID.randomUUID();
        UUID pollId = UUID.randomUUID();
        Match match = match(clubId, matchId, teamId, UUID.randomUUID(), UUID.randomUUID());
        MatchAvailabilityPoll openPoll = poll(pollId, matchId, teamId, true);
        when(matchRepository.findById(matchId)).thenReturn(Optional.of(match));
        when(matchAvailabilityPollRepository.findById(pollId)).thenReturn(Optional.of(openPoll));

        assertThatThrownBy(() -> service.open(authentication, clubId, matchId, pollId))
                .isInstanceOf(InvalidStatusTransitionException.class);

        verify(matchAvailabilityPollRepository, never()).save(any());
    }

    @Test
    void closeTransitionsAnOpenPollToClosed() {
        UUID clubId = UUID.randomUUID();
        UUID matchId = UUID.randomUUID();
        UUID teamId = UUID.randomUUID();
        UUID pollId = UUID.randomUUID();
        UUID seasonId = UUID.randomUUID();
        Match match = match(clubId, matchId, teamId, UUID.randomUUID(), seasonId);
        MatchAvailabilityPoll openPoll = poll(pollId, matchId, teamId, true);
        when(matchRepository.findById(matchId)).thenReturn(Optional.of(match));
        when(matchAvailabilityPollRepository.findById(pollId)).thenReturn(Optional.of(openPoll));
        when(matchAvailabilityPollRepository.save(any(MatchAvailabilityPoll.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));
        when(squadResolver.resolveSquadRows(eq(teamId), eq(seasonId))).thenReturn(List.of());

        service.close(authentication, clubId, matchId, pollId);

        assertThat(openPoll.isOpen()).isFalse();
    }

    @Test
    void closeReturns409WhenPollIsAlreadyClosed() {
        UUID clubId = UUID.randomUUID();
        UUID matchId = UUID.randomUUID();
        UUID teamId = UUID.randomUUID();
        UUID pollId = UUID.randomUUID();
        Match match = match(clubId, matchId, teamId, UUID.randomUUID(), UUID.randomUUID());
        MatchAvailabilityPoll closedPoll = poll(pollId, matchId, teamId, false);
        when(matchRepository.findById(matchId)).thenReturn(Optional.of(match));
        when(matchAvailabilityPollRepository.findById(pollId)).thenReturn(Optional.of(closedPoll));

        assertThatThrownBy(() -> service.close(authentication, clubId, matchId, pollId))
                .isInstanceOf(InvalidStatusTransitionException.class);

        verify(matchAvailabilityPollRepository, never()).save(any());
    }

    @Test
    void openReturns404WhenPollBelongsToADifferentMatch() {
        UUID clubId = UUID.randomUUID();
        UUID matchId = UUID.randomUUID();
        UUID otherMatchId = UUID.randomUUID();
        UUID pollId = UUID.randomUUID();
        Match match = match(clubId, matchId, UUID.randomUUID(), UUID.randomUUID(), UUID.randomUUID());
        MatchAvailabilityPoll pollOnOtherMatch = poll(pollId, otherMatchId, UUID.randomUUID(), true);
        when(matchRepository.findById(matchId)).thenReturn(Optional.of(match));
        when(matchAvailabilityPollRepository.findById(pollId)).thenReturn(Optional.of(pollOnOtherMatch));

        assertThatThrownBy(() -> service.open(authentication, clubId, matchId, pollId))
                .isInstanceOf(NotFoundException.class);
    }

    // --- getResponses ---

    @Test
    void getResponsesResolvesTheFullSeasonScopedSquadWithCorrectCountsIncludingZeroResponseMembers() {
        UUID clubId = UUID.randomUUID();
        UUID matchId = UUID.randomUUID();
        UUID teamId = UUID.randomUUID();
        UUID pollId = UUID.randomUUID();
        UUID seasonId = UUID.randomUUID();
        UUID playerA = UUID.randomUUID();
        UUID playerB = UUID.randomUUID();
        UUID playerC = UUID.randomUUID();
        Match match = match(clubId, matchId, teamId, UUID.randomUUID(), seasonId);
        MatchAvailabilityPoll openPoll = poll(pollId, matchId, teamId, true);
        when(matchRepository.findById(matchId)).thenReturn(Optional.of(match));
        when(matchAvailabilityPollRepository.findById(pollId)).thenReturn(Optional.of(openPoll));
        when(squadResolver.resolveSquadRows(teamId, seasonId)).thenReturn(List.of(
                new PlayerAvailabilityRowDto(playerA, "Alice", "A", 1, null),
                new PlayerAvailabilityRowDto(playerB, "Bob", "B", 2, null),
                new PlayerAvailabilityRowDto(playerC, "Cara", "C", null, null)));
        when(playerAvailabilityRepository.findByPollId(pollId)).thenReturn(List.of(
                PlayerAvailability.builder().pollId(pollId).playerProfileId(playerA)
                        .status(AvailabilityStatus.AVAILABLE).build(),
                PlayerAvailability.builder().pollId(pollId).playerProfileId(playerB)
                        .status(AvailabilityStatus.UNAVAILABLE).build()));

        MatchAvailabilityPollResponsesDto responses = service.getResponses(authentication, clubId, matchId, pollId);

        assertThat(responses.pollId()).isEqualTo(pollId);
        assertThat(responses.teamId()).isEqualTo(teamId);
        assertThat(responses.open()).isTrue();
        assertThat(responses.availableCount()).isEqualTo(1);
        assertThat(responses.unavailableCount()).isEqualTo(1);
        assertThat(responses.unsureCount()).isEqualTo(0);
        assertThat(responses.noResponseCount()).isEqualTo(1);
        assertThat(responses.publicPath()).isEqualTo("/poll/" + pollId);
        assertThat(responses.responses()).hasSize(3);
        assertThat(responses.responses())
                .filteredOn(row -> row.playerProfileId().equals(playerC))
                .singleElement()
                .satisfies(row -> assertThat(row.status()).isNull());
    }

    // --- setPlayerStatus (admin override) ---

    @Test
    void setPlayerStatusInsertsANewResponseWhenNoneExistsYet() {
        UUID clubId = UUID.randomUUID();
        UUID matchId = UUID.randomUUID();
        UUID teamId = UUID.randomUUID();
        UUID pollId = UUID.randomUUID();
        UUID seasonId = UUID.randomUUID();
        UUID playerId = UUID.randomUUID();
        Match match = match(clubId, matchId, teamId, UUID.randomUUID(), seasonId);
        MatchAvailabilityPoll openPoll = poll(pollId, matchId, teamId, true);
        when(matchRepository.findById(matchId)).thenReturn(Optional.of(match));
        when(matchAvailabilityPollRepository.findById(pollId)).thenReturn(Optional.of(openPoll));
        when(squadResolver.resolveSquadRows(teamId, seasonId))
                .thenReturn(List.of(new PlayerAvailabilityRowDto(playerId, "Jane", "Smith", null, null)));
        when(playerAvailabilityRepository.findByPollIdAndPlayerProfileId(pollId, playerId))
                .thenReturn(Optional.empty());
        when(playerAvailabilityRepository.findByPollId(pollId)).thenReturn(List.of());

        MatchAvailabilityPollResponsesDto result = service.setPlayerStatus(
                authentication, clubId, matchId, pollId, playerId, AvailabilityStatus.UNAVAILABLE);

        ArgumentCaptor<PlayerAvailability> captor = ArgumentCaptor.forClass(PlayerAvailability.class);
        verify(playerAvailabilityRepository).save(captor.capture());
        assertThat(captor.getValue().getPollId()).isEqualTo(pollId);
        assertThat(captor.getValue().getPlayerProfileId()).isEqualTo(playerId);
        assertThat(captor.getValue().getStatus()).isEqualTo(AvailabilityStatus.UNAVAILABLE);
        assertThat(result.pollId()).isEqualTo(pollId);
    }

    @Test
    void setPlayerStatusUpdatesInPlaceForARepeatCall() {
        UUID clubId = UUID.randomUUID();
        UUID matchId = UUID.randomUUID();
        UUID teamId = UUID.randomUUID();
        UUID pollId = UUID.randomUUID();
        UUID seasonId = UUID.randomUUID();
        UUID playerId = UUID.randomUUID();
        Match match = match(clubId, matchId, teamId, UUID.randomUUID(), seasonId);
        MatchAvailabilityPoll openPoll = poll(pollId, matchId, teamId, true);
        PlayerAvailability existing = PlayerAvailability.builder()
                .pollId(pollId).playerProfileId(playerId).status(AvailabilityStatus.UNSURE).build();
        when(matchRepository.findById(matchId)).thenReturn(Optional.of(match));
        when(matchAvailabilityPollRepository.findById(pollId)).thenReturn(Optional.of(openPoll));
        when(squadResolver.resolveSquadRows(teamId, seasonId))
                .thenReturn(List.of(new PlayerAvailabilityRowDto(playerId, "Jane", "Smith", null, null)));
        when(playerAvailabilityRepository.findByPollIdAndPlayerProfileId(pollId, playerId))
                .thenReturn(Optional.of(existing));
        when(playerAvailabilityRepository.findByPollId(pollId)).thenReturn(List.of());

        service.setPlayerStatus(authentication, clubId, matchId, pollId, playerId, AvailabilityStatus.AVAILABLE);

        verify(playerAvailabilityRepository).save(existing);
        assertThat(existing.getStatus()).isEqualTo(AvailabilityStatus.AVAILABLE);
    }

    @Test
    void setPlayerStatusRejectsAPlayerNotInThePollsOwnSquad() {
        UUID clubId = UUID.randomUUID();
        UUID matchId = UUID.randomUUID();
        UUID teamId = UUID.randomUUID();
        UUID pollId = UUID.randomUUID();
        UUID seasonId = UUID.randomUUID();
        UUID playerId = UUID.randomUUID();
        Match match = match(clubId, matchId, teamId, UUID.randomUUID(), seasonId);
        MatchAvailabilityPoll openPoll = poll(pollId, matchId, teamId, true);
        when(matchRepository.findById(matchId)).thenReturn(Optional.of(match));
        when(matchAvailabilityPollRepository.findById(pollId)).thenReturn(Optional.of(openPoll));
        when(squadResolver.resolveSquadRows(teamId, seasonId)).thenReturn(List.of());

        assertThatThrownBy(() -> service.setPlayerStatus(
                        authentication, clubId, matchId, pollId, playerId, AvailabilityStatus.AVAILABLE))
                .isInstanceOf(NotFoundException.class);
        verify(playerAvailabilityRepository, never()).save(any());
    }

    @Test
    void setPlayerStatusRejectsAWriteAgainstAClosedPoll() {
        UUID clubId = UUID.randomUUID();
        UUID matchId = UUID.randomUUID();
        UUID teamId = UUID.randomUUID();
        UUID pollId = UUID.randomUUID();
        UUID seasonId = UUID.randomUUID();
        UUID playerId = UUID.randomUUID();
        Match match = match(clubId, matchId, teamId, UUID.randomUUID(), seasonId);
        MatchAvailabilityPoll closedPoll = poll(pollId, matchId, teamId, false);
        when(matchRepository.findById(matchId)).thenReturn(Optional.of(match));
        when(matchAvailabilityPollRepository.findById(pollId)).thenReturn(Optional.of(closedPoll));
        when(squadResolver.resolveSquadRows(teamId, seasonId))
                .thenReturn(List.of(new PlayerAvailabilityRowDto(playerId, "Jane", "Smith", null, null)));

        assertThatThrownBy(() -> service.setPlayerStatus(
                        authentication, clubId, matchId, pollId, playerId, AvailabilityStatus.AVAILABLE))
                .isInstanceOf(com.cricketlegend.exception.PollClosedException.class);
        verify(playerAvailabilityRepository, never()).save(any());
    }

    // --- listOpenForClub (034/035) ---

    @Test
    void listOpenForClubReturnsOneEntryPerOpenPollScopedToClub() {
        UUID clubId = UUID.randomUUID();
        UUID matchId = UUID.randomUUID();
        UUID teamId = UUID.randomUUID();
        UUID pollId = UUID.randomUUID();
        UUID seasonId = UUID.randomUUID();
        Match match = match(clubId, matchId, teamId, UUID.randomUUID(), seasonId);
        match.setHomeTeamName(null);
        match.setAwayTeamName("Away Occasionals");
        MatchAvailabilityPoll openPoll = poll(pollId, matchId, teamId, true);
        when(matchAvailabilityPollRepository.findOpenByMatchClubId(clubId)).thenReturn(List.of(openPoll));
        when(matchRepository.findAllById(Set.of(matchId))).thenReturn(List.of(match));
        when(accessService.accessibleSectionIds(authentication, clubId)).thenReturn(Optional.empty());
        when(accessService.resolveMatchSectionIds(clubId, match.getHomeTeamId(), match.getAwayTeamId()))
                .thenReturn(Set.of(UUID.randomUUID()));
        when(squadResolver.resolveSquadRows(teamId, seasonId)).thenReturn(List.of());

        List<OpenAvailabilityPollDto> result = service.listOpenForClub(authentication, clubId, null);

        assertThat(result).hasSize(1);
        assertThat(result.get(0).pollId()).isEqualTo(pollId);
        assertThat(result.get(0).matchId()).isEqualTo(matchId);
    }

    @Test
    void listOpenForClubExcludesAClosedPollAndReturnsEmptyListNotAnErrorWhenNoneOpen() {
        UUID clubId = UUID.randomUUID();
        when(matchAvailabilityPollRepository.findOpenByMatchClubId(clubId)).thenReturn(List.of());
        when(matchRepository.findAllById(Set.of())).thenReturn(List.of());
        when(accessService.accessibleSectionIds(authentication, clubId)).thenReturn(Optional.empty());

        assertThat(service.listOpenForClub(authentication, clubId, null)).isEmpty();
    }

    @Test
    void listOpenForClubBucketsRespondentsByStatusExcludingNullStatusFromAllThreeBuckets() {
        UUID clubId = UUID.randomUUID();
        UUID matchId = UUID.randomUUID();
        UUID teamId = UUID.randomUUID();
        UUID pollId = UUID.randomUUID();
        UUID seasonId = UUID.randomUUID();
        UUID available = UUID.randomUUID();
        UUID unavailable = UUID.randomUUID();
        UUID unsure = UUID.randomUUID();
        UUID noResponse = UUID.randomUUID();
        Match match = match(clubId, matchId, teamId, UUID.randomUUID(), seasonId);
        MatchAvailabilityPoll openPoll = poll(pollId, matchId, teamId, true);
        when(matchAvailabilityPollRepository.findOpenByMatchClubId(clubId)).thenReturn(List.of(openPoll));
        when(matchRepository.findAllById(Set.of(matchId))).thenReturn(List.of(match));
        when(accessService.accessibleSectionIds(authentication, clubId)).thenReturn(Optional.empty());
        when(accessService.resolveMatchSectionIds(clubId, match.getHomeTeamId(), match.getAwayTeamId()))
                .thenReturn(Set.of(UUID.randomUUID()));
        when(squadResolver.resolveSquadRows(teamId, seasonId)).thenReturn(List.of(
                new PlayerAvailabilityRowDto(available, "Alice", "A", null, null),
                new PlayerAvailabilityRowDto(unavailable, "Bob", "B", null, null),
                new PlayerAvailabilityRowDto(unsure, "Cara", "C", null, null),
                new PlayerAvailabilityRowDto(noResponse, "Dee", "D", null, null)));
        when(playerAvailabilityRepository.findByPollId(pollId)).thenReturn(List.of(
                PlayerAvailability.builder().pollId(pollId).playerProfileId(available)
                        .status(AvailabilityStatus.AVAILABLE).build(),
                PlayerAvailability.builder().pollId(pollId).playerProfileId(unavailable)
                        .status(AvailabilityStatus.UNAVAILABLE).build(),
                PlayerAvailability.builder().pollId(pollId).playerProfileId(unsure)
                        .status(AvailabilityStatus.UNSURE).build()));

        OpenAvailabilityPollDto dto = service.listOpenForClub(authentication, clubId, null).get(0);

        assertThat(dto.availableCount()).isEqualTo(1);
        assertThat(dto.unavailableCount()).isEqualTo(1);
        assertThat(dto.unsureCount()).isEqualTo(1);
        assertThat(dto.noResponseCount()).isEqualTo(1);
        assertThat(dto.availableRespondents()).extracting("playerProfileId").containsExactly(available);
        assertThat(dto.unavailableRespondents()).extracting("playerProfileId").containsExactly(unavailable);
        assertThat(dto.unsureRespondents()).extracting("playerProfileId").containsExactly(unsure);
    }

    @Test
    void listOpenForClubSortsByMatchDateAscending() {
        UUID clubId = UUID.randomUUID();
        UUID teamId = UUID.randomUUID();
        UUID seasonId = UUID.randomUUID();
        UUID laterMatchId = UUID.randomUUID();
        UUID soonerMatchId = UUID.randomUUID();
        Instant now = Instant.now();
        Match laterMatch = match(clubId, laterMatchId, teamId, UUID.randomUUID(), seasonId);
        laterMatch.setMatchDate(now.plus(5, ChronoUnit.DAYS));
        Match soonerMatch = match(clubId, soonerMatchId, teamId, UUID.randomUUID(), seasonId);
        soonerMatch.setMatchDate(now.plus(1, ChronoUnit.DAYS));
        MatchAvailabilityPoll laterPoll = poll(UUID.randomUUID(), laterMatchId, teamId, true);
        MatchAvailabilityPoll soonerPoll = poll(UUID.randomUUID(), soonerMatchId, teamId, true);
        when(matchAvailabilityPollRepository.findOpenByMatchClubId(clubId))
                .thenReturn(List.of(laterPoll, soonerPoll));
        when(matchRepository.findAllById(Set.of(laterMatchId, soonerMatchId)))
                .thenReturn(List.of(laterMatch, soonerMatch));
        when(accessService.accessibleSectionIds(authentication, clubId)).thenReturn(Optional.empty());
        when(accessService.resolveMatchSectionIds(eq(clubId), any(), any())).thenReturn(Set.of(UUID.randomUUID()));
        when(squadResolver.resolveSquadRows(eq(teamId), eq(seasonId))).thenReturn(List.of());

        List<OpenAvailabilityPollDto> result = service.listOpenForClub(authentication, clubId, null);

        assertThat(result).extracting(OpenAvailabilityPollDto::matchId)
                .containsExactly(soonerMatchId, laterMatchId);
    }

    @Test
    void listOpenForClubExcludesAPollWhoseMatchIsOutsideTheCallersAccessibleSections() {
        UUID clubId = UUID.randomUUID();
        UUID matchId = UUID.randomUUID();
        UUID teamId = UUID.randomUUID();
        UUID pollId = UUID.randomUUID();
        UUID seasonId = UUID.randomUUID();
        Match match = match(clubId, matchId, teamId, UUID.randomUUID(), seasonId);
        MatchAvailabilityPoll openPoll = poll(pollId, matchId, teamId, true);
        UUID matchSectionId = UUID.randomUUID();
        UUID accessibleSectionId = UUID.randomUUID();
        when(matchAvailabilityPollRepository.findOpenByMatchClubId(clubId)).thenReturn(List.of(openPoll));
        when(matchRepository.findAllById(Set.of(matchId))).thenReturn(List.of(match));
        when(accessService.accessibleSectionIds(authentication, clubId))
                .thenReturn(Optional.of(Set.of(accessibleSectionId)));
        when(accessService.resolveMatchSectionIds(clubId, match.getHomeTeamId(), match.getAwayTeamId()))
                .thenReturn(Set.of(matchSectionId));

        assertThat(service.listOpenForClub(authentication, clubId, null)).isEmpty();
    }

    @Test
    void listOpenForClubNarrowsToAnExplicitSectionIdsClosureAfterValidatingIt() {
        UUID clubId = UUID.randomUUID();
        UUID matchId = UUID.randomUUID();
        UUID teamId = UUID.randomUUID();
        UUID pollId = UUID.randomUUID();
        UUID seasonId = UUID.randomUUID();
        UUID filterSectionId = UUID.randomUUID();
        UUID matchSectionId = UUID.randomUUID();
        Match match = match(clubId, matchId, teamId, UUID.randomUUID(), seasonId);
        MatchAvailabilityPoll openPoll = poll(pollId, matchId, teamId, true);
        when(matchAvailabilityPollRepository.findOpenByMatchClubId(clubId)).thenReturn(List.of(openPoll));
        when(matchRepository.findAllById(Set.of(matchId))).thenReturn(List.of(match));
        when(accessService.accessibleSectionIds(authentication, clubId)).thenReturn(Optional.empty());
        when(accessService.sectionAndDescendantIds(clubId, filterSectionId))
                .thenReturn(Set.of(filterSectionId, matchSectionId));
        when(accessService.resolveMatchSectionIds(clubId, match.getHomeTeamId(), match.getAwayTeamId()))
                .thenReturn(Set.of(matchSectionId));
        when(squadResolver.resolveSquadRows(teamId, seasonId)).thenReturn(List.of());

        List<OpenAvailabilityPollDto> result = service.listOpenForClub(authentication, clubId, filterSectionId);

        verify(accessService).assertCanAdministerSection(authentication, clubId, filterSectionId);
        assertThat(result).hasSize(1);
    }
}
