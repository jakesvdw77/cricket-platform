package com.cricketlegend.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.cricketlegend.AbstractIntegrationTest;
import com.cricketlegend.AbstractLinkIntegrationTest;
import com.cricketlegend.domain.Club;
import com.cricketlegend.domain.LinkGrantedVia;
import com.cricketlegend.domain.Person;
import com.cricketlegend.domain.PersonLink;
import com.cricketlegend.domain.PersonLinkStatus;
import com.cricketlegend.domain.PersonStatus;
import com.cricketlegend.domain.PlayerProfile;
import com.cricketlegend.domain.Section;
import java.time.Duration;
import java.time.Instant;
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
 * docs/specs/119 slice 4, Integration: handover, accept, expiry, leave, the club's remove, make-main and invite as main,
 * and the profile cards, over real HTTP and Postgres.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(AbstractIntegrationTest.class)
@Transactional
class AgentHandoverIntegrationTest extends AbstractLinkIntegrationTest {

    @Autowired private MockMvc mockMvc;

    private Club club;
    private Person kid;
    private PlayerProfile kidProfile;
    private Person main;
    private PersonLink mainLink;

    private void givenAPlayerWithAMainAgent() {
        club = club("Hillcrest");
        kid = playerPerson("Sam", "Smith", CHILD_DOB);
        kidProfile = profile(club, kid, null);
        main = account("Mary", "Main");
        mainLink = link(main, kid, club, true);
    }

    private static String invite(String email, String mode) {
        return "{\"email\":\"" + email + "\",\"mode\":\"" + mode + "\"}";
    }

    private void postInvite(Person who, PersonLink asLink, String email, String mode, int expected) throws Exception {
        mockMvc.perform(post("/api/v1/me/players/{k}/agents", asLink.getId()).with(as(who))
                        .contentType(MediaType.APPLICATION_JSON).content(invite(email, mode)))
                .andExpect(status().is(expected));
    }

    private long activeMains() {
        return personLinkRepository.findActiveBySubjectAndClub(kid.getId(), club.getId()).stream().filter(PersonLink::isMain).count();
    }

    private PersonLink onlyOpenInvitation() {
        return personLinkRepository.findOpenInvitationsBySubjectAndClub(kid.getId(), club.getId(), Instant.now()).get(0);
    }

    // ---- invite ----

    @Test
    void theMainAgentInvitesAnEmailForFourteenDaysAndTheInviteeSeesItOnlyWithThatVerifiedEmail() throws Exception {
        givenAPlayerWithAMainAgent();
        Person invitee = account("Ian", "Invitee", "ian.invitee@example.com");
        Person someoneElse = account("Eve", "Else");

        postInvite(main, mainLink, "  Ian.Invitee@Example.com ", "HANDOVER", 204);

        PersonLink invitation = onlyOpenInvitation();
        assertThat(invitation.getInvitedEmail()).isEqualTo("ian.invitee@example.com");
        assertThat(invitation.isMakeMain()).isTrue();
        assertThat(invitation.getGrantedVia()).isEqualTo(LinkGrantedVia.AGENT_INVITE);
        assertThat(invitation.getGrantedByPersonId()).isEqualTo(main.getId());
        assertThat(Duration.between(Instant.now(), invitation.getExpiresAt()))
                .isBetween(Duration.ofDays(14).minusMinutes(5), Duration.ofDays(14).plusMinutes(5));

        mockMvc.perform(get("/api/v1/me/invitations").with(as(invitee)))
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].playerName").value("Sam Smith"))
                .andExpect(jsonPath("$[0].invitedByName").value("Mary Main"))
                .andExpect(jsonPath("$[0].makeMain").value(true));
        mockMvc.perform(get("/api/v1/me/invitations").with(as(someoneElse))).andExpect(jsonPath("$.length()").value(0));
        mockMvc.perform(get("/api/v1/me/invitations").with(asUnverified(invitee)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("EMAIL_NOT_VERIFIED"));
    }

    @Test
    void aNonMainAgentCannotInviteHandOverOrRemoveOtherAgents() throws Exception {
        givenAPlayerWithAMainAgent();
        Person second = account("Sid", "Second");
        PersonLink secondLink = link(second, kid, club, false);

        postInvite(second, secondLink, "someone@example.com", "ADD", 403);
        postInvite(second, secondLink, "someone@example.com", "HANDOVER", 403);
        mockMvc.perform(delete("/api/v1/me/links/{id}", mainLink.getId()).with(as(second))).andExpect(status().isNotFound());
        assertThat(personLinkRepository.findOpenInvitationsBySubjectAndClub(kid.getId(), club.getId(), Instant.now())).isEmpty();
        assertThat(personLinkRepository.findById(mainLink.getId()).orElseThrow().getStatus()).isEqualTo(PersonLinkStatus.ACTIVE);
    }

    @Test
    void ownEmailAndMalformedAddressAreA400AndAnExistingAgentOrADuplicateInvitationIsA409() throws Exception {
        givenAPlayerWithAMainAgent();
        Person agent = account("Sid", "Second", "sid.second@example.com");
        link(agent, kid, club, false);

        postInvite(main, mainLink, main.getEmail(), "ADD", 400);
        postInvite(main, mainLink, "not-an-email", "ADD", 400);
        postInvite(main, mainLink, "sid.second@example.com", "ADD", 409);
        postInvite(main, mainLink, "a1@example.com", "ADD", 204);
        postInvite(main, mainLink, "A1@example.com", "ADD", 409);
    }

    @Test
    void theSixthInvitationInADayIs429() throws Exception {
        // (inside the test transaction a refused call's count is not rolled back, so this test sends only valid ones)
        givenAPlayerWithAMainAgent();

        for (int i = 1; i <= 5; i++) {
            postInvite(main, mainLink, "a" + i + "@example.com", "ADD", 204);
        }
        postInvite(main, mainLink, "a6@example.com", "ADD", 429);
        assertThat(personLinkRepository.findOpenInvitationsBySubjectAndClub(kid.getId(), club.getId(), Instant.now())).hasSize(5);
    }

    // ---- accept, decline, expiry ----

    @Test
    void acceptingAHandOverMakesTheInviteeMainAndStepsThePreviousMainDownToAnOrdinaryAgent() throws Exception {
        givenAPlayerWithAMainAgent();
        Person invitee = account("Ian", "Invitee", "ian.invitee@example.com");
        PersonLink invitation = invitation(kid, club, "ian.invitee@example.com", main, true);

        mockMvc.perform(post("/api/v1/me/links/{id}/accept", invitation.getId()).with(as(invitee))).andExpect(status().isNoContent());

        PersonLink accepted = personLinkRepository.findById(invitation.getId()).orElseThrow();
        assertThat(accepted.getStatus()).isEqualTo(PersonLinkStatus.ACTIVE);
        assertThat(accepted.isMain()).isTrue();
        assertThat(accepted.getAccountPersonId()).isEqualTo(invitee.getId());
        PersonLink previous = personLinkRepository.findById(mainLink.getId()).orElseThrow();
        assertThat(previous.getStatus()).isEqualTo(PersonLinkStatus.ACTIVE);
        assertThat(previous.isMain()).isFalse();
        assertThat(activeMains()).isEqualTo(1);
        mockMvc.perform(get("/api/v1/me/players").with(as(invitee))).andExpect(jsonPath("$[0].main").value(true));
        mockMvc.perform(get("/api/v1/me/players").with(as(main))).andExpect(jsonPath("$[0].main").value(false));
    }

    @Test
    void anAddInvitationKeepsTheCurrentMainAndAnInviteeForAPlayerWithNoMainBecomesMain() throws Exception {
        givenAPlayerWithAMainAgent();
        Person invitee = account("Ian", "Invitee", "ian.invitee@example.com");
        PersonLink add = invitation(kid, club, "ian.invitee@example.com", main, false);

        mockMvc.perform(post("/api/v1/me/links/{id}/accept", add.getId()).with(as(invitee))).andExpect(status().isNoContent());
        assertThat(personLinkRepository.findById(add.getId()).orElseThrow().isMain()).isFalse();
        assertThat(personLinkRepository.findById(mainLink.getId()).orElseThrow().isMain()).isTrue();

        // a player whose club removed every agent: the next accepted invitation becomes main
        Club other = club("Beta");
        Person otherKid = playerPerson("Zoe", "Zulu", CHILD_DOB);
        profile(other, otherKid, null);
        Person club2Manager = account("Mo", "Manager");
        PersonLink noMainInvite = invitation(otherKid, other, "ian.invitee@example.com", club2Manager, false);
        mockMvc.perform(post("/api/v1/me/links/{id}/accept", noMainInvite.getId()).with(as(invitee))).andExpect(status().isNoContent());
        assertThat(personLinkRepository.findById(noMainInvite.getId()).orElseThrow().isMain()).isTrue();
    }

    @Test
    void anInvitationForAnotherEmailOrAnUnverifiedEmailCannotBeAcceptedOrDeclined() throws Exception {
        givenAPlayerWithAMainAgent();
        Person invitee = account("Ian", "Invitee", "ian.invitee@example.com");
        Person stranger = account("Eve", "Stranger");
        PersonLink invitation = invitation(kid, club, "ian.invitee@example.com", main, true);

        mockMvc.perform(post("/api/v1/me/links/{id}/accept", invitation.getId()).with(as(stranger))).andExpect(status().isNotFound());
        mockMvc.perform(post("/api/v1/me/links/{id}/decline", invitation.getId()).with(as(stranger))).andExpect(status().isNotFound());
        mockMvc.perform(post("/api/v1/me/links/{id}/accept", invitation.getId()).with(asUnverified(invitee))).andExpect(status().isForbidden());
        assertThat(personLinkRepository.findById(invitation.getId()).orElseThrow().getStatus()).isEqualTo(PersonLinkStatus.INVITED);
        assertThat(activeMains()).isEqualTo(1);
        assertThat(personLinkRepository.findById(mainLink.getId()).orElseThrow().isMain()).isTrue();
    }

    @Test
    void anExpiredInvitationIsFilteredOutOnReadAndCannotBeAccepted() throws Exception {
        givenAPlayerWithAMainAgent();
        Person invitee = account("Ian", "Invitee", "ian.invitee@example.com");
        PersonLink invitation = invitation(kid, club, "ian.invitee@example.com", main, true);
        mockMvc.perform(get("/api/v1/me/invitations").with(as(invitee))).andExpect(jsonPath("$.length()").value(1));

        invitation.setExpiresAt(Instant.now().minus(Duration.ofMinutes(1)));
        personLinkRepository.save(invitation);

        mockMvc.perform(get("/api/v1/me/invitations").with(as(invitee))).andExpect(jsonPath("$.length()").value(0));
        mockMvc.perform(post("/api/v1/me/links/{id}/accept", invitation.getId()).with(as(invitee))).andExpect(status().isNotFound());
        // the main agent's own list of sent invitations drops it too
        mockMvc.perform(get("/api/v1/me/players/{k}", mainLink.getId()).with(as(main)))
                .andExpect(jsonPath("$.agents.length()").value(0));
    }

    @Test
    void decliningMarksTheInvitationDeclinedAndNothingChanges() throws Exception {
        givenAPlayerWithAMainAgent();
        Person invitee = account("Ian", "Invitee", "ian.invitee@example.com");
        PersonLink invitation = invitation(kid, club, "ian.invitee@example.com", main, true);

        mockMvc.perform(post("/api/v1/me/links/{id}/decline", invitation.getId()).with(as(invitee))).andExpect(status().isNoContent());

        assertThat(personLinkRepository.findById(invitation.getId()).orElseThrow().getStatus()).isEqualTo(PersonLinkStatus.DECLINED);
        assertThat(personLinkRepository.findById(mainLink.getId()).orElseThrow().isMain()).isTrue();
        mockMvc.perform(get("/api/v1/me/invitations").with(as(invitee))).andExpect(jsonPath("$.length()").value(0));
    }

    // ---- cancel and leave ----

    @Test
    void theSenderCancelsAnInvitationAndNobodyElseCan() throws Exception {
        givenAPlayerWithAMainAgent();
        Person invitee = account("Ian", "Invitee", "ian.invitee@example.com");
        PersonLink invitation = invitation(kid, club, "ian.invitee@example.com", main, true);

        mockMvc.perform(delete("/api/v1/me/links/{id}", invitation.getId()).with(as(invitee))).andExpect(status().isNotFound());
        mockMvc.perform(delete("/api/v1/me/links/{id}", invitation.getId()).with(as(main))).andExpect(status().isNoContent());

        assertThat(personLinkRepository.findById(invitation.getId()).orElseThrow().getStatus()).isEqualTo(PersonLinkStatus.REVOKED);
        mockMvc.perform(get("/api/v1/me/invitations").with(as(invitee))).andExpect(jsonPath("$.length()").value(0));
    }

    @Test
    void anOrdinaryAgentLeavesWithoutPromotingAnyoneAndTheMainAgentMustHandOverFirst() throws Exception {
        givenAPlayerWithAMainAgent();
        Person second = account("Sid", "Second");
        Person third = account("Tina", "Third");
        PersonLink secondLink = link(second, kid, club, false);
        PersonLink thirdLink = link(third, kid, club, false);

        mockMvc.perform(delete("/api/v1/me/links/{id}", mainLink.getId()).with(as(main))).andExpect(status().isConflict());
        mockMvc.perform(delete("/api/v1/me/links/{id}", secondLink.getId()).with(as(second))).andExpect(status().isNoContent());
        assertThat(personLinkRepository.findById(secondLink.getId()).orElseThrow().getStatus()).isEqualTo(PersonLinkStatus.REVOKED);
        assertThat(personLinkRepository.findById(mainLink.getId()).orElseThrow().isMain()).isTrue();
        assertThat(personLinkRepository.findById(thirdLink.getId()).orElseThrow().isMain()).isFalse();
        mockMvc.perform(get("/api/v1/me/players").with(as(second))).andExpect(jsonPath("$.length()").value(0));

        // the main agent leaves once the other agent has gone: nobody is left holding the player and nobody is promoted
        mockMvc.perform(delete("/api/v1/me/links/{id}", thirdLink.getId()).with(as(third))).andExpect(status().isNoContent());
        mockMvc.perform(delete("/api/v1/me/links/{id}", mainLink.getId()).with(as(main))).andExpect(status().isNoContent());
        assertThat(personLinkRepository.findActiveBySubjectAndClub(kid.getId(), club.getId())).isEmpty();
    }

    // ---- the club ----

    @Test
    void theClubRemovesAnAgentWithConfirmAndThePlayerVanishesFromTheirListOnTheNextRead() throws Exception {
        givenAPlayerWithAMainAgent();
        Person admin = clubAdmin(club);
        mockMvc.perform(get("/api/v1/me/players").with(as(main))).andExpect(jsonPath("$.length()").value(1));

        mockMvc.perform(delete("/api/v1/manage/clubs/{c}/players/{p}/links/{l}", club.getId(), kidProfile.getId(), mainLink.getId())
                        .with(as(admin)))
                .andExpect(status().isBadRequest());
        mockMvc.perform(delete("/api/v1/manage/clubs/{c}/players/{p}/links/{l}", club.getId(), kidProfile.getId(), mainLink.getId())
                        .param("confirm", "true").with(as(admin)))
                .andExpect(status().isNoContent());

        PersonLink revoked = personLinkRepository.findById(mainLink.getId()).orElseThrow();
        assertThat(revoked.getStatus()).isEqualTo(PersonLinkStatus.REVOKED);
        assertThat(revoked.isMain()).isFalse();
        assertThat(revoked.getRevokedByPersonId()).isEqualTo(admin.getId());
        mockMvc.perform(get("/api/v1/me/players").with(as(main))).andExpect(jsonPath("$.length()").value(0));
        mockMvc.perform(get("/api/v1/me/players/{k}", mainLink.getId()).with(as(main))).andExpect(status().isNotFound());
    }

    @Test
    void theClubMakesAnotherAgentMainWithConfirmAndExactlyOneMainRemains() throws Exception {
        givenAPlayerWithAMainAgent();
        Person admin = clubAdmin(club);
        Person second = account("Sid", "Second");
        PersonLink secondLink = link(second, kid, club, false);
        String path = "/api/v1/manage/clubs/{c}/players/{p}/links/{l}/make-main";

        mockMvc.perform(post(path, club.getId(), kidProfile.getId(), secondLink.getId()).with(as(admin))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"confirm\":false}"))
                .andExpect(status().isBadRequest());
        mockMvc.perform(post(path, club.getId(), kidProfile.getId(), secondLink.getId()).with(as(admin))
                        .contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isBadRequest());
        assertThat(personLinkRepository.findById(mainLink.getId()).orElseThrow().isMain()).isTrue();

        mockMvc.perform(post(path, club.getId(), kidProfile.getId(), secondLink.getId()).with(as(admin))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"confirm\":true}"))
                .andExpect(status().isNoContent());

        assertThat(personLinkRepository.findById(secondLink.getId()).orElseThrow().isMain()).isTrue();
        assertThat(personLinkRepository.findById(mainLink.getId()).orElseThrow().isMain()).isFalse();
        assertThat(activeMains()).isEqualTo(1);
        // already main: a conflict
        mockMvc.perform(post(path, club.getId(), kidProfile.getId(), secondLink.getId()).with(as(admin))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"confirm\":true}"))
                .andExpect(status().isConflict());
    }

    @Test
    void theClubInvitesAnEmailAsMainWithConfirmAndTheInviteeCanAcceptIt() throws Exception {
        givenAPlayerWithAMainAgent();
        Person admin = clubAdmin(club);
        Person invitee = account("Ian", "Invitee", "ian.invitee@example.com");
        String path = "/api/v1/manage/clubs/{c}/players/{p}/links";

        mockMvc.perform(post(path, club.getId(), kidProfile.getId()).with(as(admin)).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"ian.invitee@example.com\"}"))
                .andExpect(status().isBadRequest());
        mockMvc.perform(post(path, club.getId(), kidProfile.getId()).with(as(admin)).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"ian.invitee@example.com\",\"confirm\":true}"))
                .andExpect(status().isNoContent());

        PersonLink invitation = onlyOpenInvitation();
        assertThat(invitation.getGrantedVia()).isEqualTo(LinkGrantedVia.CLUB_MANAGER);
        assertThat(invitation.isMakeMain()).isTrue();
        mockMvc.perform(get("/api/v1/me/invitations").with(as(invitee)))
                .andExpect(jsonPath("$[0].invitedByName").value("Club Admin"));
        mockMvc.perform(post("/api/v1/me/links/{id}/accept", invitation.getId()).with(as(invitee))).andExpect(status().isNoContent());
        assertThat(personLinkRepository.findById(invitation.getId()).orElseThrow().isMain()).isTrue();
        assertThat(activeMains()).isEqualTo(1);
    }

    @Test
    void aSectionScopedManagerCannotChangeAgentsOfAPlayerOutsideTheirSections() throws Exception {
        givenAPlayerWithAMainAgent();
        Section juniors = section(club, "Juniors");
        Section vets = section(club, "Vets");
        tag(kidProfile, vets);
        Person juniorsAdmin = sectionAdmin(juniors);
        Person second = account("Sid", "Second");
        PersonLink secondLink = link(second, kid, club, false);

        mockMvc.perform(delete("/api/v1/manage/clubs/{c}/players/{p}/links/{l}", club.getId(), kidProfile.getId(), secondLink.getId())
                        .param("confirm", "true").with(as(juniorsAdmin)))
                .andExpect(status().isForbidden());
        mockMvc.perform(post("/api/v1/manage/clubs/{c}/players/{p}/links/{l}/make-main", club.getId(), kidProfile.getId(), secondLink.getId())
                        .with(as(juniorsAdmin)).contentType(MediaType.APPLICATION_JSON).content("{\"confirm\":true}"))
                .andExpect(status().isForbidden());
        mockMvc.perform(post("/api/v1/manage/clubs/{c}/players/{p}/links", club.getId(), kidProfile.getId()).with(as(juniorsAdmin))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"email\":\"x@example.com\",\"confirm\":true}"))
                .andExpect(status().isForbidden());
        assertThat(personLinkRepository.findById(secondLink.getId()).orElseThrow().getStatus()).isEqualTo(PersonLinkStatus.ACTIVE);
    }

    // ---- profile cards and suspension ----

    @Test
    void aManagerWhoIsAlsoAnAgentGetsOneManagerCardPerClubAndOneMyPlayersCard() throws Exception {
        givenAPlayerWithAMainAgent();
        Club otherClub = club("Beta");
        Person otherKid = playerPerson("Zoe", "Zulu", CHILD_DOB);
        profile(otherClub, otherKid, null);
        link(main, otherKid, otherClub, true); // two linked players at two clubs
        roleAssignmentRepository.save(com.cricketlegend.domain.RoleAssignment.builder().personId(main.getId())
                .role(com.cricketlegend.domain.RoleAssignmentRole.CLUB_ADMIN).scopeType(com.cricketlegend.domain.ScopeType.CLUB)
                .scopeId(club.getId()).build());
        Section section = section(otherClub, "Juniors");
        Section section2 = section(otherClub, "Seniors");
        for (Section s : new Section[] {section, section2}) {
            roleAssignmentRepository.save(com.cricketlegend.domain.RoleAssignment.builder().personId(main.getId())
                    .role(com.cricketlegend.domain.RoleAssignmentRole.CLUB_ADMIN)
                    .scopeType(com.cricketlegend.domain.ScopeType.SECTION).scopeId(s.getId()).build());
        }

        mockMvc.perform(get("/api/v1/me/profiles").with(as(main)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(3))
                .andExpect(jsonPath("$[0].kind").value("MY_PLAYERS"))
                .andExpect(jsonPath("$[0].subtitle").value("Sam Smith and 1 more"))
                .andExpect(jsonPath("$[?(@.kind=='MANAGER')]").value(org.hamcrest.Matchers.hasSize(2)))
                .andExpect(jsonPath("$[?(@.kind=='MANAGER' && @.clubId=='" + otherClub.getId() + "')].subtitle")
                        .value("Juniors and Seniors"));
    }

    @Test
    void anOpenInvitationAloneGivesAMyPlayersCardWithAPendingCountAndAPersonWithNothingGetsNoCards() throws Exception {
        givenAPlayerWithAMainAgent();
        Person invitee = account("Ian", "Invitee", "ian.invitee@example.com");
        Person nobody = account("No", "Body");
        invitation(kid, club, "ian.invitee@example.com", main, false);

        mockMvc.perform(get("/api/v1/me/profiles").with(as(invitee)))
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].kind").value("MY_PLAYERS"))
                .andExpect(jsonPath("$[0].pendingCount").value(1));
        mockMvc.perform(get("/api/v1/me/profiles").with(as(nobody))).andExpect(jsonPath("$.length()").value(0));
    }

    @Test
    void aSuspendedPersonIsRefusedOnProfilesPlayersAndInvitations() throws Exception {
        givenAPlayerWithAMainAgent();
        main.setStatus(PersonStatus.SUSPENDED);
        personRepository.save(main);

        mockMvc.perform(get("/api/v1/me/profiles").with(as(main))).andExpect(status().isForbidden());
        mockMvc.perform(get("/api/v1/me/players").with(as(main))).andExpect(status().isForbidden());
        mockMvc.perform(post("/api/v1/me/activate").with(as(main))).andExpect(status().isForbidden());
        mockMvc.perform(post("/api/v1/me/register").with(as(main))).andExpect(status().isForbidden());
    }

    @Test
    void registerCreatesAPersonForAnUnknownVerifiedLoginAndNothingElse() throws Exception {
        Person ghost = Person.builder().firstName("Gina").lastName("Ghost").email(unique("ghost") + "@example.com")
                .keycloakUserId(unique("sub")).build(); // not saved: the login exists only in Keycloak

        mockMvc.perform(post("/api/v1/me/register")
                        .with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt()
                                .jwt(b -> b.subject(ghost.getKeycloakUserId()).claim("email", ghost.getEmail())
                                        .claim("email_verified", true).claim("given_name", "Gina").claim("family_name", "Ghost"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.personId").isNotEmpty())
                .andExpect(jsonPath("$.clubAdminClubIds.length()").value(0))
                .andExpect(jsonPath("$.profiles.length()").value(0));
        Person created = personRepository.findByKeycloakUserId(ghost.getKeycloakUserId()).orElseThrow();
        assertThat(created.getOrigin()).isEqualTo(com.cricketlegend.domain.PersonOrigin.SELF_REGISTERED);
        assertThat(created.getFirstName()).isEqualTo("Gina");
        assertThat(roleAssignmentRepository.findByPersonId(created.getId())).isEmpty();
        assertThat(List.of(created.getStatus())).containsExactly(PersonStatus.ACTIVE);
    }
}
