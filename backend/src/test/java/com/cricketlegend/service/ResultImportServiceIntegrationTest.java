package com.cricketlegend.service;

import static com.cricketlegend.support.ScorecardDtos.bat;
import static com.cricketlegend.support.ScorecardDtos.bowl;
import static com.cricketlegend.support.ScorecardDtos.by;
import static com.cricketlegend.support.ScorecardDtos.guest;
import static com.cricketlegend.support.ScorecardDtos.opposition;
import static com.cricketlegend.support.ScorecardDtos.registered;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.cricketlegend.AbstractIntegrationTest;
import com.cricketlegend.domain.DismissalType;
import com.cricketlegend.domain.ImportMatchLevel;
import com.cricketlegend.domain.InningsKind;
import com.cricketlegend.domain.Match;
import com.cricketlegend.domain.MatchResult;
import com.cricketlegend.domain.ResultDecidedBy;
import com.cricketlegend.domain.ResultMarginType;
import com.cricketlegend.domain.ResultOutcomeType;
import com.cricketlegend.domain.ResultSide;
import com.cricketlegend.domain.ResultStatus;
import com.cricketlegend.dto.ImportErrorDto;
import com.cricketlegend.dto.ImportExactness;
import com.cricketlegend.dto.ImportMatchReason;
import com.cricketlegend.dto.ImportNoteDto;
import com.cricketlegend.dto.ImportPreviewDto;
import com.cricketlegend.dto.ImportPreviewRequest;
import com.cricketlegend.dto.ImportResolveDto;
import com.cricketlegend.dto.ImportResolveRequest;
import com.cricketlegend.dto.InningsDto;
import com.cricketlegend.dto.MatchResultDto;
import com.cricketlegend.dto.ResultDraft;
import com.cricketlegend.dto.ResultPlayerDto;
import com.cricketlegend.dto.ResultValidationDto;
import com.cricketlegend.dto.ScorecardDto;
import com.cricketlegend.dto.TeamMappingDto;
import com.cricketlegend.exception.ImportExternalIdAlreadyUsedException;
import com.cricketlegend.exception.ImportInputValidationException;
import com.cricketlegend.exception.ImportMatchAlreadyHasResultException;
import com.cricketlegend.exception.ImportWouldOverwriteDraftException;
import com.cricketlegend.exception.InvalidResultException;
import com.cricketlegend.exception.NotFoundException;
import com.cricketlegend.repository.MatchRepository;
import com.cricketlegend.repository.MatchResultRepository;
import com.cricketlegend.repository.ResultVisibility;
import com.cricketlegend.service.adaptor.AdaptorType;
import com.cricketlegend.service.adaptor.ImportInputFormat;
import com.cricketlegend.support.ResultImportFixtures;
import com.cricketlegend.support.ResultImportFixtures.Club;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.ApplicationContext;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.support.TransactionSynchronizationManager;

/**
 * docs/specs/104-match-results-import-adaptors.md, Test Plan "Backend integration", at service tier against real
 * Postgres. Deliberately not {@code @Transactional} (backend.md's lazy-field rule: the services own their transaction
 * boundaries, and {@code open-in-view} is off), so every write here is a real commit and {@link ResultImportFixtures}
 * removes what it seeded. Invented names only.
 */
@SpringBootTest
@Import(AbstractIntegrationTest.class)
class ResultImportServiceIntegrationTest {

    private static final String PROVIDER_SOURCE = "IMPORT:TESTPROV";

    @Autowired
    private ResultImportService importService;

    @Autowired
    private ResultService resultService;

    @Autowired
    private ScorecardService scorecardService;

    @Autowired
    private MatchResultRepository resultRepository;

    @Autowired
    private MatchRepository matchRepository;

    @Autowired
    private JdbcTemplate jdbc;

    @Autowired
    private ApplicationContext context;

    private ResultImportFixtures fixtures;
    private Club club;
    private UUID clubId;
    private Match match;
    private final Authentication admin = new TestingAuthenticationToken("ops", "n/a", "ROLE_platform_admin");

    @BeforeEach
    void setUp() {
        fixtures = new ResultImportFixtures(context);
        club = fixtures.club();
        clubId = club.world().club().getId();
        match = fixtures.match(club);
    }

    @AfterEach
    void cleanUp() {
        fixtures.cleanUp();
    }

    // ---- helpers ----

    private ImportPreviewDto preview(Authentication as, UUID inClub, String json, UUID launchedFrom) {
        return importService.preview(
                as, inClub, new ImportPreviewRequest(AdaptorType.JSON, ImportInputFormat.JSON, json, launchedFrom),
                null, null);
    }

    private ImportResolveDto resolve(Authentication as, UUID inClub, ImportPreviewDto preview, UUID onto, boolean replace) {
        List<TeamMappingDto> mapping = List.of(
                new TeamMappingDto("A", "Villagers 1", ResultSide.HOME, ImportExactness.EXACT, null),
                new TeamMappingDto("B", "Occasionals", ResultSide.AWAY, ImportExactness.EXACT, null));
        return importService.resolve(as, inClub, new ImportResolveRequest(preview.document(), onto, mapping, replace));
    }

    /** Preview then resolve, as the wizard does. */
    private ImportResolveDto importDoc(String json, Match onto, boolean replace) {
        return resolve(admin, onto.getClubId(), preview(admin, onto.getClubId(), json, onto.getId()), onto.getId(), replace);
    }

    private String fullDocument(String externalId, String second) {
        return ResultImportFixtures.document(match, externalId, second);
    }

    private long count(String sql, Object... args) {
        Long value = jdbc.queryForObject(sql, Long.class, args);
        return value == null ? 0 : value;
    }

    private Map<String, Long> snapshot() {
        Map<String, Long> counts = new LinkedHashMap<>();
        for (String table : List.of("match", "match_result", "match_innings", "result_player", "batting_entry",
                "bowling_entry", "fielding_entry", "match_award", "result_name_alias", "person", "player_profile",
                "team", "league_team")) {
            counts.put(table, count("select count(*) from " + table));
        }
        return counts;
    }

    private MatchResult stored(Match m) {
        return resultRepository.findByMatchId(m.getId()).orElseThrow();
    }

    private ScorecardDto read(Match m) {
        return scorecardService.read(admin, m.getClubId(), m.getId());
    }

    private ResultPlayerDto row(ScorecardDto card, String displayName) {
        return card.players().stream().filter(p -> displayName.equals(p.displayName())).findFirst().orElseThrow();
    }

    private ResultPlayerDto rowOf(ScorecardDto card, UUID profileId) {
        return card.players().stream().filter(p -> profileId.equals(p.playerProfileId())).findFirst().orElseThrow();
    }

    /** The draft the wizard would PUT after the manager changed {@code card}. */
    private ResultDraft redraft(MatchResultDto result, ScorecardDto card) {
        return new ResultDraft(result.outcomeType(), result.decidedBy(), result.winningSide(), result.marginType(),
                result.marginValue(), result.dlsTarget(), result.dlsRevisedBalls(), result.scheduledBalls(),
                result.ballsPerOver(), result.tossWonBy(), result.tossDecision(), result.playingAreaId(), result.note(),
                result.innings(), card);
    }

    /** Confirms the guess on {@code displayName} through the normal save, the way the Teams step does. */
    private void confirmGuess(Match m, String displayName) {
        ScorecardDto card = read(m);
        ResultPlayerDto guessed = row(card, displayName);
        List<ResultPlayerDto> players = card.players().stream()
                .map(p -> p.id().equals(guessed.id()) ? withFlag(p, null) : p)
                .toList();
        resultService.upsertDraft(admin, m.getClubId(), m.getId(), redraft(
                resultService.get(admin, m.getClubId(), m.getId()),
                new ScorecardDto(players, card.batting(), card.bowling(), card.fielding(), card.awards(), null, null)));
    }

    private static ResultPlayerDto withFlag(ResultPlayerDto p, ImportMatchLevel level) {
        return new ResultPlayerDto(p.id(), p.clientKey(), p.side(), p.playerProfileId(), p.displayName(),
                p.plannedBattingOrder(), p.replacedPlayerProfileId(), p.substitute(), p.opposition(), p.firstName(),
                p.lastName(), p.guest(), p.linkedBy(), p.linkedAt(), level);
    }

    private ImportNoteDto note(ImportResolveDto resolved, String code, String fileText) {
        return resolved.notes().stream()
                .filter(n -> code.equals(n.code()) && fileText.equals(n.fileText()))
                .findFirst()
                .orElseThrow(() -> new AssertionError("no " + code + " note for " + fileText + " in " + resolved.notes()));
    }

    private static List<String> codes(InvalidResultException e) {
        return e.getIssues().stream().map(i -> i.code()).toList();
    }

    // ---- resolve and preview ----

    @Test
    void refusesAMatchWithNoTeamOfTheClubBeforeSavingAnything() {
        ImportPreviewDto preview = preview(admin, clubId, fullDocument("ext-noteam", "B Player"), match.getId());
        jdbc.update("update match set home_team_name = 'Outside One', home_team_id = null, home_league_team_id = null,"
                + " away_team_name = 'Outside Two', away_team_id = null, away_league_team_id = null where id = ?", match.getId());

        assertThatThrownBy(() -> resolve(admin, clubId, preview, match.getId(), false))
                .isInstanceOfSatisfying(ImportInputValidationException.class, e -> assertThat(e.getErrors())
                        .extracting(ImportErrorDto::code).containsExactly("NO_CLUB_TEAM_ON_MATCH"));
        assertThat(resultRepository.findByMatchId(match.getId())).isEmpty();
    }

    @Test
    void servicesRunWithoutAnAmbientTransactionAndStillReadLazyFields() {
        assertThat(TransactionSynchronizationManager.isActualTransactionActive()).isFalse();

        ImportPreviewDto preview = preview(admin, clubId, fullDocument("ext-1", "B Player"), match.getId());
        ImportResolveDto resolved = resolve(admin, clubId, preview, match.getId(), false);

        assertThat(TransactionSynchronizationManager.isActualTransactionActive()).isFalse();
        assertThat(resolved.resultStatus()).isEqualTo(ResultStatus.DRAFT);
        ScorecardDto card = read(match);
        assertThat(card.players()).extracting(ResultPlayerDto::displayName).contains("Anna Player", "Olly Opp");
        assertThat(resultService.get(admin, clubId, match.getId()).innings()).hasSize(2);
    }

    @Test
    void previewWritesNothingAndProposesTheMatchAndTheTeams() {
        Map<String, Long> before = snapshot();

        ImportPreviewDto preview = preview(admin, clubId, fullDocument("ext-1", "B Player"), null);

        assertThat(snapshot()).isEqualTo(before);
        assertThat(preview.matchCandidates()).singleElement().satisfies(candidate -> {
            assertThat(candidate.matchId()).isEqualTo(match.getId());
            assertThat(candidate.reasons()).contains(ImportMatchReason.DATE, ImportMatchReason.TEAMS);
        });
        assertThat(preview.teamMapping()).extracting(TeamMappingDto::fileKey, TeamMappingDto::side)
                .containsExactly(org.assertj.core.groups.Tuple.tuple("A", ResultSide.HOME),
                        org.assertj.core.groups.Tuple.tuple("B", ResultSide.AWAY));
        assertThat(preview.existingForExternalId()).isNull();
    }

    @Test
    void resolveWritesExactlyOneDraftAndNoPersonOrProfile() {
        Map<String, Long> before = snapshot();

        ImportResolveDto resolved = importDoc(fullDocument("ext-1", "B Player"), match, false);

        Map<String, Long> after = snapshot();
        assertThat(after.get("match_result") - before.get("match_result")).isEqualTo(1);
        assertThat(after.get("person")).isEqualTo(before.get("person"));
        assertThat(after.get("player_profile")).isEqualTo(before.get("player_profile"));
        assertThat(after.get("match")).isEqualTo(before.get("match"));
        assertThat(after.get("team")).isEqualTo(before.get("team"));
        assertThat(after.get("league_team")).isEqualTo(before.get("league_team"));
        MatchResult result = stored(match);
        assertThat(result.getStatus()).isEqualTo(ResultStatus.DRAFT);
        assertThat(result.getSource()).isEqualTo(PROVIDER_SOURCE);
        assertThat(result.getExternalId()).isEqualTo("ext-1");
        assertThat(result.getSourcePayload()).isNull();
        assertThat(result.getPublishedAt()).isNull();
        assertThat(resolved.matchId()).isEqualTo(match.getId());
        assertThat(resolved.resultStatus()).isEqualTo(ResultStatus.DRAFT);
        // Anna by her full name, Bela by initials (a guess), Zed Stranger is not in the squad
        assertThat(resolved.counts().exact()).isEqualTo(1);
        assertThat(resolved.counts().normalised()).isEqualTo(1);
        assertThat(resolved.counts().unresolved()).isEqualTo(1);
        ScorecardDto card = read(match);
        assertThat(rowOf(card, club.anna().getId()).importMatch()).isNull();
        assertThat(rowOf(card, club.bela().getId()).importMatch()).isEqualTo(ImportMatchLevel.NORMALISED);
        assertThat(row(card, "Zed Stranger").playerProfileId()).isNull();
        assertThat(card.players()).filteredOn(ResultPlayerDto::opposition).extracting(ResultPlayerDto::displayName)
                .containsExactlyInAnyOrder("Olly Opp", "Pat Opp");
        // nobody who is in the squad but not in the file gets a row
        assertThat(card.players()).noneMatch(p -> club.cato().getId().equals(p.playerProfileId()));
    }

    @Test
    void aNameOutsideTheSquadIsNeverMatchedAgainstTheWholeClub() {
        importDoc(fullDocument(null, "Anna Player").replace("Zed Stranger", "Dara Player"), match, false);

        ResultPlayerDto dara = row(read(match), "Dara Player");
        assertThat(dara.playerProfileId()).isNull();
        assertThat(dara.importMatch()).isNull();
    }

    // ---- docs/specs/113: only players of the team's section are ever linked ----

    @Test
    void aSquadMemberOutsideTheTeamsSectionBecomesAGuestWithANoteAndAnEligibleOneStillLinks() {
        fixtures.shared().rosterPlayer(club.world(), club.world().seniors1(), "Eli"); // squad, but not in the Seniors section

        ImportResolveDto resolved = importDoc(fullDocument(null, "Eli Player"), match, false);

        ResultPlayerDto eliRow = row(read(match), "Eli Player");
        assertThat(eliRow.playerProfileId()).isNull();
        assertThat(eliRow.guest()).isTrue();
        assertThat(resolved.notes()).filteredOn(n -> "Eli Player".equals(n.fileText()))
                .singleElement().satisfies(n -> assertThat(n.level()).isEqualTo(ImportExactness.UNRESOLVED));
        assertThat(rowOf(read(match), club.anna().getId()).playerProfileId()).isEqualTo(club.anna().getId());
    }

    @Test
    void aRememberedNameWhoseTargetIsOutsideTheTeamsSectionIsIgnoredAndTheNameIsAGuest() {
        var eli = fixtures.shared().rosterPlayer(club.world(), club.world().seniors1(), "Eli");
        jdbc.update("insert into result_name_alias (club_id, kind, alias_normalised, alias_original, target_player_profile_id) values (?, 'PLAYER', 'zed stranger', 'Zed Stranger', ?)",
                clubId, eli.getId());

        ImportResolveDto resolved = importDoc(fullDocument("ext-1", "Bela Player"), match, false);

        assertThat(row(read(match), "Zed Stranger").playerProfileId()).isNull();
        assertThat(resolved.notes()).extracting(ImportNoteDto::code).contains("ALIAS_IGNORED");
    }

    // ---- idempotent re-import ----

    @Test
    void importingTheSameDocumentTwiceUpdatesTheSameDraftInPlace() {
        importDoc(fullDocument("ext-1", "B Player"), match, false);
        UUID firstId = stored(match).getId();
        long innings = count("select count(*) from match_innings where match_result_id = ?", firstId);
        long players = count("select count(*) from result_player where match_result_id = ?", firstId);
        long batting = count("select count(*) from batting_entry b join match_innings i on i.id = b.match_innings_id where i.match_result_id = ?", firstId);
        long aliases = count("select count(*) from result_name_alias where club_id = ?", clubId);

        importDoc(fullDocument("ext-1", "B Player"), match, true);

        assertThat(count("select count(*) from match_result where match_id = ?", match.getId())).isEqualTo(1);
        assertThat(stored(match).getId()).isEqualTo(firstId);
        assertThat(stored(match).getExternalId()).isEqualTo("ext-1");
        assertThat(count("select count(*) from match_innings where match_result_id = ?", firstId)).isEqualTo(innings).isEqualTo(2);
        assertThat(count("select count(*) from result_player where match_result_id = ?", firstId)).isEqualTo(players);
        assertThat(count("select count(*) from batting_entry b join match_innings i on i.id = b.match_innings_id where i.match_result_id = ?", firstId)).isEqualTo(batting);
        assertThat(count("select count(*) from result_name_alias where club_id = ?", clubId)).isEqualTo(aliases);
    }

    @Test
    void reImportOntoADraftNeedsTheAcknowledgementAndChangesNothingWithout() {
        importDoc(fullDocument("ext-1", "B Player"), match, false);
        var updatedBefore = stored(match).getUpdatedAt();
        Map<String, Long> before = snapshot();

        assertThatThrownBy(() -> importDoc(fullDocument("ext-1", "B Player"), match, false))
                .isInstanceOf(ImportWouldOverwriteDraftException.class);

        assertThat(snapshot()).isEqualTo(before);
        assertThat(stored(match).getUpdatedAt()).isEqualTo(updatedBefore);
    }

    @Test
    void reImportOntoAPublishedResultIsRefusedEvenWithTheAcknowledgementAndNothingChanges() {
        importDoc(fullDocument("ext-1", "Bela Player"), match, false);
        resultService.publish(admin, clubId, match.getId(), true);
        var publishedAt = stored(match).getPublishedAt();
        Map<String, Long> before = snapshot();

        assertThatThrownBy(() -> importDoc(fullDocument("ext-1", "Bela Player"), match, true))
                .isInstanceOf(ImportMatchAlreadyHasResultException.class);
        assertThatThrownBy(() -> importDoc(fullDocument("ext-1", "Bela Player"), match, false))
                .isInstanceOf(ImportMatchAlreadyHasResultException.class);

        assertThat(snapshot()).isEqualTo(before);
        assertThat(stored(match).getStatus()).isEqualTo(ResultStatus.PUBLISHED);
        assertThat(stored(match).getPublishedAt()).isEqualTo(publishedAt);
    }

    @Test
    void aManualResultForTheSameMatchIsADraftToReplaceOnlyWithTheAcknowledgement() {
        resultService.upsertDraft(admin, clubId, match.getId(), new ResultDraft(null, null, null, null, null, null,
                null, null, null, null, null, null, "typed by hand", null, new ScorecardDto(
                        List.of(guest(ResultSide.HOME, "g1", "Sam Typed")), null, null, null, null, null, null)));
        assertThat(stored(match).getSource()).isEqualTo("MANUAL");
        UUID manualId = stored(match).getId();

        assertThatThrownBy(() -> importDoc(fullDocument("ext-1", "B Player"), match, false))
                .isInstanceOf(ImportWouldOverwriteDraftException.class);
        assertThat(stored(match).getSource()).isEqualTo("MANUAL");
        assertThat(read(match).players()).extracting(ResultPlayerDto::displayName).containsExactly("Sam Typed");

        importDoc(fullDocument("ext-1", "B Player"), match, true);

        assertThat(stored(match).getId()).isEqualTo(manualId);
        assertThat(stored(match).getSource()).isEqualTo(PROVIDER_SOURCE);
        assertThat(read(match).players()).extracting(ResultPlayerDto::displayName)
                .doesNotContain("Sam Typed").contains("Anna Player");
    }

    @Test
    void theSameProviderIdOntoADifferentMatchIsRefusedNamingTheOtherMatch() {
        importDoc(fullDocument("ext-1", "B Player"), match, false);
        Match second = fixtures.shared().match(club.world(), club.world().seniors1(), null, match.getMatchDate());

        assertThatThrownBy(() -> importDoc(ResultImportFixtures.document(second, "ext-1", "B Player"), second, false))
                .isInstanceOfSatisfying(ImportExternalIdAlreadyUsedException.class,
                        e -> assertThat(e.getOtherMatchId()).isEqualTo(match.getId()));

        assertThat(resultRepository.findByMatchId(second.getId())).isEmpty();
        assertThat(count("select count(*) from match_result where club_id = ? and external_id = 'ext-1'", clubId)).isEqualTo(1);
        // the preview says where the id already lives, and ranks that match first
        ImportPreviewDto preview = preview(admin, clubId, ResultImportFixtures.document(second, "ext-1", "B Player"), second.getId());
        assertThat(preview.existingForExternalId().matchId()).isEqualTo(match.getId());
        assertThat(preview.matchCandidates().get(0).matchId()).isEqualTo(match.getId());
        assertThat(preview.matchCandidates().get(0).reasons()).contains(ImportMatchReason.EXTERNAL_ID);
    }

    @Test
    void theSameProviderIdInAnotherClubIsNotAClash() {
        importDoc(fullDocument("ext-1", "B Player"), match, false);
        Club other = fixtures.club();
        Match theirs = fixtures.match(other);

        importDoc(ResultImportFixtures.document(theirs, "ext-1", "B Player"), theirs, false);

        assertThat(stored(theirs).getExternalId()).isEqualTo("ext-1");
        assertThat(stored(match).getId()).isNotEqualTo(stored(theirs).getId());
    }

    // ---- the guess, the alias and publish ----

    @Test
    void aGuessBlocksPublishUntilConfirmedThroughTheNormalSaveWhichWritesAnAlias() {
        ImportResolveDto resolved = importDoc(fullDocument("ext-1", "B Player"), match, false);

        assertThat(resolved.validation().canPublish()).isFalse();
        assertThat(resolved.validation().issues()).extracting(i -> i.code()).contains("IMPORTED_NAME_UNCONFIRMED");
        assertThatThrownBy(() -> resultService.publish(admin, clubId, match.getId(), true))
                .isInstanceOfSatisfying(InvalidResultException.class,
                        e -> assertThat(codes(e)).contains("IMPORTED_NAME_UNCONFIRMED"));
        assertThat(count("select count(*) from result_name_alias where club_id = ? and kind = 'PLAYER'", clubId)).isZero();

        confirmGuess(match, "B Player");

        assertThat(rowOf(read(match), club.bela().getId()).importMatch()).isNull();
        assertThat(count("select count(*) from result_player where match_result_id = ? and import_match is not null",
                stored(match).getId())).isZero();
        Map<String, Object> alias = jdbc.queryForMap(
                "select alias_normalised, alias_original, target_player_profile_id, active, created_by from result_name_alias where club_id = ? and kind = 'PLAYER'",
                clubId);
        assertThat(alias.get("alias_normalised")).isEqualTo("b player");
        assertThat(alias.get("alias_original")).isEqualTo("B Player");
        assertThat(alias.get("target_player_profile_id")).isEqualTo(club.bela().getId());
        assertThat(alias.get("active")).isEqualTo(true);
        // a platform admin with no Person is handled: nobody to record
        assertThat(alias.get("created_by")).isNull();
        assertThat(resultService.validate(admin, clubId, match.getId(), null).errors()).isEmpty();
        assertThat(resultService.publish(admin, clubId, match.getId(), true).status()).isEqualTo(ResultStatus.PUBLISHED);
    }

    @Test
    void aClientCannotSetOrRaiseTheGuessFlagThroughTheNormalSave() {
        importDoc(fullDocument("ext-1", "Bela Player"), match, false);
        ScorecardDto card = read(match);
        assertThat(card.players()).allMatch(p -> p.importMatch() == null);
        List<ResultPlayerDto> raised = card.players().stream()
                .map(p -> withFlag(p, ImportMatchLevel.NORMALISED)).toList();

        resultService.upsertDraft(admin, clubId, match.getId(), redraft(
                resultService.get(admin, clubId, match.getId()),
                new ScorecardDto(raised, card.batting(), card.bowling(), card.fielding(), card.awards(), null, null)));

        assertThat(count("select count(*) from result_player where match_result_id = ? and import_match is not null",
                stored(match).getId())).isZero();
        assertThat(resultService.validate(admin, clubId, match.getId(), null).errors()).isEmpty();
    }

    @Test
    void theNextImportOfTheSameSpellingResolvesAsExactThroughTheAliasWithNoFlag() {
        importDoc(fullDocument("ext-1", "B Player"), match, false);
        confirmGuess(match, "B Player");
        long aliases = count("select count(*) from result_name_alias where club_id = ?", clubId);
        assertThat(aliases).isEqualTo(1);

        ImportResolveDto again = importDoc(fullDocument("ext-1", "B Player"), match, true);

        ImportNoteDto aliasNote = note(again, "NAME_ALIAS", "B Player");
        assertThat(aliasNote.level()).isEqualTo(ImportExactness.EXACT);
        assertThat(aliasNote.candidateName()).isEqualTo("Bela Player");
        assertThat(again.counts().exact()).isEqualTo(2);
        assertThat(again.counts().normalised()).isZero();
        assertThat(rowOf(read(match), club.bela().getId()).importMatch()).isNull();
        assertThat(again.validation().issues()).extracting(i -> i.code()).doesNotContain("IMPORTED_NAME_UNCONFIRMED");
        // written once, not once per import
        assertThat(count("select count(*) from result_name_alias where club_id = ?", clubId)).isEqualTo(aliases);
    }

    @Test
    void changingTheMatchedPlayerOfAnImportedRowReplacesTheAliasAndKeepsTheOldRowInactive() {
        importDoc(fullDocument("ext-1", "B Player"), match, false);
        confirmGuess(match, "B Player");
        ScorecardDto card = read(match);
        ResultPlayerDto bela = rowOf(card, club.bela().getId());
        List<ResultPlayerDto> players = card.players().stream()
                .map(p -> p.id().equals(bela.id())
                        ? new ResultPlayerDto(p.id(), null, p.side(), club.cato().getId(), p.displayName(),
                                p.plannedBattingOrder(), null, p.substitute(), false, null, null, false, null, null)
                        : p)
                .toList();

        resultService.upsertDraft(admin, clubId, match.getId(), redraft(
                resultService.get(admin, clubId, match.getId()),
                new ScorecardDto(players, card.batting(), card.bowling(), card.fielding(), card.awards(), null, null)));

        assertThat(count("select count(*) from result_name_alias where club_id = ? and alias_normalised = 'b player'", clubId)).isEqualTo(2);
        assertThat(jdbc.queryForObject(
                "select target_player_profile_id from result_name_alias where club_id = ? and alias_normalised = 'b player' and active",
                UUID.class, clubId)).isEqualTo(club.cato().getId());
        assertThat(count("select count(*) from result_name_alias where club_id = ? and alias_normalised = 'b player' and not active", clubId)).isEqualTo(1);
    }

    @Test
    void aManualResultNeverWritesAnAlias() {
        resultService.upsertDraft(admin, clubId, match.getId(), new ResultDraft(null, null, null, null, null, null,
                null, null, null, null, null, null, null, null, new ScorecardDto(
                        List.of(guest(ResultSide.HOME, "g1", "B Player"), opposition(ResultSide.AWAY, "o1", "Olly Opp")),
                        null, null, null, null, null, null)));
        ScorecardDto card = read(match);
        ResultPlayerDto typed = row(card, "B Player");
        List<ResultPlayerDto> linked = card.players().stream()
                .map(p -> p.id().equals(typed.id())
                        ? new ResultPlayerDto(p.id(), null, p.side(), club.bela().getId(), "B Player", null, null,
                                false, false, null, null, false, null, null)
                        : p)
                .toList();

        resultService.upsertDraft(admin, clubId, match.getId(), redraft(
                resultService.get(admin, clubId, match.getId()),
                new ScorecardDto(linked, null, null, null, null, null, null)));

        assertThat(rowOf(read(match), club.bela().getId()).displayName()).isEqualTo("B Player");
        assertThat(count("select count(*) from result_name_alias where club_id = ?", clubId)).isZero();
    }

    @Test
    void aGuestLinkedOnAnImportedDraftWritesAnAlias() {
        importDoc(fullDocument("ext-1", "Bela Player"), match, false);
        ScorecardDto card = read(match);
        ResultPlayerDto zed = row(card, "Zed Stranger");
        List<ResultPlayerDto> players = card.players().stream()
                .map(p -> p.id().equals(zed.id())
                        ? new ResultPlayerDto(p.id(), null, p.side(), club.cato().getId(), p.displayName(),
                                p.plannedBattingOrder(), null, p.substitute(), false, null, null, false, null, null)
                        : p)
                .toList();

        resultService.upsertDraft(admin, clubId, match.getId(), redraft(
                resultService.get(admin, clubId, match.getId()),
                new ScorecardDto(players, card.batting(), card.bowling(), card.fielding(), card.awards(), null, null)));

        assertThat(jdbc.queryForObject(
                "select target_player_profile_id from result_name_alias where club_id = ? and alias_normalised = 'zed stranger' and active",
                UUID.class, clubId)).isEqualTo(club.cato().getId());
    }

    // ---- forfeit ----

    @Test
    void aForfeitDocumentWithNoInningsSavesAResultWithNoScorecard() {
        ImportResolveDto resolved = importDoc(ResultImportFixtures.forfeit(match, "ext-9"), match, false);

        assertThat(resolved.resultStatus()).isEqualTo(ResultStatus.DRAFT);
        MatchResultDto result = resultService.get(admin, clubId, match.getId());
        assertThat(result.outcomeType()).isEqualTo(ResultOutcomeType.FORFEIT);
        assertThat(result.winningSide()).isEqualTo(ResultSide.HOME);
        assertThat(result.innings()).isEmpty();
        assertThat(result.hasScorecard()).isFalse();
        assertThat(read(match).players()).isEmpty();
        assertThat(result.source()).isEqualTo(PROVIDER_SOURCE);
    }

    @Test
    void aForfeitReImportedOverAFullDraftClearsTheOldScorecard() {
        importDoc(fullDocument("ext-1", "Bela Player"), match, false);
        assertThat(read(match).players()).isNotEmpty();

        importDoc(ResultImportFixtures.forfeit(match, "ext-1"), match, true);

        assertThat(resultService.get(admin, clubId, match.getId()).innings()).isEmpty();
        assertThat(read(match).players()).isEmpty();
        assertThat(read(match).batting()).isEmpty();
    }

    // ---- aliases of other clubs and outside the candidates ----

    @Test
    void anotherClubsAliasIsNeverUsed() {
        Club other = fixtures.club();
        jdbc.update("insert into result_name_alias (club_id, kind, alias_normalised, alias_original, target_player_profile_id) values (?, 'PLAYER', 'zed stranger', 'Zed Stranger', ?)",
                other.world().club().getId(), other.anna().getId());

        ImportResolveDto resolved = importDoc(fullDocument("ext-1", "Bela Player"), match, false);

        assertThat(row(read(match), "Zed Stranger").playerProfileId()).isNull();
        assertThat(resolved.notes()).extracting(ImportNoteDto::code).doesNotContain("NAME_ALIAS");
    }

    @Test
    void anAliasOfTheClubWhoseTargetIsOutsideTheMatchsPlayersIsIgnoredWithANote() {
        jdbc.update("insert into result_name_alias (club_id, kind, alias_normalised, alias_original, target_player_profile_id) values (?, 'PLAYER', 'zed stranger', 'Zed Stranger', ?)",
                clubId, club.dara().getId());

        ImportResolveDto resolved = importDoc(fullDocument("ext-1", "Bela Player"), match, false);

        assertThat(row(read(match), "Zed Stranger").playerProfileId()).isNull();
        assertThat(resolved.notes()).extracting(ImportNoteDto::code).contains("ALIAS_IGNORED");
    }

    // ---- tenancy and section narrowing ----

    @Test
    void anotherClubsManagerCannotImportIntoThisClubsMatch() {
        Club other = fixtures.club();
        Authentication theirAdmin = new TestingAuthenticationToken(fixtures.clubAdminSubject(other), "n/a");
        ImportPreviewDto preview = preview(admin, clubId, fullDocument("ext-1", "B Player"), match.getId());
        Map<String, Long> before = snapshot();

        assertThatThrownBy(() -> resolve(theirAdmin, clubId, preview, match.getId(), false))
                .isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(() -> preview(theirAdmin, clubId, fullDocument("ext-1", "B Player"), match.getId()))
                .isInstanceOf(AccessDeniedException.class);

        assertThat(snapshot()).isEqualTo(before);
    }

    @Test
    void aMatchOfAnotherClubIsNotFoundUnderThisClub() {
        Club other = fixtures.club();
        Match theirs = fixtures.match(other);
        ImportPreviewDto preview = preview(admin, clubId, fullDocument("ext-1", "B Player"), match.getId());
        Map<String, Long> before = snapshot();

        assertThatThrownBy(() -> resolve(admin, clubId, preview, theirs.getId(), false))
                .isInstanceOf(NotFoundException.class);
        assertThatThrownBy(() -> preview(admin, clubId, fullDocument("ext-1", "B Player"), theirs.getId()))
                .isInstanceOf(NotFoundException.class);

        assertThat(snapshot()).isEqualTo(before);
        assertThat(resultRepository.findByMatchId(theirs.getId())).isEmpty();
    }

    @Test
    void candidatesNeverComeFromAnotherClubEvenWithTheSameDateAndTeamNames() {
        Club other = fixtures.club();
        Match theirs = fixtures.match(other);

        ImportPreviewDto preview = preview(admin, clubId, fullDocument("ext-1", "B Player"), null);

        assertThat(preview.matchCandidates()).extracting(c -> c.matchId())
                .contains(match.getId()).doesNotContain(theirs.getId());
    }

    @Test
    void aSectionManagerSeesAndImportsOnlyMatchesOfTheirSections() {
        Match juniors = fixtures.shared().match(club.world(), club.world().juniorsTeam(), null, match.getMatchDate());
        Authentication seniorsManager = new TestingAuthenticationToken(
                fixtures.shared().sectionManagerSubject(club.world().seniors()), "n/a");
        Authentication juniorsManager = new TestingAuthenticationToken(
                fixtures.shared().sectionManagerSubject(club.world().juniors()), "n/a");
        String json = fullDocument("ext-1", "B Player");

        // candidates are narrowed to the caller's sections
        assertThat(preview(seniorsManager, clubId, json, null).matchCandidates()).extracting(c -> c.matchId())
                .contains(match.getId()).doesNotContain(juniors.getId());
        assertThat(preview(juniorsManager, clubId, json, null).matchCandidates()).extracting(c -> c.matchId())
                .contains(juniors.getId()).doesNotContain(match.getId());

        // a match outside their sections is refused, on both routes, and nothing is written
        ImportPreviewDto preview = preview(seniorsManager, clubId, json, match.getId());
        Map<String, Long> before = snapshot();
        assertThatThrownBy(() -> preview(juniorsManager, clubId, json, match.getId()))
                .isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(() -> resolve(juniorsManager, clubId, preview, match.getId(), false))
                .isInstanceOf(AccessDeniedException.class);
        assertThat(snapshot()).isEqualTo(before);

        // their own match is fine
        assertThat(resolve(seniorsManager, clubId, preview, match.getId(), false).resultStatus())
                .isEqualTo(ResultStatus.DRAFT);
        UUID person = jdbc.queryForObject("select id from person where keycloak_user_id = ?", UUID.class,
                seniorsManager.getName());
        assertThat(stored(match).getUpdatedBy()).isEqualTo(person);
    }

    // ---- the publish gate ----

    @Test
    void anUnpublishedImportedDraftIsInvisibleToCallersWhoCannotCapture() {
        importDoc(fullDocument("ext-1", "Bela Player"), match, false);
        UUID id = club.world().club().getId();

        assertThat(resultRepository.findAll(ResultVisibility.forCaller(false)).stream()
                .filter(r -> r.getClubId().equals(id))).isEmpty();
        assertThat(resultRepository.findAll(ResultVisibility.forCaller(true)).stream()
                .filter(r -> r.getClubId().equals(id))).hasSize(1);
        assertThat(matchRepository.findAll(ResultVisibility.matchesForCaller(false)).stream()
                .filter(m -> m.getClubId().equals(id))).isEmpty();

        resultService.publish(admin, clubId, match.getId(), true);

        assertThat(resultRepository.findAll(ResultVisibility.forCaller(false)).stream()
                .filter(r -> r.getClubId().equals(id))).hasSize(1);
    }

    // ---- the whole path against the normal save ----

    @Test
    void theImportedDraftValidatesExactlyAsTheSameScorecardEnteredThroughTheNormalSave() {
        ImportResolveDto resolved = importDoc(fullDocument("ext-1", "Bela Player"), match, false);
        Match typedMatch = fixtures.shared().match(club.world(), club.world().seniors1(), null, match.getMatchDate());

        ResultSide h = ResultSide.HOME;
        ResultSide a = ResultSide.AWAY;
        var batOne = by(bat(h, "p1", DismissalType.BOWLED, 40, 30, 1), "o1", null);
        var batTwo = by(bat(h, "p2", DismissalType.CAUGHT, 30, 25, 2), "o1", "o2");
        var batThree = bat(h, "p3", DismissalType.NOT_OUT, 20, 15, 3);
        ScorecardDto typed = new ScorecardDto(
                List.of(registered(h, "p1", club.anna().getId()), registered(h, "p2", club.bela().getId()),
                        guest(h, "p3", "Zed Stranger"), opposition(a, "o1", "Olly Opp"), opposition(a, "o2", "Pat Opp")),
                List.of(batOne, batTwo, batThree),
                List.of(bowl(h, "o1", 30, 0, 45, 2), bowl(h, "o2", 30, 0, 47, 0)),
                null, null, null, null);
        resultService.upsertDraft(admin, clubId, typedMatch.getId(), new ResultDraft(
                ResultOutcomeType.WON, ResultDecidedBy.REGULAR, h, ResultMarginType.RUNS, 32, null, null, 60, 6, null,
                null, null, null,
                List.of(new InningsDto(1, InningsKind.REGULAR, h, 92, 2, 60, 2, false, "10.0", 2, 0, 0, 0, 0, null),
                        new InningsDto(2, InningsKind.REGULAR, a, 60, 10, 56, null, true, "9.2")),
                typed));

        ResultValidationDto typedValidation = resultService.validate(admin, clubId, typedMatch.getId(), null);
        assertThat(resolved.validation().errors()).isEqualTo(typedValidation.errors());
        assertThat(resolved.validation().warnings()).isEqualTo(typedValidation.warnings());
        assertThat(resolved.validation().issues()).isEqualTo(typedValidation.issues());
        assertThat(resolved.validation().canPublish()).isEqualTo(typedValidation.canPublish()).isTrue();
        MatchResultDto imported = resultService.get(admin, clubId, match.getId());
        MatchResultDto manual = resultService.get(admin, clubId, typedMatch.getId());
        assertThat(imported.innings()).isEqualTo(manual.innings());
        assertThat(imported.outcomeType()).isEqualTo(manual.outcomeType());
        assertThat(imported.winningSide()).isEqualTo(manual.winningSide());
        assertThat(imported.marginType()).isEqualTo(manual.marginType());
        assertThat(imported.marginValue()).isEqualTo(manual.marginValue());
        assertThat(imported.scheduledBalls()).isEqualTo(manual.scheduledBalls());
        // and the scorecards agree on every figure
        assertThat(figures(read(match))).isEqualTo(figures(read(typedMatch)));
    }

    /** Batting and bowling figures by player name, so the comparison does not depend on row ids. */
    private static List<String> figures(ScorecardDto card) {
        Map<UUID, String> names = new LinkedHashMap<>();
        card.players().forEach(p -> names.put(p.id(),
                p.firstName() != null ? p.firstName() + " " + p.lastName() : p.displayName()));
        List<String> out = new java.util.ArrayList<>();
        card.batting().forEach(b -> out.add("bat " + names.get(b.resultPlayerId()) + " " + b.position() + " "
                + b.howOut() + " " + b.runs() + " " + b.balls() + " b:" + names.get(b.bowlerPlayerId()) + " f:"
                + names.get(b.fielderPlayerId())));
        card.bowling().forEach(b -> out.add("bowl " + names.get(b.resultPlayerId()) + " " + b.balls() + " "
                + b.maidens() + " " + b.runs() + " " + b.wickets()));
        return out.stream().sorted().toList();
    }
}
