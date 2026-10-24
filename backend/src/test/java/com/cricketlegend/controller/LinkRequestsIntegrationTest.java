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
import com.cricketlegend.domain.LinkRequest;
import com.cricketlegend.domain.LinkRequestStatus;
import com.cricketlegend.domain.Person;
import com.cricketlegend.domain.PersonLink;
import com.cricketlegend.domain.PersonLinkStatus;
import com.cricketlegend.domain.PlayerProfile;
import com.cricketlegend.domain.PlayerVerificationStatus;
import com.cricketlegend.domain.Section;
import com.cricketlegend.repository.LinkRequestRepository;
import com.jayway.jsonpath.JsonPath;
import java.util.List;
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
 * docs/specs/119 slice 3B, Integration: typed link requests from the requester (identical replies, the three pending cap,
 * the daily limit), the manager queue (approve, new player and approve, decline, section scope), and "Players and their
 * main agent" with masked emails only.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(AbstractIntegrationTest.class)
@Transactional
class LinkRequestsIntegrationTest extends AbstractLinkIntegrationTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private LinkRequestRepository linkRequestRepository;

    private static String requestBody(Club club, String first, String last, String dob) {
        return "{\"clubId\":\"" + club.getId() + "\",\"firstName\":\"" + first + "\",\"lastName\":\"" + last
                + "\",\"dateOfBirth\":\"" + dob + "\",\"contactNumber\":\"082 123 4567\",\"message\":\"Please link\"}";
    }

    private String postRequest(Person who, String body, int expectedStatus) throws Exception {
        return mockMvc.perform(post("/api/v1/me/link-requests").with(as(who)).contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().is(expectedStatus)).andReturn().getResponse().getContentAsString();
    }

    private LinkRequest pendingRequest(Person requester, Club club, String first, String last) {
        return linkRequestRepository.save(LinkRequest.builder().accountPersonId(requester.getId()).clubId(club.getId())
                .typedFirstName(first).typedLastName(last).typedDateOfBirth(CHILD_DOB).contactNumber("0821234567")
                .status(LinkRequestStatus.PENDING).build());
    }

    private String approveBody(UUID playerId, String mode) {
        return "{\"playerId\":\"" + playerId + "\",\"mainAgentMode\":\"" + mode + "\",\"confirm\":true}";
    }

    // ---- the requester ----

    @Test
    void theReplyIsIdenticalWhetherOrNotTheClubHoldsThePlayerTyped() throws Exception {
        Club club = club("Hillcrest");
        Person parent = account("Pat", "Parent");
        profile(club, playerPerson("Sam", "Smith", CHILD_DOB), null); // exists
        // a typed request for a player that exists and one for a player that does not
        String exists = postRequest(parent, requestBody(club, "Sam", "Smith", "2012-06-15"), 200);
        String unknown = postRequest(parent, requestBody(club, "Nobody", "AtAll", "2001-01-01"), 200);

        assertThat(exists).isEqualTo(unknown);
        assertThat(exists).doesNotContain("Sam").doesNotContain("Smith");
        List<LinkRequest> stored = linkRequestRepository.findByAccountPersonIdOrderByCreatedAtDesc(parent.getId());
        assertThat(stored).hasSize(2);
        assertThat(stored).allSatisfy(r -> {
            assertThat(r.getStatus()).isEqualTo(LinkRequestStatus.PENDING);
            assertThat(r.getContactNumber()).isEqualTo("082 123 4567");
        });
        assertThat(stored).extracting(LinkRequest::getTypedDateOfBirth)
                .containsExactlyInAnyOrder(CHILD_DOB, java.time.LocalDate.of(2001, 1, 1));
    }

    @Test
    void aRepeatOfTheSamePendingRequestAddsNothingAndRepliesTheSame() throws Exception {
        Club club = club("Hillcrest");
        Person parent = account("Pat", "Parent");

        String first = postRequest(parent, requestBody(club, "Sam", "Smith", "2012-06-15"), 200);
        String repeat = postRequest(parent, requestBody(club, "sam", "SMITH", "2012-06-15"), 200);

        assertThat(repeat).isEqualTo(first);
        assertThat(linkRequestRepository.findByAccountPersonIdOrderByCreatedAtDesc(parent.getId())).hasSize(1);
    }

    @Test
    void aFourthPendingRequestAtOneClubIs409AndAFifthAnywhereElseStillWorks() throws Exception {
        Club club = club("Hillcrest");
        Club other = club("Beta");
        Person parent = account("Pat", "Parent");
        for (String name : new String[] {"One", "Two", "Three"}) {
            postRequest(parent, requestBody(club, name, "Kid", "2012-06-15"), 200);
        }

        postRequest(parent, requestBody(club, "Four", "Kid", "2012-06-15"), 409);
        postRequest(parent, requestBody(other, "Four", "Kid", "2012-06-15"), 200);
    }

    @Test
    void theEleventhRequestInADayIs429WithRetryAfterSeconds() throws Exception {
        Person parent = account("Pat", "Parent");
        Club c1 = club("One");
        Club c2 = club("Two");
        Club c3 = club("Three");
        Club c4 = club("Four");
        int n = 0;
        for (Club c : new Club[] {c1, c2, c3}) {
            for (int i = 0; i < 3; i++) {
                postRequest(parent, requestBody(c, "Kid" + (n++), "Typed", "2012-06-15"), 200);
            }
        }
        postRequest(parent, requestBody(c4, "Kid" + (n++), "Typed", "2012-06-15"), 200); // the tenth

        String body = postRequest(parent, requestBody(c4, "Kid" + n, "Typed", "2012-06-15"), 429);

        assertThat(JsonPath.<Integer>read(body, "$.retryAfterSeconds")).isPositive();
    }

    @Test
    void aTypedRequestNeedsAVerifiedEmailAnActiveClubAndASaneDateOfBirth() throws Exception {
        Club club = club("Hillcrest");
        Person parent = account("Pat", "Parent");

        mockMvc.perform(post("/api/v1/me/link-requests").with(asUnverified(parent)).contentType(MediaType.APPLICATION_JSON)
                        .content(requestBody(club, "Sam", "Smith", "2012-06-15")))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("EMAIL_NOT_VERIFIED"));
        postRequest(parent, requestBody(club, "Sam", "Smith", "2999-01-01"), 400);
        postRequest(parent, requestBody(club, "Sam", "Smith", "1850-01-01"), 400);
        postRequest(parent, requestBody(club, "Sam", "Smith", "2012-06-15").replace("082 123 4567", "abc"), 400);
        mockMvc.perform(post("/api/v1/me/link-requests").with(as(parent)).contentType(MediaType.APPLICATION_JSON)
                        .content(requestBody(club, "Sam", "Smith", "2012-06-15").replace(club.getId().toString(), UUID.randomUUID().toString())))
                .andExpect(status().isNotFound());
        assertThat(linkRequestRepository.findByAccountPersonIdOrderByCreatedAtDesc(parent.getId())).isEmpty();
    }

    @Test
    void aRequesterListsTheirOwnRequestsOnlyAndCancelsOnlyTheirOwnPendingOne() throws Exception {
        Club club = club("Hillcrest");
        Person parent = account("Pat", "Parent");
        Person stranger = account("Eve", "Stranger");
        LinkRequest mine = pendingRequest(parent, club, "Sam", "Smith");
        LinkRequest theirs = pendingRequest(stranger, club, "Zoe", "Zulu");

        mockMvc.perform(get("/api/v1/me/link-requests").with(as(parent)))
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].status").value("PENDING"));
        mockMvc.perform(delete("/api/v1/me/link-requests/{id}", theirs.getId()).with(as(parent))).andExpect(status().isNotFound());
        mockMvc.perform(delete("/api/v1/me/link-requests/{id}", mine.getId()).with(as(parent))).andExpect(status().isNoContent());
        mockMvc.perform(delete("/api/v1/me/link-requests/{id}", mine.getId()).with(as(parent))).andExpect(status().isConflict());
        assertThat(linkRequestRepository.findById(mine.getId()).orElseThrow().getStatus()).isEqualTo(LinkRequestStatus.CANCELLED);
    }

    // ---- the manager ----

    @Test
    void approvingAnExistingPlayerLinksTheRequesterAsMainAndTheyThenHoldThePlayer() throws Exception {
        Club club = club("Hillcrest");
        Person admin = clubAdmin(club);
        Person parent = account("Pat", "Parent");
        Person kid = playerPerson("Sam", "Smith", CHILD_DOB);
        PlayerProfile profile = profile(club, kid, null);
        LinkRequest request = pendingRequest(parent, club, "Sam", "Smith");

        mockMvc.perform(get("/api/v1/manage/clubs/{c}/link-requests/summary", club.getId()).with(as(admin)))
                .andExpect(jsonPath("$.waiting").value(1));
        mockMvc.perform(get("/api/v1/manage/clubs/{c}/link-requests", club.getId()).with(as(admin)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].requesterEmail").value(parent.getEmail()))
                .andExpect(jsonPath("$[0].suggestedPlayer.playerId").value(profile.getId().toString()))
                .andExpect(jsonPath("$[0].suggestedPlayer.exactMatch").value(true));

        mockMvc.perform(post("/api/v1/manage/clubs/{c}/link-requests/{r}/approve", club.getId(), request.getId()).with(as(admin))
                        .contentType(MediaType.APPLICATION_JSON).content(approveBody(profile.getId(), "ADD")))
                .andExpect(status().isNoContent());

        LinkRequest decided = linkRequestRepository.findById(request.getId()).orElseThrow();
        assertThat(decided.getStatus()).isEqualTo(LinkRequestStatus.APPROVED);
        assertThat(decided.getResolvedSubjectPersonId()).isEqualTo(kid.getId());
        assertThat(decided.getDecidedByPersonId()).isEqualTo(admin.getId());
        PersonLink link = personLinkRepository.findByAccountPersonIdAndStatus(parent.getId(), PersonLinkStatus.ACTIVE).get(0);
        assertThat(link.isMain()).isTrue();
        assertThat(link.getGrantedVia()).isEqualTo(LinkGrantedVia.CLUB_APPROVAL);
        mockMvc.perform(get("/api/v1/me/players").with(as(parent))).andExpect(jsonPath("$.length()").value(1));
        mockMvc.perform(get("/api/v1/me/link-requests").with(as(parent))).andExpect(jsonPath("$[0].status").value("APPROVED"));
        mockMvc.perform(get("/api/v1/manage/clubs/{c}/link-requests/summary", club.getId()).with(as(admin)))
                .andExpect(jsonPath("$.waiting").value(0));
        // deciding twice is a conflict
        mockMvc.perform(post("/api/v1/manage/clubs/{c}/link-requests/{r}/approve", club.getId(), request.getId()).with(as(admin))
                        .contentType(MediaType.APPLICATION_JSON).content(approveBody(profile.getId(), "ADD")))
                .andExpect(status().isConflict());
    }

    @Test
    void approveWithoutConfirmTrueIs400AndChangesNothing() throws Exception {
        Club club = club("Hillcrest");
        Person admin = clubAdmin(club);
        Person parent = account("Pat", "Parent");
        PlayerProfile profile = profile(club, playerPerson("Sam", "Smith", CHILD_DOB), null);
        LinkRequest request = pendingRequest(parent, club, "Sam", "Smith");

        for (String body : new String[] {
            "{\"playerId\":\"" + profile.getId() + "\",\"mainAgentMode\":\"ADD\",\"confirm\":false}",
            "{\"playerId\":\"" + profile.getId() + "\",\"mainAgentMode\":\"ADD\"}"}) {
            mockMvc.perform(post("/api/v1/manage/clubs/{c}/link-requests/{r}/approve", club.getId(), request.getId()).with(as(admin))
                            .contentType(MediaType.APPLICATION_JSON).content(body))
                    .andExpect(status().isBadRequest());
        }
        assertThat(linkRequestRepository.findById(request.getId()).orElseThrow().getStatus()).isEqualTo(LinkRequestStatus.PENDING);
        assertThat(personLinkRepository.findByAccountPersonIdAndStatus(parent.getId(), PersonLinkStatus.ACTIVE)).isEmpty();
    }

    @Test
    void newPlayerAndApproveCreatesAVerifiedProfileTaggedToTheSectionAndTheMainAgentLinkTogether() throws Exception {
        Club club = club("Hillcrest");
        Section juniors = section(club, "Juniors");
        Person admin = clubAdmin(club);
        Person parent = account("Pat", "Parent");
        LinkRequest request = pendingRequest(parent, club, "Nia", "Newplayer");

        mockMvc.perform(post("/api/v1/manage/clubs/{c}/link-requests/{r}/approve", club.getId(), request.getId()).with(as(admin))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"newPlayer\":{\"firstName\":\"Nia\",\"lastName\":\"Newplayer\",\"dateOfBirth\":\"2012-06-15\","
                                + "\"sectionId\":\"" + juniors.getId() + "\"},\"mainAgentMode\":\"MAKE_MAIN\",\"confirm\":true}"))
                .andExpect(status().isNoContent());

        LinkRequest decided = linkRequestRepository.findById(request.getId()).orElseThrow();
        UUID newPersonId = decided.getResolvedSubjectPersonId();
        assertThat(newPersonId).isNotNull();
        PlayerProfile created = playerProfileRepository.findByPersonIdIn(List.of(newPersonId)).get(0);
        assertThat(created.getClubId()).isEqualTo(club.getId());
        assertThat(created.isActive()).isTrue();
        assertThat(created.getVerificationStatus()).isEqualTo(PlayerVerificationStatus.VERIFIED);
        assertThat(personRepository.findById(newPersonId).orElseThrow().getDateOfBirth()).isEqualTo(CHILD_DOB);
        assertThat(playerSectionRepository.findByPlayerProfileIdIn(List.of(created.getId()))).hasSize(1);
        PersonLink link = personLinkRepository.findByAccountPersonIdAndStatus(parent.getId(), PersonLinkStatus.ACTIVE).get(0);
        assertThat(link.getSubjectPersonId()).isEqualTo(newPersonId);
        assertThat(link.isMain()).isTrue();
    }

    @Test
    void makeMainStepsTheExistingMainAgentDownAndAddKeepsThem() throws Exception {
        Club club = club("Hillcrest");
        Person admin = clubAdmin(club);
        Person oldMain = account("Olga", "Old");
        Person parent = account("Pat", "Parent");
        Person kid = playerPerson("Sam", "Smith", CHILD_DOB);
        PlayerProfile profile = profile(club, kid, null);
        PersonLink oldLink = link(oldMain, kid, club, true);
        LinkRequest asAdd = pendingRequest(parent, club, "Sam", "Smith");

        mockMvc.perform(post("/api/v1/manage/clubs/{c}/link-requests/{r}/approve", club.getId(), asAdd.getId()).with(as(admin))
                        .contentType(MediaType.APPLICATION_JSON).content(approveBody(profile.getId(), "ADD")))
                .andExpect(status().isNoContent());
        assertThat(personLinkRepository.findById(oldLink.getId()).orElseThrow().isMain()).isTrue();
        assertThat(personLinkRepository.findByAccountPersonIdAndStatus(parent.getId(), PersonLinkStatus.ACTIVE).get(0).isMain()).isFalse();

        Person third = account("Tina", "Third");
        LinkRequest asMain = pendingRequest(third, club, "Sam", "Smith");
        mockMvc.perform(post("/api/v1/manage/clubs/{c}/link-requests/{r}/approve", club.getId(), asMain.getId()).with(as(admin))
                        .contentType(MediaType.APPLICATION_JSON).content(approveBody(profile.getId(), "MAKE_MAIN")))
                .andExpect(status().isNoContent());
        assertThat(personLinkRepository.findById(oldLink.getId()).orElseThrow().isMain()).isFalse();
        assertThat(personLinkRepository.findByAccountPersonIdAndStatus(third.getId(), PersonLinkStatus.ACTIVE).get(0).isMain()).isTrue();
        assertThat(personLinkRepository.findActiveBySubjectAndClub(kid.getId(), club.getId()).stream().filter(PersonLink::isMain))
                .hasSize(1);
    }

    @Test
    void declineStoresTheNoteAndTheRequesterSeesDeclinedWithIt() throws Exception {
        Club club = club("Hillcrest");
        Person admin = clubAdmin(club);
        Person parent = account("Pat", "Parent");
        LinkRequest request = pendingRequest(parent, club, "Sam", "Smith");

        mockMvc.perform(post("/api/v1/manage/clubs/{c}/link-requests/{r}/decline", club.getId(), request.getId()).with(as(admin))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"note\":\"Please call the club office.\"}"))
                .andExpect(status().isNoContent());

        assertThat(linkRequestRepository.findById(request.getId()).orElseThrow().getDecisionNote()).isEqualTo("Please call the club office.");
        mockMvc.perform(get("/api/v1/me/link-requests").with(as(parent)))
                .andExpect(jsonPath("$[0].status").value("DECLINED"))
                .andExpect(jsonPath("$[0].decisionNote").value("Please call the club office."));
        assertThat(personLinkRepository.findByAccountPersonIdAndStatus(parent.getId(), PersonLinkStatus.ACTIVE)).isEmpty();
    }

    @Test
    void aManagerOfAnotherClubAndAPlainAccountAreRefusedAndARequestOfAnotherClubIsNotFound() throws Exception {
        Club club = club("Hillcrest");
        Club other = club("Beta");
        Person otherAdmin = clubAdmin(other);
        Person parent = account("Pat", "Parent");
        LinkRequest request = pendingRequest(parent, club, "Sam", "Smith");

        mockMvc.perform(get("/api/v1/manage/clubs/{c}/link-requests", club.getId()).with(as(otherAdmin))).andExpect(status().isForbidden());
        mockMvc.perform(get("/api/v1/manage/clubs/{c}/link-requests", club.getId()).with(as(parent))).andExpect(status().isForbidden());
        mockMvc.perform(post("/api/v1/manage/clubs/{c}/link-requests/{r}/decline", club.getId(), request.getId()).with(as(parent))
                        .contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isForbidden());
        // the request id under another club's path
        mockMvc.perform(post("/api/v1/manage/clubs/{c}/link-requests/{r}/decline", other.getId(), request.getId()).with(as(otherAdmin))
                        .contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isNotFound());
        assertThat(linkRequestRepository.findById(request.getId()).orElseThrow().getStatus()).isEqualTo(LinkRequestStatus.PENDING);
    }

    @Test
    void aSectionScopedManagerSeesAndDecidesOnlyRequestsResolvedInsideTheirSections() throws Exception {
        Club club = club("Hillcrest");
        Section juniors = section(club, "Juniors");
        Section vets = section(club, "Vets");
        Person clubWide = clubAdmin(club);
        Person juniorsAdmin = sectionAdmin(juniors);
        Person parent1 = account("Pat", "Parent");
        Person parent2 = account("Quin", "Parent");
        Person parent3 = account("Ray", "Parent");
        PlayerProfile junior = profile(club, playerPerson("Jess", "Junior", CHILD_DOB), null);
        PlayerProfile vet = profile(club, playerPerson("Vic", "Veteran", CHILD_DOB), null);
        tag(junior, juniors);
        tag(vet, vets);
        LinkRequest inJuniors = pendingRequest(parent1, club, "Jess", "Junior");
        LinkRequest inVets = pendingRequest(parent2, club, "Vic", "Veteran");
        LinkRequest unresolved = pendingRequest(parent3, club, "Nobody", "Known");

        mockMvc.perform(get("/api/v1/manage/clubs/{c}/link-requests", club.getId()).with(as(juniorsAdmin)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].id").value(inJuniors.getId().toString()));
        mockMvc.perform(get("/api/v1/manage/clubs/{c}/link-requests/summary", club.getId()).with(as(juniorsAdmin)))
                .andExpect(jsonPath("$.waiting").value(1));
        mockMvc.perform(get("/api/v1/manage/clubs/{c}/link-requests/summary", club.getId()).with(as(clubWide)))
                .andExpect(jsonPath("$.waiting").value(3));

        for (LinkRequest notTheirs : new LinkRequest[] {inVets, unresolved}) {
            mockMvc.perform(post("/api/v1/manage/clubs/{c}/link-requests/{r}/decline", club.getId(), notTheirs.getId())
                            .with(as(juniorsAdmin)).contentType(MediaType.APPLICATION_JSON).content("{}"))
                    .andExpect(status().isForbidden());
            mockMvc.perform(post("/api/v1/manage/clubs/{c}/link-requests/{r}/approve", club.getId(), notTheirs.getId())
                            .with(as(juniorsAdmin)).contentType(MediaType.APPLICATION_JSON).content(approveBody(vet.getId(), "ADD")))
                    .andExpect(status().isForbidden());
        }
        mockMvc.perform(post("/api/v1/manage/clubs/{c}/link-requests/{r}/decline", club.getId(), inJuniors.getId())
                        .with(as(juniorsAdmin)).contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isNoContent());
        assertThat(linkRequestRepository.findById(inVets.getId()).orElseThrow().getStatus()).isEqualTo(LinkRequestStatus.PENDING);
        assertThat(linkRequestRepository.findById(unresolved.getId()).orElseThrow().getStatus()).isEqualTo(LinkRequestStatus.PENDING);
    }

    // ---- players and their main agent ----

    @Test
    void playerAccountsListMainAgentsByMaskedEmailOnlyAndSectionScopedManagersSeeOnlyTheirPlayers() throws Exception {
        Club club = club("Hillcrest");
        Section juniors = section(club, "Juniors");
        Section vets = section(club, "Vets");
        Person clubWide = clubAdmin(club);
        Person juniorsAdmin = sectionAdmin(juniors);
        Person mainAgent = account("Mary", "Main", "mary.main@example.org");
        Person second = account("Sid", "Second", "sid.second@example.net");
        Person junior = playerPerson("Jess", "Junior", CHILD_DOB);
        Person vet = playerPerson("Vic", "Veteran", CHILD_DOB);
        PlayerProfile juniorProfile = profile(club, junior, null);
        PlayerProfile vetProfile = profile(club, vet, null);
        tag(juniorProfile, juniors);
        tag(vetProfile, vets);
        link(mainAgent, junior, club, true);
        link(second, junior, club, false);

        String all = mockMvc.perform(get("/api/v1/manage/clubs/{c}/player-accounts", club.getId()).with(as(clubWide)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(2))
                .andReturn().getResponse().getContentAsString();
        assertThat(all).contains("m***@example.org").contains("Mary Main")
                .doesNotContain("mary.main@example.org").doesNotContain("sid.second@example.net").doesNotContain("2012-06-15");

        mockMvc.perform(get("/api/v1/manage/clubs/{c}/player-accounts", club.getId()).param("noMainAgent", "true").with(as(clubWide)))
                .andExpect(jsonPath("$.content.length()").value(1))
                .andExpect(jsonPath("$.content[0].firstName").value("Vic"));
        mockMvc.perform(get("/api/v1/manage/clubs/{c}/player-accounts", club.getId()).param("search", "jess").with(as(clubWide)))
                .andExpect(jsonPath("$.content.length()").value(1));
        mockMvc.perform(get("/api/v1/manage/clubs/{c}/player-accounts", club.getId()).with(as(juniorsAdmin)))
                .andExpect(jsonPath("$.content.length()").value(1))
                .andExpect(jsonPath("$.content[0].firstName").value("Jess"))
                .andExpect(jsonPath("$.content[0].otherAgentCount").value(1));
        mockMvc.perform(get("/api/v1/manage/clubs/{c}/player-accounts", club.getId()).param("size", "101").with(as(clubWide)))
                .andExpect(status().isBadRequest());
        mockMvc.perform(get("/api/v1/manage/clubs/{c}/player-accounts", club.getId()).param("sectionId", vets.getId().toString())
                        .with(as(juniorsAdmin)))
                .andExpect(status().isForbidden());
    }

    @Test
    void aPlayersAgentsAreShownToTheManagerMaskedAndOutOfSectionPlayersAreForbidden() throws Exception {
        Club club = club("Hillcrest");
        Section juniors = section(club, "Juniors");
        Section vets = section(club, "Vets");
        Person clubWide = clubAdmin(club);
        Person juniorsAdmin = sectionAdmin(juniors);
        Person mainAgent = account("Mary", "Main", "mary.main@example.org");
        Person vet = playerPerson("Vic", "Veteran", CHILD_DOB);
        Person junior = playerPerson("Jess", "Junior", CHILD_DOB);
        PlayerProfile vetProfile = profile(club, vet, null);
        PlayerProfile juniorProfile = profile(club, junior, null);
        tag(vetProfile, vets);
        tag(juniorProfile, juniors);
        link(mainAgent, junior, club, true);

        String links = mockMvc.perform(get("/api/v1/manage/clubs/{c}/players/{p}/links", club.getId(), juniorProfile.getId())
                        .with(as(juniorsAdmin)))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        assertThat(links).contains("m***@example.org").doesNotContain("mary.main@example.org");
        mockMvc.perform(get("/api/v1/manage/clubs/{c}/players/{p}/links", club.getId(), vetProfile.getId()).with(as(juniorsAdmin)))
                .andExpect(status().isForbidden());
        mockMvc.perform(get("/api/v1/manage/clubs/{c}/players/{p}/links", club.getId(), vetProfile.getId()).with(as(clubWide)))
                .andExpect(status().isOk());
    }
}
