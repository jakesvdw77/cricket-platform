package com.cricketlegend.controller;

import static com.cricketlegend.PlatformRoleJwtPostProcessors.platformAdmin;
import static com.cricketlegend.PlatformRoleJwtPostProcessors.withSubject;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.cricketlegend.AbstractIntegrationTest;
import com.cricketlegend.domain.Club;
import com.cricketlegend.domain.ClubProfile;
import com.cricketlegend.domain.ClubStatus;
import com.cricketlegend.domain.Person;
import com.cricketlegend.domain.RoleAssignment;
import com.cricketlegend.domain.RoleAssignmentRole;
import com.cricketlegend.domain.ScopeType;
import com.cricketlegend.domain.Section;
import com.cricketlegend.repository.ClubProfileRepository;
import com.cricketlegend.repository.ClubRepository;
import com.cricketlegend.repository.PersonRepository;
import com.cricketlegend.repository.RoleAssignmentRepository;
import com.cricketlegend.repository.SectionRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.Set;
import java.util.TreeSet;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.JwtRequestPostProcessor;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

/** HTTP-layer integration test for docs/specs/148-player-hub-club-info.md's {@code /api/v1/manage/clubs/{clubId}/hub-settings}. */
@SpringBootTest
@AutoConfigureMockMvc
@Import(AbstractIntegrationTest.class)
@Transactional
class ClubHubSettingsControllerIntegrationTest {

    private static final String URL = "/api/v1/manage/clubs/{clubId}/hub-settings";
    private static final String ALL_ON = "{\"identityShown\":false,\"contactShown\":false,\"linksShown\":false,\"logosShown\":false,"
            + "\"logoDownloadAllowed\":true,\"directoryShown\":true,\"directoryPhoneShown\":true,\"directoryEmailShown\":true}";
    private static final String PHONE_WITHOUT_DIRECTORY = "{\"identityShown\":true,\"contactShown\":true,\"linksShown\":true,\"logosShown\":true,"
            + "\"logoDownloadAllowed\":false,\"directoryShown\":false,\"directoryPhoneShown\":true,\"directoryEmailShown\":false}";
    private static final String EMAIL_WITHOUT_DIRECTORY = PHONE_WITHOUT_DIRECTORY
            .replace("\"directoryPhoneShown\":true", "\"directoryPhoneShown\":false")
            .replace("\"directoryEmailShown\":false", "\"directoryEmailShown\":true");

    @Autowired private MockMvc mockMvc;
    @Autowired private ClubRepository clubRepository;
    @Autowired private ClubProfileRepository clubProfileRepository;
    @Autowired private SectionRepository sectionRepository;
    @Autowired private PersonRepository personRepository;
    @Autowired private RoleAssignmentRepository roleAssignmentRepository;

    private final java.util.List<UUID> createdClubs = new java.util.ArrayList<>();

    // The settings PUT creates a club_profile row; leave none behind (ClubProfileControllerIntegrationTest counts the whole table).
    @org.junit.jupiter.api.AfterEach
    void removeProfileRows() {
        for (UUID id : createdClubs) {
            clubProfileRepository.deleteById(id);
        }
        createdClubs.clear();
    }

    private Club newClub(String slug) {
        Club created = clubRepository.save(Club.builder().name(slug).slug(slug + "-" + UUID.randomUUID().toString().substring(0, 6))
                .status(ClubStatus.ACTIVE).build());
        createdClubs.add(created.getId());
        return created;
    }

    private JwtRequestPostProcessor grant(RoleAssignmentRole role, ScopeType scopeType, UUID scopeId) {
        String sub = "sub-" + UUID.randomUUID();
        Person person = personRepository.save(Person.builder().firstName("Casey").lastName("Manager")
                .email(sub + "@example.com").keycloakUserId(sub).build());
        roleAssignmentRepository.save(RoleAssignment.builder().personId(person.getId()).role(role)
                .scopeType(scopeType).scopeId(scopeId).build());
        return withSubject(sub);
    }

    @Test
    void aClubWithNoProfileRowReadsTheDefaults() throws Exception {
        Club club = newClub("riverside");
        JwtRequestPostProcessor admin = grant(RoleAssignmentRole.CLUB_ADMIN, ScopeType.CLUB, club.getId());

        mockMvc.perform(get(URL, club.getId()).with(admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.identityShown").value(true))
                .andExpect(jsonPath("$.contactShown").value(true))
                .andExpect(jsonPath("$.linksShown").value(true))
                .andExpect(jsonPath("$.logosShown").value(true))
                .andExpect(jsonPath("$.logoDownloadAllowed").value(false))
                .andExpect(jsonPath("$.directoryShown").value(false))
                .andExpect(jsonPath("$.directoryPhoneShown").value(false))
                .andExpect(jsonPath("$.directoryEmailShown").value(false));
        assertThat(clubProfileRepository.findById(club.getId())).as("a read never creates the row").isEmpty();
    }

    @Test
    void theClubAdminWritesAndReadsBackAllEightSwitchesWithExactlyThoseKeys() throws Exception {
        Club club = newClub("riverside");
        JwtRequestPostProcessor admin = grant(RoleAssignmentRole.CLUB_ADMIN, ScopeType.CLUB, club.getId());

        String body = mockMvc.perform(put(URL, club.getId()).with(admin).contentType(MediaType.APPLICATION_JSON).content(ALL_ON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.identityShown").value(false))
                .andExpect(jsonPath("$.logoDownloadAllowed").value(true))
                .andExpect(jsonPath("$.directoryShown").value(true))
                .andExpect(jsonPath("$.directoryPhoneShown").value(true))
                .andExpect(jsonPath("$.directoryEmailShown").value(true))
                .andReturn().getResponse().getContentAsString();

        Set<String> keys = new TreeSet<>();
        new ObjectMapper().readTree(body).fieldNames().forEachRemaining(keys::add);
        assertThat(keys).containsExactlyInAnyOrder("identityShown", "contactShown", "linksShown", "logosShown",
                "logoDownloadAllowed", "directoryShown", "directoryPhoneShown", "directoryEmailShown");
        mockMvc.perform(get(URL, club.getId()).with(admin))
                .andExpect(jsonPath("$.contactShown").value(false))
                .andExpect(jsonPath("$.directoryEmailShown").value(true));
        ClubProfile stored = clubProfileRepository.findById(club.getId()).orElseThrow();
        assertThat(stored.isHubInfoDirectory()).isTrue();
        assertThat(stored.isHubInfoLogoDownload()).isTrue();
    }

    @Test
    void aPlainManagerOfTheClubAndASectionAdminAreRefused() throws Exception {
        Club club = newClub("riverside");
        Section section = sectionRepository.save(Section.builder().clubId(club.getId()).name("Juniors").active(true).build());
        JwtRequestPostProcessor manager = grant(RoleAssignmentRole.MANAGER, ScopeType.CLUB, club.getId());
        JwtRequestPostProcessor sectionAdmin = grant(RoleAssignmentRole.CLUB_ADMIN, ScopeType.SECTION, section.getId());

        for (JwtRequestPostProcessor caller : new JwtRequestPostProcessor[] {manager, sectionAdmin}) {
            mockMvc.perform(get(URL, club.getId()).with(caller)).andExpect(status().isForbidden());
            mockMvc.perform(put(URL, club.getId()).with(caller).contentType(MediaType.APPLICATION_JSON).content(ALL_ON))
                    .andExpect(status().isForbidden());
        }
        assertThat(clubProfileRepository.findById(club.getId())).isEmpty();
    }

    @Test
    void anAdminOfAnotherClubIsRefused() throws Exception {
        Club mine = newClub("riverside");
        Club other = newClub("lakeside");
        JwtRequestPostProcessor admin = grant(RoleAssignmentRole.CLUB_ADMIN, ScopeType.CLUB, mine.getId());

        mockMvc.perform(get(URL, other.getId()).with(admin)).andExpect(status().isForbidden());
        mockMvc.perform(put(URL, other.getId()).with(admin).contentType(MediaType.APPLICATION_JSON).content(ALL_ON))
                .andExpect(status().isForbidden());
    }

    @Test
    void anonymousIs401AndAPlatformAdminOnAnUnknownClubIs404() throws Exception {
        mockMvc.perform(get(URL, UUID.randomUUID())).andExpect(status().isUnauthorized());
        mockMvc.perform(put(URL, UUID.randomUUID()).contentType(MediaType.APPLICATION_JSON).content(ALL_ON))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(get(URL, UUID.randomUUID()).with(platformAdmin())).andExpect(status().isNotFound());
    }

    @Test
    void phoneOrEmailOnWhileTheDirectoryIsOffIsA400AndNothingIsSaved() throws Exception {
        Club club = newClub("riverside");
        JwtRequestPostProcessor admin = grant(RoleAssignmentRole.CLUB_ADMIN, ScopeType.CLUB, club.getId());

        mockMvc.perform(put(URL, club.getId()).with(admin).contentType(MediaType.APPLICATION_JSON).content(PHONE_WITHOUT_DIRECTORY))
                .andExpect(status().isBadRequest());
        mockMvc.perform(put(URL, club.getId()).with(admin).contentType(MediaType.APPLICATION_JSON).content(EMAIL_WITHOUT_DIRECTORY))
                .andExpect(status().isBadRequest());
        assertThat(clubProfileRepository.findById(club.getId())).isEmpty();
    }

    @Test
    void aProfileSaveDoesNotResetTheSwitchesAndASwitchesSaveKeepsTheProfile() throws Exception {
        Club club = newClub("riverside");
        JwtRequestPostProcessor admin = grant(RoleAssignmentRole.CLUB_ADMIN, ScopeType.CLUB, club.getId());
        mockMvc.perform(put(URL, club.getId()).with(admin).contentType(MediaType.APPLICATION_JSON).content(ALL_ON))
                .andExpect(status().isOk());

        mockMvc.perform(put("/api/v1/manage/clubs/{id}/profile", club.getId()).with(admin).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"type\":\"CLUB\",\"email\":\"hello@riverside.test\",\"phone\":\"0215550000\"}"))
                .andExpect(status().isOk());

        mockMvc.perform(get(URL, club.getId()).with(admin))
                .andExpect(jsonPath("$.identityShown").value(false))
                .andExpect(jsonPath("$.logoDownloadAllowed").value(true))
                .andExpect(jsonPath("$.directoryShown").value(true))
                .andExpect(jsonPath("$.directoryPhoneShown").value(true))
                .andExpect(jsonPath("$.directoryEmailShown").value(true));

        mockMvc.perform(put(URL, club.getId()).with(admin).contentType(MediaType.APPLICATION_JSON)
                        .content(PHONE_WITHOUT_DIRECTORY.replace("\"directoryPhoneShown\":true", "\"directoryPhoneShown\":false")))
                .andExpect(status().isOk());
        ClubProfile stored = clubProfileRepository.findById(club.getId()).orElseThrow();
        assertThat(stored.getEmail()).isEqualTo("hello@riverside.test");
        assertThat(stored.getPhone()).isEqualTo("0215550000");
        assertThat(stored.getType().name()).isEqualTo("CLUB");
        assertThat(stored.isHubInfoDirectory()).isFalse();
    }
}
