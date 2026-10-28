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
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.JwtRequestPostProcessor;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

/** HTTP-layer integration test for docs/specs/114-share-result.md's club share settings endpoint. */
@SpringBootTest
@AutoConfigureMockMvc
@Import(AbstractIntegrationTest.class)
@Transactional
class ClubShareSettingsControllerIntegrationTest {

    private static final String URL = "/api/v1/manage/clubs/{clubId}/share-settings";
    private static final String ON = "{\"initialsOnlyDefault\":true}";
    private static final String OFF = "{\"initialsOnlyDefault\":false}";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ClubRepository clubRepository;

    @Autowired
    private ClubProfileRepository clubProfileRepository;

    @Autowired
    private SectionRepository sectionRepository;

    @Autowired
    private PersonRepository personRepository;

    @Autowired
    private RoleAssignmentRepository roleAssignmentRepository;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Test
    void roundTripsTheFlagAndDefaultsToFalse() throws Exception {
        Club club = newClub("riverside-cc");
        JwtRequestPostProcessor admin = grant("admin", ScopeType.CLUB, club.getId());

        mockMvc.perform(get(URL, club.getId()).with(admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.initialsOnlyDefault").value(false));

        mockMvc.perform(put(URL, club.getId()).with(admin).contentType(MediaType.APPLICATION_JSON).content(ON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.initialsOnlyDefault").value(true));

        mockMvc.perform(get(URL, club.getId()).with(admin))
                .andExpect(jsonPath("$.initialsOnlyDefault").value(true));

        mockMvc.perform(put(URL, club.getId()).with(admin).contentType(MediaType.APPLICATION_JSON).content(OFF))
                .andExpect(jsonPath("$.initialsOnlyDefault").value(false));
    }

    @Test
    void clubAdminOfAnotherClubGets403() throws Exception {
        Club mine = newClub("riverside-cc");
        Club other = newClub("lakeside-cc");
        JwtRequestPostProcessor admin = grant("admin", ScopeType.CLUB, mine.getId());

        mockMvc.perform(get(URL, other.getId()).with(admin)).andExpect(status().isForbidden());
        mockMvc.perform(put(URL, other.getId()).with(admin).contentType(MediaType.APPLICATION_JSON).content(ON))
                .andExpect(status().isForbidden());
    }

    @Test
    void aSectionScopedManagerOfTheClubIsAllowed() throws Exception {
        Club club = newClub("riverside-cc");
        Section section = sectionRepository.save(
                Section.builder().clubId(club.getId()).name("Juniors").active(true).build());
        JwtRequestPostProcessor sectionAdmin = grant("section-admin", ScopeType.SECTION, section.getId());

        mockMvc.perform(put(URL, club.getId()).with(sectionAdmin).contentType(MediaType.APPLICATION_JSON).content(ON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.initialsOnlyDefault").value(true));
        mockMvc.perform(get(URL, club.getId()).with(sectionAdmin))
                .andExpect(jsonPath("$.initialsOnlyDefault").value(true));
    }

    @Test
    void unknownClubIs404AndAnonymousIs401() throws Exception {
        mockMvc.perform(get(URL, UUID.randomUUID()).with(platformAdmin())).andExpect(status().isNotFound());
        mockMvc.perform(get(URL, UUID.randomUUID())).andExpect(status().isUnauthorized());
    }

    @Test
    void aProfileSaveDoesNotResetTheFlagAndTheFlagSaveKeepsTheProfile() throws Exception {
        Club club = newClub("riverside-cc");
        JwtRequestPostProcessor admin = grant("admin", ScopeType.CLUB, club.getId());
        mockMvc.perform(put(URL, club.getId()).with(admin).contentType(MediaType.APPLICATION_JSON).content(ON))
                .andExpect(status().isOk());

        mockMvc.perform(put("/api/v1/platform/clubs/{id}/profile", club.getId())
                        .with(platformAdmin())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"type\":\"CLUB\",\"email\":\"hello@riverside.test\"}"))
                .andExpect(status().isOk());

        mockMvc.perform(get(URL, club.getId()).with(admin))
                .andExpect(jsonPath("$.initialsOnlyDefault").value(true));

        mockMvc.perform(put(URL, club.getId()).with(admin).contentType(MediaType.APPLICATION_JSON).content(OFF))
                .andExpect(status().isOk());
        assertThat(clubProfileRepository.findById(club.getId()).orElseThrow().getEmail())
                .isEqualTo("hello@riverside.test");
    }

    @Test
    void theMigrationAddedTheColumnAsNotNullDefaultingToFalse() {
        String defaultValue = jdbcTemplate.queryForObject(
                "SELECT column_default FROM information_schema.columns "
                        + "WHERE table_name = 'club_profile' AND column_name = 'share_initials_only'",
                String.class);
        String nullable = jdbcTemplate.queryForObject(
                "SELECT is_nullable FROM information_schema.columns "
                        + "WHERE table_name = 'club_profile' AND column_name = 'share_initials_only'",
                String.class);
        assertThat(defaultValue).isEqualTo("false");
        assertThat(nullable).isEqualTo("NO");
    }

    private JwtRequestPostProcessor grant(String sub, ScopeType scopeType, UUID scopeId) {
        Person person = personRepository.save(Person.builder()
                .firstName("Casey")
                .lastName("Manager")
                .email(sub + "@example.com")
                .keycloakUserId(sub)
                .build());
        roleAssignmentRepository.save(RoleAssignment.builder()
                .personId(person.getId())
                .role(RoleAssignmentRole.CLUB_ADMIN)
                .scopeType(scopeType)
                .scopeId(scopeId)
                .build());
        return withSubject(sub);
    }

    private Club newClub(String slug) {
        return clubRepository.save(Club.builder().name(slug).slug(slug).status(ClubStatus.ACTIVE).build());
    }

    // --- docs/specs/122-league-sharing.md: disabledFormats ---

    @Test
    void disabledFormatsRoundTripAndDefaultToEmpty() throws Exception {
        Club club = newClub("riverside-cc");
        JwtRequestPostProcessor admin = grant("admin", ScopeType.CLUB, club.getId());

        mockMvc.perform(get(URL, club.getId()).with(admin))
                .andExpect(jsonPath("$.disabledFormats").isMap())
                .andExpect(jsonPath("$.disabledFormats").isEmpty());

        mockMvc.perform(put(URL, club.getId()).with(admin).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"initialsOnlyDefault\":false,\"disabledFormats\":{\"RESULT\":[\"TV\"],\"LEAGUE\":[\"POSTER\",\"FACEBOOK\"]}}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.disabledFormats.RESULT[0]").value("TV"))
                .andExpect(jsonPath("$.disabledFormats.LEAGUE[0]").value("FACEBOOK"))
                .andExpect(jsonPath("$.disabledFormats.LEAGUE[1]").value("POSTER"));

        mockMvc.perform(get(URL, club.getId()).with(admin))
                .andExpect(jsonPath("$.disabledFormats.RESULT[0]").value("TV"))
                .andExpect(jsonPath("$.disabledFormats.LEAGUE.length()").value(2));

        // a save of only the flag leaves the formats alone
        mockMvc.perform(put(URL, club.getId()).with(admin).contentType(MediaType.APPLICATION_JSON).content(ON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.initialsOnlyDefault").value(true))
                .andExpect(jsonPath("$.disabledFormats.RESULT[0]").value("TV"));

        // an empty list clears one content type
        mockMvc.perform(put(URL, club.getId()).with(admin).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"initialsOnlyDefault\":true,\"disabledFormats\":{\"RESULT\":[],\"LEAGUE\":[\"POSTER\",\"FACEBOOK\"]}}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.disabledFormats.RESULT").doesNotExist())
                .andExpect(jsonPath("$.disabledFormats.LEAGUE.length()").value(2));
    }

    @Test
    void aProfilePutDoesNotResetDisabledFormats() throws Exception {
        Club club = newClub("riverside-cc");
        JwtRequestPostProcessor admin = grant("admin", ScopeType.CLUB, club.getId());
        mockMvc.perform(put(URL, club.getId()).with(admin).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"initialsOnlyDefault\":false,\"disabledFormats\":{\"LEAGUE\":[\"CALENDAR\"]}}"))
                .andExpect(status().isOk());

        mockMvc.perform(put("/api/v1/platform/clubs/{id}/profile", club.getId())
                        .with(platformAdmin())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"type\":\"CLUB\",\"email\":\"hello@riverside.test\"}"))
                .andExpect(status().isOk());

        mockMvc.perform(get(URL, club.getId()).with(admin))
                .andExpect(jsonPath("$.disabledFormats.LEAGUE[0]").value("CALENDAR"));
    }

    @Test
    void switchingOffTheLastFormatOfAContentTypeIs400AndStoresNothing() throws Exception {
        Club club = newClub("riverside-cc");
        JwtRequestPostProcessor admin = grant("admin", ScopeType.CLUB, club.getId());

        mockMvc.perform(put(URL, club.getId()).with(admin).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"initialsOnlyDefault\":false,\"disabledFormats\":{\"RESULT\":[\"PDF\",\"IMAGE\",\"TV\",\"WHATSAPP\",\"FACEBOOK\"]}}"))
                .andExpect(status().isBadRequest());

        mockMvc.perform(get(URL, club.getId()).with(admin)).andExpect(jsonPath("$.disabledFormats").isEmpty());
    }

    @Test
    void anUnknownContentTypeOrFormatCodeIs400() throws Exception {
        Club club = newClub("riverside-cc");
        JwtRequestPostProcessor admin = grant("admin", ScopeType.CLUB, club.getId());

        mockMvc.perform(put(URL, club.getId()).with(admin).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"initialsOnlyDefault\":false,\"disabledFormats\":{\"BOGUS\":[\"PDF\"]}}"))
                .andExpect(status().isBadRequest());
        mockMvc.perform(put(URL, club.getId()).with(admin).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"initialsOnlyDefault\":false,\"disabledFormats\":{\"LEAGUE\":[\"TV\"]}}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void aSectionScopedManagerCannotChangeTheFormatsButMaySaveTheFlagAndResendTheSameFormats() throws Exception {
        Club club = newClub("riverside-cc");
        Section section = sectionRepository.save(
                Section.builder().clubId(club.getId()).name("Juniors").active(true).build());
        JwtRequestPostProcessor admin = grant("admin", ScopeType.CLUB, club.getId());
        JwtRequestPostProcessor sectionAdmin = grant("section-admin", ScopeType.SECTION, section.getId());
        String formats = "{\"initialsOnlyDefault\":true,\"disabledFormats\":{\"RESULT\":[\"TV\"]}}";

        mockMvc.perform(put(URL, club.getId()).with(sectionAdmin).contentType(MediaType.APPLICATION_JSON).content(formats))
                .andExpect(status().isForbidden());

        mockMvc.perform(put(URL, club.getId()).with(admin).contentType(MediaType.APPLICATION_JSON).content(formats))
                .andExpect(status().isOk());

        mockMvc.perform(put(URL, club.getId()).with(sectionAdmin).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"initialsOnlyDefault\":false,\"disabledFormats\":{\"RESULT\":[\"TV\"]}}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.initialsOnlyDefault").value(false))
                .andExpect(jsonPath("$.disabledFormats.RESULT[0]").value("TV"));
    }

    @Test
    void aClubAdminOfAnotherClubCannotChangeThisClubsFormats() throws Exception {
        Club mine = newClub("riverside-cc");
        Club other = newClub("lakeside-cc");
        JwtRequestPostProcessor admin = grant("admin", ScopeType.CLUB, mine.getId());

        mockMvc.perform(put(URL, other.getId()).with(admin).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"initialsOnlyDefault\":false,\"disabledFormats\":{\"RESULT\":[\"TV\"]}}"))
                .andExpect(status().isForbidden());
    }

    @Test
    void theMigrationAddedTheDisabledFormatsColumnAsNotNullDefaultingToAnEmptyObject() {
        String defaultValue = jdbcTemplate.queryForObject(
                "SELECT column_default FROM information_schema.columns "
                        + "WHERE table_name = 'club_profile' AND column_name = 'share_disabled_formats'",
                String.class);
        String nullable = jdbcTemplate.queryForObject(
                "SELECT is_nullable FROM information_schema.columns "
                        + "WHERE table_name = 'club_profile' AND column_name = 'share_disabled_formats'",
                String.class);
        assertThat(defaultValue).contains("{}");
        assertThat(nullable).isEqualTo("NO");
    }
}
