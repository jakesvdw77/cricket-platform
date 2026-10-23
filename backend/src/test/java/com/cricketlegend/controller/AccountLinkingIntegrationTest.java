package com.cricketlegend.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.cricketlegend.AbstractIntegrationTest;
import com.cricketlegend.AbstractLinkIntegrationTest;
import com.cricketlegend.domain.Club;
import com.cricketlegend.domain.LinkGrantedVia;
import com.cricketlegend.domain.Person;
import com.cricketlegend.domain.PersonLink;
import com.cricketlegend.domain.PersonLinkStatus;
import com.cricketlegend.domain.PlayerProfile;
import com.cricketlegend.domain.Section;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

/**
 * docs/specs/119 slice 3, Integration (Testcontainers): the email match and confirm over real HTTP and Postgres, the
 * minimisation of the matches response (a body scan for the stored date of birth and every other private field), masked
 * emails, and the 404 wall around "My players" (another club, another player, another account's link).
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(AbstractIntegrationTest.class)
@Transactional
class AccountLinkingIntegrationTest extends AbstractLinkIntegrationTest {

    @Autowired private MockMvc mockMvc;

    private String get200(String url, org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.JwtRequestPostProcessor who)
            throws Exception {
        return mockMvc.perform(get(url).with(who)).andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
    }

    @Test
    void theMatchesResponseCarriesBirthYearAndNoFullDateOfBirthPhoneMedicalOrPhotoAnywhere() throws Exception {
        Club club = club("Hillcrest");
        Person parent = account("Pat", "Parent");
        Person kid = playerPerson("Sam", "Smith", CHILD_DOB);
        profile(club, kid, parent.getEmail());

        String body = get200("/api/v1/me/player-matches", as(parent));

        assertThat(body).contains("\"birthYear\":2012").contains("\"adult\":false").contains("\"surnameInitial\":\"S\"")
                .contains("\"firstName\":\"Sam\"");
        // the stored date of birth, in every common rendering, and every other private field of the record
        assertThat(body).doesNotContain("2012-06-15").doesNotContain("15/06").doesNotContain("06-15")
                .doesNotContain("0821234567").doesNotContain("Discovery").doesNotContain("MED-9Q")
                .doesNotContain("photo.png").doesNotContain("dateOfBirth").doesNotContain("medical")
                .doesNotContain("Smith").doesNotContain(parent.getEmail());
    }

    @Test
    void anUnverifiedEmailGets403WithTheStableCodeOnEveryLinkEndpointAndSeesNothing() throws Exception {
        Club club = club("Hillcrest");
        Person parent = account("Pat", "Parent");
        PlayerProfile profile = profile(club, playerPerson("Sam", "Smith", CHILD_DOB), parent.getEmail());

        mockMvc.perform(get("/api/v1/me/player-matches").with(asUnverified(parent)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("EMAIL_NOT_VERIFIED"));
        mockMvc.perform(post("/api/v1/me/links").with(asUnverified(parent)).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"playerRefs\":[\"" + profile.getId() + "\"],\"confirm\":true}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("EMAIL_NOT_VERIFIED"));
        assertThat(personLinkRepository.findByAccountPersonIdAndStatus(parent.getId(), PersonLinkStatus.ACTIVE)).isEmpty();
    }

    @Test
    void aPlayerWithAMainAgentIsListedSeparatelyWithOnlyAMaskedEmail() throws Exception {
        Club club = club("Hillcrest");
        Person parent = account("Pat", "Parent");
        Person otherParent = account("Olga", "Other", "olga.other@example.org");
        Person free = playerPerson("Fred", "Free", CHILD_DOB);
        Person taken = playerPerson("Tara", "Taken", CHILD_DOB);
        profile(club, free, parent.getEmail());
        profile(club, taken, parent.getEmail());
        link(otherParent, taken, club, true);

        String body = get200("/api/v1/me/player-matches", as(parent));

        assertThat(body).contains("\"maskedMainAgentEmail\":\"o***@example.org\"");
        assertThat(body).doesNotContain("olga.other@example.org").doesNotContain("Olga");
        mockMvc.perform(get("/api/v1/me/player-matches").with(as(parent)))
                .andExpect(jsonPath("$.withoutMainAgent[0].firstName").value("Fred"))
                .andExpect(jsonPath("$.withMainAgent[0].firstName").value("Tara"));
    }

    @Test
    void emailMatchingIsCaseInsensitiveAndSkipsInactivePlayersAndOtherEmails() throws Exception {
        Club club = club("Hillcrest");
        Person parent = account("Pat", "Parent", "pat.parent@example.com");
        profile(club, playerPerson("Upper", "Case", CHILD_DOB), "PAT.PARENT@EXAMPLE.COM");
        PlayerProfile inactive = profile(club, playerPerson("In", "Active", CHILD_DOB), parent.getEmail());
        inactive.setActive(false);
        playerProfileRepository.save(inactive);
        profile(club, playerPerson("Some", "OneElse", CHILD_DOB), "someone.else@example.com");

        mockMvc.perform(get("/api/v1/me/player-matches").with(as(parent)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.withoutMainAgent.length()").value(1))
                .andExpect(jsonPath("$.withoutMainAgent[0].firstName").value("Upper"));
    }

    @Test
    void confirmingLinksTheTickedPlayersAsMainAgentAndTheyThenAppearInMyPlayersAndLeaveTheMatches() throws Exception {
        Club club = club("Hillcrest");
        Person parent = account("Pat", "Parent");
        Person kid = playerPerson("Sam", "Smith", CHILD_DOB);
        PlayerProfile profile = profile(club, kid, parent.getEmail());

        mockMvc.perform(post("/api/v1/me/links").with(as(parent)).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"playerRefs\":[\"" + profile.getId() + "\"],\"confirm\":true}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.linked[0].firstName").value("Sam"));

        List<PersonLink> links = personLinkRepository.findByAccountPersonIdAndStatus(parent.getId(), PersonLinkStatus.ACTIVE);
        assertThat(links).singleElement().satisfies(l -> {
            assertThat(l.isMain()).isTrue();
            assertThat(l.getGrantedVia()).isEqualTo(LinkGrantedVia.EMAIL_MATCH);
            assertThat(l.getSubjectPersonId()).isEqualTo(kid.getId());
            assertThat(l.getClubId()).isEqualTo(club.getId());
        });
        mockMvc.perform(get("/api/v1/me/players").with(as(parent)))
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].key").value(links.get(0).getId().toString()))
                .andExpect(jsonPath("$[0].main").value(true));
        mockMvc.perform(get("/api/v1/me/player-matches").with(as(parent)))
                .andExpect(jsonPath("$.withoutMainAgent.length()").value(0))
                .andExpect(jsonPath("$.withMainAgent.length()").value(0));
    }

    @Test
    void confirmFalseOrMissingIsA400AndLinksNothing() throws Exception {
        Club club = club("Hillcrest");
        Person parent = account("Pat", "Parent");
        PlayerProfile profile = profile(club, playerPerson("Sam", "Smith", CHILD_DOB), parent.getEmail());

        mockMvc.perform(post("/api/v1/me/links").with(as(parent)).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"playerRefs\":[\"" + profile.getId() + "\"],\"confirm\":false}"))
                .andExpect(status().isBadRequest());
        mockMvc.perform(post("/api/v1/me/links").with(as(parent)).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"playerRefs\":[\"" + profile.getId() + "\"]}"))
                .andExpect(status().isBadRequest());
        mockMvc.perform(post("/api/v1/me/links").with(as(parent)).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"playerRefs\":[],\"confirm\":true}"))
                .andExpect(status().isBadRequest());
        assertThat(personLinkRepository.findByAccountPersonIdAndStatus(parent.getId(), PersonLinkStatus.ACTIVE)).isEmpty();
    }

    // ---- the 404 wall around My players ----

    @Test
    void aLinkAtClubAIsNotFoundOnTheSamePlayerAtClubBAndOnAnotherPlayerAtClubAAndOnAnotherAccountsLink() throws Exception {
        Club clubA = club("Alpha");
        Club clubB = club("Beta");
        Section sectionB = section(clubB, "Juniors");
        Person parent = account("Pat", "Parent");
        Person kid = playerPerson("Sam", "Smith", CHILD_DOB);
        PlayerProfile atA = profile(clubA, kid, null);
        PlayerProfile atB = profile(clubB, kid, null);
        tag(atB, sectionB);
        Person otherParent = account("Olga", "Other");
        Person otherKid = playerPerson("Zoe", "Zulu", CHILD_DOB);
        PlayerProfile otherAtA = profile(clubA, otherKid, null);
        PersonLink mine = link(parent, kid, clubA, true);
        PersonLink theirs = link(otherParent, otherKid, clubA, true);
        SquadPoll pollAtB = squadPoll(clubB, sectionB, atB);

        // the held key resolves to the club A record only
        mockMvc.perform(get("/api/v1/me/players/{k}", mine.getId()).with(as(parent)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.clubId").value(clubA.getId().toString()));

        String[] unheld = {"self:" + atB.getId(), "self:" + atA.getId(), "self:" + otherAtA.getId(),
            theirs.getId().toString(), "garbage", java.util.UUID.randomUUID().toString()};
        for (String key : unheld) {
            mockMvc.perform(get("/api/v1/me/players/{k}", key).with(as(parent))).andExpect(status().isNotFound());
            mockMvc.perform(put("/api/v1/me/players/{k}", key).with(as(parent)).contentType(MediaType.APPLICATION_JSON)
                            .content("{\"isWicketKeeper\":false}"))
                    .andExpect(status().isNotFound());
            mockMvc.perform(get("/api/v1/me/players/{k}/polls", key).with(as(parent))).andExpect(status().isNotFound());
            mockMvc.perform(post("/api/v1/me/players/{k}/agents", key).with(as(parent)).contentType(MediaType.APPLICATION_JSON)
                            .content("{\"email\":\"x@example.com\",\"mode\":\"ADD\"}"))
                    .andExpect(status().isNotFound());
        }
        // a poll of club B cannot be answered through the club A link, even though the same person is in its squad
        mockMvc.perform(put("/api/v1/me/players/{k}/polls/{p}/answers", mine.getId(), pollAtB.poll().getId()).with(as(parent))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"answers\":[{\"status\":\"AVAILABLE\"}]}"))
                .andExpect(status().isNotFound());
    }

    @Test
    void aRevokedLinkAndAnInactivePlayerDropOutOfMyPlayersOnTheNextRead() throws Exception {
        Club club = club("Hillcrest");
        Person parent = account("Pat", "Parent");
        Person kid = playerPerson("Sam", "Smith", CHILD_DOB);
        PlayerProfile profile = profile(club, kid, null);
        PersonLink link = link(parent, kid, club, true);

        mockMvc.perform(get("/api/v1/me/players").with(as(parent))).andExpect(jsonPath("$.length()").value(1));

        profile.setActive(false);
        playerProfileRepository.save(profile);
        mockMvc.perform(get("/api/v1/me/players").with(as(parent))).andExpect(jsonPath("$.length()").value(0));
        mockMvc.perform(get("/api/v1/me/players/{k}", link.getId()).with(as(parent))).andExpect(status().isNotFound());

        profile.setActive(true);
        playerProfileRepository.save(profile);
        link.setStatus(PersonLinkStatus.REVOKED);
        personLinkRepository.save(link);
        mockMvc.perform(get("/api/v1/me/players").with(as(parent))).andExpect(jsonPath("$.length()").value(0));
    }

}
