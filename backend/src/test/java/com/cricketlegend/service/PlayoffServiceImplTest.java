package com.cricketlegend.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.cricketlegend.dto.CreateMatchRequest;
import com.cricketlegend.dto.CreatePlayoffsRequest;
import com.cricketlegend.dto.MatchDto;
import com.cricketlegend.dto.PlayoffGameRequest;
import com.cricketlegend.dto.PlayoffSideRequest;
import com.cricketlegend.exception.ValidationException;
import com.cricketlegend.service.impl.PlayoffServiceImpl;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.core.Authentication;

/**
 * docs/specs/155-playoff-and-knockout-fixtures.md: a round becomes ordinary create-match requests handed to
 * {@link MatchService#createBatch}, so every normal match rule applies. The preview's rollback needs a real transaction and is
 * proved in PlayoffControllerIntegrationTest.
 */
@ExtendWith(MockitoExtension.class)
class PlayoffServiceImplTest {

    @Mock
    private MatchService matchService;

    private PlayoffServiceImpl service;
    private final Authentication authentication = new TestingAuthenticationToken("manager", null);
    private final UUID clubId = UUID.randomUUID();
    private final UUID leagueId = UUID.randomUUID();
    private final UUID seasonId = UUID.randomUUID();
    private final Instant when = Instant.parse("2026-11-21T08:00:00Z");

    @BeforeEach
    void setUp() {
        service = new PlayoffServiceImpl(matchService);
    }

    private PlayoffGameRequest game(String stage, String label, PlayoffSideRequest home, PlayoffSideRequest away) {
        return new PlayoffGameRequest(stage, label, home, away, when, "Durbanville CC B", null);
    }

    private PlayoffSideRequest tbc(String text) {
        return new PlayoffSideRequest(text, null, null);
    }

    @SuppressWarnings("unchecked")
    private List<CreateMatchRequest> created(CreatePlayoffsRequest request) {
        when(matchService.createBatch(any(), any(), any())).thenReturn(List.of());
        service.create(authentication, clubId, leagueId, seasonId, request);
        ArgumentCaptor<List<CreateMatchRequest>> captor = ArgumentCaptor.forClass(List.class);
        verify(matchService).createBatch(eq(authentication), eq(clubId), captor.capture());
        return captor.getValue();
    }

    @Test
    void everyGameBecomesAMatchRequestInTheLeagueAndSeasonWithTheRoundsTrimmedStage() {
        List<CreateMatchRequest> requests = created(new CreatePlayoffsRequest(
                "  Playoff ", List.of(game(null, "1st v 2nd", tbc("1st in the pool"), tbc("2nd in the pool")),
                        game("  ", "3rd v 4th", tbc("3rd in the pool"), tbc("4th in the pool"))), null));

        assertThat(requests).hasSize(2);
        assertThat(requests).allSatisfy(request -> {
            assertThat(request.leagueId()).isEqualTo(leagueId);
            assertThat(request.seasonId()).isEqualTo(seasonId);
            assertThat(request.stage()).isEqualTo("Playoff");
            assertThat(request.matchDate()).isEqualTo(when);
            assertThat(request.venue()).isEqualTo("Durbanville CC B");
        });
        assertThat(requests.get(0).stageLabel()).isEqualTo("1st v 2nd");
    }

    @Test
    void aTbcSideIsSentAsATrimmedPlaceholderWithNoTeam() {
        CreateMatchRequest request = created(new CreatePlayoffsRequest(
                "Playoff", List.of(game(null, null, tbc("  1st in the pool "), tbc("2nd in the pool"))), null)).get(0);

        assertThat(request.homePlaceholder()).isTrue();
        assertThat(request.homeTeamName()).isEqualTo("1st in the pool");
        assertThat(request.homeTeamId()).isNull();
        assertThat(request.homeLeagueTeamId()).isNull();
        assertThat(request.awayPlaceholder()).isTrue();
    }

    @Test
    void aRealTeamOrLeagueTeamSideIsSentWithTheFlagOffAndNoName() {
        UUID ourTeam = UUID.randomUUID();
        UUID leagueTeam = UUID.randomUUID();
        CreateMatchRequest request = created(new CreatePlayoffsRequest(
                "Playoff", List.of(game(null, null, new PlayoffSideRequest(null, ourTeam, null), new PlayoffSideRequest(null, null, leagueTeam))), null)).get(0);

        assertThat(request.homeTeamId()).isEqualTo(ourTeam);
        assertThat(request.homePlaceholder()).isFalse();
        assertThat(request.homeTeamName()).isNull();
        assertThat(request.awayLeagueTeamId()).isEqualTo(leagueTeam);
        assertThat(request.awayPlaceholder()).isFalse();
    }

    @Test
    void aGamesOwnStageOverridesTheRounds() {
        List<CreateMatchRequest> requests = created(new CreatePlayoffsRequest(
                "Semi-final", List.of(game(null, "SF1", tbc("1st"), tbc("4th")), game(" Final ", "Final", tbc("W SF1"), tbc("W SF2"))), null));

        assertThat(requests.get(0).stage()).isEqualTo("Semi-final");
        assertThat(requests.get(1).stage()).isEqualTo("Final");
    }

    @Test
    void acknowledgedWarningsAreCarriedToEveryMatchRequest() {
        List<CreateMatchRequest> requests = created(new CreatePlayoffsRequest(
                "Playoff", List.of(game(null, null, tbc("a"), tbc("b"))), List.of("warning-key")));

        assertThat(requests.get(0).acknowledgedWarnings()).containsExactly("warning-key");
    }

    @Test
    void aSideWithNeitherTextNorTeamIsRefusedAndNothingIsCreated() {
        CreatePlayoffsRequest request = new CreatePlayoffsRequest("Playoff", List.of(game(null, null, new PlayoffSideRequest("  ", null, null), tbc("b"))), null);

        assertThatThrownBy(() -> service.create(authentication, clubId, leagueId, seasonId, request))
                .isInstanceOf(ValidationException.class)
                .hasMessageContaining("home");
        verify(matchService, never()).createBatch(any(), any(), any());
    }

    @Test
    void aSideWithTextAndATeamIsRefused() {
        CreatePlayoffsRequest request = new CreatePlayoffsRequest(
                "Playoff", List.of(game(null, null, tbc("a"), new PlayoffSideRequest("b", UUID.randomUUID(), null))), null);

        assertThatThrownBy(() -> service.create(authentication, clubId, leagueId, seasonId, request))
                .isInstanceOf(ValidationException.class)
                .hasMessageContaining("away");
        verify(matchService, never()).createBatch(any(), any(), any());
    }

    @Test
    void theCreatedMatchesAreReturnedAsTheServiceMadeThem() {
        MatchDto dto = org.mockito.Mockito.mock(MatchDto.class);
        when(matchService.createBatch(any(), any(), any())).thenReturn(List.of(dto));

        assertThat(service.create(authentication, clubId, leagueId, seasonId,
                new CreatePlayoffsRequest("Playoff", List.of(game(null, null, tbc("a"), tbc("b"))), null))).containsExactly(dto);
    }
}
