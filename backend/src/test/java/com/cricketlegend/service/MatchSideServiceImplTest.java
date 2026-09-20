package com.cricketlegend.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.cricketlegend.config.AccessService;
import com.cricketlegend.domain.Gender;
import com.cricketlegend.domain.League;
import com.cricketlegend.domain.LeagueSource;
import com.cricketlegend.domain.Match;
import com.cricketlegend.domain.MatchSide;
import com.cricketlegend.domain.MatchSidePlayer;
import com.cricketlegend.domain.Person;
import com.cricketlegend.domain.PersonStatus;
import com.cricketlegend.domain.PlayerProfile;
import com.cricketlegend.domain.PlayingRole;
import com.cricketlegend.domain.Season;
import com.cricketlegend.dto.AddMatchSidePlayerRequest;
import com.cricketlegend.dto.CreateMatchSideRequest;
import com.cricketlegend.dto.UpdateMatchSidePlayerRequest;
import com.cricketlegend.dto.UpdateMatchSideRequest;
import com.cricketlegend.exception.ConflictException;
import com.cricketlegend.exception.NotFoundException;
import com.cricketlegend.exception.PlayerAgeIneligibleException;
import com.cricketlegend.exception.PlayerNotInSquadException;
import com.cricketlegend.exception.PlayingXiCapExceededException;
import com.cricketlegend.exception.ValidationException;
import com.cricketlegend.mapper.MatchSideMapper;
import com.cricketlegend.repository.LeagueRepository;
import com.cricketlegend.repository.MatchRepository;
import com.cricketlegend.repository.MatchSidePlayerRepository;
import com.cricketlegend.repository.MatchSideRepository;
import com.cricketlegend.repository.PersonRepository;
import com.cricketlegend.repository.PlayerProfileRepository;
import com.cricketlegend.repository.SeasonRepository;
import com.cricketlegend.repository.TeamSquadMemberRepository;
import com.cricketlegend.service.impl.MatchSideServiceImpl;
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
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;

/**
 * Unit tests for MatchSideServiceImpl's business rules from docs/specs/029-league-management.md's
 * MatchSide/MatchSidePlayer business rules: side creation restricted to the match's own two team
 * ids, the squad-membership {@link PlayerNotInSquadException} (including a season-mismatch case —
 * a player in the team's squad for a DIFFERENT season than the match's own), the {@link
 * PlayingXiCapExceededException} (both the league-configured size and the 11-fallback), the {@link
 * PlayerAgeIneligibleException} (missing DOB, out-of-range age, both cutoff-date sources),
 * captain/keeper-must-be-in-XI and twelfth-man-must-not-be-in-XI, and remove clearing
 * captain/keeper.
 */
@ExtendWith(MockitoExtension.class)
class MatchSideServiceImplTest {

    @Mock
    private MatchRepository matchRepository;

    @Mock
    private MatchSideRepository matchSideRepository;

    @Mock
    private MatchSidePlayerRepository matchSidePlayerRepository;

    @Mock
    private TeamSquadMemberRepository teamSquadMemberRepository;

    @Mock
    private LeagueRepository leagueRepository;

    @Mock
    private SeasonRepository seasonRepository;

    @Mock
    private PlayerProfileRepository playerProfileRepository;

    @Mock
    private PersonRepository personRepository;

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
                matchRepository, matchSideRepository, matchSidePlayerRepository, teamSquadMemberRepository,
                leagueRepository, seasonRepository, playerProfileRepository, personRepository,
                matchSideMapper, accessService);
        org.mockito.Mockito.lenient().when(matchSideMapper.toDto(any(), any())).thenReturn(null);
    }

    private Match matchWithoutLeague(UUID clubId, UUID matchId, UUID homeTeamId, UUID awayTeamId, UUID seasonId) {
        return Match.builder().id(matchId).clubId(clubId).homeTeamId(homeTeamId).awayTeamId(awayTeamId)
                .seasonId(seasonId).matchDate(Instant.now()).active(true).build();
    }

    private Match matchWithLeague(
            UUID clubId, UUID matchId, UUID homeTeamId, UUID awayTeamId, UUID seasonId, UUID leagueId) {
        return Match.builder().id(matchId).clubId(clubId).homeTeamId(homeTeamId).awayTeamId(awayTeamId)
                .leagueId(leagueId).seasonId(seasonId).matchDate(Instant.now()).active(true).build();
    }

    private MatchSide side(UUID id, UUID matchId, UUID teamId) {
        return MatchSide.builder().id(id).matchId(matchId).teamId(teamId).build();
    }

    private void stubAgeCheckPlayer(UUID playerId, LocalDate dateOfBirth) {
        UUID personId = UUID.randomUUID();
        PlayerProfile profile = PlayerProfile.builder().id(playerId).personId(personId).build();
        when(playerProfileRepository.findById(playerId)).thenReturn(Optional.of(profile));
        when(personRepository.findById(personId)).thenReturn(Optional.of(
                Person.builder().id(personId).firstName("Joe").lastName("Bloggs")
                        .dateOfBirth(dateOfBirth).status(PersonStatus.ACTIVE).gender(Gender.MALE).build()));
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

    // --- addPlayer: squad membership ---

    @Test
    void addPlayerNotInTheTeamsSquadForTheMatchsSeasonThrowsPlayerNotInSquadException() {
        UUID clubId = UUID.randomUUID();
        UUID matchId = UUID.randomUUID();
        UUID teamId = UUID.randomUUID();
        UUID seasonId = UUID.randomUUID();
        UUID playerId = UUID.randomUUID();
        Match match = matchWithoutLeague(clubId, matchId, teamId, UUID.randomUUID(), seasonId);
        MatchSide matchSide = side(UUID.randomUUID(), matchId, teamId);
        when(matchRepository.findById(matchId)).thenReturn(Optional.of(match));
        when(matchSideRepository.findById(matchSide.getId())).thenReturn(Optional.of(matchSide));
        when(teamSquadMemberRepository.existsByTeamIdAndSeasonIdAndPlayerProfileId(teamId, seasonId, playerId))
                .thenReturn(false);

        AddMatchSidePlayerRequest request = new AddMatchSidePlayerRequest(playerId, PlayingRole.BATSMAN);

        assertThatThrownBy(() -> service.addPlayer(authentication, clubId, matchId, matchSide.getId(), request))
                .isInstanceOf(PlayerNotInSquadException.class);
        verify(matchSidePlayerRepository, never()).save(any());
    }

    @Test
    void addPlayerInTheTeamsSquadForADifferentSeasonThrowsPlayerNotInSquadException() {
        UUID clubId = UUID.randomUUID();
        UUID matchId = UUID.randomUUID();
        UUID teamId = UUID.randomUUID();
        UUID matchSeasonId = UUID.randomUUID();
        UUID otherSeasonId = UUID.randomUUID();
        UUID playerId = UUID.randomUUID();
        Match match = matchWithoutLeague(clubId, matchId, teamId, UUID.randomUUID(), matchSeasonId);
        MatchSide matchSide = side(UUID.randomUUID(), matchId, teamId);
        when(matchRepository.findById(matchId)).thenReturn(Optional.of(match));
        when(matchSideRepository.findById(matchSide.getId())).thenReturn(Optional.of(matchSide));
        // Player IS in the team's squad, but only for a different season.
        when(teamSquadMemberRepository.existsByTeamIdAndSeasonIdAndPlayerProfileId(
                teamId, matchSeasonId, playerId)).thenReturn(false);

        AddMatchSidePlayerRequest request = new AddMatchSidePlayerRequest(playerId, PlayingRole.BATSMAN);

        assertThatThrownBy(() -> service.addPlayer(authentication, clubId, matchId, matchSide.getId(), request))
                .isInstanceOf(PlayerNotInSquadException.class);
        verify(teamSquadMemberRepository, never())
                .existsByTeamIdAndSeasonIdAndPlayerProfileId(teamId, otherSeasonId, playerId);
    }

    @Test
    void addPlayerAlreadyOnTheSideThrowsConflictException() {
        UUID clubId = UUID.randomUUID();
        UUID matchId = UUID.randomUUID();
        UUID teamId = UUID.randomUUID();
        UUID seasonId = UUID.randomUUID();
        UUID playerId = UUID.randomUUID();
        Match match = matchWithoutLeague(clubId, matchId, teamId, UUID.randomUUID(), seasonId);
        MatchSide matchSide = side(UUID.randomUUID(), matchId, teamId);
        when(matchRepository.findById(matchId)).thenReturn(Optional.of(match));
        when(matchSideRepository.findById(matchSide.getId())).thenReturn(Optional.of(matchSide));
        when(teamSquadMemberRepository.existsByTeamIdAndSeasonIdAndPlayerProfileId(teamId, seasonId, playerId))
                .thenReturn(true);
        when(matchSidePlayerRepository.existsByMatchSideIdAndPlayerProfileId(matchSide.getId(), playerId))
                .thenReturn(true);

        AddMatchSidePlayerRequest request = new AddMatchSidePlayerRequest(playerId, PlayingRole.BATSMAN);

        assertThatThrownBy(() -> service.addPlayer(authentication, clubId, matchId, matchSide.getId(), request))
                .isInstanceOf(ConflictException.class);
        verify(matchSidePlayerRepository, never()).save(any());
    }

    // --- addPlayer: cap ---

    @Test
    void addPlayerBeyondTheElevenFallbackCapWithNoLeagueThrowsPlayingXiCapExceededException() {
        UUID clubId = UUID.randomUUID();
        UUID matchId = UUID.randomUUID();
        UUID teamId = UUID.randomUUID();
        UUID seasonId = UUID.randomUUID();
        UUID playerId = UUID.randomUUID();
        Match match = matchWithoutLeague(clubId, matchId, teamId, UUID.randomUUID(), seasonId);
        MatchSide matchSide = side(UUID.randomUUID(), matchId, teamId);
        when(matchRepository.findById(matchId)).thenReturn(Optional.of(match));
        when(matchSideRepository.findById(matchSide.getId())).thenReturn(Optional.of(matchSide));
        when(teamSquadMemberRepository.existsByTeamIdAndSeasonIdAndPlayerProfileId(teamId, seasonId, playerId))
                .thenReturn(true);
        when(matchSidePlayerRepository.existsByMatchSideIdAndPlayerProfileId(matchSide.getId(), playerId))
                .thenReturn(false);
        when(matchSidePlayerRepository.countByMatchSideId(matchSide.getId())).thenReturn(11L);

        AddMatchSidePlayerRequest request = new AddMatchSidePlayerRequest(playerId, PlayingRole.BATSMAN);

        assertThatThrownBy(() -> service.addPlayer(authentication, clubId, matchId, matchSide.getId(), request))
                .isInstanceOf(PlayingXiCapExceededException.class);
        verify(matchSidePlayerRepository, never()).save(any());
    }

    @Test
    void addPlayerBeyondTheLeaguesConfiguredCapThrowsPlayingXiCapExceededException() {
        UUID clubId = UUID.randomUUID();
        UUID matchId = UUID.randomUUID();
        UUID teamId = UUID.randomUUID();
        UUID seasonId = UUID.randomUUID();
        UUID leagueId = UUID.randomUUID();
        UUID playerId = UUID.randomUUID();
        Match match = matchWithLeague(clubId, matchId, teamId, UUID.randomUUID(), seasonId, leagueId);
        MatchSide matchSide = side(UUID.randomUUID(), matchId, teamId);
        League league = League.builder().id(leagueId).clubId(clubId).name("Vets League")
                .source(LeagueSource.INTERNAL).maxPlayingXiSize(12).active(true).build();
        when(matchRepository.findById(matchId)).thenReturn(Optional.of(match));
        when(matchSideRepository.findById(matchSide.getId())).thenReturn(Optional.of(matchSide));
        when(teamSquadMemberRepository.existsByTeamIdAndSeasonIdAndPlayerProfileId(teamId, seasonId, playerId))
                .thenReturn(true);
        when(matchSidePlayerRepository.existsByMatchSideIdAndPlayerProfileId(matchSide.getId(), playerId))
                .thenReturn(false);
        when(leagueRepository.findById(leagueId)).thenReturn(Optional.of(league));
        when(matchSidePlayerRepository.countByMatchSideId(matchSide.getId())).thenReturn(12L);

        AddMatchSidePlayerRequest request = new AddMatchSidePlayerRequest(playerId, PlayingRole.BATSMAN);

        assertThatThrownBy(() -> service.addPlayer(authentication, clubId, matchId, matchSide.getId(), request))
                .isInstanceOf(PlayingXiCapExceededException.class);
    }

    // --- addPlayer: age eligibility ---

    @Test
    void addPlayerWithNoRecordedDateOfBirthToAnAgeRestrictedLeagueThrowsPlayerAgeIneligibleException() {
        UUID clubId = UUID.randomUUID();
        UUID matchId = UUID.randomUUID();
        UUID teamId = UUID.randomUUID();
        UUID seasonId = UUID.randomUUID();
        UUID leagueId = UUID.randomUUID();
        UUID playerId = UUID.randomUUID();
        Match match = matchWithLeague(clubId, matchId, teamId, UUID.randomUUID(), seasonId, leagueId);
        MatchSide matchSide = side(UUID.randomUUID(), matchId, teamId);
        League league = League.builder().id(leagueId).clubId(clubId).name("U15s")
                .source(LeagueSource.INTERNAL).maxPlayingXiSize(11).minAge(13).maxAge(15).active(true).build();
        when(matchRepository.findById(matchId)).thenReturn(Optional.of(match));
        when(matchSideRepository.findById(matchSide.getId())).thenReturn(Optional.of(matchSide));
        when(teamSquadMemberRepository.existsByTeamIdAndSeasonIdAndPlayerProfileId(teamId, seasonId, playerId))
                .thenReturn(true);
        when(matchSidePlayerRepository.existsByMatchSideIdAndPlayerProfileId(matchSide.getId(), playerId))
                .thenReturn(false);
        when(leagueRepository.findById(leagueId)).thenReturn(Optional.of(league));
        when(matchSidePlayerRepository.countByMatchSideId(matchSide.getId())).thenReturn(0L);
        stubAgeCheckPlayer(playerId, null);

        AddMatchSidePlayerRequest request = new AddMatchSidePlayerRequest(playerId, PlayingRole.BATSMAN);

        assertThatThrownBy(() -> service.addPlayer(authentication, clubId, matchId, matchSide.getId(), request))
                .isInstanceOf(PlayerAgeIneligibleException.class);
        verify(matchSidePlayerRepository, never()).save(any());
    }

    @Test
    void addPlayerOutsideTheLeaguesAgeRangeUsingTheLeaguesOwnCutoffDateThrowsPlayerAgeIneligibleException() {
        UUID clubId = UUID.randomUUID();
        UUID matchId = UUID.randomUUID();
        UUID teamId = UUID.randomUUID();
        UUID seasonId = UUID.randomUUID();
        UUID leagueId = UUID.randomUUID();
        UUID playerId = UUID.randomUUID();
        Match match = matchWithLeague(clubId, matchId, teamId, UUID.randomUUID(), seasonId, leagueId);
        MatchSide matchSide = side(UUID.randomUUID(), matchId, teamId);
        League league = League.builder().id(leagueId).clubId(clubId).name("U15s")
                .source(LeagueSource.INTERNAL).maxPlayingXiSize(11).minAge(13).maxAge(15)
                .ageCutoffDate(LocalDate.of(2026, 12, 31)).active(true).build();
        when(matchRepository.findById(matchId)).thenReturn(Optional.of(match));
        when(matchSideRepository.findById(matchSide.getId())).thenReturn(Optional.of(matchSide));
        when(teamSquadMemberRepository.existsByTeamIdAndSeasonIdAndPlayerProfileId(teamId, seasonId, playerId))
                .thenReturn(true);
        when(matchSidePlayerRepository.existsByMatchSideIdAndPlayerProfileId(matchSide.getId(), playerId))
                .thenReturn(false);
        when(leagueRepository.findById(leagueId)).thenReturn(Optional.of(league));
        when(matchSidePlayerRepository.countByMatchSideId(matchSide.getId())).thenReturn(0L);
        // 17 years old as of the league's own cutoff date — above maxAge of 15.
        stubAgeCheckPlayer(playerId, LocalDate.of(2009, 6, 1));

        AddMatchSidePlayerRequest request = new AddMatchSidePlayerRequest(playerId, PlayingRole.BATSMAN);

        assertThatThrownBy(() -> service.addPlayer(authentication, clubId, matchId, matchSide.getId(), request))
                .isInstanceOf(PlayerAgeIneligibleException.class);
        verify(seasonRepository, never()).findById(any());
    }

    @Test
    void addPlayerWithinRangeUsingTheSeasonsStartDateAsFallbackCutoffSucceeds() {
        UUID clubId = UUID.randomUUID();
        UUID matchId = UUID.randomUUID();
        UUID teamId = UUID.randomUUID();
        UUID seasonId = UUID.randomUUID();
        UUID leagueId = UUID.randomUUID();
        UUID playerId = UUID.randomUUID();
        Match match = matchWithLeague(clubId, matchId, teamId, UUID.randomUUID(), seasonId, leagueId);
        MatchSide matchSide = side(UUID.randomUUID(), matchId, teamId);
        League league = League.builder().id(leagueId).clubId(clubId).name("U15s")
                .source(LeagueSource.INTERNAL).maxPlayingXiSize(11).minAge(13).maxAge(15).active(true).build();
        Season season = Season.builder().id(seasonId).clubId(clubId).label("2026")
                .startDate(LocalDate.of(2026, 1, 1)).endDate(LocalDate.of(2026, 12, 31)).active(true).build();
        when(matchRepository.findById(matchId)).thenReturn(Optional.of(match));
        when(matchSideRepository.findById(matchSide.getId())).thenReturn(Optional.of(matchSide));
        when(teamSquadMemberRepository.existsByTeamIdAndSeasonIdAndPlayerProfileId(teamId, seasonId, playerId))
                .thenReturn(true);
        when(matchSidePlayerRepository.existsByMatchSideIdAndPlayerProfileId(matchSide.getId(), playerId))
                .thenReturn(false);
        when(leagueRepository.findById(leagueId)).thenReturn(Optional.of(league));
        when(matchSidePlayerRepository.countByMatchSideId(matchSide.getId())).thenReturn(0L);
        when(seasonRepository.findById(seasonId)).thenReturn(Optional.of(season));
        // 14 years old as of the season's own start date (2026-01-01).
        stubAgeCheckPlayer(playerId, LocalDate.of(2011, 6, 1));
        when(matchSidePlayerRepository.findByMatchSideIdOrderByBattingOrderAsc(matchSide.getId()))
                .thenReturn(List.of());

        AddMatchSidePlayerRequest request = new AddMatchSidePlayerRequest(playerId, PlayingRole.BATSMAN);

        service.addPlayer(authentication, clubId, matchId, matchSide.getId(), request);

        verify(matchSidePlayerRepository).save(any(MatchSidePlayer.class));
    }

    // --- updateSide: captain/keeper/twelfth man ---

    @Test
    void updateSideWithCaptainNotInTheOrderedXiThrowsValidationException() {
        UUID clubId = UUID.randomUUID();
        UUID matchId = UUID.randomUUID();
        UUID teamId = UUID.randomUUID();
        UUID captainId = UUID.randomUUID();
        Match match = matchWithoutLeague(clubId, matchId, teamId, UUID.randomUUID(), UUID.randomUUID());
        MatchSide matchSide = side(UUID.randomUUID(), matchId, teamId);
        when(matchRepository.findById(matchId)).thenReturn(Optional.of(match));
        when(matchSideRepository.findById(matchSide.getId())).thenReturn(Optional.of(matchSide));
        when(matchSidePlayerRepository.existsByMatchSideIdAndPlayerProfileId(matchSide.getId(), captainId))
                .thenReturn(false);

        UpdateMatchSideRequest request = new UpdateMatchSideRequest(captainId, null, null);

        assertThatThrownBy(() -> service.updateSide(authentication, clubId, matchId, matchSide.getId(), request))
                .isInstanceOf(ValidationException.class);
        verify(matchSideRepository, never()).save(any());
    }

    @Test
    void updateSideWithTwelfthManAlreadyInTheOrderedXiThrowsValidationException() {
        UUID clubId = UUID.randomUUID();
        UUID matchId = UUID.randomUUID();
        UUID teamId = UUID.randomUUID();
        UUID twelfthManId = UUID.randomUUID();
        Match match = matchWithoutLeague(clubId, matchId, teamId, UUID.randomUUID(), UUID.randomUUID());
        MatchSide matchSide = side(UUID.randomUUID(), matchId, teamId);
        when(matchRepository.findById(matchId)).thenReturn(Optional.of(match));
        when(matchSideRepository.findById(matchSide.getId())).thenReturn(Optional.of(matchSide));
        when(matchSidePlayerRepository.existsByMatchSideIdAndPlayerProfileId(matchSide.getId(), twelfthManId))
                .thenReturn(true);

        UpdateMatchSideRequest request = new UpdateMatchSideRequest(null, null, twelfthManId);

        assertThatThrownBy(() -> service.updateSide(authentication, clubId, matchId, matchSide.getId(), request))
                .isInstanceOf(ValidationException.class);
        verify(matchSideRepository, never()).save(any());
    }

    @Test
    void updateSideWithATwelfthManNotInTheSquadThrowsPlayerNotInSquadException() {
        UUID clubId = UUID.randomUUID();
        UUID matchId = UUID.randomUUID();
        UUID teamId = UUID.randomUUID();
        UUID seasonId = UUID.randomUUID();
        UUID twelfthManId = UUID.randomUUID();
        Match match = matchWithoutLeague(clubId, matchId, teamId, UUID.randomUUID(), seasonId);
        MatchSide matchSide = side(UUID.randomUUID(), matchId, teamId);
        when(matchRepository.findById(matchId)).thenReturn(Optional.of(match));
        when(matchSideRepository.findById(matchSide.getId())).thenReturn(Optional.of(matchSide));
        when(matchSidePlayerRepository.existsByMatchSideIdAndPlayerProfileId(matchSide.getId(), twelfthManId))
                .thenReturn(false);
        when(teamSquadMemberRepository.existsByTeamIdAndSeasonIdAndPlayerProfileId(teamId, seasonId, twelfthManId))
                .thenReturn(false);

        UpdateMatchSideRequest request = new UpdateMatchSideRequest(null, null, twelfthManId);

        assertThatThrownBy(() -> service.updateSide(authentication, clubId, matchId, matchSide.getId(), request))
                .isInstanceOf(PlayerNotInSquadException.class);
    }

    @Test
    void updateSideWithValidCaptainKeeperAndTwelfthManSucceeds() {
        UUID clubId = UUID.randomUUID();
        UUID matchId = UUID.randomUUID();
        UUID teamId = UUID.randomUUID();
        UUID seasonId = UUID.randomUUID();
        UUID captainId = UUID.randomUUID();
        UUID keeperId = UUID.randomUUID();
        UUID twelfthManId = UUID.randomUUID();
        Match match = matchWithoutLeague(clubId, matchId, teamId, UUID.randomUUID(), seasonId);
        MatchSide matchSide = side(UUID.randomUUID(), matchId, teamId);
        when(matchRepository.findById(matchId)).thenReturn(Optional.of(match));
        when(matchSideRepository.findById(matchSide.getId())).thenReturn(Optional.of(matchSide));
        when(matchSidePlayerRepository.existsByMatchSideIdAndPlayerProfileId(matchSide.getId(), captainId))
                .thenReturn(true);
        when(matchSidePlayerRepository.existsByMatchSideIdAndPlayerProfileId(matchSide.getId(), keeperId))
                .thenReturn(true);
        when(matchSidePlayerRepository.existsByMatchSideIdAndPlayerProfileId(matchSide.getId(), twelfthManId))
                .thenReturn(false);
        when(teamSquadMemberRepository.existsByTeamIdAndSeasonIdAndPlayerProfileId(teamId, seasonId, twelfthManId))
                .thenReturn(true);
        when(matchSideRepository.save(matchSide)).thenReturn(matchSide);
        when(matchSidePlayerRepository.findByMatchSideIdOrderByBattingOrderAsc(matchSide.getId()))
                .thenReturn(List.of());

        UpdateMatchSideRequest request = new UpdateMatchSideRequest(captainId, keeperId, twelfthManId);
        service.updateSide(authentication, clubId, matchId, matchSide.getId(), request);

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

        service.removePlayer(authentication, clubId, matchId, matchSide.getId(), playerId);

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

        assertThatThrownBy(() -> service.removePlayer(authentication, clubId, matchId, matchSide.getId(), playerId))
                .isInstanceOf(NotFoundException.class);
        verify(matchSidePlayerRepository, never()).deleteByMatchSideIdAndPlayerProfileId(any(), any());
    }

    // --- reorderPlayers ---

    @Test
    void reorderWithASetNotMatchingTheSidesCurrentPlayersThrowsValidationException() {
        UUID clubId = UUID.randomUUID();
        UUID matchId = UUID.randomUUID();
        UUID teamId = UUID.randomUUID();
        Match match = matchWithoutLeague(clubId, matchId, teamId, UUID.randomUUID(), UUID.randomUUID());
        MatchSide matchSide = side(UUID.randomUUID(), matchId, teamId);
        UUID playerAId = UUID.randomUUID();
        UUID playerBId = UUID.randomUUID();
        when(matchRepository.findById(matchId)).thenReturn(Optional.of(match));
        when(matchSideRepository.findById(matchSide.getId())).thenReturn(Optional.of(matchSide));
        when(matchSidePlayerRepository.findByMatchSideIdOrderByBattingOrderAsc(matchSide.getId()))
                .thenReturn(List.of(
                        MatchSidePlayer.builder().id(UUID.randomUUID()).matchSideId(matchSide.getId())
                                .playerProfileId(playerAId).battingOrder(1).role(PlayingRole.BATSMAN).build()));

        assertThatThrownBy(() -> service.reorderPlayers(authentication, clubId, matchId, matchSide.getId(),
                new com.cricketlegend.dto.ReorderMatchSidePlayersRequest(List.of(playerBId))))
                .isInstanceOf(ValidationException.class);
    }

    @Test
    void reorderWithTheExactCurrentPlayerSetReassignsBattingOrder() {
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
        when(matchSidePlayerRepository.save(any(MatchSidePlayer.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        service.reorderPlayers(authentication, clubId, matchId, matchSide.getId(),
                new com.cricketlegend.dto.ReorderMatchSidePlayersRequest(List.of(playerBId, playerAId)));

        assertThat(playerB.getBattingOrder()).isEqualTo(1);
        assertThat(playerA.getBattingOrder()).isEqualTo(2);
    }

    // --- 040: announce/unannounce ---

    @Test
    void announceASideWithAtLeastOnePlayerSetsAnnouncedTrue() {
        UUID clubId = UUID.randomUUID();
        UUID matchId = UUID.randomUUID();
        UUID teamId = UUID.randomUUID();
        Match match = matchWithoutLeague(clubId, matchId, teamId, UUID.randomUUID(), UUID.randomUUID());
        MatchSide matchSide = side(UUID.randomUUID(), matchId, teamId);
        when(matchRepository.findById(matchId)).thenReturn(Optional.of(match));
        when(matchSideRepository.findById(matchSide.getId())).thenReturn(Optional.of(matchSide));
        when(matchSidePlayerRepository.countByMatchSideId(matchSide.getId())).thenReturn(1L);
        when(matchSideRepository.save(matchSide)).thenReturn(matchSide);
        when(matchSidePlayerRepository.findByMatchSideIdOrderByBattingOrderAsc(matchSide.getId()))
                .thenReturn(List.of());

        service.announce(authentication, clubId, matchId, matchSide.getId());

        assertThat(matchSide.isAnnounced()).isTrue();
        verify(matchSideRepository).save(matchSide);
    }

    @Test
    void announceASideWithZeroPlayersThrowsValidationException() {
        UUID clubId = UUID.randomUUID();
        UUID matchId = UUID.randomUUID();
        UUID teamId = UUID.randomUUID();
        Match match = matchWithoutLeague(clubId, matchId, teamId, UUID.randomUUID(), UUID.randomUUID());
        MatchSide matchSide = side(UUID.randomUUID(), matchId, teamId);
        when(matchRepository.findById(matchId)).thenReturn(Optional.of(match));
        when(matchSideRepository.findById(matchSide.getId())).thenReturn(Optional.of(matchSide));
        when(matchSidePlayerRepository.countByMatchSideId(matchSide.getId())).thenReturn(0L);

        assertThatThrownBy(() -> service.announce(authentication, clubId, matchId, matchSide.getId()))
                .isInstanceOf(ValidationException.class);
        verify(matchSideRepository, never()).save(any());
    }

    @Test
    void announceOnAnUnknownSideThrowsNotFoundException() {
        UUID clubId = UUID.randomUUID();
        UUID matchId = UUID.randomUUID();
        UUID sideId = UUID.randomUUID();
        Match match = matchWithoutLeague(clubId, matchId, UUID.randomUUID(), UUID.randomUUID(), UUID.randomUUID());
        when(matchRepository.findById(matchId)).thenReturn(Optional.of(match));
        when(matchSideRepository.findById(sideId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.announce(authentication, clubId, matchId, sideId))
                .isInstanceOf(NotFoundException.class);
    }

    @Test
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
        UUID teamId = UUID.randomUUID();
        UUID seasonId = UUID.randomUUID();
        UUID playerId = UUID.randomUUID();
        Match match = matchWithoutLeague(clubId, matchId, teamId, UUID.randomUUID(), seasonId);
        MatchSide matchSide = side(UUID.randomUUID(), matchId, teamId);
        matchSide.setAnnounced(true);
        when(matchRepository.findById(matchId)).thenReturn(Optional.of(match));
        when(matchSideRepository.findById(matchSide.getId())).thenReturn(Optional.of(matchSide));
        when(teamSquadMemberRepository.existsByTeamIdAndSeasonIdAndPlayerProfileId(teamId, seasonId, playerId))
                .thenReturn(true);
        when(matchSidePlayerRepository.existsByMatchSideIdAndPlayerProfileId(matchSide.getId(), playerId))
                .thenReturn(false);
        when(matchSidePlayerRepository.countByMatchSideId(matchSide.getId())).thenReturn(0L);
        when(matchSidePlayerRepository.findByMatchSideIdOrderByBattingOrderAsc(matchSide.getId()))
                .thenReturn(List.of());
        when(matchSideRepository.save(matchSide)).thenReturn(matchSide);

        AddMatchSidePlayerRequest request = new AddMatchSidePlayerRequest(playerId, PlayingRole.BATSMAN);
        service.addPlayer(authentication, clubId, matchId, matchSide.getId(), request);

        assertThat(matchSide.isAnnounced()).isFalse();
        verify(matchSideRepository).save(matchSide);
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

        service.removePlayer(authentication, clubId, matchId, matchSide.getId(), playerId);

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

        service.removePlayer(authentication, clubId, matchId, matchSide.getId(), playerId);

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
        when(matchSidePlayerRepository.save(any(MatchSidePlayer.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));
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
        when(matchSidePlayerRepository.save(any(MatchSidePlayer.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

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
