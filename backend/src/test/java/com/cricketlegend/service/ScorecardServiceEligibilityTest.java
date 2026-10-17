package com.cricketlegend.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.cricketlegend.config.AccessService;
import com.cricketlegend.domain.Match;
import com.cricketlegend.domain.MatchResult;
import com.cricketlegend.domain.PlayerProfile;
import com.cricketlegend.domain.ResultIssueSeverity;
import com.cricketlegend.domain.ResultPlayer;
import com.cricketlegend.domain.ResultSide;
import com.cricketlegend.domain.ResultWizardStep;
import com.cricketlegend.dto.ResultDraft;
import com.cricketlegend.dto.ResultPlayerDto;
import com.cricketlegend.dto.ScorecardDto;
import com.cricketlegend.exception.InvalidResultException;
import com.cricketlegend.mapper.ScorecardMapper;
import com.cricketlegend.repository.BattingEntryRepository;
import com.cricketlegend.repository.BowlingEntryRepository;
import com.cricketlegend.repository.FieldingEntryRepository;
import com.cricketlegend.repository.LeaguePlayingConditionsRepository;
import com.cricketlegend.repository.LeagueRepository;
import com.cricketlegend.repository.MatchAwardRepository;
import com.cricketlegend.repository.MatchInningsRepository;
import com.cricketlegend.repository.MatchResultRepository;
import com.cricketlegend.repository.MatchSidePlayerRepository;
import com.cricketlegend.repository.MatchSideRepository;
import com.cricketlegend.repository.PlayerProfileRepository;
import com.cricketlegend.repository.ResultPlayerRepository;
import com.cricketlegend.repository.TeamRepository;
import com.cricketlegend.repository.TeamSquadMemberRepository;
import com.cricketlegend.service.impl.ScorecardServiceImpl;
import com.cricketlegend.service.support.NameAliases;
import com.cricketlegend.service.support.ResultPlayerEligibility;
import com.cricketlegend.service.support.ResultPlayerEligibility.Problem;
import com.cricketlegend.service.support.ResultValidator.ErrorCode;
import com.cricketlegend.service.support.ScorecardContext;
import com.cricketlegend.service.support.SelectionEligibility;
import com.cricketlegend.service.support.SelectionEligibility.PlayerInfo;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mapstruct.factory.Mappers;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.core.Authentication;

/**
 * docs/specs/113 Test Plan, service tier: {@link ScorecardServiceImpl} refuses a NEWLY ADDED registered player of one of
 * our sides who fails {@link ResultPlayerEligibility} (in {@code replace}, {@code replaceImported} and {@code link}),
 * accepts the same player when already stored, never checks guests or the opposition, and carries the problems in the
 * validation context. The eligibility rule itself is covered in {@code ResultPlayerEligibilityTest}.
 */
class ScorecardServiceEligibilityTest {

    private static final String SECTION_MESSAGE = "Bad Player is not in the Seniors section.";

    private final MatchResultRepository resultRepository = mock(MatchResultRepository.class);
    private final MatchInningsRepository inningsRepository = mock(MatchInningsRepository.class);
    private final ResultPlayerRepository playerRepository = mock(ResultPlayerRepository.class);
    private final PlayerProfileRepository playerProfileRepository = mock(PlayerProfileRepository.class);
    private final SelectionEligibility eligibility = mock(SelectionEligibility.class);
    private final AccessService accessService = mock(AccessService.class);
    private final MatchService matchService = mock(MatchService.class);
    private final ResultPlayerEligibility playerEligibility = mock(ResultPlayerEligibility.class);

    private ScorecardServiceImpl service;
    private final UUID clubId = UUID.randomUUID();
    private final UUID matchId = UUID.randomUUID();
    private final UUID resultId = UUID.randomUUID();
    private final UUID badId = UUID.randomUUID();
    private final UUID goodId = UUID.randomUUID();
    private final UUID personId = UUID.randomUUID();
    private final Authentication auth = new TestingAuthenticationToken("manager", "n/a");
    private final Match match = Match.builder().id(matchId).clubId(clubId).homeTeamId(UUID.randomUUID()).build();

    @BeforeEach
    void setUp() {
        service = new ScorecardServiceImpl(matchService, resultRepository, inningsRepository, playerRepository,
                mock(BattingEntryRepository.class), mock(BowlingEntryRepository.class), mock(FieldingEntryRepository.class),
                mock(MatchAwardRepository.class), mock(MatchSideRepository.class), mock(MatchSidePlayerRepository.class),
                mock(TeamRepository.class), mock(TeamSquadMemberRepository.class), playerProfileRepository,
                mock(LeaguePlayingConditionsRepository.class), eligibility, Mappers.getMapper(ScorecardMapper.class),
                accessService, mock(NameAliases.class), mock(LeagueRepository.class), playerEligibility);
        MatchResult result = MatchResult.builder().id(resultId).clubId(clubId).matchId(matchId).source("MANUAL").build();
        when(resultRepository.findById(resultId)).thenReturn(Optional.of(result));
        when(resultRepository.findByMatchId(matchId)).thenReturn(Optional.of(result));
        when(matchService.requireAdministrableMatch(any(), any(), any())).thenReturn(match);
        when(inningsRepository.findByMatchResultIdOrderBySequence(resultId)).thenReturn(List.of());
        when(playerRepository.findByMatchResultIdOrderByCreatedAtAscIdAsc(resultId)).thenReturn(List.of());
        when(playerRepository.saveAll(anyCollection())).thenAnswer(inv -> {
            List<ResultPlayer> rows = new ArrayList<>(inv.getArgument(0));
            rows.stream().filter(p -> p.getId() == null).forEach(p -> p.setId(UUID.randomUUID()));
            return rows;
        });
        when(playerRepository.saveAndFlush(any(ResultPlayer.class))).thenAnswer(inv -> inv.getArgument(0));
        when(playerProfileRepository.findAllById(anyCollection())).thenAnswer(inv -> {
            List<PlayerProfile> profiles = new ArrayList<>();
            for (Object id : (Iterable<?>) inv.getArgument(0)) {
                profiles.add(PlayerProfile.builder().id((UUID) id).clubId(clubId).build());
            }
            return profiles;
        });
        when(playerProfileRepository.findById(any())).thenAnswer(inv ->
                Optional.of(PlayerProfile.builder().id(inv.getArgument(0)).clubId(clubId).build()));
        when(eligibility.loadPlayers(anyCollection())).thenReturn(Map.of(
                badId, new PlayerInfo(badId, clubId, true, "Bad", "Player", null, null),
                goodId, new PlayerInfo(goodId, clubId, true, "Good", "Player", null, null)));
        when(accessService.resolveCurrentPersonId(auth)).thenReturn(personId);
        // the rule: badId is outside the section, goodId is fine
        org.mockito.stubbing.Answer<Map<ResultSide, Map<UUID, List<Problem>>>> rule = inv -> {
            Map<ResultSide, Set<UUID>> asked = new java.util.EnumMap<>(ResultSide.class);
            Map<ResultSide, ? extends Collection<UUID>> idsBySide = inv.getArgument(1);
            idsBySide.forEach((side, ids) -> asked.put(side, new HashSet<>(ids)));
            Map<ResultSide, Map<UUID, List<Problem>>> out = new java.util.EnumMap<>(ResultSide.class);
            asked.forEach((side, ids) -> {
                if (ids.contains(badId)) {
                    out.put(side, Map.of(badId, List.of(new Problem(ErrorCode.PLAYER_NOT_IN_SECTION, SECTION_MESSAGE))));
                }
            });
            return out;
        };
        when(playerEligibility.check(any(), any())).thenAnswer(rule);
        when(playerEligibility.check(any(), any(), any())).thenAnswer(rule);
    }

    private static ResultPlayerDto registered(UUID id, UUID profile, boolean substitute) {
        return new ResultPlayerDto(id, id == null ? "p-" + profile : null, ResultSide.HOME, profile, null, null, null,
                substitute, false, null, null, false, null, null);
    }

    private static ResultPlayerDto guest() {
        return new ResultPlayerDto(null, "g1", ResultSide.HOME, null, "Sam Guest", null, null, false, false, null, null,
                true, null, null);
    }

    private static ResultPlayerDto opposition() {
        return new ResultPlayerDto(null, "o1", ResultSide.AWAY, null, "Rob Brown", null, null, false, true, null, null,
                false, null, null);
    }

    private static ScorecardDto card(ResultPlayerDto... players) {
        return new ScorecardDto(List.of(players), null, null, null, null, null, null);
    }

    private ResultPlayer stored(UUID id, UUID profile) {
        return ResultPlayer.builder().id(id).matchResultId(resultId).side(ResultSide.HOME).playerProfileId(profile).build();
    }

    private void assertRefused(Runnable save) {
        assertThatThrownBy(save::run).isInstanceOfSatisfying(InvalidResultException.class, e -> {
            assertThat(e.getErrors()).containsExactly(SECTION_MESSAGE);
            assertThat(e.getIssues()).singleElement().satisfies(issue -> {
                assertThat(issue.code()).isEqualTo("PLAYER_NOT_IN_SECTION");
                assertThat(issue.step()).isEqualTo(ResultWizardStep.TEAMS);
                assertThat(issue.side()).isEqualTo(ResultSide.HOME);
                assertThat(issue.severity()).isEqualTo(ResultIssueSeverity.ERROR);
            });
        });
    }

    // ---- replace (the wizard save) ----

    @Test
    void replaceRefusesANewlyAddedPlayerWhoFailsTheRule() {
        assertRefused(() -> service.replace(resultId, clubId, match, card(registered(null, badId, false)), personId));

        verify(playerRepository, never()).saveAll(anyCollection());
    }

    @Test
    void replaceAcceptsANewlyAddedPlayerWhoPasses() {
        service.replace(resultId, clubId, match, card(registered(null, goodId, false)), personId);

        verify(playerRepository).saveAll(anyCollection());
    }

    @Test
    void replaceAcceptsTheSamePlayerWhenAlreadyStoredOnThatSide() {
        UUID rowId = UUID.randomUUID();
        when(playerRepository.findByMatchResultIdOrderByCreatedAtAscIdAsc(resultId))
                .thenReturn(List.of(stored(rowId, badId)));

        service.replace(resultId, clubId, match, card(registered(rowId, badId, false)), personId);

        verify(playerEligibility, never()).check(any(), any());
        verify(playerRepository).saveAll(anyCollection());
    }

    @Test
    void replaceChecksAPlayerWhoWasStoredOnlyOnTheOtherSide() {
        UUID rowId = UUID.randomUUID();
        ResultPlayer onAway = ResultPlayer.builder().id(rowId).matchResultId(resultId).side(ResultSide.AWAY)
                .playerProfileId(badId).build();
        when(playerRepository.findByMatchResultIdOrderByCreatedAtAscIdAsc(resultId)).thenReturn(List.of(onAway));

        assertRefused(() -> service.replace(resultId, clubId, match,
                card(registered(null, badId, false), opposition()), personId));
    }

    @Test
    void replaceRefusesAFlaggedRegisteredSubstituteToo() {
        assertRefused(() -> service.replace(resultId, clubId, match, card(registered(null, badId, true)), personId));
    }

    @Test
    void replaceNeverChecksGuestsOrTheOpposition() {
        service.replace(resultId, clubId, match, card(guest(), opposition()), personId);

        verify(playerEligibility, never()).check(any(), any());
    }

    @Test
    void replaceChecksOnlyTheNewlyAddedPlayersWhenSomeAreStored() {
        UUID rowId = UUID.randomUUID();
        when(playerRepository.findByMatchResultIdOrderByCreatedAtAscIdAsc(resultId))
                .thenReturn(List.of(stored(rowId, badId)));

        service.replace(resultId, clubId, match,
                card(registered(rowId, badId, false), registered(null, goodId, false)), personId);

        org.mockito.ArgumentCaptor<Map<ResultSide, Set<UUID>>> asked = org.mockito.ArgumentCaptor.forClass(Map.class);
        verify(playerEligibility).check(any(), asked.capture());
        assertThat(asked.getValue()).containsOnlyKeys(ResultSide.HOME);
        assertThat(asked.getValue().get(ResultSide.HOME)).containsExactly(goodId);
    }

    // ---- replaceImported ----

    @Test
    void replaceImportedRefusesANewlyAddedPlayerWhoFailsTheRule() {
        assertRefused(() -> service.replaceImported(
                resultId, clubId, match, card(registered(null, badId, false)), personId));
    }

    @Test
    void replaceImportedAcceptsAPlayerWhoAlreadyHadARowOnThatSide() {
        UUID rowId = UUID.randomUUID();
        when(playerRepository.findByMatchResultIdOrderByCreatedAtAscIdAsc(resultId))
                .thenReturn(List.of(stored(rowId, badId)));

        service.replaceImported(resultId, clubId, match, card(registered(rowId, badId, false)), personId);

        verify(playerEligibility, never()).check(any(), any());
    }

    // ---- link ----

    @Test
    void linkRefusesAGuestBecomingAPlayerWhoFailsTheRule() {
        UUID rowId = UUID.randomUUID();
        ResultPlayer guestRow = stored(rowId, null);
        when(playerRepository.findById(rowId)).thenReturn(Optional.of(guestRow));

        assertRefused(() -> service.link(auth, clubId, matchId, rowId, badId));

        assertThat(guestRow.getPlayerProfileId()).isNull();
        verify(playerRepository, never()).saveAndFlush(any(ResultPlayer.class));
    }

    @Test
    void linkAcceptsAGuestBecomingAPlayerWhoPasses() {
        UUID rowId = UUID.randomUUID();
        ResultPlayer guestRow = stored(rowId, null);
        when(playerRepository.findById(rowId)).thenReturn(Optional.of(guestRow));

        service.link(auth, clubId, matchId, rowId, goodId);

        assertThat(guestRow.getPlayerProfileId()).isEqualTo(goodId);
    }

    // ---- validation context ----

    @Test
    void theValidationContextCarriesTheProblemsOfEveryRegisteredPlayerOfOurSides() {
        ScorecardDto scorecard = card(registered(UUID.randomUUID(), badId, false), registered(UUID.randomUUID(), goodId, false),
                guest(), opposition());
        ResultDraft draft = new ResultDraft(null, null, null, null, null, null, null, null, null, null, null, null, null,
                List.of(), scorecard);

        ScorecardContext context = service.validationContext(match, draft);

        assertThat(context.eligibilityProblems()).containsOnlyKeys(ResultSide.HOME);
        assertThat(context.eligibilityProblems().get(ResultSide.HOME)).containsOnlyKeys(badId);
        verify(playerEligibility).check(any(), any(), any());
    }
}
