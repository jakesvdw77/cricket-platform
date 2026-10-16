package com.cricketlegend.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.cricketlegend.AbstractIntegrationTest;
import com.cricketlegend.domain.Match;
import com.cricketlegend.support.ResultImportFixtures;
import com.cricketlegend.support.ResultImportFixtures.Club;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.nio.charset.StandardCharsets;
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
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.JwtRequestPostProcessor;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockMultipartHttpServletRequestBuilder;

/**
 * docs/specs/104-match-results-import-adaptors.md, Test Plan "Backend integration": the three import routes through
 * real HTTP against real Postgres. Discovery, preview as multipart (a JSON {@code request} part and a {@code file}
 * part, or a pasted document, including one wrapped in a code fence), resolve, the error ProblemDetail bodies ({@code
 * errors}, {@code totalErrors}, {@code supported}, {@code otherMatchId}), tenancy and section scoping. Not
 * {@code @Transactional}; {@link ResultImportFixtures} removes what it seeds.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(AbstractIntegrationTest.class)
class ResultImportRoutesIntegrationTest {

    private static final String BASE = "/api/v1/manage/clubs/{clubId}/results/import";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ApplicationContext context;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private JdbcTemplate jdbc;

    private ResultImportFixtures fixtures;
    private Club club;
    private UUID clubId;
    private Match match;
    private JwtRequestPostProcessor admin;

    @BeforeEach
    void setUp() {
        fixtures = new ResultImportFixtures(context);
        club = fixtures.club();
        clubId = club.world().club().getId();
        match = fixtures.match(club);
        admin = fixtures.shared().clubAdmin(club.world());
    }

    @AfterEach
    void cleanUp() {
        fixtures.cleanUp();
    }

    // ---- helpers ----

    private JsonNode body(ResultActions actions) throws Exception {
        return objectMapper.readTree(actions.andReturn().getResponse().getContentAsString());
    }

    private String document(String externalId, String second) {
        return ResultImportFixtures.document(match, externalId, second);
    }

    private static MockMultipartFile part(String name, String filename, String type, String content) {
        return new MockMultipartFile(name, filename, type, content.getBytes(StandardCharsets.UTF_8));
    }

    private String requestPart(String format, String content, UUID matchId) throws Exception {
        ObjectNode request = objectMapper.createObjectNode().put("adaptor", "JSON").put("format", format);
        if (content != null) {
            request.put("content", content);
        }
        if (matchId != null) {
            request.put("matchId", matchId.toString());
        }
        return objectMapper.writeValueAsString(request);
    }

    private ResultActions previewPaste(JwtRequestPostProcessor caller, UUID inClub, String pasted, UUID matchId)
            throws Exception {
        return mockMvc.perform(multipart(BASE + "/preview", inClub)
                .file(part("request", null, MediaType.APPLICATION_JSON_VALUE, requestPart("JSON", pasted, matchId)))
                .with(caller));
    }

    private ResultActions previewFile(JwtRequestPostProcessor caller, UUID inClub, String fileContent, UUID matchId)
            throws Exception {
        MockMultipartHttpServletRequestBuilder request = multipart(BASE + "/preview", inClub)
                .file(part("request", null, MediaType.APPLICATION_JSON_VALUE, requestPart("JSON", null, matchId)))
                .file(part("file", "match-report.json", MediaType.APPLICATION_JSON_VALUE, fileContent));
        return mockMvc.perform(request.with(caller));
    }

    /** The resolve request the wizard sends after a preview: the document as returned, plus the manager's choices. */
    private String resolveBody(JsonNode preview, UUID onto, boolean replace) throws Exception {
        ObjectNode request = objectMapper.createObjectNode();
        request.set("document", preview.get("document"));
        request.put("matchId", onto.toString());
        ArrayNode mapping = request.putArray("teamMapping");
        mapping.addObject().put("fileKey", "A").put("fileName", "Villagers 1").put("side", "HOME");
        mapping.addObject().put("fileKey", "B").put("fileName", "Occasionals").put("side", "AWAY");
        request.put("replaceExistingDraft", replace);
        return objectMapper.writeValueAsString(request);
    }

    private ResultActions resolve(JwtRequestPostProcessor caller, UUID inClub, String body) throws Exception {
        return mockMvc.perform(post(BASE + "/resolve", inClub).with(caller)
                .contentType(MediaType.APPLICATION_JSON).content(body));
    }

    private long results() {
        Long n = jdbc.queryForObject("select count(*) from match_result where club_id = ?", Long.class, clubId);
        return n == null ? 0 : n;
    }

    // ---- discovery ----

    @Test
    void discoveryListsTheJsonAdaptorWithItsFormatsLimitsExampleAndNoAi() throws Exception {
        JsonNode catalogue = body(mockMvc.perform(get(BASE + "/adaptors", clubId).with(admin))
                .andExpect(status().isOk()));

        JsonNode json = null;
        for (JsonNode adaptor : catalogue.path("adaptors")) {
            if ("JSON".equals(adaptor.path("type").asText())) {
                json = adaptor;
            }
        }
        assertThat(json).as("the JSON adaptor is in the catalogue").isNotNull();
        assertThat(json.path("type").asText()).isEqualTo("JSON");
        assertThat(json.path("displayName").asText()).isNotBlank();
        assertThat(json.path("aiAllowed").asBoolean()).isFalse();
        assertThat(json.path("example").asText()).contains("schemaVersion");
        assertThat(json.path("conversionPrompt").asText()).isNotBlank();
        JsonNode input = json.path("inputs").get(0);
        assertThat(input.path("format").asText()).isEqualTo("JSON");
        assertThat(input.path("textBased").asBoolean()).isTrue();
        assertThat(input.path("acceptsPaste").asBoolean()).isTrue();
        assertThat(catalogue.path("limits").path("maxPasteCharacters").asInt()).isPositive();
        assertThat(catalogue.path("limits").path("maxFileBytes").asLong()).isPositive();
    }

    // ---- preview ----

    @Test
    void aPastedDocumentIsPreviewedAndNothingIsWritten() throws Exception {
        JsonNode preview = body(previewPaste(admin, clubId, document("ext-1", "B Player"), match.getId())
                .andExpect(status().isOk()));

        assertThat(preview.path("document").path("source").path("adaptor").asText()).isEqualTo("JSON");
        assertThat(preview.path("matchCandidates").get(0).path("matchId").asText()).isEqualTo(match.getId().toString());
        assertThat(preview.path("teamMapping").get(0).path("side").asText()).isEqualTo("HOME");
        assertThat(preview.path("teamMapping").get(1).path("side").asText()).isEqualTo("AWAY");
        assertThat(preview.path("document").path("teams").get(0).path("exactness").asText()).isEqualTo("EXACT");
        assertThat(results()).isZero();
    }

    @Test
    void anUploadedFileIsPreviewedThroughTheFilePart() throws Exception {
        JsonNode preview = body(previewFile(admin, clubId, document("ext-1", "B Player"), null)
                .andExpect(status().isOk()));

        assertThat(preview.path("document").path("source").path("fileName").asText()).isEqualTo("match-report.json");
        assertThat(preview.path("matchCandidates").get(0).path("matchId").asText()).isEqualTo(match.getId().toString());
        assertThat(results()).isZero();
    }

    @Test
    void aPastedDocumentInsideACodeFenceIsAccepted() throws Exception {
        String fenced = "Here is the JSON you asked for:\n\n```json\n" + document("ext-1", "B Player") + "```\n";
        String bare = "```json\n" + document("ext-1", "B Player") + "```";

        previewPaste(admin, clubId, bare, match.getId()).andExpect(status().isOk());
        // prose before the fence is not part of the document and is still refused
        previewPaste(admin, clubId, fenced, match.getId()).andExpect(status().isBadRequest());
    }

    @Test
    void aDocumentThatIsNotJsonIsRefusedWithAPlainMessageAndTheLocation() throws Exception {
        JsonNode problem = body(previewPaste(admin, clubId, "{ \"schemaVersion\": 1, ", null)
                .andExpect(status().isBadRequest()));

        assertThat(problem.path("detail").asText()).contains("JSON");
        assertThat(problem.has("errors")).isFalse();
    }

    @Test
    void aDocumentThatBreaksTheCommonFormatListsTheErrorsWithPathCodeAndMessageAndTheTotal() throws Exception {
        String bad = document("ext-1", "B Player").replace("\"schemaVersion\": 1", "\"schemaVersion\": 2");

        JsonNode problem = body(previewPaste(admin, clubId, bad, null).andExpect(status().isBadRequest()));

        assertThat(problem.path("totalErrors").asInt()).isEqualTo(problem.path("errors").size()).isPositive();
        JsonNode first = problem.path("errors").get(0);
        assertThat(first.path("path").asText()).isEqualTo("schemaVersion");
        assertThat(first.path("code").asText()).isEqualTo("UNSUPPORTED_SCHEMA_VERSION");
        assertThat(first.path("message").asText()).isNotBlank();
        assertThat(problem.has("supported")).isFalse();
    }

    @Test
    void anUnknownPropertyIsAnErrorNotSilentlyDropped() throws Exception {
        String bad = document("ext-1", "B Player").replace("\"venue\"", "\"vnue\"");

        JsonNode problem = body(previewPaste(admin, clubId, bad, null).andExpect(status().isBadRequest()));

        assertThat(problem.toString()).contains("vnue");
    }

    @Test
    void aFormatTheAdaptorDoesNotSupportIsRefusedListingWhatItDoes() throws Exception {
        JsonNode problem = body(mockMvc.perform(multipart(BASE + "/preview", clubId)
                        .file(part("request", null, MediaType.APPLICATION_JSON_VALUE,
                                requestPart("PDF", null, null)))
                        .file(part("file", "report.pdf", "application/pdf", "%PDF-1.4"))
                        .with(admin))
                .andExpect(status().isBadRequest()));

        assertThat(problem.path("supported")).hasSize(1);
        assertThat(problem.path("supported").get(0).asText()).containsIgnoringCase("json");
    }

    @Test
    void aPreviewWithBothAFileAndPastedContentOrNeitherIsRefused() throws Exception {
        mockMvc.perform(multipart(BASE + "/preview", clubId)
                        .file(part("request", null, MediaType.APPLICATION_JSON_VALUE,
                                requestPart("JSON", document(null, "B Player"), null)))
                        .file(part("file", "a.json", MediaType.APPLICATION_JSON_VALUE, document(null, "B Player")))
                        .with(admin))
                .andExpect(status().isBadRequest());
        previewPaste(admin, clubId, "", null).andExpect(status().isBadRequest());
    }

    // ---- resolve ----

    @Test
    void resolveSavesOneDraftAndReportsTheGuessThenAnUnacknowledgedRepeatIsAConflict() throws Exception {
        JsonNode preview = body(previewPaste(admin, clubId, document("ext-1", "B Player"), match.getId())
                .andExpect(status().isOk()));

        JsonNode resolved = body(resolve(admin, clubId, resolveBody(preview, match.getId(), false))
                .andExpect(status().isOk()));

        assertThat(resolved.path("matchId").asText()).isEqualTo(match.getId().toString());
        assertThat(resolved.path("resultStatus").asText()).isEqualTo("DRAFT");
        assertThat(resolved.path("counts").path("normalised").asInt()).isEqualTo(1);
        assertThat(resolved.path("validation").path("canPublish").asBoolean()).isFalse();
        assertThat(resolved.path("validation").path("issues").toString()).contains("IMPORTED_NAME_UNCONFIRMED");
        assertThat(results()).isEqualTo(1);

        // the same provider id previewed again now reports where it lives
        JsonNode again = body(previewPaste(admin, clubId, document("ext-1", "B Player"), null)
                .andExpect(status().isOk()));
        assertThat(again.path("existingForExternalId").path("matchId").asText()).isEqualTo(match.getId().toString());
        assertThat(again.path("existingForExternalId").path("status").asText()).isEqualTo("DRAFT");

        resolve(admin, clubId, resolveBody(preview, match.getId(), false)).andExpect(status().isConflict());
        resolve(admin, clubId, resolveBody(preview, match.getId(), true)).andExpect(status().isOk());
        assertThat(results()).isEqualTo(1);
    }

    @Test
    void aPublishedResultIsAConflictForResolve() throws Exception {
        JsonNode preview = body(previewPaste(admin, clubId, document("ext-1", "Bela Player"), match.getId())
                .andExpect(status().isOk()));
        resolve(admin, clubId, resolveBody(preview, match.getId(), false)).andExpect(status().isOk());
        mockMvc.perform(post("/api/v1/manage/clubs/{c}/matches/{m}/result/publish", clubId, match.getId())
                        .with(admin).contentType(MediaType.APPLICATION_JSON).content("{\"acknowledgedWarnings\":true}"))
                .andExpect(status().isOk());

        resolve(admin, clubId, resolveBody(preview, match.getId(), true)).andExpect(status().isConflict());

        assertThat(jdbc.queryForObject("select status from match_result where match_id = ?", String.class, match.getId()))
                .isEqualTo("PUBLISHED");
    }

    @Test
    void theSameProviderIdOntoAnotherMatchIsAConflictNamingTheOtherMatch() throws Exception {
        JsonNode preview = body(previewPaste(admin, clubId, document("ext-1", "B Player"), match.getId())
                .andExpect(status().isOk()));
        resolve(admin, clubId, resolveBody(preview, match.getId(), false)).andExpect(status().isOk());
        Match second = fixtures.shared().match(club.world(), club.world().seniors1(), null, match.getMatchDate());

        JsonNode problem = body(resolve(admin, clubId, resolveBody(preview, second.getId(), false))
                .andExpect(status().isConflict()));

        assertThat(problem.path("otherMatchId").asText()).isEqualTo(match.getId().toString());
        assertThat(results()).isEqualTo(1);
    }

    @Test
    void resolveRefusesATeamMappingThatIsNotOneToOneWithTheErrorsListed() throws Exception {
        JsonNode preview = body(previewPaste(admin, clubId, document("ext-1", "B Player"), match.getId())
                .andExpect(status().isOk()));
        ObjectNode request = (ObjectNode) objectMapper.readTree(resolveBody(preview, match.getId(), false));
        ((ObjectNode) request.path("teamMapping").get(1)).put("side", "HOME");

        JsonNode problem = body(resolve(admin, clubId, objectMapper.writeValueAsString(request))
                .andExpect(status().isBadRequest()));

        assertThat(problem.path("errors").get(0).path("path").asText()).isEqualTo("teamMapping");
        assertThat(problem.path("totalErrors").asInt()).isPositive();
        assertThat(results()).isZero();
    }

    @Test
    void resolveRevalidatesTheDocumentItWasGiven() throws Exception {
        JsonNode preview = body(previewPaste(admin, clubId, document("ext-1", "B Player"), match.getId())
                .andExpect(status().isOk()));
        ObjectNode request = (ObjectNode) objectMapper.readTree(resolveBody(preview, match.getId(), false));
        ((ObjectNode) request.path("document")).put("schemaVersion", 9);

        JsonNode problem = body(resolve(admin, clubId, objectMapper.writeValueAsString(request))
                .andExpect(status().isBadRequest()));

        assertThat(problem.path("errors").get(0).path("code").asText()).isEqualTo("UNSUPPORTED_SCHEMA_VERSION");
        assertThat(results()).isZero();
    }

    @Test
    void resolveWithNoMatchIsABadRequest() throws Exception {
        JsonNode preview = body(previewPaste(admin, clubId, document("ext-1", "B Player"), match.getId())
                .andExpect(status().isOk()));
        ObjectNode request = (ObjectNode) objectMapper.readTree(resolveBody(preview, match.getId(), false));
        request.remove("matchId");

        resolve(admin, clubId, objectMapper.writeValueAsString(request)).andExpect(status().isBadRequest());
    }

    // ---- tenancy and section scoping ----

    @Test
    void anotherClubsAdminIsForbiddenOnAllThreeRoutes() throws Exception {
        Club other = fixtures.club();
        JwtRequestPostProcessor stranger = fixtures.shared().clubAdmin(other.world());
        JsonNode preview = body(previewPaste(admin, clubId, document("ext-1", "B Player"), match.getId())
                .andExpect(status().isOk()));

        mockMvc.perform(get(BASE + "/adaptors", clubId).with(stranger)).andExpect(status().isForbidden());
        previewPaste(stranger, clubId, document("ext-1", "B Player"), match.getId()).andExpect(status().isForbidden());
        resolve(stranger, clubId, resolveBody(preview, match.getId(), false)).andExpect(status().isForbidden());

        assertThat(results()).isZero();
    }

    @Test
    void aMatchOfAnotherClubIsNotFoundForAnAdminOfTheUrlsClub() throws Exception {
        Club other = fixtures.club();
        Match theirs = fixtures.match(other);
        JsonNode preview = body(previewPaste(admin, clubId, document("ext-1", "B Player"), match.getId())
                .andExpect(status().isOk()));

        previewPaste(admin, clubId, document("ext-1", "B Player"), theirs.getId()).andExpect(status().isNotFound());
        resolve(admin, clubId, resolveBody(preview, theirs.getId(), false)).andExpect(status().isNotFound());

        assertThat(jdbc.queryForObject("select count(*) from match_result where match_id = ?", Long.class,
                theirs.getId())).isZero();
    }

    @Test
    void aSectionManagerIsForbiddenForAMatchOutsideTheirSectionsAndAllowedForTheirOwn() throws Exception {
        JwtRequestPostProcessor juniorsManager = fixtures.shared().sectionManager(club.world().juniors());
        JwtRequestPostProcessor seniorsManager = fixtures.shared().sectionManager(club.world().seniors());
        JsonNode preview = body(previewPaste(admin, clubId, document("ext-1", "B Player"), match.getId())
                .andExpect(status().isOk()));

        previewPaste(juniorsManager, clubId, document("ext-1", "B Player"), match.getId())
                .andExpect(status().isForbidden());
        resolve(juniorsManager, clubId, resolveBody(preview, match.getId(), false)).andExpect(status().isForbidden());
        assertThat(results()).isZero();

        resolve(seniorsManager, clubId, resolveBody(preview, match.getId(), false)).andExpect(status().isOk());
        assertThat(results()).isEqualTo(1);
    }

    @Test
    void aCallerWithNoRoleAtAllIsForbidden() throws Exception {
        previewPaste(fixtures.shared().nobody(), clubId, document("ext-1", "B Player"), null)
                .andExpect(status().isForbidden());
    }
}
