package com.cricketlegend.controller;

import static com.cricketlegend.PlatformRoleJwtPostProcessors.withSubject;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.cricketlegend.AbstractIntegrationTest;
import com.cricketlegend.domain.Club;
import com.cricketlegend.domain.ClubStatus;
import com.cricketlegend.domain.Person;
import com.cricketlegend.domain.PlayerProfile;
import com.cricketlegend.domain.PlayerSection;
import com.cricketlegend.domain.RoleAssignment;
import com.cricketlegend.domain.RoleAssignmentRole;
import com.cricketlegend.domain.ScopeType;
import com.cricketlegend.domain.Section;
import com.cricketlegend.repository.ClubMembershipRepository;
import com.cricketlegend.repository.ClubRepository;
import com.cricketlegend.repository.PersonRepository;
import com.cricketlegend.repository.PlayerProfileRepository;
import com.cricketlegend.repository.PlayerSectionRepository;
import com.cricketlegend.repository.RoleAssignmentRepository;
import com.cricketlegend.repository.SectionRepository;
import com.jayway.jsonpath.JsonPath;
import jakarta.persistence.EntityManagerFactory;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.hibernate.SessionFactory;
import org.hibernate.stat.Statistics;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.JwtRequestPostProcessor;
import org.springframework.test.web.servlet.MockMvc;

/**
 * docs/specs/077-public-availability-form-verification.md slice 1: the required, sanity-checked
 * date of birth on player create/update (400 with a clear message), the {@code
 * missingDateOfBirth=true} list filter within the caller's scope, and an N+1 guard on the list.
 * Deliberately NOT {@code @Transactional} (docs/standards/backend.md): the real service
 * transactions run, and rows are removed in {@code @AfterEach}.
 */
@SpringBootTest(properties = "spring.jpa.properties.hibernate.generate_statistics=true")
@AutoConfigureMockMvc
@Import(AbstractIntegrationTest.class)
class PlayerDateOfBirthIntegrationTest {

    private static final String BASE = "/api/v1/manage/clubs/{clubId}/players";

    @Autowired private MockMvc mockMvc;
    @Autowired private EntityManagerFactory entityManagerFactory;
    @Autowired private ClubRepository clubRepository;
    @Autowired private SectionRepository sectionRepository;
    @Autowired private PersonRepository personRepository;
    @Autowired private PlayerProfileRepository playerProfileRepository;
    @Autowired private PlayerSectionRepository playerSectionRepository;
    @Autowired private ClubMembershipRepository clubMembershipRepository;
    @Autowired private RoleAssignmentRepository roleAssignmentRepository;

    private final List<Club> clubs = new ArrayList<>();
    private final List<Section> sections = new ArrayList<>();
    private final List<Person> people = new ArrayList<>();
    private final List<PlayerProfile> profiles = new ArrayList<>();
    private final List<PlayerSection> links = new ArrayList<>();
    private final List<RoleAssignment> roles = new ArrayList<>();

    @AfterEach
    void cleanUp() {
        java.util.Set<UUID> personIds = new java.util.HashSet<>();
        playerSectionRepository.deleteAll(links);
        // Players created through the API are not tracked individually: sweep by club.
        clubs.forEach(club -> {
            playerProfileRepository.findByClubId(club.getId()).forEach(profile -> {
                playerSectionRepository.deleteAll(playerSectionRepository.findByPlayerProfileId(profile.getId()));
                personIds.add(profile.getPersonId());
            });
            clubMembershipRepository.deleteAll(clubMembershipRepository.findAll().stream()
                    .filter(m -> m.getClubId().equals(club.getId()))
                    .toList());
            playerProfileRepository.deleteAll(playerProfileRepository.findByClubId(club.getId()));
        });
        roleAssignmentRepository.deleteAll(roles);
        people.forEach(person -> personIds.add(person.getId()));
        personRepository.deleteAllById(personIds);
        sectionRepository.deleteAll(sections);
        clubRepository.deleteAll(clubs);
    }

    private static String body(String dateOfBirthJson, String firstName) {
        return """
                {"firstName": "%s", "lastName": "Doe"%s, "gender": "FEMALE", "isWicketKeeper": false}
                """.formatted(firstName, dateOfBirthJson == null ? "" : ", \"dateOfBirth\": " + dateOfBirthJson);
    }

    // --- create / update validation ---

    @Test
    void createWithoutDateOfBirthReturns400WithAClearMessage() throws Exception {
        Club club = seedClub();
        JwtRequestPostProcessor admin = grantAdmin(club.getId(), ScopeType.CLUB, club.getId());

        mockMvc.perform(post(BASE, club.getId()).with(admin).contentType(MediaType.APPLICATION_JSON)
                        .content(body(null, "Jane")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detail").value("Date of birth is required"));
        mockMvc.perform(post(BASE, club.getId()).with(admin).contentType(MediaType.APPLICATION_JSON)
                        .content(body("null", "Jane")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detail").value("Date of birth is required"));
        assertThat(playerProfileRepository.findByClubId(club.getId())).isEmpty();
    }

    @Test
    void createWithFutureOrPre1900DateReturns400AndBoundaryDatesAreAccepted() throws Exception {
        Club club = seedClub();
        JwtRequestPostProcessor admin = grantAdmin(club.getId(), ScopeType.CLUB, club.getId());

        mockMvc.perform(post(BASE, club.getId()).with(admin).contentType(MediaType.APPLICATION_JSON)
                        .content(body("\"" + LocalDate.now().plusDays(1) + "\"", "Jane")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detail").value("Date of birth must not be in the future"));
        mockMvc.perform(post(BASE, club.getId()).with(admin).contentType(MediaType.APPLICATION_JSON)
                        .content(body("\"1899-12-31\"", "Jane")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detail").value("Date of birth must not be before 1900-01-01"));
        mockMvc.perform(post(BASE, club.getId()).with(admin).contentType(MediaType.APPLICATION_JSON)
                        .content(body("\"1900-01-01\"", "Old")))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.dateOfBirth").value("1900-01-01"));
        mockMvc.perform(post(BASE, club.getId()).with(admin).contentType(MediaType.APPLICATION_JSON)
                        .content(body("\"" + LocalDate.now() + "\"", "Baby")))
                .andExpect(status().isCreated());
    }

    @Test
    void updateRequiresADateOfBirthEvenForAPlayerWhoHasNoneStored() throws Exception {
        Club club = seedClub();
        JwtRequestPostProcessor admin = grantAdmin(club.getId(), ScopeType.CLUB, club.getId());
        PlayerProfile noDate = seedPlayer(club, null, "Legacy");

        mockMvc.perform(put(BASE + "/{playerId}", club.getId(), noDate.getId()).with(admin)
                        .contentType(MediaType.APPLICATION_JSON).content(body(null, "Renamed")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detail").value("Date of birth is required"));
        mockMvc.perform(put(BASE + "/{playerId}", club.getId(), noDate.getId()).with(admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body("\"" + LocalDate.now().plusDays(1) + "\"", "Renamed")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detail").value("Date of birth must not be in the future"));
        mockMvc.perform(put(BASE + "/{playerId}", club.getId(), noDate.getId()).with(admin)
                        .contentType(MediaType.APPLICATION_JSON).content(body("\"1899-12-31\"", "Renamed")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detail").value("Date of birth must not be before 1900-01-01"));
        assertThat(personRepository.findById(noDate.getPersonId()).orElseThrow().getFirstName())
                .isEqualTo("Legacy");

        mockMvc.perform(put(BASE + "/{playerId}", club.getId(), noDate.getId()).with(admin)
                        .contentType(MediaType.APPLICATION_JSON).content(body("\"2001-02-03\"", "Renamed")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.dateOfBirth").value("2001-02-03"));
    }

    // --- missingDateOfBirth filter ---

    @Test
    void filterReturnsOnlyPlayersWithoutADateWithinTheCallersScope() throws Exception {
        Club club = seedClub();
        Club other = seedClub();
        Section men = seedSection(club);
        Section women = seedSection(club);
        PlayerProfile menNoDate = seedPlayer(club, null, "MenNoDate");
        PlayerProfile menWithDate = seedPlayer(club, LocalDate.of(2000, 1, 1), "MenWithDate");
        PlayerProfile womenNoDate = seedPlayer(club, null, "WomenNoDate");
        PlayerProfile inactiveNoDate = seedPlayer(club, null, "InactiveNoDate");
        inactiveNoDate.setActive(false);
        playerProfileRepository.save(inactiveNoDate);
        seedPlayer(other, null, "OtherClubNoDate");
        tag(menNoDate, men);
        tag(menWithDate, men);
        tag(womenNoDate, women);
        tag(inactiveNoDate, men);

        JwtRequestPostProcessor clubAdmin = grantAdmin(club.getId(), ScopeType.CLUB, club.getId());
        mockMvc.perform(get(BASE, club.getId()).with(clubAdmin).param("missingDateOfBirth", "true"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(3))
                .andExpect(jsonPath("$[*].firstName").value(org.hamcrest.Matchers.containsInAnyOrder(
                        "MenNoDate", "WomenNoDate", "InactiveNoDate")))
                .andExpect(jsonPath("$[*].dateOfBirth").value(org.hamcrest.Matchers.everyItem(
                        org.hamcrest.Matchers.nullValue())));
        // inactive players stay in (the endpoint's existing status behaviour); the unfiltered list is unchanged
        mockMvc.perform(get(BASE, club.getId()).with(clubAdmin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(4));

        JwtRequestPostProcessor menManager = grantAdmin(club.getId(), ScopeType.SECTION, men.getId());
        mockMvc.perform(get(BASE, club.getId()).with(menManager).param("missingDateOfBirth", "true"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[*].firstName").value(
                        org.hamcrest.Matchers.containsInAnyOrder("MenNoDate", "InactiveNoDate")));

        // explicit false behaves like the default
        mockMvc.perform(get(BASE, club.getId()).with(menManager).param("missingDateOfBirth", "false"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(3));

        // another club's admin cannot reach this club
        JwtRequestPostProcessor otherAdmin = grantAdmin(other.getId(), ScopeType.CLUB, other.getId());
        mockMvc.perform(get(BASE, club.getId()).with(otherAdmin).param("missingDateOfBirth", "true"))
                .andExpect(status().isForbidden());
        mockMvc.perform(get(BASE, other.getId()).with(otherAdmin).param("missingDateOfBirth", "true"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].firstName").value("OtherClubNoDate"));
    }

    @Test
    void filteredAndUnfilteredListsIssueTheSameNumberOfStatementsForTwoAsForTwelvePlayers() throws Exception {
        Club small = seedClub();
        Club large = seedClub();
        Section smallSection = seedSection(small);
        Section largeSection = seedSection(large);
        for (int i = 0; i < 2; i++) {
            tag(seedPlayer(small, null, "S" + i), smallSection);
        }
        for (int i = 0; i < 12; i++) {
            tag(seedPlayer(large, null, "L" + i), largeSection);
        }
        JwtRequestPostProcessor smallAdmin = grantAdmin(small.getId(), ScopeType.CLUB, small.getId());
        JwtRequestPostProcessor largeAdmin = grantAdmin(large.getId(), ScopeType.CLUB, large.getId());
        Statistics statistics = entityManagerFactory.unwrap(SessionFactory.class).getStatistics();
        assertThat(statistics.isStatisticsEnabled()).isTrue();

        for (String flag : new String[] {"true", "false"}) {
            statistics.clear();
            mockMvc.perform(get(BASE, small.getId()).with(smallAdmin).param("missingDateOfBirth", flag))
                    .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(2));
            long smallCount = statistics.getPrepareStatementCount();
            statistics.clear();
            mockMvc.perform(get(BASE, large.getId()).with(largeAdmin).param("missingDateOfBirth", flag))
                    .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(12));
            assertThat(statistics.getPrepareStatementCount()).isEqualTo(smallCount);
        }
    }

    @Test
    void createdPlayerRoundTripsItsDateOfBirthThroughTheApi() throws Exception {
        Club club = seedClub();
        JwtRequestPostProcessor admin = grantAdmin(club.getId(), ScopeType.CLUB, club.getId());
        String response = mockMvc.perform(post(BASE, club.getId()).with(admin)
                        .contentType(MediaType.APPLICATION_JSON).content(body("\"2004-05-06\"", "Jane")))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        assertThat((String) JsonPath.read(response, "$.dateOfBirth")).isEqualTo("2004-05-06");
        mockMvc.perform(get(BASE, club.getId()).with(admin).param("missingDateOfBirth", "true"))
                .andExpect(status().isOk()).andExpect(jsonPath("$").isEmpty());
    }

    // --- fixtures ---

    private Club seedClub() {
        String slug = "dob-" + UUID.randomUUID().toString().substring(0, 8);
        Club club = clubRepository.save(
                Club.builder().name(slug).slug(slug).status(ClubStatus.ACTIVE).build());
        clubs.add(club);
        return club;
    }

    private Section seedSection(Club club) {
        Section section = sectionRepository.save(
                Section.builder().clubId(club.getId()).name("S-" + UUID.randomUUID()).active(true).build());
        sections.add(section);
        return section;
    }

    private PlayerProfile seedPlayer(Club club, LocalDate dateOfBirth, String firstName) {
        Person person = personRepository.save(
                Person.builder().firstName(firstName).lastName("Doe").dateOfBirth(dateOfBirth).build());
        people.add(person);
        PlayerProfile profile = playerProfileRepository.save(
                PlayerProfile.builder().personId(person.getId()).clubId(club.getId()).active(true).build());
        profiles.add(profile);
        return profile;
    }

    private void tag(PlayerProfile profile, Section section) {
        links.add(playerSectionRepository.save(
                PlayerSection.builder().playerProfileId(profile.getId()).sectionId(section.getId()).build()));
    }

    private JwtRequestPostProcessor grantAdmin(UUID clubId, ScopeType scopeType, UUID scopeId) {
        String sub = "dob-admin-" + UUID.randomUUID();
        Person person = personRepository.save(Person.builder()
                .firstName("Casey").lastName("Manager").email(sub + "@example.com").keycloakUserId(sub).build());
        people.add(person);
        roles.add(roleAssignmentRepository.save(RoleAssignment.builder()
                .personId(person.getId()).role(RoleAssignmentRole.CLUB_ADMIN)
                .scopeType(scopeType).scopeId(scopeId).build()));
        return withSubject(sub);
    }
}
