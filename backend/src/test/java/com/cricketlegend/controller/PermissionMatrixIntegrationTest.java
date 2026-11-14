package com.cricketlegend.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.request;

import com.cricketlegend.AbstractIntegrationTest;
import com.cricketlegend.domain.Permission;
import com.cricketlegend.domain.ScopeType;
import com.cricketlegend.support.ManagerOverviewFixtures;
import com.cricketlegend.support.ManagerOverviewFixtures.World;
import java.util.ArrayList;
import java.util.EnumSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.ApplicationContext;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpMethod;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.JwtRequestPostProcessor;
import org.springframework.test.web.servlet.MockMvc;

/**
 * docs/specs/150, the safety net: every built-in role against one endpoint per permission, through real HTTP. A denied
 * caller must get 403; a permitted one must get anything else (the ids are random, so a permitted call ends in 404 or
 * 400, never 403). The expected permission sets are written out here on purpose, so a wrong seed in migration 064 or a
 * wrong guard on a controller fails this test instead of passing silently.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(AbstractIntegrationTest.class)
class PermissionMatrixIntegrationTest {

    private static final UUID MANAGER = UUID.fromString("00000000-0000-4000-a000-000000000001");
    private static final UUID COORDINATOR = UUID.fromString("00000000-0000-4000-a000-000000000002");
    private static final UUID TEAM_MANAGER = UUID.fromString("00000000-0000-4000-a000-000000000003");
    private static final UUID SCORER = UUID.fromString("00000000-0000-4000-a000-000000000004");
    private static final UUID VIEWER = UUID.fromString("00000000-0000-4000-a000-000000000005");

    /** One endpoint, what it needs. {@code null} permission means reference data any grant may read. */
    private record Endpoint(HttpMethod method, String path, Permission needs) {}

    private static final List<Endpoint> ENDPOINTS = List.of(
            new Endpoint(HttpMethod.GET, "/players", Permission.PLAYERS_VIEW),
            new Endpoint(HttpMethod.POST, "/players/{x}/deactivate", Permission.PLAYERS_EDIT),
            new Endpoint(HttpMethod.GET, "/teams", Permission.TEAMS_VIEW),
            new Endpoint(HttpMethod.POST, "/sections/{s}/teams/{x}/deactivate", Permission.TEAMS_EDIT),
            new Endpoint(HttpMethod.GET, "/matches", Permission.MATCHES_VIEW),
            new Endpoint(HttpMethod.DELETE, "/matches/{x}", Permission.MATCHES_EDIT),
            new Endpoint(HttpMethod.GET, "/results", Permission.RESULTS_VIEW),
            new Endpoint(HttpMethod.DELETE, "/matches/{x}/result", Permission.RESULTS_EDIT),
            new Endpoint(HttpMethod.GET, "/team-selection", Permission.SELECTION_VIEW),
            new Endpoint(HttpMethod.POST, "/matches/{x}/sides/{x}/announce", Permission.SELECTION_MANAGE),
            new Endpoint(HttpMethod.GET, "/player-availability", Permission.AVAILABILITY_VIEW),
            new Endpoint(HttpMethod.DELETE, "/matches/{x}/polls/{x}", Permission.AVAILABILITY_MANAGE),
            new Endpoint(HttpMethod.GET, "/leaderboards", Permission.STATS_VIEW),
            new Endpoint(HttpMethod.GET, "/access/grants", Permission.ACCESS_VIEW),
            new Endpoint(HttpMethod.DELETE, "/access/grants/{x}", Permission.ACCESS_MANAGE),
            new Endpoint(HttpMethod.POST, "/leagues/{x}/deactivate", Permission.LEAGUES_EDIT),
            new Endpoint(HttpMethod.POST, "/sponsors/{x}/deactivate", Permission.CLUB_SETUP_EDIT),
            new Endpoint(HttpMethod.GET, "/hub-settings", Permission.CLUB_SETUP_EDIT),
            new Endpoint(HttpMethod.GET, "/imports/types", Permission.IMPORTS_RUN),
            new Endpoint(HttpMethod.GET, "/player-accounts", Permission.PLAYER_ACCOUNTS_MANAGE),
            new Endpoint(HttpMethod.GET, "/leagues", null),
            new Endpoint(HttpMethod.GET, "/sections", null),
            new Endpoint(HttpMethod.GET, "/sponsors", null),
            new Endpoint(HttpMethod.GET, "/playing-areas", null),
            new Endpoint(HttpMethod.GET, "/access/roles", null));

    private static final Set<Permission> VIEWS = EnumSet.of(
            Permission.PLAYERS_VIEW, Permission.TEAMS_VIEW, Permission.MATCHES_VIEW, Permission.RESULTS_VIEW,
            Permission.SELECTION_VIEW, Permission.AVAILABILITY_VIEW, Permission.STATS_VIEW);

    // Written out from the spec's built-in role table, not read from the database.
    private static final Map<UUID, Set<Permission>> ROLE_PERMISSIONS = Map.of(
            MANAGER, EnumSet.allOf(Permission.class),
            COORDINATOR, EnumSet.of(
                    Permission.PLAYERS_VIEW, Permission.PLAYERS_EDIT, Permission.TEAMS_VIEW, Permission.TEAMS_EDIT,
                    Permission.MATCHES_VIEW, Permission.MATCHES_EDIT, Permission.RESULTS_VIEW, Permission.RESULTS_EDIT,
                    Permission.SELECTION_VIEW, Permission.SELECTION_MANAGE, Permission.AVAILABILITY_VIEW,
                    Permission.AVAILABILITY_MANAGE, Permission.STATS_VIEW, Permission.ACCESS_VIEW),
            TEAM_MANAGER, EnumSet.of(
                    Permission.PLAYERS_VIEW, Permission.TEAMS_VIEW, Permission.TEAMS_EDIT, Permission.MATCHES_VIEW,
                    Permission.MATCHES_EDIT, Permission.RESULTS_VIEW, Permission.RESULTS_EDIT, Permission.SELECTION_VIEW,
                    Permission.SELECTION_MANAGE, Permission.AVAILABILITY_VIEW, Permission.AVAILABILITY_MANAGE,
                    Permission.STATS_VIEW),
            SCORER, EnumSet.of(
                    Permission.PLAYERS_VIEW, Permission.TEAMS_VIEW, Permission.MATCHES_VIEW, Permission.RESULTS_VIEW,
                    Permission.RESULTS_EDIT, Permission.STATS_VIEW),
            VIEWER, VIEWS);

    private static final Map<UUID, String> ROLE_NAMES = Map.of(
            MANAGER, "Manager", COORDINATOR, "Coordinator", TEAM_MANAGER, "Team Manager", SCORER, "Scorer", VIEWER, "Viewer");

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ApplicationContext context;

    private ManagerOverviewFixtures fixtures;
    private World world;
    private UUID clubId;

    @BeforeEach
    void setUp() {
        fixtures = new ManagerOverviewFixtures(context);
        world = fixtures.world();
        clubId = world.club().getId();
    }

    @AfterEach
    void cleanUp() {
        fixtures.cleanUp();
    }

    private int status(JwtRequestPostProcessor caller, Endpoint endpoint, UUID section) throws Exception {
        String path = "/api/v1/manage/clubs/" + clubId + endpoint.path();
        path = path.replace("{s}", section.toString());
        while (path.contains("{x}")) {
            path = path.replaceFirst("\\{x\\}", UUID.randomUUID().toString());
        }
        return mockMvc.perform(request(endpoint.method(), path).with(caller)).andReturn().getResponse().getStatus();
    }

    private boolean expectedAllowed(Set<Permission> held, Endpoint endpoint, boolean clubWide) {
        if (endpoint.needs() == null) {
            return true;
        }
        if (!clubWide && endpoint.needs().reach() == Permission.Reach.CLUB) {
            return false; // club reach permissions are inert on a section grant
        }
        return held.contains(endpoint.needs());
    }

    @Test
    void everyRoleGrantedClubWideMayDoExactlyWhatItsPermissionsAllow() throws Exception {
        List<String> wrong = new ArrayList<>();
        for (Map.Entry<UUID, Set<Permission>> role : ROLE_PERMISSIONS.entrySet()) {
            JwtRequestPostProcessor caller = fixtures.withRole(role.getKey(), ScopeType.CLUB, clubId);
            for (Endpoint endpoint : ENDPOINTS) {
                int status = status(caller, endpoint, world.seniors().getId());
                boolean allowed = expectedAllowed(role.getValue(), endpoint, true);
                if (allowed == (status == 403) || status == 401) {
                    wrong.add(ROLE_NAMES.get(role.getKey()) + " club-wide " + endpoint.method() + " " + endpoint.path()
                            + " expected " + (allowed ? "allowed" : "403") + " but was " + status);
                }
            }
        }
        assertThat(wrong).isEmpty();
    }

    @Test
    void everyRoleGrantedOnOneSectionIsRefusedElsewhereAndOnClubWideAreas() throws Exception {
        List<String> wrong = new ArrayList<>();
        for (Map.Entry<UUID, Set<Permission>> role : ROLE_PERMISSIONS.entrySet()) {
            JwtRequestPostProcessor caller = fixtures.withRole(role.getKey(), ScopeType.SECTION, world.juniors().getId());
            for (Endpoint endpoint : ENDPOINTS) {
                if (endpoint.path().contains("{s}")) {
                    int inside = status(caller, endpoint, world.juniors().getId());
                    int outside = status(caller, endpoint, world.seniors().getId());
                    boolean allowed = expectedAllowed(role.getValue(), endpoint, false);
                    if (allowed == (inside == 403)) {
                        wrong.add(ROLE_NAMES.get(role.getKey()) + " on Juniors " + endpoint.path() + " inside was " + inside);
                    }
                    if (outside != 403) {
                        wrong.add(ROLE_NAMES.get(role.getKey()) + " on Juniors " + endpoint.path() + " in Seniors was " + outside);
                    }
                    continue;
                }
                int status = status(caller, endpoint, world.juniors().getId());
                boolean allowed = expectedAllowed(role.getValue(), endpoint, false);
                if (allowed == (status == 403) || status == 401) {
                    wrong.add(ROLE_NAMES.get(role.getKey()) + " on Juniors " + endpoint.method() + " " + endpoint.path()
                            + " expected " + (allowed ? "allowed" : "403") + " but was " + status);
                }
            }
        }
        assertThat(wrong).isEmpty();
    }

    @Test
    void aSignedInPersonWithNoGrantIsRefusedEverywhere() throws Exception {
        JwtRequestPostProcessor nobody = fixtures.nobody();
        List<String> wrong = new ArrayList<>();
        for (Endpoint endpoint : ENDPOINTS) {
            int status = status(nobody, endpoint, world.seniors().getId());
            if (status != 403) {
                wrong.add(endpoint.method() + " " + endpoint.path() + " was " + status);
            }
        }
        assertThat(wrong).isEmpty();
    }
}
