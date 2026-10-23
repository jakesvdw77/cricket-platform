package com.cricketlegend.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.cricketlegend.AbstractIntegrationTest;
import com.cricketlegend.AbstractLinkIntegrationTest;
import com.cricketlegend.domain.AnswerSource;
import com.cricketlegend.domain.Club;
import com.cricketlegend.domain.Person;
import com.cricketlegend.domain.PersonLink;
import com.cricketlegend.domain.PlayerProfile;
import com.cricketlegend.domain.Section;
import com.cricketlegend.repository.PlayerAvailabilityRepository;
import com.cricketlegend.repository.SectionAvailabilityResponseRepository;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

/**
 * docs/specs/119 slice 3, Integration: My players. The update whitelist, who sees what (other agents' emails, medical
 * aid, date of birth), and availability answers through a linked account: source LINKED_ACCOUNT, "belonging to the poll"
 * and closed polls.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(AbstractIntegrationTest.class)
@Transactional
class MyPlayersIntegrationTest extends AbstractLinkIntegrationTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private PlayerAvailabilityRepository availabilityRepository;
    @Autowired private SectionAvailabilityResponseRepository responseRepository;

    private static final String FULL_EDIT = """
            {"phone":"0839999999","email":"new.contact@example.com","altContactName":"Gran","altContactPhone":"0841111111",
             "battingStance":"LEFT_HANDED","bowlingArm":"RIGHT_ARM","isWicketKeeper":true,
             "medicalAidProvider":"Bonitas","medicalAidMemberNumber":"BON-77"%s}
            """;

    private static String edit(String extra) {
        return FULL_EDIT.formatted(extra);
    }

    // ---- list order ----

    @Test
    void theOwnRecordIsListedFirstThenLinkedPlayersByName() throws Exception {
        Club club = club("Hillcrest");
        Person me = account("Pat", "Parent");
        profile(club, me, null); // my own verified record
        Person amy = playerPerson("Amy", "Alpha", CHILD_DOB);
        Person zed = playerPerson("Zed", "Zulu", CHILD_DOB);
        profile(club, zed, null);
        profile(club, amy, null);
        link(me, zed, club, true);
        link(me, amy, club, true);

        mockMvc.perform(get("/api/v1/me/players").with(as(me)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(3))
                .andExpect(jsonPath("$[0].self").value(true))
                .andExpect(jsonPath("$[0].firstName").value("Pat"))
                .andExpect(jsonPath("$[1].firstName").value("Amy"))
                .andExpect(jsonPath("$[2].firstName").value("Zed"));
    }

    // ---- the update whitelist ----

    @Test
    void anUpdateChangesOnlyTheWhitelistedFieldsAndIgnoresNameJerseyStatusAndVerification() throws Exception {
        Club club = club("Hillcrest");
        Person parent = account("Pat", "Parent");
        Person kid = playerPerson("Sam", "Smith", CHILD_DOB);
        PlayerProfile profile = profile(club, kid, null);
        profile.setJerseyNumber(7);
        playerProfileRepository.save(profile);
        PersonLink link = link(parent, kid, club, true);

        mockMvc.perform(put("/api/v1/me/players/{k}", link.getId()).with(as(parent)).contentType(MediaType.APPLICATION_JSON)
                        .content(edit(",\"firstName\":\"Hacked\",\"lastName\":\"Hacked\",\"jerseyNumber\":99,\"active\":false,"
                                + "\"verificationStatus\":\"REJECTED\",\"clubMembershipNumber\":\"X\",\"gender\":\"MALE\"")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.firstName").value("Sam"))
                .andExpect(jsonPath("$.jerseyNumber").value(7))
                .andExpect(jsonPath("$.phone").value("0839999999"))
                .andExpect(jsonPath("$.medicalAidProvider").value("Bonitas"));

        PlayerProfile stored = playerProfileRepository.findById(profile.getId()).orElseThrow();
        assertThat(stored.getPhone()).isEqualTo("0839999999");
        assertThat(stored.getEmail()).isEqualTo("new.contact@example.com");
        assertThat(stored.getAltContactName()).isEqualTo("Gran");
        assertThat(stored.isWicketKeeper()).isTrue();
        assertThat(stored.getMedicalAidMemberNumber()).isEqualTo("BON-77");
        assertThat(stored.getJerseyNumber()).isEqualTo(7);
        assertThat(stored.isActive()).isTrue();
        assertThat(stored.getVerificationStatus()).isEqualTo(com.cricketlegend.domain.PlayerVerificationStatus.VERIFIED);
        assertThat(stored.getClubMembershipNumber()).isNull();
        assertThat(stored.getUpdatedBy()).isEqualTo(parent.getId());
        Person person = personRepository.findById(kid.getId()).orElseThrow();
        assertThat(person.getFirstName()).isEqualTo("Sam");
        assertThat(person.getLastName()).isEqualTo("Smith");
    }

    @Test
    void aNonMainAgentCannotChangeMedicalAidTheEmailOrTheDateOfBirth() throws Exception {
        Club club = club("Hillcrest");
        Person main = account("Main", "Agent");
        Person second = account("Second", "Agent");
        Person kid = playerPerson("Sam", "Smith", CHILD_DOB);
        PlayerProfile profile = profile(club, kid, "main.agent@example.com");
        link(main, kid, club, true);
        PersonLink secondLink = link(second, kid, club, false);

        String resendStored = """
                {"phone":"0821234567","email":"main.agent@example.com","isWicketKeeper":false,
                 "medicalAidProvider":"Discovery","medicalAidMemberNumber":"MED-9Q"}
                """;
        mockMvc.perform(put("/api/v1/me/players/{k}", secondLink.getId()).with(as(second)).contentType(MediaType.APPLICATION_JSON)
                        .content(resendStored))
                .andExpect(status().isOk());
        String[] forbiddenBodies = {
            "{\"isWicketKeeper\":false,\"phone\":\"0821234567\",\"email\":\"main.agent@example.com\",\"medicalAidProvider\":\"Bonitas\",\"medicalAidMemberNumber\":\"MED-9Q\"}",
            "{\"isWicketKeeper\":false,\"phone\":\"0821234567\",\"email\":\"main.agent@example.com\",\"medicalAidProvider\":\"Discovery\",\"medicalAidMemberNumber\":\"NEW\"}",
            "{\"isWicketKeeper\":false,\"phone\":\"0821234567\",\"email\":\"other@example.com\",\"medicalAidProvider\":\"Discovery\",\"medicalAidMemberNumber\":\"MED-9Q\"}",
            "{\"isWicketKeeper\":false,\"phone\":\"0821234567\",\"email\":\"main.agent@example.com\",\"dateOfBirth\":\"2011-01-01\"}"};
        for (String body : forbiddenBodies) {
            mockMvc.perform(put("/api/v1/me/players/{k}", secondLink.getId()).with(as(second))
                            .contentType(MediaType.APPLICATION_JSON).content(body))
                    .andExpect(status().isForbidden());
        }
        PlayerProfile stored = playerProfileRepository.findById(profile.getId()).orElseThrow();
        assertThat(stored.getMedicalAidProvider()).isEqualTo("Discovery");
        assertThat(stored.getEmail()).isEqualTo("main.agent@example.com");
        assertThat(personRepository.findById(kid.getId()).orElseThrow().getDateOfBirth()).isEqualTo(CHILD_DOB);
    }

    @Test
    void theMainAgentChangesTheDateOfBirthWithinBoundsAndABadOneIs400() throws Exception {
        Club club = club("Hillcrest");
        Person parent = account("Pat", "Parent");
        Person kid = playerPerson("Sam", "Smith", CHILD_DOB);
        profile(club, kid, null);
        PersonLink link = link(parent, kid, club, true);
        String base = "{\"isWicketKeeper\":false,\"dateOfBirth\":\"%s\"}";

        for (String bad : new String[] {LocalDate.now().plusDays(1).toString(), "1899-12-31",
            LocalDate.now().minusYears(101).toString()}) {
            mockMvc.perform(put("/api/v1/me/players/{k}", link.getId()).with(as(parent)).contentType(MediaType.APPLICATION_JSON)
                            .content(base.formatted(bad)))
                    .andExpect(status().isBadRequest());
        }
        mockMvc.perform(put("/api/v1/me/players/{k}", link.getId()).with(as(parent)).contentType(MediaType.APPLICATION_JSON)
                        .content(base.formatted("2011-06-15")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.dateOfBirth").value("2011-06-15"));
        assertThat(personRepository.findById(kid.getId()).orElseThrow().getDateOfBirth()).isEqualTo(LocalDate.of(2011, 6, 15));
    }

    // ---- what each agent sees ----

    @Test
    void aNonMainAgentNeverSeesAnotherAgentsEmailAndTheMainAgentSeesThemMasked() throws Exception {
        Club club = club("Hillcrest");
        Person main = account("Mary", "Main", "mary.main@example.org");
        Person second = account("Sid", "Second", "sid.second@example.net");
        Person kid = playerPerson("Sam", "Smith", CHILD_DOB);
        profile(club, kid, null);
        PersonLink mainLink = link(main, kid, club, true);
        PersonLink secondLink = link(second, kid, club, false);

        String asSecond = mockMvc.perform(get("/api/v1/me/players/{k}", secondLink.getId()).with(as(second)))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        assertThat(asSecond).doesNotContain("mary.main@example.org").doesNotContain("Mary").doesNotContain("m***@");
        assertThat(com.jayway.jsonpath.JsonPath.<java.util.List<Object>>read(asSecond, "$.agents")).isEmpty();
        assertThat(com.jayway.jsonpath.JsonPath.<Integer>read(asSecond, "$.agentCount")).isEqualTo(2);
        assertThat(com.jayway.jsonpath.JsonPath.<Boolean>read(asSecond, "$.canEditMedical")).isFalse();

        String asMain = mockMvc.perform(get("/api/v1/me/players/{k}", mainLink.getId()).with(as(main)))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        assertThat(asMain).contains("s***@example.net").doesNotContain("sid.second@example.net");
    }

    // ---- polls ----

    @Test
    void aLinkedAccountSeesTheOpenPollsThePlayerBelongsToWithTheirCurrentAnswer() throws Exception {
        Club club = club("Hillcrest");
        Section juniors = section(club, "Juniors");
        Person parent = account("Pat", "Parent");
        Person kid = playerPerson("Sam", "Smith", CHILD_DOB);
        PlayerProfile profile = profile(club, kid, null);
        tag(profile, juniors);
        PersonLink link = link(parent, kid, club, true);
        SquadPoll squad = squadPoll(club, juniors, profile);
        GroupRound round = groupRound(club, juniors);
        // a poll for a team the player is not in
        squadPoll(club, juniors);

        mockMvc.perform(get("/api/v1/me/players/{k}/polls", link.getId()).with(as(parent)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[?(@.kind=='SQUAD')].pollId").value(squad.poll().getId().toString()))
                .andExpect(jsonPath("$[?(@.kind=='GROUP')].pollId").value(round.round().getId().toString()));
    }

    @Test
    void aSquadPollAnswerIsWrittenWithSourceLinkedAccountAndASecondAnswerReplacesIt() throws Exception {
        Club club = club("Hillcrest");
        Section juniors = section(club, "Juniors");
        Person parent = account("Pat", "Parent");
        Person kid = playerPerson("Sam", "Smith", CHILD_DOB);
        PlayerProfile profile = profile(club, kid, null);
        PersonLink link = link(parent, kid, club, true);
        SquadPoll squad = squadPoll(club, juniors, profile);

        for (String status : new String[] {"AVAILABLE", "UNAVAILABLE"}) {
            mockMvc.perform(put("/api/v1/me/players/{k}/polls/{p}/answers", link.getId(), squad.poll().getId()).with(as(parent))
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"answers\":[{\"status\":\"" + status + "\"}]}"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.answers[0].status").value(status));
        }

        var stored = availabilityRepository.findByPollIdAndPlayerProfileId(squad.poll().getId(), profile.getId()).orElseThrow();
        assertThat(stored.getSource()).isEqualTo(AnswerSource.LINKED_ACCOUNT);
        assertThat(stored.getStatus().name()).isEqualTo("UNAVAILABLE");
        assertThat(availabilityRepository.findByPollId(squad.poll().getId())).hasSize(1);
        // and the findByPollIdInAndPlayerProfileId read behind the list shows the answer
        mockMvc.perform(get("/api/v1/me/players/{k}/polls", link.getId()).with(as(parent)))
                .andExpect(jsonPath("$[0].answers[0].status").value("UNAVAILABLE"));
    }

    @Test
    void aClosedSquadPollIs409AndAPollThePlayerDoesNotBelongToIs404() throws Exception {
        Club club = club("Hillcrest");
        Section juniors = section(club, "Juniors");
        Person parent = account("Pat", "Parent");
        Person kid = playerPerson("Sam", "Smith", CHILD_DOB);
        PlayerProfile profile = profile(club, kid, null);
        PersonLink link = link(parent, kid, club, true);
        SquadPoll closed = squadPoll(club, juniors, profile);
        closed.poll().setOpen(false);
        pollRepository.save(closed.poll());
        SquadPoll notMine = squadPoll(club, juniors);
        String body = "{\"answers\":[{\"status\":\"AVAILABLE\"}]}";

        mockMvc.perform(put("/api/v1/me/players/{k}/polls/{p}/answers", link.getId(), closed.poll().getId()).with(as(parent))
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isConflict());
        mockMvc.perform(put("/api/v1/me/players/{k}/polls/{p}/answers", link.getId(), notMine.poll().getId()).with(as(parent))
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isNotFound());
        mockMvc.perform(put("/api/v1/me/players/{k}/polls/{p}/answers", link.getId(), UUID.randomUUID()).with(as(parent))
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isNotFound());
        assertThat(availabilityRepository.findByPollId(closed.poll().getId())).isEmpty();
        assertThat(availabilityRepository.findByPollId(notMine.poll().getId())).isEmpty();
    }

    @Test
    void aGroupPollAnswerIsWrittenWithSourceLinkedAccountAndAClosedWindowIs409() throws Exception {
        Club club = club("Hillcrest");
        Section juniors = section(club, "Juniors");
        Person parent = account("Pat", "Parent");
        Person kid = playerPerson("Sam", "Smith", CHILD_DOB);
        PlayerProfile profile = profile(club, kid, null);
        tag(profile, juniors);
        PersonLink link = link(parent, kid, club, true);
        GroupRound round = groupRound(club, juniors);
        String body = "{\"answers\":[{\"windowId\":\"" + round.window().getId() + "\",\"status\":\"AVAILABLE\"}]}";

        mockMvc.perform(put("/api/v1/me/players/{k}/polls/{p}/answers", link.getId(), round.round().getId()).with(as(parent))
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isOk());
        var stored = responseRepository.findByWindowIdAndPlayerProfileId(round.window().getId(), profile.getId()).orElseThrow();
        assertThat(stored.getSource()).isEqualTo(AnswerSource.LINKED_ACCOUNT);

        round.window().setOpen(false);
        windowRepository.save(round.window());
        mockMvc.perform(put("/api/v1/me/players/{k}/polls/{p}/answers", link.getId(), round.round().getId()).with(as(parent))
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isConflict());
    }

    @Test
    void aGroupPollOfASectionThePlayerIsNotTaggedToIs404() throws Exception {
        Club club = club("Hillcrest");
        Section juniors = section(club, "Juniors");
        Section vets = section(club, "Vets");
        Person parent = account("Pat", "Parent");
        Person kid = playerPerson("Sam", "Smith", CHILD_DOB);
        PlayerProfile profile = profile(club, kid, null);
        tag(profile, juniors);
        PersonLink link = link(parent, kid, club, true);
        GroupRound vetsRound = groupRound(club, vets);

        mockMvc.perform(put("/api/v1/me/players/{k}/polls/{p}/answers", link.getId(), vetsRound.round().getId()).with(as(parent))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"answers\":[{\"windowId\":\"" + vetsRound.window().getId() + "\",\"status\":\"AVAILABLE\"}]}"))
                .andExpect(status().isNotFound());
        assertThat(responseRepository.findByWindowIdAndPlayerProfileId(vetsRound.window().getId(), profile.getId())).isEmpty();
    }
}
