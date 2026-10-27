package com.cricketlegend.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.cricketlegend.AbstractIntegrationTest;
import com.cricketlegend.AbstractLinkIntegrationTest;
import com.cricketlegend.domain.Club;
import com.cricketlegend.domain.ClubStatus;
import com.cricketlegend.domain.LinkRequest;
import com.cricketlegend.domain.LinkRequestStatus;
import com.cricketlegend.domain.Person;
import com.cricketlegend.domain.PlayerProfile;
import com.cricketlegend.domain.Section;
import com.cricketlegend.repository.LinkRequestRepository;
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
 * docs/specs/119 Decision 31, Integration: a link request carries a section so it reaches the right manager. The sections
 * picker endpoint, creating with and without a section, section scoped visibility and decisions, and the section on the
 * response bodies. Transactional, so no rows are left behind in the shared database.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(AbstractIntegrationTest.class)
@Transactional
class LinkRequestSectionsIntegrationTest extends AbstractLinkIntegrationTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private LinkRequestRepository linkRequestRepository;

    private static String body(Club club, String first, String sectionId) {
        return "{\"clubId\":\"" + club.getId() + "\",\"firstName\":\"" + first + "\",\"lastName\":\"Kid\","
                + "\"dateOfBirth\":\"2012-06-15\",\"contactNumber\":\"082 123 4567\""
                + (sectionId == null ? "" : ",\"sectionId\":\"" + sectionId + "\"") + "}";
    }

    private void postRequest(Person who, String body, int expectedStatus) throws Exception {
        mockMvc.perform(post("/api/v1/me/link-requests").with(as(who)).contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().is(expectedStatus));
    }

    private LinkRequest request(Person requester, Club club, Section section, String first) {
        return linkRequestRepository.save(LinkRequest.builder().accountPersonId(requester.getId()).clubId(club.getId())
                .typedFirstName(first).typedLastName("Kid").typedDateOfBirth(CHILD_DOB).contactNumber("0821234567")
                .sectionId(section == null ? null : section.getId()).status(LinkRequestStatus.PENDING).build());
    }

    private String declineUrl(Club club, LinkRequest request) {
        return "/api/v1/manage/clubs/" + club.getId() + "/link-requests/" + request.getId() + "/decline";
    }

    private String approveUrl(Club club, LinkRequest request) {
        return "/api/v1/manage/clubs/" + club.getId() + "/link-requests/" + request.getId() + "/approve";
    }

    // ---- the sections endpoint ----

    @Test
    void sectionsAreTheActiveOnesOrderedByNameWithTheParentAsGroupLabel() throws Exception {
        Club club = club("Hillcrest");
        Person parent = account("Pat", "Parent");
        Section senior = section(club, "Senior");
        Section firsts = sectionRepository.save(Section.builder().clubId(club.getId()).name("1st XI")
                .parentSectionId(senior.getId()).active(true).build());
        Section colts = section(club, "Colts");
        sectionRepository.save(Section.builder().clubId(club.getId()).name("Aardvarks").active(false).build());
        section(club("Other"), "Elsewhere"); // another club's section never shows

        mockMvc.perform(get("/api/v1/me/clubs/{c}/sections", club.getId()).with(as(parent)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(3))
                .andExpect(jsonPath("$[0].id").value(firsts.getId().toString()))
                .andExpect(jsonPath("$[0].name").value("1st XI"))
                .andExpect(jsonPath("$[0].groupLabel").value("Senior"))
                .andExpect(jsonPath("$[1].id").value(colts.getId().toString()))
                .andExpect(jsonPath("$[1].groupLabel").doesNotExist())
                .andExpect(jsonPath("$[2].name").value("Senior"));
    }

    @Test
    void sectionsNeedAVerifiedEmailAndAnActiveClub() throws Exception {
        Club club = club("Hillcrest");
        Club suspended = clubRepository.save(Club.builder().name("Gone " + unique("c")).slug(unique("gone"))
                .status(ClubStatus.SUSPENDED).build());
        Person parent = account("Pat", "Parent");

        mockMvc.perform(get("/api/v1/me/clubs/{c}/sections", club.getId()).with(asUnverified(parent)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("EMAIL_NOT_VERIFIED"));
        mockMvc.perform(get("/api/v1/me/clubs/{c}/sections", UUID.randomUUID()).with(as(parent)))
                .andExpect(status().isNotFound());
        mockMvc.perform(get("/api/v1/me/clubs/{c}/sections", suspended.getId()).with(as(parent)))
                .andExpect(status().isNotFound());
    }

    @Test
    void aClubWithNoSectionsReturnsAnEmptyList() throws Exception {
        mockMvc.perform(get("/api/v1/me/clubs/{c}/sections", club("Hillcrest").getId()).with(as(account("Pat", "Parent"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(0));
    }

    // ---- creating a request ----

    @Test
    void aTypedRequestToAClubWithSectionsStoresTheChosenSectionAndRefusesNoneOrAnotherClubs() throws Exception {
        Club club = club("Hillcrest");
        Section juniors = section(club, "Juniors");
        Section foreign = section(club("Beta"), "Juniors");
        Person parent = account("Pat", "Parent");

        postRequest(parent, body(club, "NoSection", null), 400);
        postRequest(parent, body(club, "Foreign", foreign.getId().toString()), 400);
        postRequest(parent, body(club, "Unknown", UUID.randomUUID().toString()), 400);
        assertThat(linkRequestRepository.findByAccountPersonIdOrderByCreatedAtDesc(parent.getId())).isEmpty();

        postRequest(parent, body(club, "Chosen", juniors.getId().toString()), 200);

        List<LinkRequest> stored = linkRequestRepository.findByAccountPersonIdOrderByCreatedAtDesc(parent.getId());
        assertThat(stored).hasSize(1);
        assertThat(stored.get(0).getSectionId()).isEqualTo(juniors.getId());
        mockMvc.perform(get("/api/v1/me/link-requests").with(as(parent)))
                .andExpect(jsonPath("$[0].sectionName").value("Juniors"));
    }

    @Test
    void aClubWithNoSectionsStoresNoSectionWhateverIsSent() throws Exception {
        Club club = club("Hillcrest");
        Person parent = account("Pat", "Parent");

        postRequest(parent, body(club, "Plain", null), 200);
        postRequest(parent, body(club, "Ignored", UUID.randomUUID().toString()), 200);

        assertThat(linkRequestRepository.findByAccountPersonIdOrderByCreatedAtDesc(parent.getId()))
                .hasSize(2).allSatisfy(r -> assertThat(r.getSectionId()).isNull());
        mockMvc.perform(get("/api/v1/me/link-requests").with(as(parent)))
                .andExpect(jsonPath("$[0].sectionName").doesNotExist());
    }

    // ---- visibility and decisions ----

    @Test
    void aRequestWithASectionReachesOnlyThatSectionsManagersAndClubAdmins() throws Exception {
        Club club = club("Hillcrest");
        Section juniors = section(club, "Juniors");
        Section vets = section(club, "Vets");
        Person clubWide = clubAdmin(club);
        Person juniorsAdmin = sectionAdmin(juniors);
        Person vetsAdmin = sectionAdmin(vets);
        LinkRequest inJuniors = request(account("Pat", "Parent"), club, juniors, "Jess");
        request(account("Quin", "Parent"), club, vets, "Vic");

        mockMvc.perform(get("/api/v1/manage/clubs/{c}/link-requests", club.getId()).with(as(juniorsAdmin)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].id").value(inJuniors.getId().toString()))
                .andExpect(jsonPath("$[0].sectionId").value(juniors.getId().toString()))
                .andExpect(jsonPath("$[0].sectionName").value("Juniors"));
        mockMvc.perform(get("/api/v1/manage/clubs/{c}/link-requests/summary", club.getId()).with(as(juniorsAdmin)))
                .andExpect(jsonPath("$.waiting").value(1));
        mockMvc.perform(get("/api/v1/manage/clubs/{c}/link-requests/summary", club.getId()).with(as(vetsAdmin)))
                .andExpect(jsonPath("$.waiting").value(1));
        mockMvc.perform(get("/api/v1/manage/clubs/{c}/link-requests/summary", club.getId()).with(as(clubWide)))
                .andExpect(jsonPath("$.waiting").value(2));
        mockMvc.perform(get("/api/v1/manage/clubs/{c}/link-requests", club.getId()).with(as(clubWide)))
                .andExpect(jsonPath("$.length()").value(2));
    }

    @Test
    void aManagerOfAnotherSectionCannotDeclineOrApproveButTheSectionManagerAndClubAdminCan() throws Exception {
        Club club = club("Hillcrest");
        Section juniors = section(club, "Juniors");
        Section vets = section(club, "Vets");
        Person clubWide = clubAdmin(club);
        Person juniorsAdmin = sectionAdmin(juniors);
        Person vetsAdmin = sectionAdmin(vets);
        PlayerProfile junior = profile(club, playerPerson("Jess", "Junior", CHILD_DOB), null);
        tag(junior, juniors);
        LinkRequest request = request(account("Pat", "Parent"), club, juniors, "Jess");
        LinkRequest second = request(account("Quin", "Parent"), club, juniors, "Jay");

        mockMvc.perform(post(declineUrl(club, request)).with(as(vetsAdmin)).contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isForbidden());
        mockMvc.perform(post(approveUrl(club, request)).with(as(vetsAdmin)).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"playerId\":\"" + junior.getId() + "\",\"mainAgentMode\":\"ADD\",\"confirm\":true}"))
                .andExpect(status().isForbidden());
        assertThat(linkRequestRepository.findById(request.getId()).orElseThrow().getStatus()).isEqualTo(LinkRequestStatus.PENDING);

        mockMvc.perform(post(approveUrl(club, request)).with(as(juniorsAdmin)).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"playerId\":\"" + junior.getId() + "\",\"mainAgentMode\":\"ADD\",\"confirm\":true}"))
                .andExpect(status().isNoContent());
        mockMvc.perform(post(declineUrl(club, second)).with(as(clubWide)).contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isNoContent());
        assertThat(linkRequestRepository.findById(request.getId()).orElseThrow().getStatus()).isEqualTo(LinkRequestStatus.APPROVED);
        assertThat(linkRequestRepository.findById(second.getId()).orElseThrow().getStatus()).isEqualTo(LinkRequestStatus.DECLINED);
    }

    @Test
    void approvingANewPlayerWithNoSectionChosenDefaultsToTheRequestsSection() throws Exception {
        Club club = club("Hillcrest");
        Section juniors = section(club, "Juniors");
        Person juniorsAdmin = sectionAdmin(juniors);
        Person parent = account("Pat", "Parent");
        LinkRequest request = request(parent, club, juniors, "Nia");

        mockMvc.perform(post(approveUrl(club, request)).with(as(juniorsAdmin)).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"newPlayer\":{\"firstName\":\"Nia\",\"lastName\":\"Kid\",\"dateOfBirth\":\"2012-06-15\"},"
                                + "\"mainAgentMode\":\"MAKE_MAIN\",\"confirm\":true}"))
                .andExpect(status().isNoContent());

        UUID newPersonId = linkRequestRepository.findById(request.getId()).orElseThrow().getResolvedSubjectPersonId();
        PlayerProfile created = playerProfileRepository.findByPersonIdIn(List.of(newPersonId)).get(0);
        assertThat(playerSectionRepository.findByPlayerProfileIdIn(List.of(created.getId())))
                .singleElement().satisfies(ps -> assertThat(ps.getSectionId()).isEqualTo(juniors.getId()));
    }
}
