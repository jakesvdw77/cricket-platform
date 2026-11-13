package com.cricketlegend.controller;

import static org.assertj.core.api.Assertions.assertThat;

import com.cricketlegend.AbstractIntegrationTest;
import com.cricketlegend.domain.Club;
import com.cricketlegend.domain.ClubContact;
import com.cricketlegend.domain.ClubProfile;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.data.domain.PageRequest;

/**
 * docs/specs/148-player-hub-club-info.md: migration 063 and the native SQL of the club contact directory, run against a
 * real Postgres (the queries had never run against one). Calls the repository directly so every letter, sort and
 * query behaviour is pinned without the service in between.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(AbstractIntegrationTest.class)
class ClubContactDirectoryQueryIntegrationTest extends AbstractClubInfoIntegrationTest {

    private static final PageRequest ALL = PageRequest.of(0, 50);

    private List<String> names(List<ClubContact> rows) {
        return rows.stream().map(c -> c.getContact().getFirstName() + " " + c.getContact().getLastName()).toList();
    }

    // ---- migration 063 ----

    @Test
    void migrationAddedTheEightSwitchesNotNullWithTheOwnerDefaults() {
        Map<String, String> expected = new java.util.LinkedHashMap<>();
        expected.put("hub_info_identity", "true");
        expected.put("hub_info_contact", "true");
        expected.put("hub_info_links", "true");
        expected.put("hub_info_logos", "true");
        expected.put("hub_info_logo_download", "false");
        expected.put("hub_info_directory", "false");
        expected.put("hub_info_directory_phone", "false");
        expected.put("hub_info_directory_email", "false");
        expected.forEach((column, value) -> {
            Map<String, Object> row = jdbc.queryForMap("select column_default, is_nullable, data_type from information_schema.columns "
                    + "where table_name = 'club_profile' and column_name = ?", column);
            assertThat(row.get("column_default")).as(column).isEqualTo(value);
            assertThat(row.get("is_nullable")).as(column).isEqualTo("NO");
            assertThat(row.get("data_type")).as(column).isEqualTo("boolean");
        });
    }

    @Test
    void aProfileRowInsertedWithNoSwitchesGetsTheDefaults() {
        Club club = club("Defaults");
        track(club);
        jdbc.update("insert into club_profile (club_id) values (?)", club.getId());

        ClubProfile profile = clubProfileRepository.findById(club.getId()).orElseThrow();

        assertThat(profile.isHubInfoIdentity()).isTrue();
        assertThat(profile.isHubInfoContact()).isTrue();
        assertThat(profile.isHubInfoLinks()).isTrue();
        assertThat(profile.isHubInfoLogos()).isTrue();
        assertThat(profile.isHubInfoLogoDownload()).isFalse();
        assertThat(profile.isHubInfoDirectory()).isFalse();
        assertThat(profile.isHubInfoDirectoryPhone()).isFalse();
        assertThat(profile.isHubInfoDirectoryEmail()).isFalse();
    }

    @Test
    void thePartialDirectoryIndexExistsOnActiveContactsOnly() {
        String def = jdbc.queryForObject("select indexdef from pg_indexes where indexname = 'ix_club_contact_hub'", String.class);

        assertThat(def).contains("club_contact").contains("(club_id, last_name, first_name)").containsIgnoringCase("WHERE active");
    }

    @Test
    void theDirectoryPageQueryUsesThePartialIndexOnASeededTable() {
        List<Object[]> rows = new ArrayList<>();
        List<Club> clubs = new ArrayList<>();
        for (int c = 0; c < 25; c++) {
            Club club = club("Seeded");
            track(club);
            clubs.add(club);
            for (int i = 0; i < 200; i++) {
                rows.add(new Object[] {club.getId(), "First" + i, "Last" + String.format("%04d", (i * 37) % 1000), "Role" + (i % 7), "", "", i % 10 != 0});
            }
        }
        jdbc.batchUpdate("insert into club_contact (club_id, first_name, last_name, role, phone, email, active) values (?,?,?,?,?,?,?)", rows);
        jdbc.execute("ANALYZE club_contact");
        UUID target = clubs.get(0).getId();

        String plan = jdbc.execute((java.sql.Connection con) -> {
            try (java.sql.Statement st = con.createStatement()) {
                st.execute("SET enable_seqscan = off");
                StringBuilder out = new StringBuilder();
                try (java.sql.ResultSet rs = st.executeQuery("EXPLAIN SELECT c.* FROM club_contact c WHERE c.club_id = '" + target + "' AND c.active"
                        + " AND (lower(c.first_name) LIKE '%' ESCAPE '!' OR lower(c.last_name) LIKE '%' ESCAPE '!' OR lower(c.role) LIKE '%' ESCAPE '!')"
                        + " ORDER BY c.last_name, c.first_name, c.id LIMIT 25")) {
                    while (rs.next()) {
                        out.append(rs.getString(1)).append('\n');
                    }
                } finally {
                    st.execute("RESET enable_seqscan");
                }
                return out.toString();
            }
        });

        assertThat(plan).contains("ix_club_contact_hub");
    }

    // ---- the native SQL ----

    @Test
    void activeContactsOfOneClubInLastNameThenFirstNameOrder() {
        Club club = club("Order");
        Club other = club("Other");
        contact(club, "Zoe", "Adams", "Chair", "", "");
        contact(club, "Anna", "Adams", "Treasurer", "", "");
        contact(club, "Bob", "Brown", "Coach", "", "");
        contact(club, "Yan", "Zulu", "Coach", "", "", false);
        contact(other, "Other", "Aaaa", "Chair", "", "");

        List<ClubContact> page = clubContactRepository.directoryByName(club.getId(), "%", "", ALL);

        assertThat(names(page)).containsExactly("Anna Adams", "Zoe Adams", "Bob Brown");
        assertThat(clubContactRepository.countDirectory(club.getId(), "%", "")).isEqualTo(3);
    }

    @Test
    void sortByRoleOrdersByRoleThenLastNameThenFirstName() {
        Club club = club("Role");
        contact(club, "Zoe", "Adams", "Coach", "", "");
        contact(club, "Anna", "Brown", "Coach", "", "");
        contact(club, "Bob", "Adams", "Coach", "", "");
        contact(club, "Cy", "Cole", "Chair", "", "");
        contact(club, "Di", "Dunn", "Treasurer", "", "");

        assertThat(names(clubContactRepository.directoryByRole(club.getId(), "%", "", ALL)))
                .containsExactly("Cy Cole", "Bob Adams", "Zoe Adams", "Anna Brown", "Di Dunn");
    }

    @Test
    void pagingSlicesTheOrderedSet() {
        Club club = club("Paging");
        for (String last : List.of("Adams", "Brown", "Cole", "Dunn", "Evans")) {
            contact(club, "Sam", last, "Chair", "", "");
        }

        assertThat(names(clubContactRepository.directoryByName(club.getId(), "%", "", PageRequest.of(0, 2))))
                .containsExactly("Sam Adams", "Sam Brown");
        assertThat(names(clubContactRepository.directoryByName(club.getId(), "%", "", PageRequest.of(1, 2))))
                .containsExactly("Sam Cole", "Sam Dunn");
        assertThat(names(clubContactRepository.directoryByName(club.getId(), "%", "", PageRequest.of(2, 2))))
                .containsExactly("Sam Evans");
        assertThat(clubContactRepository.countDirectory(club.getId(), "%", "")).isEqualTo(5);
    }

    @Test
    void aLetterFiltersOnTheFirstLetterOfTheLastNameIgnoringCaseAndHashIsEverythingElse() {
        Club club = club("Letters");
        contact(club, "A1", "Adams", "Chair", "", "");
        contact(club, "A2", "avery", "Chair", "", "");
        contact(club, "B1", "Brown", "Chair", "", "");
        contact(club, "H1", "Éclair", "Chair", "", "");
        contact(club, "H2", "1st", "Chair", "", "");
        contact(club, "H3", "'t Hart", "Chair", "", "");

        assertThat(names(clubContactRepository.directoryByName(club.getId(), "%", "A", ALL))).containsExactlyInAnyOrder("A1 Adams", "A2 avery");
        assertThat(names(clubContactRepository.directoryByName(club.getId(), "%", "B", ALL))).containsExactly("B1 Brown");
        assertThat(names(clubContactRepository.directoryByName(club.getId(), "%", "#", ALL)))
                .containsExactlyInAnyOrder("H1 Éclair", "H2 1st", "H3 't Hart");
        assertThat(clubContactRepository.directoryByName(club.getId(), "%", "Z", ALL)).isEmpty();
        assertThat(clubContactRepository.countDirectory(club.getId(), "%", "A")).isEqualTo(2);
        assertThat(clubContactRepository.countDirectory(club.getId(), "%", "#")).isEqualTo(3);
        assertThat(clubContactRepository.countDirectory(club.getId(), "%", "Z")).isZero();
        assertThat(names(clubContactRepository.directoryByRole(club.getId(), "%", "#", ALL))).hasSize(3);
    }

    @Test
    void theLettersAreTheDistinctInitialsOfTheQuerySetWithHashForTheRest() {
        Club club = club("LetterStrip");
        contact(club, "A1", "Adams", "Chair", "", "");
        contact(club, "A2", "Allen", "Coach", "", "");
        contact(club, "S1", "smith", "Coach", "", "");
        contact(club, "H1", "Éclair", "Coach", "", "");
        contact(club, "I1", "Gone", "Coach", "", "", false);

        assertThat(clubContactRepository.directoryLetters(club.getId(), "%")).containsExactlyInAnyOrder("A", "S", "#");
        // a query narrows the strip, and no letter filter exists at this level so it can never narrow it further
        assertThat(clubContactRepository.directoryLetters(club.getId(), "%coach%")).containsExactlyInAnyOrder("A", "S", "#");
        assertThat(clubContactRepository.directoryLetters(club.getId(), "%chair%")).containsExactly("A");
        assertThat(clubContactRepository.directoryLetters(club.getId(), "%nomatch%")).isEmpty();
    }

    @Test
    void theQueryIsCaseInsensitiveOverFirstNameLastNameAndRoleOnly() {
        Club club = club("Query");
        contact(club, "Anna", "Adams", "Treasurer", "0821230000", "anna@club.test");
        contact(club, "Bob", "Brown", "Head Coach", "0821231111", "bob@club.test");

        assertThat(names(clubContactRepository.directoryByName(club.getId(), "%anna%", "", ALL))).containsExactly("Anna Adams");
        assertThat(names(clubContactRepository.directoryByName(club.getId(), "%adams%", "", ALL))).containsExactly("Anna Adams");
        assertThat(names(clubContactRepository.directoryByName(club.getId(), "%head coach%", "", ALL))).containsExactly("Bob Brown");
        assertThat(names(clubContactRepository.directoryByRole(club.getId(), "%treasurer%", "", ALL))).containsExactly("Anna Adams");
        assertThat(clubContactRepository.countDirectory(club.getId(), "%o%", "")).isEqualTo(1);
        // phone and email are never searchable
        assertThat(clubContactRepository.directoryByName(club.getId(), "%0821230000%", "", ALL)).isEmpty();
        assertThat(clubContactRepository.directoryByName(club.getId(), "%anna@club%", "", ALL)).isEmpty();
        // the query and a letter combine
        assertThat(clubContactRepository.countDirectory(club.getId(), "%o%", "B")).isEqualTo(1);
        assertThat(clubContactRepository.countDirectory(club.getId(), "%o%", "A")).isZero();
    }

    @Test
    void percentUnderscoreAndBangInTheQueryAreTreatedLiterally() {
        Club club = club("Escape");
        contact(club, "P1", "100%Sure", "Chair", "", "");
        contact(club, "U1", "O_Neil", "Chair", "", "");
        contact(club, "U2", "OaNeil", "Chair", "", "");
        contact(club, "B1", "Wow!", "Chair", "", "");
        contact(club, "N1", "Plain", "Chair", "", "");

        assertThat(names(clubContactRepository.directoryByName(club.getId(), com.cricketlegend.service.support.ClubInfoRules.likePattern("%"), "", ALL)))
                .containsExactly("P1 100%Sure");
        assertThat(names(clubContactRepository.directoryByName(club.getId(), com.cricketlegend.service.support.ClubInfoRules.likePattern("o_n"), "", ALL)))
                .containsExactly("U1 O_Neil");
        assertThat(names(clubContactRepository.directoryByName(club.getId(), com.cricketlegend.service.support.ClubInfoRules.likePattern("!"), "", ALL)))
                .containsExactly("B1 Wow!");
        assertThat(clubContactRepository.countDirectory(club.getId(), com.cricketlegend.service.support.ClubInfoRules.likePattern("_"), "")).isEqualTo(1);
        assertThat(clubContactRepository.directoryLetters(club.getId(), com.cricketlegend.service.support.ClubInfoRules.likePattern("%"))).containsExactly("#");
    }
}
