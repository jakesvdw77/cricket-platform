package com.cricketlegend.controller;

import static com.cricketlegend.PlatformRoleJwtPostProcessors.platformAdmin;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyIterable;
import static org.mockito.Mockito.doThrow;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.cricketlegend.AbstractIntegrationTest;
import com.cricketlegend.domain.League;
import com.cricketlegend.domain.LeagueContact;
import com.cricketlegend.domain.LeagueFormat;
import com.cricketlegend.domain.LeaguePlayingConditions;
import com.cricketlegend.domain.LeagueSource;
import com.cricketlegend.domain.Season;
import com.cricketlegend.domain.SocialLink;
import com.cricketlegend.dto.DuplicateLeagueRequest;
import com.cricketlegend.dto.DuplicateLeagueResponse;
import com.cricketlegend.repository.LeagueContactRepository;
import com.cricketlegend.repository.LeaguePlayingConditionsRepository;
import com.cricketlegend.repository.LeagueRepository;
import com.cricketlegend.service.LeagueService;
import com.cricketlegend.support.ManagerOverviewFixtures;
import com.cricketlegend.support.ManagerOverviewFixtures.World;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Instant;
import java.time.LocalDate;
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
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.JwtRequestPostProcessor;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.test.web.servlet.MockMvc;

/**
 * docs/specs/096-duplicate-league.md: {@code POST .../leagues/{leagueId}/duplicate} through real HTTP against real
 * Postgres. Proves the new league's exact rows, that affiliations, league teams and matches are never copied, that the
 * source is untouched, that a mid-copy failure rolls everything back, and the 201/400/403/404/409 cases. Not
 * {@code @Transactional} (so a rollback is real); {@link ManagerOverviewFixtures} removes what it seeds.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(AbstractIntegrationTest.class)
class LeagueDuplicateIntegrationTest {

    private static final String DUPLICATE = "/api/v1/manage/clubs/{clubId}/leagues/{leagueId}/duplicate";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ApplicationContext context;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private LeagueRepository leagueRepository;

    @Autowired
    private LeaguePlayingConditionsRepository playingConditionsRepository;

    @Autowired
    private LeagueService leagueService;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @MockitoSpyBean
    private LeagueContactRepository leagueContactRepository;

    private ManagerOverviewFixtures fixtures;

    @BeforeEach
    void setUp() {
        fixtures = new ManagerOverviewFixtures(context);
    }

    @AfterEach
    void cleanUp() {
        fixtures.cleanUp();
    }

    private record Rich(World w, League source, Season s2031, Season s2030) {
    }

    /** An inactive source with profile, social links, two seasons of conditions and affiliations, 3 contacts, teams, matches. */
    private Rich seedRich() {
        World w = fixtures.world();
        Season s2030 = fixtures.season(w.club(), "2030");
        League source = fixtures.leagueWithProfile(w, "Division 1", false);
        fixtures.playingConditions(source, w.season());
        fixtures.playingConditions(source, s2030);
        fixtures.affiliate(source, w.seniors1(), w.season());
        fixtures.affiliate(source, w.seniors2(), s2030);
        fixtures.contact(source, "Sam", "Secretary", true, true);
        fixtures.contact(source, "Alex", "Treasurer", false, true);
        fixtures.contact(source, "Gone", "Umpire", false, false);
        fixtures.leagueTeam(source, w.season(), "Opponents A");
        fixtures.leagueTeam(source, s2030, "Opponents B");
        fixtures.match(w, w.seniors1(), null, Instant.parse("2031-06-01T12:00:00Z"), true, source);
        return new Rich(w, source, w.season(), s2030);
    }

    private String body(String name, List<UUID> seasonIds, Boolean conditions, Boolean contacts) throws Exception {
        return objectMapper.writeValueAsString(new DuplicateLeagueRequest(name, seasonIds, conditions, contacts));
    }

    private int count(String table, UUID leagueId) {
        return jdbcTemplate.queryForObject("select count(*) from " + table + " where league_id = ?", Integer.class, leagueId);
    }

    private int countLeagues(UUID clubId) {
        return jdbcTemplate.queryForObject("select count(*) from league where club_id = ?", Integer.class, clubId);
    }

    private League reload(UUID clubId, UUID leagueId) {
        return leagueRepository.findByClubId(clubId).stream().filter(l -> l.getId().equals(leagueId)).findFirst().orElseThrow();
    }

    private DuplicateLeagueResponse duplicateOk(JwtRequestPostProcessor jwt, World w, League source, String json)
            throws Exception {
        String response = mockMvc.perform(post(DUPLICATE, w.club().getId(), source.getId()).with(jwt)
                        .contentType(MediaType.APPLICATION_JSON).content(json))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return objectMapper.readValue(response, DuplicateLeagueResponse.class);
    }

    @Test
    void aClubAdminDuplicatesARichLeagueAndGetsExactlyTheExpectedRows() throws Exception {
        Rich rich = seedRich();
        UUID clubId = rich.w().club().getId();

        DuplicateLeagueResponse response = duplicateOk(fixtures.clubAdmin(rich.w()), rich.w(), rich.source(),
                body("  Division 2 ", List.of(rich.s2031().getId(), rich.s2030().getId()), true, true));

        assertThat(response.name()).isEqualTo("Division 2");
        assertThat(response.seasonsCopied()).isEqualTo(2);
        assertThat(response.playingConditionsCopied()).isEqualTo(2);
        assertThat(response.contactsCopied()).isEqualTo(2);

        League copy = reload(clubId, response.leagueId());
        assertThat(copy.getId()).isNotEqualTo(rich.source().getId());
        assertThat(copy.getName()).isEqualTo("Division 2");
        assertThat(copy.isActive()).isTrue();
        assertThat(copy.getSource()).isEqualTo(LeagueSource.INTERNAL);
        assertThat(copy.getUpdatedBy()).isNull();
        assertThat(copy.getCreatedAt()).isNotNull();
        assertThat(copy.getMaxPlayingXiSize()).isEqualTo(9);
        assertThat(copy.getMinAge()).isEqualTo(12);
        assertThat(copy.getMaxAge()).isEqualTo(15);
        assertThat(copy.getAgeCutoffDate()).isEqualTo(LocalDate.of(2031, 9, 1));
        assertThat(copy.getFormat()).isEqualTo(LeagueFormat.T20);
        assertThat(copy.getLogoUrl()).isEqualTo("/media/league.png");
        assertThat(copy.getPhone()).isEqualTo("0123456789");
        assertThat(copy.getWebsite()).isEqualTo("https://league.example");
        assertThat(copy.getEmail()).isEqualTo("info@league.example");
        assertThat(copy.getSocialLinks()).extracting(SocialLink::getPlatform, SocialLink::getUrl)
                .containsExactlyInAnyOrder(
                        org.assertj.core.groups.Tuple.tuple("facebook", "https://facebook.com/league"),
                        org.assertj.core.groups.Tuple.tuple("instagram", "https://instagram.com/league"));

        List<LeaguePlayingConditions> conditions = playingConditionsRepository.findByLeagueIdAndSeasonIdIn(
                copy.getId(), List.of(rich.s2031().getId(), rich.s2030().getId()));
        assertThat(conditions).hasSize(2).allSatisfy(row -> {
            assertThat(row.getDocumentUrl()).startsWith("/media/pc-");
            assertThat(row.getUploadedAt()).isEqualTo(Instant.parse("2031-02-01T10:00:00Z"));
            assertThat(row.getUploadedBy()).isNotNull();
            assertThat(row.getMaxOversPerInnings()).isEqualTo(40);
            assertThat(row.getPowerplayOvers()).isEqualTo(10);
            assertThat(row.getMaxOversPerBowler()).isEqualTo(8);
            assertThat(row.getFieldingRestrictionsNotes()).isEqualTo("Five outside the circle");
            assertThat(row.isAllowSubstitutions()).isTrue();
            assertThat(row.getPointsForWin()).isEqualTo(4);
            assertThat(row.getPointsForForfeitWin()).isEqualTo(4);
            assertThat(row.isBonusPointsEnabled()).isTrue();
            assertThat(row.getBonusBattingOversThreshold()).isEqualTo(30);
            assertThat(row.getBonusBowlingRestrictionPercentage()).isEqualTo(50);
        });
        assertThat(conditions).extracting(LeaguePlayingConditions::getSeasonId)
                .containsExactlyInAnyOrder(rich.s2031().getId(), rich.s2030().getId());

        List<LeagueContact> contacts = leagueContactRepository.findByLeagueId(copy.getId());
        assertThat(contacts).hasSize(2).allMatch(LeagueContact::isActive);
        assertThat(contacts).extracting(c -> c.getContact().getFirstName()).containsExactlyInAnyOrder("Sam", "Alex");
        assertThat(contacts.stream().filter(LeagueContact::isPrimary)).hasSize(1)
                .allSatisfy(c -> assertThat(c.getContact().getFirstName()).isEqualTo("Sam"));

        assertThat(count("league_affiliation", copy.getId())).isZero();
        assertThat(count("league_team", copy.getId())).isZero();
        assertThat(count("match", copy.getId())).isZero();
    }

    @Test
    void theSourceLeagueAndItsRowsAreUnchangedByDuplicating() throws Exception {
        Rich rich = seedRich();
        UUID sourceId = rich.source().getId();
        UUID clubId = rich.w().club().getId();
        League before = reload(clubId, sourceId);

        duplicateOk(fixtures.clubAdmin(rich.w()), rich.w(), rich.source(),
                body("Division 2", List.of(rich.s2031().getId(), rich.s2030().getId()), true, true));

        League after = reload(clubId, sourceId);
        assertThat(after.getName()).isEqualTo("Division 1");
        assertThat(after.isActive()).isFalse();
        assertThat(after.getUpdatedAt()).isEqualTo(before.getUpdatedAt());
        assertThat(after.getSocialLinks()).hasSize(2);
        assertThat(count("league_playing_conditions", sourceId)).isEqualTo(2);
        assertThat(count("league_contact", sourceId)).isEqualTo(3);
        assertThat(count("league_affiliation", sourceId)).isEqualTo(2);
        assertThat(count("league_team", sourceId)).isEqualTo(2);
        assertThat(count("match", sourceId)).isEqualTo(1);
        assertThat(countLeagues(clubId)).isEqualTo(2);
    }

    @Test
    void onlyTheChosenSeasonsConditionsAreCopiedAndSwitchedOffGroupsCopyNothing() throws Exception {
        Rich rich = seedRich();

        DuplicateLeagueResponse one = duplicateOk(fixtures.clubAdmin(rich.w()), rich.w(), rich.source(),
                body("One season", List.of(rich.s2030().getId()), true, false));
        DuplicateLeagueResponse none = duplicateOk(fixtures.clubAdmin(rich.w()), rich.w(), rich.source(),
                body("Profile only", List.of(), false, false));

        assertThat(one.playingConditionsCopied()).isEqualTo(1);
        assertThat(count("league_playing_conditions", one.leagueId())).isEqualTo(1);
        assertThat(count("league_contact", one.leagueId())).isZero();
        assertThat(none.seasonsCopied()).isZero();
        assertThat(count("league_playing_conditions", none.leagueId())).isZero();
        assertThat(count("league_contact", none.leagueId())).isZero();
    }

    @Test
    void aMidCopyFailureRollsTheWholeDuplicationBack() throws Exception {
        Rich rich = seedRich();
        UUID clubId = rich.w().club().getId();
        doThrow(new IllegalStateException("boom")).when(leagueContactRepository).saveAll(anyIterable());

        assertThatThrownBy(() -> leagueService.duplicate(clubId, rich.source().getId(),
                        new DuplicateLeagueRequest("Division 2", List.of(rich.s2031().getId()), true, true)))
                .hasMessageContaining("boom");

        assertThat(countLeagues(clubId)).isEqualTo(1);
        assertThat(jdbcTemplate.queryForObject(
                        "select count(*) from league_playing_conditions where league_id in "
                                + "(select id from league where club_id = ?)", Integer.class, clubId))
                .isEqualTo(2);
        assertThat(jdbcTemplate.queryForObject(
                        "select count(*) from league_social_link where league_id in "
                                + "(select id from league where club_id = ?)", Integer.class, clubId))
                .isEqualTo(2);
    }

    @Test
    void anotherClubsAdminIsForbidden() throws Exception {
        Rich rich = seedRich();
        World other = fixtures.world();

        mockMvc.perform(post(DUPLICATE, rich.w().club().getId(), rich.source().getId()).with(fixtures.clubAdmin(other))
                        .contentType(MediaType.APPLICATION_JSON).content(body("Division 2", null, false, false)))
                .andExpect(status().isForbidden());
        assertThat(countLeagues(rich.w().club().getId())).isEqualTo(1);
    }

    @Test
    void aPlatformAdminCanDuplicate() throws Exception {
        Rich rich = seedRich();

        DuplicateLeagueResponse response = duplicateOk(platformAdmin(), rich.w(), rich.source(),
                body("Division 2", List.of(rich.s2031().getId()), true, true));

        assertThat(response.playingConditionsCopied()).isEqualTo(1);
        assertThat(response.contactsCopied()).isEqualTo(2);
    }

    @Test
    void aLeagueOfAnotherClubIs404() throws Exception {
        Rich rich = seedRich();
        World other = fixtures.world();

        mockMvc.perform(post(DUPLICATE, other.club().getId(), rich.source().getId()).with(fixtures.clubAdmin(other))
                        .contentType(MediaType.APPLICATION_JSON).content(body("Division 2", null, false, false)))
                .andExpect(status().isNotFound());
    }

    @Test
    void anUnknownOrOtherClubsSeasonIs404AndNothingIsCreated() throws Exception {
        Rich rich = seedRich();
        World other = fixtures.world();
        UUID clubId = rich.w().club().getId();

        for (UUID seasonId : List.of(UUID.randomUUID(), other.season().getId())) {
            mockMvc.perform(post(DUPLICATE, clubId, rich.source().getId()).with(fixtures.clubAdmin(rich.w()))
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(body("Division 2", List.of(rich.s2031().getId(), seasonId), true, true)))
                    .andExpect(status().isNotFound());
        }
        assertThat(countLeagues(clubId)).isEqualTo(1);
    }

    @Test
    void badRequestsAre400() throws Exception {
        Rich rich = seedRich();
        JwtRequestPostProcessor admin = fixtures.clubAdmin(rich.w());
        UUID clubId = rich.w().club().getId();

        for (String json : List.of(
                body("   ", List.of(rich.s2031().getId()), true, true),
                body("x".repeat(256), List.of(rich.s2031().getId()), true, true),
                body("Division 2", List.of(), true, true),
                body("Division 2", null, null, true),
                objectMapper.writeValueAsString(Map.of("name", "Division 2",
                        "seasonIds", java.util.Arrays.asList((UUID) null))))) {
            mockMvc.perform(post(DUPLICATE, clubId, rich.source().getId()).with(admin)
                            .contentType(MediaType.APPLICATION_JSON).content(json))
                    .andExpect(status().isBadRequest());
        }
        assertThat(countLeagues(clubId)).isEqualTo(1);
    }

    @Test
    void aNameClashIs409CaseInsensitivelyTrimmedAndAgainstInactiveLeagues() throws Exception {
        Rich rich = seedRich();
        fixtures.leagueWithProfile(rich.w(), "Winter Cup", false);
        JwtRequestPostProcessor admin = fixtures.clubAdmin(rich.w());
        UUID clubId = rich.w().club().getId();

        for (String name : List.of("division 1", "  DIVISION 1  ", "winter cup")) {
            String response = mockMvc.perform(post(DUPLICATE, clubId, rich.source().getId()).with(admin)
                            .contentType(MediaType.APPLICATION_JSON).content(body(name, null, false, false)))
                    .andExpect(status().isConflict())
                    .andReturn().getResponse().getContentAsString();
            JsonNode problem = objectMapper.readTree(response);
            assertThat(problem.toString()).contains("A league named " + name.trim() + " already exists");
        }
        assertThat(countLeagues(clubId)).isEqualTo(2);
    }

    @Test
    void theResponseBodyShapeIsLeagueIdNameAndCounts() throws Exception {
        Rich rich = seedRich();

        mockMvc.perform(post(DUPLICATE, rich.w().club().getId(), rich.source().getId())
                        .with(fixtures.clubAdmin(rich.w())).contentType(MediaType.APPLICATION_JSON)
                        .content(body("Division 2", List.of(rich.s2031().getId()), true, true)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.leagueId").isNotEmpty())
                .andExpect(jsonPath("$.name").value("Division 2"))
                .andExpect(jsonPath("$.seasonsCopied").value(1))
                .andExpect(jsonPath("$.playingConditionsCopied").value(1))
                .andExpect(jsonPath("$.contactsCopied").value(2));
    }
}
