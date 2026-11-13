package com.cricketlegend.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.cricketlegend.AbstractIntegrationTest;
import com.cricketlegend.domain.Club;
import com.cricketlegend.domain.ClubContact;
import com.cricketlegend.domain.Person;
import com.cricketlegend.domain.PersonLink;
import com.cricketlegend.domain.PlayerProfile;
import com.cricketlegend.domain.Team;
import com.cricketlegend.domain.TeamContact;
import com.fasterxml.jackson.databind.JsonNode;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;

/**
 * docs/specs/148-player-hub-club-info.md, Integration: the privacy matrix of the directory switches, the club-contacts-only
 * guard (no player, parent or agent is ever returned or searchable), who counts as a contact, and the exact JSON shapes.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(AbstractIntegrationTest.class)
class MePlayerClubInfoPrivacyIntegrationTest extends AbstractClubInfoIntegrationTest {

    private static final String PHONE = "0825550001";
    private static final String EMAIL = "cathy@hillcrest.test";

    private record Fx(Club club, Person parent, String key) {}

    private Fx fx() {
        Club club = clubWithProfile();
        Person parent = account("Pat", "Parent");
        Person kid = playerPerson("Sam", "Smith", CHILD_DOB);
        profile(club, kid, null);
        PersonLink link = link(parent, kid, club, true);
        return new Fx(club, parent, link.getId().toString());
    }

    private String infoBody(Fx f) throws Exception {
        return mockMvc.perform(info(f.key()).with(as(f.parent()))).andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
    }

    private String contactsBody(Fx f, String... params) throws Exception {
        var request = contacts(f.key());
        for (int i = 0; i < params.length; i += 2) {
            request.param(params[i], params[i + 1]);
        }
        return mockMvc.perform(request.with(as(f.parent()))).andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
    }

    // ---- privacy matrix ----

    @Test
    void everyCombinationOfTheThreeDirectorySwitchesShowsExactlyWhatIsSwitchedOn() throws Exception {
        for (boolean directory : new boolean[] {false, true}) {
            for (boolean phone : new boolean[] {false, true}) {
                for (boolean email : new boolean[] {false, true}) {
                    Fx f = fx();
                    contact(f.club(), "Cathy", "Clubber", "Secretary", PHONE, EMAIL);
                    switches(f.club(), directory, phone, email);
                    String label = "directory=" + directory + " phone=" + phone + " email=" + email;

                    String info = infoBody(f);
                    if (!directory) {
                        // the contacts are 404 and nothing of them leaks through Club info, whatever the phone/email switches say
                        mockMvc.perform(contacts(f.key()).with(as(f.parent()))).andExpect(status().isNotFound());
                        assertThat(tree(info).get("directory").isNull()).as(label).isTrue();
                        assertThat(info).as(label).doesNotContain("Clubber").doesNotContain(PHONE).doesNotContain(EMAIL);
                        continue;
                    }
                    JsonNode summary = tree(info).get("directory");
                    assertThat(summary.get("total").asLong()).as(label).isEqualTo(1);
                    assertThat(summary.get("phoneShown").asBoolean()).as(label).isEqualTo(phone);
                    assertThat(summary.get("emailShown").asBoolean()).as(label).isEqualTo(email);
                    assertThat(info).as(label).doesNotContain(PHONE).doesNotContain(EMAIL);

                    JsonNode row = tree(contactsBody(f)).get("items").get(0);
                    assertThat(row.get("firstName").asText()).as(label).isEqualTo("Cathy");
                    assertThat(row.get("role").asText()).as(label).isEqualTo("Secretary");
                    if (phone) {
                        assertThat(row.get("phone").asText()).as(label).isEqualTo(PHONE);
                    } else {
                        assertThat(row.get("phone").isNull()).as(label).isTrue();
                    }
                    if (email) {
                        assertThat(row.get("email").asText()).as(label).isEqualTo(EMAIL);
                    } else {
                        assertThat(row.get("email").isNull()).as(label).isTrue();
                    }
                }
            }
        }
    }

    @Test
    void phoneAndEmailSwitchedOnWhileTheDirectoryIsOffNeverReachTheClient() throws Exception {
        Fx f = fx();
        contact(f.club(), "Cathy", "Clubber", "Secretary", PHONE, EMAIL);
        switches(f.club(), false, true, true);

        mockMvc.perform(contacts(f.key()).with(as(f.parent()))).andExpect(status().isNotFound());
        assertThat(infoBody(f)).doesNotContain(PHONE).doesNotContain(EMAIL).doesNotContain("Clubber");
    }

    @Test
    void aContactWithNoPhoneOrEmailOnFileIsStillListedWithNullValues() throws Exception {
        Fx f = fx();
        switches(f.club(), true, true, true);
        contact(f.club(), "Nina", "Nophone", "Chair", "", "");

        JsonNode row = tree(contactsBody(f)).get("items").get(0);

        assertThat(row.get("lastName").asText()).isEqualTo("Nophone");
        assertThat(row.get("phone").isNull()).isTrue();
        assertThat(row.get("email").isNull()).isTrue();
    }

    @Test
    void inactiveContactsNeverAppearInListSearchLettersOrCounts() throws Exception {
        Fx f = fx();
        switches(f.club(), true, true, true);
        contact(f.club(), "Cathy", "Clubber", "Secretary", PHONE, EMAIL);
        contact(f.club(), "Gone", "Zebra", "Chair", "0829998888", "gone@hillcrest.test", false);

        JsonNode page = tree(contactsBody(f, "size", "50"));
        JsonNode searched = tree(contactsBody(f, "query", "Zebra"));
        JsonNode letterZ = tree(contactsBody(f, "letter", "Z"));

        assertThat(page.get("total").asLong()).isEqualTo(1);
        assertThat(page.toString()).doesNotContain("Zebra").doesNotContain("0829998888");
        assertThat(page.get("letters")).extracting(JsonNode::asText).containsExactly("C");
        assertThat(searched.get("items")).isEmpty();
        assertThat(letterZ.get("items")).isEmpty();
        assertThat(tree(infoBody(f)).get("directory").get("total").asLong()).isEqualTo(1);
    }

    // ---- club contacts only ----

    @Test
    void noPlayerParentOrAgentOfTheClubIsEverReturnedOrSearchable() throws Exception {
        Fx f = fx();
        switches(f.club(), true, true, true);
        ClubContact real = contact(f.club(), "Cathy", "Clubber", "Secretary", PHONE, EMAIL);

        // a player, a parent and an agent in the SAME club, all with names, phones and emails on file
        Person player = personRepository.save(Person.builder().firstName("Zorbo").lastName("Zanzibar")
                .email("zorbo.player@leak.test").phone("0829990001").dateOfBirth(ADULT_DOB).keycloakUserId(unique("sub"))
                .status(com.cricketlegend.domain.PersonStatus.ACTIVE).build());
        PlayerProfile playerProfile = playerProfileRepository.save(PlayerProfile.builder().personId(player.getId()).clubId(f.club().getId())
                .email("zorbo.contact@leak.test").phone("0829990002").active(true).build());
        Person parent = personRepository.save(Person.builder().firstName("Penelope").lastName("Parentson")
                .email("penelope@leak.test").phone("0829990003").keycloakUserId(unique("sub"))
                .status(com.cricketlegend.domain.PersonStatus.ACTIVE).build());
        Person agent = personRepository.save(Person.builder().firstName("Agatha").lastName("Agentsen")
                .email("agatha@leak.test").phone("0829990004").keycloakUserId(unique("sub"))
                .status(com.cricketlegend.domain.PersonStatus.ACTIVE).build());
        link(parent, player, f.club(), true);
        link(agent, player, f.club(), false);
        assertThat(playerProfile.getId()).isNotNull();

        List<String> leaks = List.of("Zorbo", "Zanzibar", "Penelope", "Parentson", "Agatha", "Agentsen", "leak.test",
                "0829990001", "0829990002", "0829990003", "0829990004");
        List<String> everyBody = new ArrayList<>();
        for (String sort : List.of("name", "role")) {
            everyBody.add(contactsBody(f, "sort", sort, "size", "50"));
            for (String letter : List.of("Z", "P", "A", "S", "#")) {
                everyBody.add(contactsBody(f, "sort", sort, "letter", letter));
            }
            for (String query : List.of("Zorbo", "Zanzibar", "Penelope", "Parentson", "Agatha", "Agentsen", "leak.test",
                    "0829990001", "0829990003", "Smith", "Sam", "Pat", "Parent")) {
                String body = contactsBody(f, "sort", sort, "query", query);
                assertThat(tree(body).get("items")).as("query " + query).isEmpty();
                assertThat(tree(body).get("total").asLong()).as("query " + query).isZero();
                everyBody.add(body);
            }
        }
        everyBody.add(infoBody(f));
        for (String body : everyBody) {
            for (String leak : leaks) {
                assertThat(body).doesNotContain(leak);
            }
        }

        // the full listing is exactly the one club contact, and the strip only knows its letter
        JsonNode all = tree(contactsBody(f, "size", "50"));
        assertThat(all.get("total").asLong()).isEqualTo(1);
        assertThat(all.get("items")).hasSize(1);
        assertThat(all.get("items").get(0).get("id").asText()).isEqualTo(real.getId().toString());
        assertThat(all.get("letters")).extracting(JsonNode::asText).containsExactly("C");
    }

    @Test
    void teamManagersAndCoachesThatAreClubContactsAppearAsContacts() throws Exception {
        Fx f = fx();
        switches(f.club(), true, true, true);
        Team team = teamRepository.save(Team.builder().clubId(f.club().getId()).sectionId(section(f.club(), "Seniors").getId())
                .name("1st XI").active(true).build());
        ClubContact manager = contact(f.club(), "Tom", "Teammanager", "Treasurer", "0821110001", "tom@hillcrest.test");
        ClubContact coach = contact(f.club(), "Cora", "Coachman", "Volunteer", "0821110002", "cora@hillcrest.test");
        ClubContact inactiveCoach = contact(f.club(), "Old", "Coachgone", "Coach", "0821110003", "old@hillcrest.test", false);
        for (ClubContact c : List.of(manager, coach, inactiveCoach)) {
            teamContactRepository.save(TeamContact.builder().teamId(team.getId()).clubContactId(c.getId())
                    .role(c == manager ? "Manager" : "Coach").build());
        }

        JsonNode page = tree(contactsBody(f, "size", "50"));

        assertThat(page.get("total").asLong()).isEqualTo(2);
        assertThat(page.get("items")).extracting(n -> n.get("lastName").asText()).containsExactly("Coachman", "Teammanager");
        assertThat(page.toString()).doesNotContain("Coachgone").doesNotContain("0821110003");
    }

    // ---- exact JSON ----

    @Test
    void clubInfoHasExactlyTheDocumentedKeysAtEveryLevelAndNoInternalId() throws Exception {
        Fx f = fx();
        switches(f.club(), true, true, true);
        contact(f.club(), "Cathy", "Clubber", "Secretary", PHONE, EMAIL);

        String body = infoBody(f);
        JsonNode root = tree(body);

        assertThat(keys(root)).isEqualTo(setOf("clubName", "tabs", "about", "links", "logos", "directory"));
        assertThat(keys(root.get("about"))).isEqualTo(setOf("type", "address", "phone", "email"));
        assertThat(keys(root.get("about").get("address"))).isEqualTo(setOf("number", "street", "city", "provinceState", "country", "postalCode"));
        assertThat(keys(root.get("links"))).isEqualTo(setOf("website", "social"));
        assertThat(keys(root.get("links").get("social").get(0))).isEqualTo(setOf("platform", "url"));
        assertThat(keys(root.get("logos"))).isEqualTo(setOf("logoUrl", "bannerUrl", "downloadable"));
        assertThat(keys(root.get("directory"))).isEqualTo(setOf("total", "phoneShown", "emailShown"));
        assertThat(root.get("tabs")).hasSize(3);
        for (JsonNode tab : root.get("tabs")) {
            assertThat(keys(tab)).isEqualTo(setOf("id", "count"));
        }
        assertThat(body).doesNotContain(f.club().getId().toString());
        assertThat(root.get("tabs")).extracting(t -> t.get("id").asText()).containsExactly("about", "contacts", "links");
    }

    @Test
    void theContactPageAndItsRowsHaveExactlyTheDocumentedKeys() throws Exception {
        Fx f = fx();
        switches(f.club(), true, true, true);
        contact(f.club(), "Cathy", "Clubber", "Secretary", PHONE, EMAIL);

        JsonNode page = tree(contactsBody(f));

        assertThat(keys(page)).isEqualTo(setOf("items", "letters", "page", "size", "total", "hasMore"));
        assertThat(keys(page.get("items").get(0))).isEqualTo(setOf("id", "firstName", "lastName", "role", "primary", "phone", "email"));
        assertThat(page.get("page").asInt()).isZero();
        assertThat(page.get("size").asInt()).isEqualTo(25);
        assertThat(page.get("hasMore").asBoolean()).isFalse();
    }

    @Test
    void aSwitchedOffBlockIsNullAndItsValuesAreNotInTheBody() throws Exception {
        Fx f = fx();
        setSwitch(f.club(), "hub_info_identity", false);
        setSwitch(f.club(), "hub_info_contact", false);
        setSwitch(f.club(), "hub_info_links", false);
        setSwitch(f.club(), "hub_info_logos", false);

        String body = infoBody(f);
        JsonNode root = tree(body);

        assertThat(keys(root)).isEqualTo(setOf("clubName", "tabs", "about", "links", "logos", "directory"));
        assertThat(root.get("tabs")).isEmpty();
        for (String block : List.of("about", "links", "logos", "directory")) {
            assertThat(root.get(block).isNull()).as(block).isTrue();
        }
        assertThat(body).doesNotContain("High St").doesNotContain("0215550000").doesNotContain("club@hillcrest.test")
                .doesNotContain("hillcrest.test").doesNotContain("/media/").doesNotContain("facebook");
    }

    @Test
    void anAdultPlayersOwnRecordGetsTheSameShapes() throws Exception {
        Fx f = fx();
        switches(f.club(), true, false, false);
        contact(f.club(), "Cathy", "Clubber", "Secretary", PHONE, EMAIL);
        Own me = adultSelf(f.club());

        String body = mockMvc.perform(contacts(me.key()).with(as(me.person()))).andExpect(status().isOk()).andReturn().getResponse().getContentAsString();

        assertThat(tree(body).get("items").get(0).get("phone").isNull()).isTrue();
        assertThat(body).doesNotContain(PHONE).doesNotContain(EMAIL);
    }

    @Test
    void deactivatingAContactThroughTheContactEndpointRemovesItAtOnceAndReactivatingRestoresIt() throws Exception {
        Fx f = fx();
        switches(f.club(), true, true, true);
        ClubContact keep = contact(f.club(), "Cathy", "Clubber", "Secretary", PHONE, EMAIL);
        ClubContact toggled = contact(f.club(), "Tina", "Toggle", "Chair", "0823330001", "tina@hillcrest.test");
        Person admin = clubAdmin(f.club());
        String before = contactsBody(f, "size", "50");
        assertThat(tree(before).get("total").asLong()).isEqualTo(2);

        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                        .post("/api/v1/manage/clubs/{c}/contacts/{id}/deactivate", f.club().getId(), toggled.getId()).with(as(admin)))
                .andExpect(status().isOk());
        String during = contactsBody(f, "size", "50");
        assertThat(tree(during).get("total").asLong()).isEqualTo(1);
        assertThat(during).doesNotContain("Toggle").doesNotContain("0823330001");
        assertThat(tree(contactsBody(f, "query", "Toggle")).get("items")).isEmpty();
        assertThat(tree(during).get("items").get(0).get("id").asText()).isEqualTo(keep.getId().toString());
        assertThat(tree(infoBody(f)).get("directory").get("total").asLong()).isEqualTo(1);

        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                        .post("/api/v1/manage/clubs/{c}/contacts/{id}/reactivate", f.club().getId(), toggled.getId()).with(as(admin)))
                .andExpect(status().isOk());
        assertThat(contactsBody(f, "size", "50")).isEqualTo(before);
        assertThat(tree(infoBody(f)).get("directory").get("total").asLong()).isEqualTo(2);
    }
}
