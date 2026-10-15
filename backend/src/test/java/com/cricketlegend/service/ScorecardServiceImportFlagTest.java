package com.cricketlegend.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.cricketlegend.config.AccessService;
import com.cricketlegend.domain.ImportMatchLevel;
import com.cricketlegend.domain.Match;
import com.cricketlegend.domain.MatchResult;
import com.cricketlegend.domain.NameAliasKind;
import com.cricketlegend.domain.PlayerProfile;
import com.cricketlegend.domain.ResultPlayer;
import com.cricketlegend.domain.ResultSide;
import com.cricketlegend.dto.ResultPlayerDto;
import com.cricketlegend.dto.ScorecardDto;
import com.cricketlegend.mapper.ScorecardMapper;
import com.cricketlegend.repository.BattingEntryRepository;
import com.cricketlegend.repository.BowlingEntryRepository;
import com.cricketlegend.repository.FieldingEntryRepository;
import com.cricketlegend.repository.LeaguePlayingConditionsRepository;
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
import com.cricketlegend.service.support.SelectionEligibility;
import com.cricketlegend.service.support.SelectionEligibility.PlayerInfo;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mapstruct.factory.Mappers;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.core.Authentication;

/**
 * docs/specs/104 Test Plan: the {@code import_match} guess flag rules and the alias writing in {@link
 * ScorecardServiceImpl}, with mocks and the real mapper. A client can only keep or clear a stored flag, never set or
 * raise one; confirming, swapping, linking or removing the row clears it; a confirmed or changed spelling of an
 * imported draft is remembered for the club, a manual result never writes one, and a platform admin with no person
 * writes one with a null creator. The alias store itself is covered in {@code NameAliasesTest}.
 */
class ScorecardServiceImportFlagTest {

    private final MatchResultRepository resultRepository = mock(MatchResultRepository.class);
    private final MatchInningsRepository inningsRepository = mock(MatchInningsRepository.class);
    private final ResultPlayerRepository playerRepository = mock(ResultPlayerRepository.class);
    private final PlayerProfileRepository playerProfileRepository = mock(PlayerProfileRepository.class);
    private final SelectionEligibility eligibility = mock(SelectionEligibility.class);
    private final AccessService accessService = mock(AccessService.class);
    private final NameAliases nameAliases = mock(NameAliases.class);
    private final MatchService matchService = mock(MatchService.class);

    private ScorecardServiceImpl service;
    private final UUID clubId = UUID.randomUUID();
    private final UUID matchId = UUID.randomUUID();
    private final UUID resultId = UUID.randomUUID();
    private final UUID abelId = UUID.randomUUID();
    private final UUID ceesId = UUID.randomUUID();
    private final UUID personId = UUID.randomUUID();
    private final Authentication auth = new TestingAuthenticationToken("manager", "n/a");
    private final Match match = Match.builder().id(matchId).clubId(clubId).homeTeamId(UUID.randomUUID()).build();
    private MatchResult result;

    @BeforeEach
    void setUp() {
        service = new ScorecardServiceImpl(matchService, resultRepository, inningsRepository, playerRepository,
                mock(BattingEntryRepository.class), mock(BowlingEntryRepository.class), mock(FieldingEntryRepository.class),
                mock(MatchAwardRepository.class), mock(MatchSideRepository.class), mock(MatchSidePlayerRepository.class),
                mock(TeamRepository.class), mock(TeamSquadMemberRepository.class), playerProfileRepository,
                mock(LeaguePlayingConditionsRepository.class), eligibility, Mappers.getMapper(ScorecardMapper.class),
                accessService, nameAliases);
        result = MatchResult.builder().id(resultId).clubId(clubId).matchId(matchId).source("IMPORT:EXAMPLE").build();
        when(resultRepository.findById(resultId)).thenReturn(Optional.of(result));
        when(resultRepository.findByMatchId(matchId)).thenReturn(Optional.of(result));
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
                abelId, new PlayerInfo(abelId, clubId, true, "Abel", "Nazar", null, null),
                ceesId, new PlayerInfo(ceesId, clubId, true, "Cees", "Meyer", null, null)));
        when(accessService.resolveCurrentPersonId(auth)).thenReturn(personId);
    }

    private static ResultPlayerDto dto(UUID id, UUID profile, String displayName, ImportMatchLevel flag) {
        return new ResultPlayerDto(id, id == null ? "p1" : null, ResultSide.HOME, profile, displayName, null, null,
                false, false, null, null, false, null, null, flag);
    }

    private static ResultPlayerDto guestDto(String displayName, ImportMatchLevel flag) {
        return dto(null, null, displayName, flag);
    }

    private ResultPlayer stored(UUID id, UUID profile, String displayName, ImportMatchLevel flag) {
        return ResultPlayer.builder().id(id).matchResultId(resultId).side(ResultSide.HOME).playerProfileId(profile)
                .displayName(displayName).importMatch(flag).build();
    }

    private void existing(ResultPlayer... rows) {
        when(playerRepository.findByMatchResultIdOrderByCreatedAtAscIdAsc(resultId)).thenReturn(List.of(rows));
    }

    private ResultPlayer savedRow() {
        org.mockito.ArgumentCaptor<List<ResultPlayer>> captor = org.mockito.ArgumentCaptor.forClass(List.class);
        verify(playerRepository).saveAll(captor.capture());
        return captor.getValue().get(0);
    }

    private void clientSave(ResultPlayerDto... players) {
        service.replace(resultId, clubId, match, new ScorecardDto(List.of(players), null, null, null, null, null, null), personId);
    }

    private void importSave(ResultPlayerDto... players) {
        service.replaceImported(resultId, clubId, match, new ScorecardDto(List.of(players), null, null, null, null, null, null), null);
    }

    // ---- import_match: only the import path sets it ----

    @Test
    void theImportPathKeepsTheFlagOnANewLinkedOurPlayer() {
        importSave(dto(null, abelId, "Nazar A", ImportMatchLevel.NORMALISED));

        assertThat(savedRow().getImportMatch()).isEqualTo(ImportMatchLevel.NORMALISED);
    }

    @Test
    void theImportPathNeverFlagsAGuest() {
        importSave(guestDto("Zane Quirk", ImportMatchLevel.NORMALISED));

        assertThat(savedRow().getImportMatch()).isNull();
    }

    @Test
    void theImportPathNeverFlagsAnOppositionPlayer() {
        ResultPlayerDto opposition = new ResultPlayerDto(null, "o1", ResultSide.AWAY, null, "Rob Brown", null, null,
                false, true, null, null, false, null, null, ImportMatchLevel.NORMALISED);

        service.replaceImported(resultId, clubId, match,
                new ScorecardDto(List.of(opposition), null, null, null, null, null, null), null);

        assertThat(savedRow().getImportMatch()).isNull();
    }

    @Test
    void aClientCannotSetTheFlagOnANewRow() {
        clientSave(dto(null, abelId, "Nazar A", ImportMatchLevel.NORMALISED));

        assertThat(savedRow().getImportMatch()).isNull();
    }

    @Test
    void aClientCannotSetTheFlagOnAStoredRowThatHadNone() {
        UUID rowId = UUID.randomUUID();
        existing(stored(rowId, abelId, "Nazar A", null));

        clientSave(dto(rowId, abelId, "Nazar A", ImportMatchLevel.AI_SUGGESTED));

        assertThat(savedRow().getImportMatch()).isNull();
    }

    @Test
    void aClientCannotRaiseAStoredFlagToAnotherLevel() {
        UUID rowId = UUID.randomUUID();
        existing(stored(rowId, abelId, "Nazar A", ImportMatchLevel.NORMALISED));

        clientSave(dto(rowId, abelId, "Nazar A", ImportMatchLevel.AI_SUGGESTED));

        assertThat(savedRow().getImportMatch()).isEqualTo(ImportMatchLevel.NORMALISED);
    }

    @Test
    void aSaveThatStillSendsTheFlagForAnUnchangedPlayerKeepsIt() {
        UUID rowId = UUID.randomUUID();
        existing(stored(rowId, abelId, "Nazar A", ImportMatchLevel.NORMALISED));

        clientSave(dto(rowId, abelId, "Nazar A", ImportMatchLevel.NORMALISED));

        assertThat(savedRow().getImportMatch()).isEqualTo(ImportMatchLevel.NORMALISED);
        verify(nameAliases, never()).remember(any(), any(), any(), any(), any());
    }

    @Test
    void sendingNoFlagConfirmsTheRowAndClearsIt() {
        UUID rowId = UUID.randomUUID();
        existing(stored(rowId, abelId, "Nazar A", ImportMatchLevel.NORMALISED));

        clientSave(dto(rowId, abelId, "Nazar A", null));

        assertThat(savedRow().getImportMatch()).isNull();
    }

    @Test
    void swappingThePlayerClearsTheFlagEvenIfTheClientStillSendsIt() {
        UUID rowId = UUID.randomUUID();
        existing(stored(rowId, abelId, "Nazar A", ImportMatchLevel.NORMALISED));

        clientSave(dto(rowId, ceesId, "Nazar A", ImportMatchLevel.NORMALISED));

        assertThat(savedRow().getImportMatch()).isNull();
    }

    @Test
    void unlinkingTheRowToAGuestClearsTheFlag() {
        UUID rowId = UUID.randomUUID();
        existing(stored(rowId, abelId, "Nazar A", ImportMatchLevel.NORMALISED));

        clientSave(dto(rowId, null, "Nazar A", ImportMatchLevel.NORMALISED));

        assertThat(savedRow().getImportMatch()).isNull();
    }

    @Test
    void aRowLeftOutOfTheSaveIsRemovedAndSoIsItsFlag() {
        UUID rowId = UUID.randomUUID();
        ResultPlayer flagged = stored(rowId, abelId, "Nazar A", ImportMatchLevel.NORMALISED);
        existing(flagged);

        clientSave(guestDto("Zane Quirk", null));

        verify(playerRepository).deleteAll(List.of(flagged));
    }

    // ---- aliases written by a save ----

    @Test
    void confirmingAGuessWritesAnAliasForTheClubWithTheFilesSpelling() {
        UUID rowId = UUID.randomUUID();
        existing(stored(rowId, abelId, "Nazar A", ImportMatchLevel.NORMALISED));

        clientSave(dto(rowId, abelId, "Nazar A", null));

        verify(nameAliases).remember(clubId, NameAliasKind.PLAYER, "Nazar A", abelId, personId);
    }

    @Test
    void changingThePlayerOnAnImportedDraftWritesTheAliasForTheNewPlayer() {
        UUID rowId = UUID.randomUUID();
        existing(stored(rowId, abelId, "Nazar A", ImportMatchLevel.NORMALISED));

        clientSave(dto(rowId, ceesId, "Nazar A", null));

        // NameAliases.remember replaces the previous alias (deactivates it); the service just asks for the new pair
        verify(nameAliases).remember(clubId, NameAliasKind.PLAYER, "Nazar A", ceesId, personId);
    }

    @Test
    void linkingAGuestRowInASaveOnAnImportedDraftWritesAnAlias() {
        UUID rowId = UUID.randomUUID();
        existing(stored(rowId, null, "Zane Quirk", null));

        clientSave(dto(rowId, ceesId, "Zane Quirk", null));

        verify(nameAliases).remember(clubId, NameAliasKind.PLAYER, "Zane Quirk", ceesId, personId);
    }

    @Test
    void aSpellingEqualToThePlayersOwnNameIsNotRemembered() {
        UUID rowId = UUID.randomUUID();
        existing(stored(rowId, abelId, "abel  nazar", ImportMatchLevel.NORMALISED));

        clientSave(dto(rowId, abelId, "abel  nazar", null));

        verify(nameAliases, never()).remember(any(), any(), any(), any(), any());
    }

    @Test
    void aManualResultNeverWritesAnAliasWhenAPlayerIsChanged() {
        result.setSource("MANUAL");
        UUID rowId = UUID.randomUUID();
        existing(stored(rowId, abelId, "Nazar A", null));

        clientSave(dto(rowId, ceesId, "Nazar A", null));

        verify(nameAliases, never()).remember(any(), any(), any(), any(), any());
    }

    @Test
    void aManualResultNeverWritesAnAliasForANewRow() {
        result.setSource("MANUAL");

        clientSave(dto(null, abelId, "Nazar A", null));

        verify(nameAliases, never()).remember(any(), any(), any(), any(), any());
    }

    @Test
    void theImportPathItselfNeverWritesAnAlias() {
        importSave(dto(null, abelId, "Nazar A", ImportMatchLevel.NORMALISED));

        verify(nameAliases, never()).remember(any(), any(), any(), any(), any());
    }

    @Test
    void anOppositionRowNeverWritesAnAlias() {
        UUID rowId = UUID.randomUUID();
        ResultPlayer opposition = ResultPlayer.builder().id(rowId).matchResultId(resultId).side(ResultSide.AWAY)
                .opposition(true).displayName("Rob Brown").build();
        existing(opposition);
        ResultPlayerDto sent = new ResultPlayerDto(rowId, null, ResultSide.AWAY, null, "Rob Browne", null, null,
                false, true, null, null, false, null, null, null);

        service.replace(resultId, clubId, match, new ScorecardDto(List.of(sent), null, null, null, null, null, null), personId);

        verify(nameAliases, never()).remember(any(), any(), any(), any(), any());
    }

    @Test
    void aPlatformAdminWithNoPersonStillWritesTheAliasWithANullCreator() {
        UUID rowId = UUID.randomUUID();
        existing(stored(rowId, abelId, "Nazar A", ImportMatchLevel.NORMALISED));

        service.replace(resultId, clubId, match,
                new ScorecardDto(List.of(dto(rowId, abelId, "Nazar A", null)), null, null, null, null, null, null), null);

        verify(nameAliases).remember(clubId, NameAliasKind.PLAYER, "Nazar A", abelId, null);
    }

    // ---- link: a guest linked on an imported draft ----

    @Test
    void linkingAGuestOnAnImportedDraftWritesAnAliasAndClearsAnyFlag() {
        UUID rowId = UUID.randomUUID();
        ResultPlayer guest = stored(rowId, null, "Zane Quirk", ImportMatchLevel.NORMALISED);
        when(playerRepository.findById(rowId)).thenReturn(Optional.of(guest));

        service.link(auth, clubId, matchId, rowId, ceesId);

        assertThat(guest.getImportMatch()).isNull();
        assertThat(guest.getPlayerProfileId()).isEqualTo(ceesId);
        verify(nameAliases).remember(eq(clubId), eq(NameAliasKind.PLAYER), eq("Zane Quirk"), eq(ceesId), eq(personId));
    }

    @Test
    void linkingAGuestOnAManualResultWritesNoAlias() {
        result.setSource("MANUAL");
        UUID rowId = UUID.randomUUID();
        when(playerRepository.findById(rowId)).thenReturn(Optional.of(stored(rowId, null, "Zane Quirk", null)));

        service.link(auth, clubId, matchId, rowId, ceesId);

        verify(nameAliases, never()).remember(any(), any(), any(), any(), any());
    }

    @Test
    void linkingAsAPlatformAdminWithNoPersonWritesAnAliasWithANullCreator() {
        when(accessService.resolveCurrentPersonId(auth)).thenReturn(null);
        UUID rowId = UUID.randomUUID();
        when(playerRepository.findById(rowId)).thenReturn(Optional.of(stored(rowId, null, "Zane Quirk", null)));

        service.link(auth, clubId, matchId, rowId, ceesId);

        verify(nameAliases).remember(clubId, NameAliasKind.PLAYER, "Zane Quirk", ceesId, null);
    }
}
