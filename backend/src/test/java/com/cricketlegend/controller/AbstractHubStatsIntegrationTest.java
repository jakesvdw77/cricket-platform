package com.cricketlegend.controller;

import com.cricketlegend.AbstractLinkIntegrationTest;
import com.cricketlegend.domain.Person;
import com.cricketlegend.domain.PersonLink;
import com.cricketlegend.domain.PlayerProfile;
import com.cricketlegend.support.PlayerStatsSeed;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.TreeSet;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.ApplicationContext;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;

/**
 * Shared fixture of the docs/specs/147 Player Hub stats integration tests. The seeded club of {@link PlayerStatsSeed}
 * (spec 103/115 scenarios, results inserted with SQL) with every seeded result switched on for the Player Hub (the seed
 * does not set the flag), and a parent account holding Alice (via an active person link). Not transactional, because the
 * seed commits; everything created is removed in {@link #removeHubFixture()}.
 */
abstract class AbstractHubStatsIntegrationTest extends AbstractLinkIntegrationTest {

    static final String BASE = "/api/v1/me/players/{k}";

    @Autowired protected MockMvc mockMvc;
    @Autowired protected ObjectMapper objectMapper;
    @Autowired protected JdbcTemplate jdbc;
    @Autowired protected ApplicationContext context;

    protected PlayerStatsSeed seed;
    protected Person parent;
    protected PersonLink link;
    /** The playerKey of the held player (Alice). */
    protected String key;
    private final List<UUID> accounts = new ArrayList<>();
    private final List<UUID> links = new ArrayList<>();

    /** Seeds the club and holds Alice. {@code matchList} adds the spec 115 players and results too. */
    protected void seedHubFixture(boolean matchList) {
        seed = new PlayerStatsSeed(context);
        if (matchList) {
            seed.seedMatchList();
        }
        flagEveryResult();
        parent = account("Pat", "Parent");
        accounts.add(parent.getId());
        link = hold(parent, seed.alice);
        key = link.getId().toString();
    }

    /** Switches every result of the seeded club on for the Hub, whatever its status (the reads must still filter). */
    protected void flagEveryResult() {
        jdbc.update("update match_result set visible_to_players = true where club_id = ?", seed.w.club().getId());
    }

    protected PersonLink hold(Person account, PlayerProfile player) {
        Person subject = personRepository.findById(player.getPersonId()).orElseThrow();
        PersonLink l = link(account, subject, seed.w.club(), true);
        links.add(l.getId());
        return l;
    }

    protected Person track(Person p) {
        accounts.add(p.getId());
        return p;
    }

    protected Person newAccount(String first, String last) {
        Person p = account(first, last);
        accounts.add(p.getId());
        return p;
    }

    @AfterEach
    void removeHubFixture() {
        if (seed == null) {
            return;
        }
        for (UUID id : links) {
            jdbc.update("delete from person_link where id = ?", id);
        }
        for (UUID id : accounts) {
            jdbc.update("delete from person_link where account_person_id = ?", id);
            jdbc.update("delete from role_assignment where person_id = ?", id);
            jdbc.update("delete from person where id = ?", id);
        }
        seed.cleanUp();
    }

    protected JsonNode json(String body) throws Exception {
        return objectMapper.readTree(body);
    }

    protected static Set<String> keys(JsonNode node) {
        Set<String> out = new TreeSet<>();
        node.fieldNames().forEachRemaining(out::add);
        return out;
    }

    /** Every field name (at any depth) of the document. */
    protected static Set<String> allFieldNames(JsonNode node) {
        Set<String> names = new TreeSet<>();
        collect(node, names);
        return names;
    }

    private static void collect(JsonNode node, Set<String> names) {
        if (node.isObject()) {
            node.fields().forEachRemaining(e -> {
                names.add(e.getKey());
                collect(e.getValue(), names);
            });
        } else if (node.isArray()) {
            node.forEach(child -> collect(child, names));
        }
    }

    /** Every text value (at any depth) of the document. */
    protected static Set<String> allTextValues(JsonNode node) {
        Set<String> values = new TreeSet<>();
        collectText(node, values);
        return values;
    }

    private static void collectText(JsonNode node, Set<String> values) {
        if (node.isTextual()) {
            values.add(node.asText());
        } else if (node.isContainerNode()) {
            node.forEach(child -> collectText(child, values));
        }
    }

    /** The ids that must never reach a Hub payload: results, result players, player profiles and persons, the club. */
    protected Set<String> internalIds() {
        Set<String> ids = new TreeSet<>();
        String club = seed.w.club().getId().toString();
        ids.add(club);
        ids.add(parent.getId().toString());
        ids.add(link.getId().toString());
        for (String sql : List.of(
                "select id from match_result where club_id = ?",
                "select id from player_profile where club_id = ?",
                "select person_id from player_profile where club_id = ?",
                "select id from result_player where match_result_id in (select id from match_result where club_id = ?)",
                "select id from match_innings where match_result_id in (select id from match_result where club_id = ?)")) {
            jdbc.queryForList(sql, UUID.class, seed.w.club().getId()).forEach(id -> ids.add(id.toString()));
        }
        return ids;
    }
}
