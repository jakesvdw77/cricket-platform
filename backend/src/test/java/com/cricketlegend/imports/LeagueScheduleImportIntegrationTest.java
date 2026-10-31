package com.cricketlegend.imports;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.cricketlegend.AbstractIntegrationTest;
import com.cricketlegend.PlatformRoleJwtPostProcessors;
import com.cricketlegend.domain.ImportBatchStatus;
import com.cricketlegend.domain.ImportIssueSeverity;
import com.cricketlegend.domain.ImportOutcome;
import com.cricketlegend.domain.ImportResolutionKind;
import com.cricketlegend.domain.ImportScopeMode;
import com.cricketlegend.domain.League;
import com.cricketlegend.domain.LeagueSeason;
import com.cricketlegend.domain.LeagueTeam;
import com.cricketlegend.domain.Match;
import com.cricketlegend.dto.CommitImportRequest;
import com.cricketlegend.dto.DeleteImportRequest;
import com.cricketlegend.dto.ImportBatchDto;
import com.cricketlegend.dto.ImportDecisionsDto;
import com.cricketlegend.dto.ImportDecisionsDto.Acknowledgement;
import com.cricketlegend.dto.ImportDecisionsDto.Resolution;
import com.cricketlegend.dto.ImportDecisionsDto.RowValues;
import com.cricketlegend.dto.ImportDecisionsRequest;
import com.cricketlegend.dto.ImportRowDto;
import com.cricketlegend.dto.ImportScopeDto;
import com.cricketlegend.exception.ImportConfirmationInvalidException;
import com.cricketlegend.repository.LeagueSeasonRepository;
import com.cricketlegend.repository.LeagueTeamRepository;
import com.cricketlegend.repository.MatchRepository;
import com.cricketlegend.service.ImportExpiryService;
import com.cricketlegend.service.ImportService;
import com.cricketlegend.service.impl.ImportExpiryServiceImpl;
import com.cricketlegend.support.ManagerOverviewFixtures;
import com.cricketlegend.support.ManagerOverviewFixtures.World;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.ApplicationContext;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.JwtRequestPostProcessor;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * docs/specs/097, 098 and 125, Test Plan "Integration": the schedule import through the real services against real
 * Postgres (migrations 058/059 applied), the re-import cases, the typed-in import, expiry and the new repository
 * queries. Not {@code @Transactional} (services own their transactions); everything committed is removed in
 * {@code @AfterEach}. Invented names only.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(AbstractIntegrationTest.class)
class LeagueScheduleImportIntegrationTest {

    private static final String TYPE = "LEAGUE_SCHEDULE";
    private static final String ZONE = "Africa/Johannesburg";
    private static final String HEADER = "Date,Start Time,Home team,Away team,Venue,Notes\n";
    private static final String SUN1 = "2031-06-01";
    private static final String SUN2 = "2031-06-08";

    @Autowired private ImportService importService;
    @Autowired private ImportExpiryService expiry;
    @Autowired private ImportExpiryServiceImpl expiryJob;
    @Autowired private MatchRepository matchRepository;
    @Autowired private LeagueTeamRepository leagueTeamRepository;
    @Autowired private LeagueSeasonRepository leagueSeasonRepository;
    @Autowired private JdbcTemplate jdbc;
    @Autowired private ApplicationContext context;
    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private TransactionTemplate tx;

    private ManagerOverviewFixtures fixtures;
    private World w;
    private UUID clubId;
    private League league;
    private LeagueTeam police;
    private LeagueTeam laudium;
    private final Authentication admin = new TestingAuthenticationToken("ops", "n/a", "ROLE_platform_admin");

    @BeforeEach
    void setUp() {
        fixtures = new ManagerOverviewFixtures(context);
        w = fixtures.world();
        clubId = w.club().getId();
        league = fixtures.league(w, 11);
        fixtures.affiliate(league, w.seniors1(), w.season());
        fixtures.affiliate(league, w.seniors2(), w.season());
        police = fixtures.leagueTeam(league, w.season(), "Police 1");
        laudium = fixtures.leagueTeam(league, w.season(), "Laudium 1");
    }

    @AfterEach
    void cleanUp() {
        jdbc.update("delete from import_alias where club_id = ?", clubId);
        jdbc.update("delete from import_batch_entity where batch_id in (select id from import_batch where club_id = ?)", clubId);
        jdbc.update("delete from import_batch where club_id = ?", clubId);
        fixtures.cleanUp();
    }

    // ---- helpers ----

    private ImportScopeDto scope(ImportScopeMode mode) {
        return new ImportScopeDto(mode, null,
                Map.of("leagueId", league.getId().toString(), "seasonId", w.season().getId().toString()));
    }

    private ImportBatchDto preview(ImportScopeMode mode, String... lines) {
        String csv = HEADER + String.join("\n", lines) + "\n";
        return importService.preview(admin, clubId, TYPE, "schedule.csv", csv.getBytes(StandardCharsets.UTF_8), scope(mode), ZONE);
    }

    private static Resolution link(String key, String kind, UUID id) {
        return new Resolution(key, ImportResolutionKind.LINK, kind, id, null, false, null);
    }

    private static Resolution create(String key) {
        return new Resolution(key, ImportResolutionKind.CREATE, null, null, null, false, null);
    }

    private ImportDecisionsDto decisions(List<Resolution> resolutions, List<String> ours, Map<String, Object> options,
            boolean updateAll, List<RowValues> edits, List<RowValues> added, List<Acknowledgement> acks) {
        return new ImportDecisionsDto(null, ours, resolutions, null, updateAll, acks, options, edits, added);
    }

    private ImportBatchDto save(ImportBatchDto batch, ImportDecisionsDto d) {
        return importService.saveDecisions(admin, clubId, batch.id(), new ImportDecisionsRequest(batch.revision(), d));
    }

    /** Saves the decisions, then acknowledges every warning raised, as the wizard's ticks do. */
    private ImportBatchDto confirmable(ImportBatchDto batch, ImportDecisionsDto d) {
        ImportBatchDto saved = save(batch, d);
        List<Acknowledgement> acks = new ArrayList<>();
        saved.issues().stream().filter(i -> i.severity() == ImportIssueSeverity.WARNING)
                .map(i -> i.code()).distinct().forEach(code -> acks.add(new Acknowledgement(code, null)));
        if (!acks.isEmpty()) {
            saved = save(saved, new ImportDecisionsDto(d.excludedRows(), d.identifiedAsOurs(), d.resolutions(), d.updates(),
                    d.updateAllDiffering(), acks, d.options(), d.rowEdits(), d.addedRows()));
        }
        assertThat(saved.confirmationToken()).as("issues: %s", saved.issues()).isNotNull();
        return saved;
    }

    private ImportBatchDto commit(ImportBatchDto c) {
        return importService.commit(admin, clubId, c.id(), new CommitImportRequest(c.revision(), c.confirmationToken(), c.creationsDigest()));
    }

    private List<Resolution> ourPolice() {
        return List.of(link("Villagers 1", "OWN_TEAM", w.seniors1().getId()), link("Police 1", "LEAGUE_TEAM", police.getId()));
    }

    private ImportDecisionsDto withResolutions(List<Resolution> r) {
        return decisions(r, null, null, false, null, null, null);
    }

    private List<Match> leagueMatches() {
        return matchRepository.findByLeagueIdAndSeasonId(league.getId(), w.season().getId());
    }

    private Instant at(String date, String time) {
        return LocalDateTime.of(LocalDate.parse(date), java.time.LocalTime.parse(time)).atZone(ZoneId.of(ZONE)).toInstant();
    }

    private String row(String date, String time, String home, String away, String venue) {
        return date + "," + time + "," + home + "," + away + "," + venue + ",";
    }

    private Match manualMatch(String date, String time, String opponentText) {
        return matchRepository.save(Match.builder().clubId(clubId).homeTeamId(w.seniors1().getId()).awayTeamName(opponentText)
                .leagueId(league.getId()).seasonId(w.season().getId()).matchDate(at(date, time)).venue("Brits Oval").active(true).build());
    }

    private String statusOf(UUID batchId) {
        return jdbc.queryForObject("select status from import_batch where id = ?", String.class, batchId);
    }

    // ---- commit, report, delete ----

    @Test
    void fileImportCommitsMatchesRecordsEntitiesAndDeleteRemovesOnlyThem() {
        ImportBatchDto c = confirmable(preview(ImportScopeMode.ALL, row(SUN1, "08:00", "Villagers 1", "Police 1", "Brits Oval"),
                row(SUN1, "11:00", "Villagers 2", "Laudium 1", "Brits Oval")),
                withResolutions(List.of(link("Villagers 1", "OWN_TEAM", w.seniors1().getId()), link("Villagers 2", "OWN_TEAM", w.seniors2().getId()),
                        link("Police 1", "LEAGUE_TEAM", police.getId()), link("Laudium 1", "LEAGUE_TEAM", laudium.getId()))));
        Match manual = manualMatch(SUN2, "08:00", "Somebody");

        ImportBatchDto done = commit(c);
        assertThat(done.status()).isEqualTo(ImportBatchStatus.COMMITTED);
        assertThat(leagueMatches()).hasSize(3);
        assertThat(jdbc.queryForObject("select count(*) from import_batch_entity where batch_id = ? and entity_type = 'MATCH'",
                Long.class, done.id())).isEqualTo(2);
        assertThat(importService.commit(admin, clubId, c.id(), new CommitImportRequest(c.revision(), c.confirmationToken(), c.creationsDigest())).status())
                .as("a retry returns the report").isEqualTo(ImportBatchStatus.COMMITTED);
        assertThat(leagueMatches()).hasSize(3);

        assertThat(importService.deletionCheck(clubId, done.id()).deletable()).isTrue();
        importService.delete(admin, clubId, done.id(), new DeleteImportRequest(true));
        assertThat(leagueMatches()).extracting(Match::getId).containsExactly(manual.getId());
        assertThat(statusOf(done.id())).isEqualTo("DELETED");
    }

    // ---- the re-import cases of spec 098 ----

    @Test
    void case1_theSameFileTwiceCreatesNothingTheSecondTime() {
        String line = row(SUN1, "08:00", "Villagers 1", "Police 1", "Brits Oval");
        commit(confirmable(preview(ImportScopeMode.ALL, line), withResolutions(ourPolice())));

        ImportBatchDto second = save(preview(ImportScopeMode.ALL, line), withResolutions(ourPolice()));
        assertThat(second.earlierImportWarning()).contains("importing it again will skip");
        assertThat(second.plannedChanges()).isEmpty();
        assertThat(importService.rows(clubId, second.id(), null, null, org.springframework.data.domain.PageRequest.of(0, 10))
                .getContent()).extracting(ImportRowDto::outcome).containsExactly(ImportOutcome.DUPLICATE);
        assertThat(leagueMatches()).hasSize(1);
    }

    @Test
    void case2_oursOnlyThenFullCreatesOnlyTheAdditionalMatchAndLinksTheCreatedTeam() {
        String ours = row(SUN1, "08:00", "Villagers 1", "Police 1", "Brits Oval");
        String foreign = row(SUN1, "11:00", "Laudium 1", "Brits Vets 1", "Brits Oval");
        ImportBatchDto first = preview(ImportScopeMode.OURS_ONLY, ours, foreign);
        ImportBatchDto c1 = confirmable(first, decisions(ourPolice(), List.of("Villagers 1"), null, false, null, null, null));
        assertThat(c1.counts()).containsEntry("skippedNotOurs", 1);
        commit(c1);
        assertThat(leagueMatches()).hasSize(1);

        List<Resolution> all = new ArrayList<>(ourPolice());
        all.add(link("Laudium 1", "LEAGUE_TEAM", laudium.getId()));
        all.add(create("Brits Vets 1"));
        ImportBatchDto c2 = confirmable(preview(ImportScopeMode.ALL, ours, foreign), withResolutions(all));
        assertThat(c2.plannedChanges()).extracting("entityType").containsExactly("LEAGUE_TEAM", "MATCH");
        commit(c2);
        assertThat(leagueMatches()).hasSize(2);
        assertThat(leagueTeamRepository.findByLeagueAndSeason(league.getId(), w.season().getId()))
                .extracting(LeagueTeam::getName).contains("Brits Vets 1");
    }

    @Test
    void case3_aChangedTimeShowsDiffersAndUpdatesOnlyWhenOptedIn() {
        commit(confirmable(preview(ImportScopeMode.ALL, row(SUN1, "08:00", "Villagers 1", "Police 1", "Brits Oval")), withResolutions(ourPolice())));
        String changed = row(SUN1, "10:00", "Villagers 1", "Police 1", "Brits Oval");

        ImportBatchDto noOptIn = confirmable(preview(ImportScopeMode.ALL, changed), withResolutions(ourPolice()));
        assertThat(noOptIn.plannedChanges()).isEmpty();
        assertThat(importService.rows(clubId, noOptIn.id(), null, null, org.springframework.data.domain.PageRequest.of(0, 10))
                .getContent()).extracting(ImportRowDto::outcome).containsExactly(ImportOutcome.DIFFERS);
        assertThat(leagueMatches().get(0).getMatchDate()).isEqualTo(at(SUN1, "08:00"));

        ImportBatchDto optIn = confirmable(preview(ImportScopeMode.ALL, changed), decisions(ourPolice(), null, null, true, null, null, null));
        assertThat(optIn.plannedChanges()).singleElement().satisfies(p -> assertThat(p.action().name()).isEqualTo("UPDATED"));
        commit(optIn);
        assertThat(leagueMatches()).hasSize(1);
        assertThat(leagueMatches().get(0).getMatchDate()).isEqualTo(at(SUN1, "10:00"));
    }

    @Test
    void case4_aManualMatchIsAnExistingDuplicateAndADifferentTimeIsDiffers() {
        manualMatch(SUN1, "08:00", "POLICE 1");
        ImportBatchDto same = save(preview(ImportScopeMode.ALL, row(SUN1, "08:00", "Villagers 1", "Police 1", "Brits Oval")), withResolutions(ourPolice()));
        assertThat(same.plannedChanges()).isEmpty();
        assertThat(importService.rows(clubId, same.id(), null, null, org.springframework.data.domain.PageRequest.of(0, 10))
                .getContent().get(0).outcome()).isEqualTo(ImportOutcome.DUPLICATE);

        ImportBatchDto other = save(preview(ImportScopeMode.ALL, row(SUN1, "09:30", "Villagers 1", "Police 1", "Brits Oval")), withResolutions(ourPolice()));
        assertThat(importService.rows(clubId, other.id(), null, null, org.springframework.data.domain.PageRequest.of(0, 10))
                .getContent().get(0).outcome()).isEqualTo(ImportOutcome.DIFFERS);
        assertThat(leagueMatches()).hasSize(1);
    }

    // ---- extend league dates ----

    @Test
    void extendLeagueDatesWidensTheRangeOnCommitAndDeleteRestoresIt() {
        leagueSeasonRepository.save(LeagueSeason.builder().leagueId(league.getId()).seasonId(w.season().getId())
                .startDate(LocalDate.of(2031, 6, 5)).endDate(LocalDate.of(2031, 6, 30)).build());
        ImportBatchDto blocked = save(preview(ImportScopeMode.ALL, row(SUN1, "08:00", "Villagers 1", "Police 1", "Brits Oval")), withResolutions(ourPolice()));
        assertThat(blocked.confirmationToken()).isNull();
        assertThat(blocked.issues()).extracting("code").contains("DATE_OUTSIDE_LEAGUE_DATES");

        ImportBatchDto c = confirmable(preview(ImportScopeMode.ALL, row(SUN1, "08:00", "Villagers 1", "Police 1", "Brits Oval")),
                decisions(ourPolice(), null, Map.of("extendLeagueDates", true), false, null, null, null));
        assertThat(c.plannedChanges()).extracting("entityType").contains("LEAGUE_SEASON");
        ImportBatchDto done = commit(c);
        assertThat(leagueSeasonRepository.findByLeagueIdAndSeasonId(league.getId(), w.season().getId()).orElseThrow().getStartDate())
                .isEqualTo(LocalDate.of(2031, 6, 1));

        importService.delete(admin, clubId, done.id(), new DeleteImportRequest(true));
        assertThat(leagueSeasonRepository.findByLeagueIdAndSeasonId(league.getId(), w.season().getId()).orElseThrow().getStartDate())
                .isEqualTo(LocalDate.of(2031, 6, 5));
    }

    // ---- typed-in import (spec 125, migration 059) ----

    @Test
    void aTypedInImportIsPersistedAsManualAndRunsToCommitAndDelete() {
        ImportBatchDto blank = importService.startBlank(admin, clubId, TYPE, scope(ImportScopeMode.ALL), ZONE);
        assertThat(jdbc.queryForObject("select source from import_batch where id = ?", String.class, blank.id())).isEqualTo("MANUAL");
        assertThat(blank.firstRows()).isEmpty();

        RowValues added = new RowValues(1001, Map.of("date", SUN1, "time", "08:00", "home", "Villagers 1", "away", "Police 1", "venue", "Brits Oval"));
        ImportBatchDto c = confirmable(blank, decisions(ourPolice(), null, null, false, null, List.of(added), null));
        ImportBatchDto done = commit(c);
        assertThat(leagueMatches()).hasSize(1);
        assertThat(jdbc.queryForObject("select detail->>'rowOrigin' from import_batch_entity where batch_id = ? and entity_type = 'MATCH'",
                String.class, done.id())).isEqualTo("ADDED");
        importService.delete(admin, clubId, done.id(), new DeleteImportRequest(true));
        assertThat(leagueMatches()).isEmpty();
    }

    @Test
    void anEditedValueIsWhatIsCommittedAndATokenFromBeforeTheEditIsRefused() {
        ImportBatchDto preview = preview(ImportScopeMode.ALL, row(SUN1, "08:00", "Villagers 1", "Police 1", "Brits Oval"));
        ImportBatchDto before = confirmable(preview, withResolutions(ourPolice()));
        ImportBatchDto edited = confirmable(before, decisions(ourPolice(), null, null, false,
                List.of(new RowValues(2, Map.of("time", "09:15"))), null, null));

        assertThatThrownBy(() -> commit(before)).isInstanceOf(ImportConfirmationInvalidException.class);
        assertThat(leagueMatches()).isEmpty();
        ImportBatchDto second = save(edited, decisions(ourPolice(), null, null, false,
                List.of(new RowValues(2, Map.of("time", "09:45"))), null, null));
        assertThatThrownBy(() -> commit(edited)).as("a second edit after the token invalidates it")
                .isInstanceOf(ImportConfirmationInvalidException.class);
        commit(second);
        assertThat(leagueMatches()).singleElement().satisfies(m -> assertThat(m.getMatchDate()).isEqualTo(at(SUN1, "09:45")));
    }

    @Test
    void addedRowsBeyondTheCapAreRefused() {
        ImportBatchDto blank = importService.startBlank(admin, clubId, TYPE, scope(ImportScopeMode.ALL), ZONE);
        List<RowValues> many = new ArrayList<>();
        for (int i = 0; i < 1001; i++) {
            many.add(new RowValues(1001 + i, Map.of("home", "x")));
        }
        assertThatThrownBy(() -> save(blank, decisions(null, null, null, false, null, many, null)))
                .hasMessageContaining("at most 1000 rows");
    }

    // ---- expiry job ----

    @Test
    void theExpiryJobExpiresOldPreviewsRetiresPayloadsAndDeletesOldNeverCommittedBatches() {
        ImportBatchDto stale = importService.startBlank(admin, clubId, TYPE, scope(ImportScopeMode.ALL), ZONE);
        ImportBatchDto fresh = importService.startBlank(admin, clubId, TYPE, scope(ImportScopeMode.ALL), ZONE);
        jdbc.update("update import_batch set expires_at = now() - interval '1 hour' where id = ?", stale.id());
        ImportBatchDto old = importService.startBlank(admin, clubId, TYPE, scope(ImportScopeMode.ALL), ZONE);
        importService.discard(admin, clubId, old.id());
        jdbc.update("update import_batch set created_at = now() - interval '100 days' where id = ?", old.id());
        ImportBatchDto committed = commit(confirmable(preview(ImportScopeMode.ALL, row(SUN1, "08:00", "Villagers 1", "Police 1", "V")), withResolutions(ourPolice())));
        jdbc.update("update import_batch set committed_at = now() - interval '31 days' where id = ?", committed.id());

        expiryJob.runScheduled(); // disabled in tests: the scheduled entry point must do nothing
        assertThat(statusOf(stale.id())).isEqualTo("PREVIEW");

        assertThat(expiry.runExpiry(Instant.now())).isEqualTo(3);
        assertThat(statusOf(stale.id())).isEqualTo("EXPIRED");
        assertThat(jdbc.queryForObject("select payload is null from import_batch where id = ?", Boolean.class, stale.id())).isTrue();
        assertThat(statusOf(fresh.id())).isEqualTo("PREVIEW");
        assertThat(jdbc.queryForObject("select count(*) from import_batch where id = ?", Long.class, old.id())).isZero();
        assertThat(statusOf(committed.id())).isEqualTo("COMMITTED");
        assertThat(jdbc.queryForObject("select payload is null from import_batch where id = ?", Boolean.class, committed.id())).isTrue();
        assertThat(expiry.runExpiry(Instant.now())).as("nothing more is due").isZero();
    }

    // ---- new repository queries ----

    @Test
    void leagueTeamQueriesFindOtherSeasonsAndOtherLeagues() {
        var oldSeason = fixtures.season(w.club(), "2030");
        LeagueTeam previous = fixtures.leagueTeam(league, oldSeason, "Old Team");
        League other = fixtures.league(w, 11);
        LeagueTeam elsewhere = fixtures.leagueTeam(other, w.season(), "Elsewhere");

        assertThat(leagueTeamRepository.findByLeagueIdAndSeasonIdNot(league.getId(), w.season().getId()))
                .extracting(LeagueTeam::getId).containsExactly(previous.getId());
        assertThat(leagueTeamRepository.findByLeagueIdIn(List.of(other.getId()))).extracting(LeagueTeam::getId).containsExactly(elsewhere.getId());
        assertThat(leagueTeamRepository.findByLeagueIdIn(List.of(league.getId(), other.getId()))).hasSize(4);
    }

    @Test
    void matchQueriesFindByLeagueAndSeasonDistinctVenuesAndLockByIds() {
        Match a = manualMatch(SUN1, "08:00", "A");
        Match b = manualMatch(SUN2, "08:00", "B");
        Match noVenue = matchRepository.save(Match.builder().clubId(clubId).homeTeamId(w.seniors1().getId()).awayTeamName("C")
                .leagueId(league.getId()).seasonId(w.season().getId()).matchDate(at(SUN2, "12:00")).venue("").active(false).build());
        fixtures.match(w, w.seniors1(), null, Instant.now(), true, null);

        assertThat(matchRepository.findByLeagueIdAndSeasonId(league.getId(), w.season().getId()))
                .extracting(Match::getId).containsExactlyInAnyOrder(a.getId(), b.getId(), noVenue.getId());
        assertThat(matchRepository.findByLeagueIdAndSeasonId(UUID.randomUUID(), w.season().getId())).isEmpty();
        assertThat(matchRepository.findDistinctVenuesByClubId(clubId)).containsExactlyInAnyOrder("Brits Oval", "Ground");
        List<Match> locked = tx.execute(s -> matchRepository.findAllByIdForUpdate(List.of(a.getId(), noVenue.getId())));
        assertThat(locked).extracting(Match::getId).containsExactlyInAnyOrder(a.getId(), noVenue.getId());
    }

    // ---- HTTP: tenancy and the typed-in flow ----

    private static final String BASE = "/api/v1/manage/clubs/{clubId}/imports";

    private JsonNode json(org.springframework.test.web.servlet.ResultActions r) throws Exception {
        return objectMapper.readTree(r.andReturn().getResponse().getContentAsString());
    }

    @Test
    void theTypedInFlowRunsThroughHttpAndOthersAreRefused() throws Exception {
        JwtRequestPostProcessor clubAdmin = fixtures.clubAdmin(w);
        JwtRequestPostProcessor stranger = fixtures.clubAdmin(fixtures.world());
        JwtRequestPostProcessor sectionManager = fixtures.sectionManager(w.seniors());
        String scopeJson = objectMapper.writeValueAsString(scope(ImportScopeMode.ALL));

        mockMvc.perform(post(BASE + "/{type}/blank", clubId, TYPE).with(stranger).contentType(MediaType.APPLICATION_JSON).content(scopeJson))
                .andExpect(status().isForbidden());
        mockMvc.perform(post(BASE + "/{type}/blank", clubId, TYPE).with(sectionManager).contentType(MediaType.APPLICATION_JSON).content(scopeJson))
                .andExpect(status().isForbidden());
        mockMvc.perform(get(BASE + "/types", clubId).with(PlatformRoleJwtPostProcessors.platformAdmin())).andExpect(status().isOk());

        JsonNode blank = json(mockMvc.perform(post(BASE + "/{type}/blank?timeZone=" + ZONE, clubId, TYPE).with(clubAdmin)
                .contentType(MediaType.APPLICATION_JSON).content(scopeJson)).andExpect(status().isOk()));
        String id = blank.path("id").asText();
        assertThat(blank.path("source").asText()).isEqualTo("MANUAL");

        mockMvc.perform(get(BASE + "/{id}", clubId, id).with(stranger)).andExpect(status().isForbidden());
        mockMvc.perform(get(BASE + "/{id}", fixtures.world().club().getId(), id).with(clubAdmin)).andExpect(status().isForbidden());

        RowValues added = new RowValues(1001, Map.of("date", SUN1, "time", "08:00", "home", "Villagers 1", "away", "Police 1", "venue", "Brits Oval"));
        ImportDecisionsDto d = decisions(ourPolice(), null, null, false, null, List.of(added), null);
        JsonNode decided = json(mockMvc.perform(put(BASE + "/{id}/decisions", clubId, id).with(clubAdmin).contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new ImportDecisionsRequest(blank.path("revision").asInt(), d)))).andExpect(status().isOk()));
        assertThat(decided.path("confirmationToken").asText()).isNotBlank();

        String commitBody = objectMapper.writeValueAsString(Map.of("revision", decided.path("revision").asInt(),
                "confirmationToken", decided.path("confirmationToken").asText(), "confirmedCreationsDigest", decided.path("creationsDigest").asText()));
        mockMvc.perform(post(BASE + "/{id}/commit", clubId, id).with(stranger).contentType(MediaType.APPLICATION_JSON).content(commitBody))
                .andExpect(status().isForbidden());
        assertThat(leagueMatches()).isEmpty();
        mockMvc.perform(post(BASE + "/{id}/commit", clubId, id).with(clubAdmin).contentType(MediaType.APPLICATION_JSON).content(commitBody))
                .andExpect(status().isOk());
        assertThat(leagueMatches()).hasSize(1);
        mockMvc.perform(post(BASE + "/{id}/commit", clubId, id).with(clubAdmin).contentType(MediaType.APPLICATION_JSON)
                .content(commitBody.replace(decided.path("confirmationToken").asText(), "tampered.token"))).andExpect(status().isConflict());
        mockMvc.perform(post(BASE + "/{id}/delete", clubId, id).with(clubAdmin).contentType(MediaType.APPLICATION_JSON).content("{\"confirm\":true}"))
                .andExpect(status().isOk());
        assertThat(leagueMatches()).isEmpty();
    }
}
