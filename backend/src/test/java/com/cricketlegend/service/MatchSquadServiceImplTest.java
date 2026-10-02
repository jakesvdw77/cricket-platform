package com.cricketlegend.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.cricketlegend.config.AccessService;
import com.cricketlegend.domain.AvailabilityStatus;
import com.cricketlegend.domain.DayPart;
import com.cricketlegend.domain.Match;
import com.cricketlegend.domain.MatchSquadMember;
import com.cricketlegend.domain.Person;
import com.cricketlegend.domain.PlayerProfile;
import com.cricketlegend.domain.SectionAvailabilityResponse;
import com.cricketlegend.domain.SectionAvailabilityWindow;
import com.cricketlegend.domain.Team;
import com.cricketlegend.dto.MatchSquadDto;
import com.cricketlegend.dto.MatchSquadMemberDto;
import com.cricketlegend.exception.ConflictException;
import com.cricketlegend.exception.DuplicateMatchSquadJerseyNumberException;
import com.cricketlegend.exception.NotFoundException;
import com.cricketlegend.exception.PlayerAlreadyPickedForWindowException;
import com.cricketlegend.exception.SectionAvailabilityWindowRequiredException;
import com.cricketlegend.exception.ValidationException;
import com.cricketlegend.mapper.PlayerMapper;
import com.cricketlegend.repository.MatchRepository;
import com.cricketlegend.repository.MatchSquadMemberRepository;
import com.cricketlegend.repository.PersonRepository;
import com.cricketlegend.repository.PlayerProfileRepository;
import com.cricketlegend.repository.PlayerSectionRepository;
import com.cricketlegend.repository.SectionAvailabilityResponseRepository;
import com.cricketlegend.repository.SectionAvailabilityWindowRepository;
import com.cricketlegend.repository.TeamRepository;
import com.cricketlegend.service.impl.MatchSquadServiceImpl;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
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
 * Unit tests for MatchSquadServiceImpl's business rules from
 * docs/specs/063-section-availability-and-flexible-squads.md's Test Plan (Unit, Part B/C): {@code
 * add} (squad-mode-mismatch, no-window-yet, not-a-real-player, already-picked-elsewhere with the
 * correct conflicting {@code matchId}/{@code teamId}, already-in-this-squad, happy path), {@code
 * remove} (not-in-squad 404, happy-path hard delete), {@code updateJerseyNumber} (negative,
 * not-in-squad, duplicate, happy path), and {@code get}'s own shape ({@code windowId}/{@code
 * windowOpen}/{@code roundId}, {@code candidates} only ever {@code AVAILABLE}-status players,
 * {@code pickedElsewhere} populated for a candidate already picked into a different match sharing
 * the same window, and the resolved-bracket-but-no-window-yet shape).
 */
@ExtendWith(MockitoExtension.class)
class MatchSquadServiceImplTest {

    @Mock
    private MatchRepository matchRepository;

    @Mock
    private TeamRepository teamRepository;

    @Mock
    private MatchSquadMemberRepository matchSquadMemberRepository;

    @Mock
    private SectionAvailabilityWindowRepository sectionAvailabilityWindowRepository;

    @Mock
    private SectionAvailabilityResponseRepository sectionAvailabilityResponseRepository;

    @Mock
    private SectionAvailabilityMatchResolver matchResolver;

    @Mock
    private MatchPollCoverageService coverageService;

    @Mock
    private PlayerProfileRepository playerProfileRepository;

    @Mock
    private PersonRepository personRepository;

    @Mock
    private PlayerSectionRepository playerSectionRepository;

    @Mock
    private PlayerMapper playerMapper;

    @Mock
    private AccessService accessService;

    private MatchSquadServiceImpl service;
    private final Authentication authentication = new TestingAuthenticationToken(
            "club-admin-subject", null, List.of(new SimpleGrantedAuthority("ROLE_someone_else")));

    @BeforeEach
    void setUp() {
        service = new MatchSquadServiceImpl(
                matchRepository,
                teamRepository,
                matchSquadMemberRepository,
                sectionAvailabilityWindowRepository,
                sectionAvailabilityResponseRepository,
                matchResolver,
                coverageService,
                playerProfileRepository,
                personRepository,
                playerSectionRepository,
                playerMapper,
                accessService);
    }

    private Team team(UUID id, UUID clubId, UUID sectionId) {
        Team team = new Team();
        team.setId(id);
        team.setClubId(clubId);
        team.setSectionId(sectionId);
        team.setName("U15 Colts");
        team.setActive(true);
        return team;
    }

    private Match match(UUID id, UUID clubId, UUID homeTeamId, UUID awayTeamId) {
        return Match.builder().id(id).clubId(clubId).homeTeamId(homeTeamId).awayTeamId(awayTeamId)
                .seasonId(UUID.randomUUID()).matchDate(java.time.Instant.now()).active(true).build();
    }

    private PlayerProfile playerProfile(UUID id, UUID clubId, boolean active) {
        return PlayerProfile.builder().id(id).personId(UUID.randomUUID()).clubId(clubId).active(active).build();
    }

    private void stubPlayerLookup(PlayerProfile profile) {
        when(playerProfileRepository.findById(profile.getId())).thenReturn(Optional.of(profile));
        when(personRepository.findById(profile.getPersonId())).thenReturn(
                Optional.of(Person.builder().id(profile.getPersonId()).firstName("Alex").lastName("Player").build()));
        when(playerSectionRepository.findByPlayerProfileId(profile.getId())).thenReturn(List.of());
        when(playerMapper.toMatchSquadMemberDto(any(), any(), any(), any())).thenAnswer(invocation -> {
            Person person = invocation.getArgument(0);
            PlayerProfile p = invocation.getArgument(1);
            MatchSquadMember member = invocation.getArgument(2);
            return new MatchSquadMemberDto(
                    member.getId(), p.getId(), person.getId(), p.getClubId(), person.getFirstName(),
                    person.getLastName(), null, null, p.getPhotoUrl(), null, null, null, null, null, null, null,
                    null, null, null, false, p.isActive(), List.of(), member.getJerseyNumber(),
                    member.getJerseyNumber(), false);
        });
    }

    // --- add ---

    @Test
    void addWithNoWindowYetForTheResolvedBracketThrowsSectionAvailabilityWindowRequiredException() {
        UUID clubId = UUID.randomUUID();
        UUID matchId = UUID.randomUUID();
        UUID teamId = UUID.randomUUID();
        UUID sectionId = UUID.randomUUID();
        Team team = team(teamId, clubId, sectionId);
        Match match = match(matchId, clubId, teamId, UUID.randomUUID());
        when(matchRepository.findById(matchId)).thenReturn(Optional.of(match));
        when(teamRepository.findById(teamId)).thenReturn(Optional.of(team));
        SectionAvailabilityMatchResolver.WindowKey key =
                new SectionAvailabilityMatchResolver.WindowKey(sectionId, LocalDate.of(2026, 9, 26), DayPart.MORNING);
        when(coverageService.resolve(any(), any())).thenReturn(MatchPollCoverageService.Coverage.NONE);

        assertThatThrownBy(() -> service.add(authentication, clubId, matchId, teamId, UUID.randomUUID()))
                .isInstanceOf(SectionAvailabilityWindowRequiredException.class);
        verify(matchSquadMemberRepository, never()).save(any());
    }

    @Test
    void addWithAPlayerThatIsNotARealActivePlayerOfThisClubThrowsNotFoundException() {
        UUID clubId = UUID.randomUUID();
        UUID matchId = UUID.randomUUID();
        UUID teamId = UUID.randomUUID();
        UUID sectionId = UUID.randomUUID();
        UUID playerId = UUID.randomUUID();
        Team team = team(teamId, clubId, sectionId);
        Match match = match(matchId, clubId, teamId, UUID.randomUUID());
        when(matchRepository.findById(matchId)).thenReturn(Optional.of(match));
        when(teamRepository.findById(teamId)).thenReturn(Optional.of(team));
        SectionAvailabilityMatchResolver.WindowKey key =
                new SectionAvailabilityMatchResolver.WindowKey(sectionId, LocalDate.of(2026, 9, 26), DayPart.MORNING);
        SectionAvailabilityWindow window = SectionAvailabilityWindow.builder().id(UUID.randomUUID())
                .clubId(clubId).sectionId(sectionId).roundId(UUID.randomUUID())
                .windowDate(key.windowDate()).dayPart(key.dayPart()).open(true).build();
        when(coverageService.resolve(any(), any()))
                .thenReturn(new MatchPollCoverageService.Coverage(
                        MatchPollCoverageService.Kind.GROUP, null, window.getRoundId(), window.getId(), "round"));
        when(sectionAvailabilityWindowRepository.findById(window.getId())).thenReturn(Optional.of(window));
        when(playerProfileRepository.findById(playerId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.add(authentication, clubId, matchId, teamId, playerId))
                .isInstanceOf(NotFoundException.class);
        verify(matchSquadMemberRepository, never()).save(any());
    }

    @Test
    void addAPlayerAlreadyPickedForThisWindowElsewhereThrowsPlayerAlreadyPickedForWindowExceptionNamingTheConflict() {
        UUID clubId = UUID.randomUUID();
        UUID matchId = UUID.randomUUID();
        UUID teamId = UUID.randomUUID();
        UUID sectionId = UUID.randomUUID();
        Team team = team(teamId, clubId, sectionId);
        Match match = match(matchId, clubId, teamId, UUID.randomUUID());
        PlayerProfile profile = playerProfile(UUID.randomUUID(), clubId, true);
        when(matchRepository.findById(matchId)).thenReturn(Optional.of(match));
        when(teamRepository.findById(teamId)).thenReturn(Optional.of(team));
        SectionAvailabilityMatchResolver.WindowKey key =
                new SectionAvailabilityMatchResolver.WindowKey(sectionId, LocalDate.of(2026, 9, 26), DayPart.MORNING);
        SectionAvailabilityWindow window = SectionAvailabilityWindow.builder().id(UUID.randomUUID())
                .clubId(clubId).sectionId(sectionId).roundId(UUID.randomUUID())
                .windowDate(key.windowDate()).dayPart(key.dayPart()).open(true).build();
        when(coverageService.resolve(any(), any()))
                .thenReturn(new MatchPollCoverageService.Coverage(
                        MatchPollCoverageService.Kind.GROUP, null, window.getRoundId(), window.getId(), "round"));
        when(sectionAvailabilityWindowRepository.findById(window.getId())).thenReturn(Optional.of(window));
        when(playerProfileRepository.findById(profile.getId())).thenReturn(Optional.of(profile));

        UUID conflictingMatchId = UUID.randomUUID();
        UUID conflictingTeamId = UUID.randomUUID();
        MatchSquadMember existing = MatchSquadMember.builder().id(UUID.randomUUID())
                .matchId(conflictingMatchId).teamId(conflictingTeamId)
                .sectionAvailabilityWindowId(window.getId()).playerProfileId(profile.getId()).build();
        when(matchSquadMemberRepository.findBySectionAvailabilityWindowIdAndPlayerProfileId(
                        window.getId(), profile.getId()))
                .thenReturn(Optional.of(existing));
        when(teamRepository.findById(conflictingTeamId))
                .thenReturn(Optional.of(team(conflictingTeamId, clubId, sectionId)));

        assertThatThrownBy(() -> service.add(authentication, clubId, matchId, teamId, profile.getId()))
                .isInstanceOf(PlayerAlreadyPickedForWindowException.class)
                .hasMessageContaining(conflictingMatchId.toString())
                .hasMessageContaining(conflictingTeamId.toString());
        verify(matchSquadMemberRepository, never()).save(any());
    }

    @Test
    void addAPlayerAlreadyInThisExactMatchAndTeamsSquadThrowsConflictException() {
        UUID clubId = UUID.randomUUID();
        UUID matchId = UUID.randomUUID();
        UUID teamId = UUID.randomUUID();
        UUID sectionId = UUID.randomUUID();
        Team team = team(teamId, clubId, sectionId);
        Match match = match(matchId, clubId, teamId, UUID.randomUUID());
        PlayerProfile profile = playerProfile(UUID.randomUUID(), clubId, true);
        when(matchRepository.findById(matchId)).thenReturn(Optional.of(match));
        when(teamRepository.findById(teamId)).thenReturn(Optional.of(team));
        SectionAvailabilityMatchResolver.WindowKey key =
                new SectionAvailabilityMatchResolver.WindowKey(sectionId, LocalDate.of(2026, 9, 26), DayPart.MORNING);
        SectionAvailabilityWindow window = SectionAvailabilityWindow.builder().id(UUID.randomUUID())
                .clubId(clubId).sectionId(sectionId).roundId(UUID.randomUUID())
                .windowDate(key.windowDate()).dayPart(key.dayPart()).open(true).build();
        when(coverageService.resolve(any(), any()))
                .thenReturn(new MatchPollCoverageService.Coverage(
                        MatchPollCoverageService.Kind.GROUP, null, window.getRoundId(), window.getId(), "round"));
        when(sectionAvailabilityWindowRepository.findById(window.getId())).thenReturn(Optional.of(window));
        when(playerProfileRepository.findById(profile.getId())).thenReturn(Optional.of(profile));
        // Already holds a row for this exact window, but via this exact match+team — filtered out
        // of the "picked elsewhere" check, falling through to the plain already-in-squad 409.
        MatchSquadMember existing = MatchSquadMember.builder().id(UUID.randomUUID())
                .matchId(matchId).teamId(teamId)
                .sectionAvailabilityWindowId(window.getId()).playerProfileId(profile.getId()).build();
        when(matchSquadMemberRepository.findBySectionAvailabilityWindowIdAndPlayerProfileId(
                        window.getId(), profile.getId()))
                .thenReturn(Optional.of(existing));
        when(matchSquadMemberRepository.existsByMatchIdAndTeamIdAndPlayerProfileId(matchId, teamId, profile.getId()))
                .thenReturn(true);

        assertThatThrownBy(() -> service.add(authentication, clubId, matchId, teamId, profile.getId()))
                .isInstanceOf(ConflictException.class)
                .isNotInstanceOf(PlayerAlreadyPickedForWindowException.class);
        verify(matchSquadMemberRepository, never()).save(any());
    }

    @Test
    void addAnAvailableNotYetPickedPlayerSucceedsDefaultingTheJerseyNumberFromTheirProfile() {
        UUID clubId = UUID.randomUUID();
        UUID matchId = UUID.randomUUID();
        UUID teamId = UUID.randomUUID();
        UUID sectionId = UUID.randomUUID();
        Team team = team(teamId, clubId, sectionId);
        Match match = match(matchId, clubId, teamId, UUID.randomUUID());
        PlayerProfile profile = playerProfile(UUID.randomUUID(), clubId, true);
        profile.setJerseyNumber(7);
        when(matchRepository.findById(matchId)).thenReturn(Optional.of(match));
        when(teamRepository.findById(teamId)).thenReturn(Optional.of(team));
        SectionAvailabilityMatchResolver.WindowKey key =
                new SectionAvailabilityMatchResolver.WindowKey(sectionId, LocalDate.of(2026, 9, 26), DayPart.MORNING);
        SectionAvailabilityWindow window = SectionAvailabilityWindow.builder().id(UUID.randomUUID())
                .clubId(clubId).sectionId(sectionId).roundId(UUID.randomUUID())
                .windowDate(key.windowDate()).dayPart(key.dayPart()).open(true).build();
        when(coverageService.resolve(any(), any()))
                .thenReturn(new MatchPollCoverageService.Coverage(
                        MatchPollCoverageService.Kind.GROUP, null, window.getRoundId(), window.getId(), "round"));
        when(sectionAvailabilityWindowRepository.findById(window.getId())).thenReturn(Optional.of(window));
        when(playerProfileRepository.findById(profile.getId())).thenReturn(Optional.of(profile));
        when(matchSquadMemberRepository.findBySectionAvailabilityWindowIdAndPlayerProfileId(
                        window.getId(), profile.getId()))
                .thenReturn(Optional.empty());
        when(matchSquadMemberRepository.existsByMatchIdAndTeamIdAndPlayerProfileId(matchId, teamId, profile.getId()))
                .thenReturn(false);
        when(matchSquadMemberRepository.save(any(MatchSquadMember.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));
        stubPlayerLookup(profile);

        MatchSquadMemberDto dto = service.add(authentication, clubId, matchId, teamId, profile.getId());

        ArgumentCaptor<MatchSquadMember> captor = ArgumentCaptor.forClass(MatchSquadMember.class);
        verify(matchSquadMemberRepository).save(captor.capture());
        MatchSquadMember saved = captor.getValue();
        assertThat(saved.getMatchId()).isEqualTo(matchId);
        assertThat(saved.getTeamId()).isEqualTo(teamId);
        assertThat(saved.getSectionAvailabilityWindowId()).isEqualTo(window.getId());
        assertThat(saved.getPlayerProfileId()).isEqualTo(profile.getId());
        assertThat(saved.getJerseyNumber()).isEqualTo(7);
        assertThat(dto.playerProfileId()).isEqualTo(profile.getId());
    }

    // --- remove ---

    @Test
    void removeAPlayerNotCurrentlyInThisMatchAndTeamsSquadThrowsNotFoundException() {
        UUID clubId = UUID.randomUUID();
        UUID matchId = UUID.randomUUID();
        UUID teamId = UUID.randomUUID();
        UUID playerId = UUID.randomUUID();
        Team team = team(teamId, clubId, UUID.randomUUID());
        Match match = match(matchId, clubId, teamId, UUID.randomUUID());
        when(matchRepository.findById(matchId)).thenReturn(Optional.of(match));
        when(teamRepository.findById(teamId)).thenReturn(Optional.of(team));
        when(matchSquadMemberRepository.findByMatchIdAndTeamIdAndPlayerProfileId(matchId, teamId, playerId))
                .thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.remove(authentication, clubId, matchId, teamId, playerId))
                .isInstanceOf(NotFoundException.class);
        verify(matchSquadMemberRepository, never())
                .deleteByMatchIdAndTeamIdAndPlayerProfileId(any(), any(), any());
    }

    @Test
    void removeAPlayerCurrentlyInTheSquadHardDeletesTheRow() {
        UUID clubId = UUID.randomUUID();
        UUID matchId = UUID.randomUUID();
        UUID teamId = UUID.randomUUID();
        UUID playerId = UUID.randomUUID();
        Team team = team(teamId, clubId, UUID.randomUUID());
        Match match = match(matchId, clubId, teamId, UUID.randomUUID());
        when(matchRepository.findById(matchId)).thenReturn(Optional.of(match));
        when(teamRepository.findById(teamId)).thenReturn(Optional.of(team));
        when(matchSquadMemberRepository.findByMatchIdAndTeamIdAndPlayerProfileId(matchId, teamId, playerId))
                .thenReturn(Optional.of(MatchSquadMember.builder().id(UUID.randomUUID()).matchId(matchId)
                        .teamId(teamId).playerProfileId(playerId).sectionAvailabilityWindowId(UUID.randomUUID())
                        .build()));

        service.remove(authentication, clubId, matchId, teamId, playerId);

        verify(matchSquadMemberRepository).deleteByMatchIdAndTeamIdAndPlayerProfileId(matchId, teamId, playerId);
    }

    // --- updateJerseyNumber ---

    @Test
    void updateJerseyNumberToANegativeValueThrowsValidationException() {
        UUID clubId = UUID.randomUUID();
        UUID matchId = UUID.randomUUID();
        UUID teamId = UUID.randomUUID();
        UUID playerId = UUID.randomUUID();
        Team team = team(teamId, clubId, UUID.randomUUID());
        Match match = match(matchId, clubId, teamId, UUID.randomUUID());
        when(matchRepository.findById(matchId)).thenReturn(Optional.of(match));
        when(teamRepository.findById(teamId)).thenReturn(Optional.of(team));
        when(matchSquadMemberRepository.findByMatchIdAndTeamIdAndPlayerProfileId(matchId, teamId, playerId))
                .thenReturn(Optional.of(MatchSquadMember.builder().id(UUID.randomUUID()).matchId(matchId)
                        .teamId(teamId).playerProfileId(playerId).sectionAvailabilityWindowId(UUID.randomUUID())
                        .build()));

        assertThatThrownBy(() -> service.updateJerseyNumber(authentication, clubId, matchId, teamId, playerId, -1))
                .isInstanceOf(ValidationException.class);
        verify(matchSquadMemberRepository, never()).save(any());
    }

    @Test
    void updateJerseyNumberForAPlayerNotCurrentlyInTheSquadThrowsNotFoundException() {
        UUID clubId = UUID.randomUUID();
        UUID matchId = UUID.randomUUID();
        UUID teamId = UUID.randomUUID();
        UUID playerId = UUID.randomUUID();
        Team team = team(teamId, clubId, UUID.randomUUID());
        Match match = match(matchId, clubId, teamId, UUID.randomUUID());
        when(matchRepository.findById(matchId)).thenReturn(Optional.of(match));
        when(teamRepository.findById(teamId)).thenReturn(Optional.of(team));
        when(matchSquadMemberRepository.findByMatchIdAndTeamIdAndPlayerProfileId(matchId, teamId, playerId))
                .thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.updateJerseyNumber(authentication, clubId, matchId, teamId, playerId, 9))
                .isInstanceOf(NotFoundException.class);
        verify(matchSquadMemberRepository, never()).save(any());
    }

    @Test
    void updateJerseyNumberToOneAnotherPlayerAlreadyHoldsThrowsDuplicateMatchSquadJerseyNumberException() {
        UUID clubId = UUID.randomUUID();
        UUID matchId = UUID.randomUUID();
        UUID teamId = UUID.randomUUID();
        UUID playerId = UUID.randomUUID();
        UUID memberId = UUID.randomUUID();
        Team team = team(teamId, clubId, UUID.randomUUID());
        Match match = match(matchId, clubId, teamId, UUID.randomUUID());
        MatchSquadMember member = MatchSquadMember.builder().id(memberId).matchId(matchId).teamId(teamId)
                .playerProfileId(playerId).sectionAvailabilityWindowId(UUID.randomUUID()).jerseyNumber(3).build();
        when(matchRepository.findById(matchId)).thenReturn(Optional.of(match));
        when(teamRepository.findById(teamId)).thenReturn(Optional.of(team));
        when(matchSquadMemberRepository.findByMatchIdAndTeamIdAndPlayerProfileId(matchId, teamId, playerId))
                .thenReturn(Optional.of(member));
        when(matchSquadMemberRepository.existsByMatchIdAndTeamIdAndJerseyNumberAndIdNot(
                        matchId, teamId, 9, memberId))
                .thenReturn(true);

        assertThatThrownBy(() -> service.updateJerseyNumber(authentication, clubId, matchId, teamId, playerId, 9))
                .isInstanceOf(DuplicateMatchSquadJerseyNumberException.class);
        verify(matchSquadMemberRepository, never()).save(any());
    }

    @Test
    void updateJerseyNumberHappyPathSavesTheNewNumberAndReturnsIt() {
        UUID clubId = UUID.randomUUID();
        UUID matchId = UUID.randomUUID();
        UUID teamId = UUID.randomUUID();
        UUID playerId = UUID.randomUUID();
        UUID memberId = UUID.randomUUID();
        Team team = team(teamId, clubId, UUID.randomUUID());
        Match match = match(matchId, clubId, teamId, UUID.randomUUID());
        MatchSquadMember member = MatchSquadMember.builder().id(memberId).matchId(matchId).teamId(teamId)
                .playerProfileId(playerId).sectionAvailabilityWindowId(UUID.randomUUID()).jerseyNumber(3).build();
        when(matchRepository.findById(matchId)).thenReturn(Optional.of(match));
        when(teamRepository.findById(teamId)).thenReturn(Optional.of(team));
        when(matchSquadMemberRepository.findByMatchIdAndTeamIdAndPlayerProfileId(matchId, teamId, playerId))
                .thenReturn(Optional.of(member));
        when(matchSquadMemberRepository.existsByMatchIdAndTeamIdAndJerseyNumberAndIdNot(
                        matchId, teamId, 9, memberId))
                .thenReturn(false);
        when(matchSquadMemberRepository.save(any(MatchSquadMember.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));
        PlayerProfile profile = playerProfile(playerId, clubId, true);
        stubPlayerLookup(profile);

        MatchSquadMemberDto dto = service.updateJerseyNumber(authentication, clubId, matchId, teamId, playerId, 9);

        assertThat(member.getJerseyNumber()).isEqualTo(9);
        assertThat(dto.squadJerseyNumber()).isEqualTo(9);
    }

    // --- get ---

    @Test
    void getReturnsTheResolvedBracketWithANullWindowIdWhenNoWindowExistsYet() {
        UUID clubId = UUID.randomUUID();
        UUID matchId = UUID.randomUUID();
        UUID teamId = UUID.randomUUID();
        UUID sectionId = UUID.randomUUID();
        Team team = team(teamId, clubId, sectionId);
        Match match = match(matchId, clubId, teamId, UUID.randomUUID());
        when(matchRepository.findById(matchId)).thenReturn(Optional.of(match));
        when(teamRepository.findById(teamId)).thenReturn(Optional.of(team));
        SectionAvailabilityMatchResolver.WindowKey key =
                new SectionAvailabilityMatchResolver.WindowKey(sectionId, LocalDate.of(2026, 9, 26), DayPart.MORNING);
        when(matchResolver.resolveWindowKey(team, match)).thenReturn(key);
        when(coverageService.resolve(any(), any())).thenReturn(MatchPollCoverageService.Coverage.NONE);
        when(matchSquadMemberRepository.findByMatchIdAndTeamId(matchId, teamId)).thenReturn(List.of());

        MatchSquadDto dto = service.get(authentication, clubId, matchId, teamId);

        assertThat(dto.windowId()).isNull();
        assertThat(dto.windowOpen()).isFalse();
        assertThat(dto.roundId()).isNull();
        assertThat(dto.sectionId()).isEqualTo(sectionId);
        assertThat(dto.windowDate()).isEqualTo(key.windowDate());
        assertThat(dto.dayPart()).isEqualTo(key.dayPart());
        assertThat(dto.candidates()).isEmpty();
        assertThat(dto.selected()).isEmpty();
    }

    @Test
    void getExposesWindowIdWindowOpenAndRoundIdWhenAWindowExists() {
        UUID clubId = UUID.randomUUID();
        UUID matchId = UUID.randomUUID();
        UUID teamId = UUID.randomUUID();
        UUID sectionId = UUID.randomUUID();
        UUID roundId = UUID.randomUUID();
        Team team = team(teamId, clubId, sectionId);
        Match match = match(matchId, clubId, teamId, UUID.randomUUID());
        when(matchRepository.findById(matchId)).thenReturn(Optional.of(match));
        when(teamRepository.findById(teamId)).thenReturn(Optional.of(team));
        SectionAvailabilityMatchResolver.WindowKey key =
                new SectionAvailabilityMatchResolver.WindowKey(sectionId, LocalDate.of(2026, 9, 26), DayPart.MORNING);
        when(matchResolver.resolveWindowKey(team, match)).thenReturn(key);
        SectionAvailabilityWindow window = SectionAvailabilityWindow.builder().id(UUID.randomUUID())
                .clubId(clubId).sectionId(sectionId).roundId(roundId)
                .windowDate(key.windowDate()).dayPart(key.dayPart()).open(true).build();
        when(coverageService.resolve(any(), any()))
                .thenReturn(new MatchPollCoverageService.Coverage(
                        MatchPollCoverageService.Kind.GROUP, null, window.getRoundId(), window.getId(), "round"));
        when(sectionAvailabilityWindowRepository.findById(window.getId())).thenReturn(Optional.of(window));
        when(sectionAvailabilityResponseRepository.findByWindowId(window.getId())).thenReturn(List.of());
        when(matchSquadMemberRepository.findByMatchIdAndTeamId(matchId, teamId)).thenReturn(List.of());

        MatchSquadDto dto = service.get(authentication, clubId, matchId, teamId);

        assertThat(dto.windowId()).isEqualTo(window.getId());
        assertThat(dto.windowOpen()).isTrue();
        assertThat(dto.roundId()).isEqualTo(roundId);
    }

    @Test
    void getOnlyIncludesAvailableStatusPlayersInCandidates() {
        UUID clubId = UUID.randomUUID();
        UUID matchId = UUID.randomUUID();
        UUID teamId = UUID.randomUUID();
        UUID sectionId = UUID.randomUUID();
        Team team = team(teamId, clubId, sectionId);
        Match match = match(matchId, clubId, teamId, UUID.randomUUID());
        when(matchRepository.findById(matchId)).thenReturn(Optional.of(match));
        when(teamRepository.findById(teamId)).thenReturn(Optional.of(team));
        SectionAvailabilityMatchResolver.WindowKey key =
                new SectionAvailabilityMatchResolver.WindowKey(sectionId, LocalDate.of(2026, 9, 26), DayPart.MORNING);
        when(matchResolver.resolveWindowKey(team, match)).thenReturn(key);
        SectionAvailabilityWindow window = SectionAvailabilityWindow.builder().id(UUID.randomUUID())
                .clubId(clubId).sectionId(sectionId).roundId(UUID.randomUUID())
                .windowDate(key.windowDate()).dayPart(key.dayPart()).open(true).build();
        when(coverageService.resolve(any(), any()))
                .thenReturn(new MatchPollCoverageService.Coverage(
                        MatchPollCoverageService.Kind.GROUP, null, window.getRoundId(), window.getId(), "round"));
        when(sectionAvailabilityWindowRepository.findById(window.getId())).thenReturn(Optional.of(window));

        PlayerProfile availablePlayer = playerProfile(UUID.randomUUID(), clubId, true);
        UUID unavailablePlayerId = UUID.randomUUID();
        UUID unsurePlayerId = UUID.randomUUID();
        when(sectionAvailabilityResponseRepository.findByWindowId(window.getId())).thenReturn(List.of(
                SectionAvailabilityResponse.builder().windowId(window.getId())
                        .playerProfileId(availablePlayer.getId()).status(AvailabilityStatus.AVAILABLE).build(),
                SectionAvailabilityResponse.builder().windowId(window.getId())
                        .playerProfileId(unavailablePlayerId).status(AvailabilityStatus.UNAVAILABLE).build(),
                SectionAvailabilityResponse.builder().windowId(window.getId())
                        .playerProfileId(unsurePlayerId).status(AvailabilityStatus.UNSURE).build()));
        when(playerProfileRepository.findById(availablePlayer.getId())).thenReturn(Optional.of(availablePlayer));
        when(personRepository.findById(availablePlayer.getPersonId())).thenReturn(
                Optional.of(Person.builder().id(availablePlayer.getPersonId())
                        .firstName("Alex").lastName("Player").build()));
        when(matchSquadMemberRepository.findBySectionAvailabilityWindowIdAndPlayerProfileId(
                        window.getId(), availablePlayer.getId()))
                .thenReturn(Optional.empty());
        when(matchSquadMemberRepository.findByMatchIdAndTeamId(matchId, teamId)).thenReturn(List.of());

        MatchSquadDto dto = service.get(authentication, clubId, matchId, teamId);

        assertThat(dto.candidates()).hasSize(1);
        assertThat(dto.candidates().get(0).playerProfileId()).isEqualTo(availablePlayer.getId());
        assertThat(dto.candidates().get(0).pickedElsewhere()).isNull();
    }

    @Test
    void getPopulatesPickedElsewhereForACandidateAlreadyPickedIntoADifferentMatchSharingThisWindow() {
        UUID clubId = UUID.randomUUID();
        UUID matchId = UUID.randomUUID();
        UUID teamId = UUID.randomUUID();
        UUID sectionId = UUID.randomUUID();
        Team team = team(teamId, clubId, sectionId);
        Match match = match(matchId, clubId, teamId, UUID.randomUUID());
        when(matchRepository.findById(matchId)).thenReturn(Optional.of(match));
        when(teamRepository.findById(teamId)).thenReturn(Optional.of(team));
        SectionAvailabilityMatchResolver.WindowKey key =
                new SectionAvailabilityMatchResolver.WindowKey(sectionId, LocalDate.of(2026, 9, 26), DayPart.MORNING);
        when(matchResolver.resolveWindowKey(team, match)).thenReturn(key);
        SectionAvailabilityWindow window = SectionAvailabilityWindow.builder().id(UUID.randomUUID())
                .clubId(clubId).sectionId(sectionId).roundId(UUID.randomUUID())
                .windowDate(key.windowDate()).dayPart(key.dayPart()).open(true).build();
        when(coverageService.resolve(any(), any()))
                .thenReturn(new MatchPollCoverageService.Coverage(
                        MatchPollCoverageService.Kind.GROUP, null, window.getRoundId(), window.getId(), "round"));
        when(sectionAvailabilityWindowRepository.findById(window.getId())).thenReturn(Optional.of(window));

        PlayerProfile availablePlayer = playerProfile(UUID.randomUUID(), clubId, true);
        when(sectionAvailabilityResponseRepository.findByWindowId(window.getId())).thenReturn(List.of(
                SectionAvailabilityResponse.builder().windowId(window.getId())
                        .playerProfileId(availablePlayer.getId()).status(AvailabilityStatus.AVAILABLE).build()));
        when(playerProfileRepository.findById(availablePlayer.getId())).thenReturn(Optional.of(availablePlayer));
        when(personRepository.findById(availablePlayer.getPersonId())).thenReturn(
                Optional.of(Person.builder().id(availablePlayer.getPersonId())
                        .firstName("Alex").lastName("Player").build()));

        UUID otherMatchId = UUID.randomUUID();
        UUID otherTeamId = UUID.randomUUID();
        MatchSquadMember pickedElsewhere = MatchSquadMember.builder().id(UUID.randomUUID())
                .matchId(otherMatchId).teamId(otherTeamId).sectionAvailabilityWindowId(window.getId())
                .playerProfileId(availablePlayer.getId()).build();
        when(matchSquadMemberRepository.findBySectionAvailabilityWindowIdAndPlayerProfileId(
                        window.getId(), availablePlayer.getId()))
                .thenReturn(Optional.of(pickedElsewhere));
        Team otherTeam = team(otherTeamId, clubId, sectionId);
        otherTeam.setName("U15 Panthers");
        when(teamRepository.findById(otherTeamId)).thenReturn(Optional.of(otherTeam));
        when(matchSquadMemberRepository.findByMatchIdAndTeamId(matchId, teamId)).thenReturn(List.of());

        MatchSquadDto dto = service.get(authentication, clubId, matchId, teamId);

        assertThat(dto.candidates()).hasSize(1);
        assertThat(dto.candidates().get(0).pickedElsewhere()).isNotNull();
        assertThat(dto.candidates().get(0).pickedElsewhere().matchId()).isEqualTo(otherMatchId);
        assertThat(dto.candidates().get(0).pickedElsewhere().teamId()).isEqualTo(otherTeamId);
        assertThat(dto.candidates().get(0).pickedElsewhere().teamName()).isEqualTo("U15 Panthers");
    }

    // --- 035: section-scoped access ---

    @Test
    void getThrowsAccessDeniedWhenCallerCannotAdministerTheTeamsSection() {
        UUID clubId = UUID.randomUUID();
        UUID matchId = UUID.randomUUID();
        UUID teamId = UUID.randomUUID();
        UUID sectionId = UUID.randomUUID();
        Team team = team(teamId, clubId, sectionId);
        Match match = match(matchId, clubId, teamId, UUID.randomUUID());
        when(matchRepository.findById(matchId)).thenReturn(Optional.of(match));
        when(teamRepository.findById(teamId)).thenReturn(Optional.of(team));
        org.mockito.Mockito.doThrow(new org.springframework.security.access.AccessDeniedException("denied"))
                .when(accessService)
                .assertCanAdministerSection(authentication, clubId, sectionId);

        assertThatThrownBy(() -> service.get(authentication, clubId, matchId, teamId))
                .isInstanceOf(org.springframework.security.access.AccessDeniedException.class);
    }
}
