package com.cricketlegend.controller;

import static com.cricketlegend.PlatformRoleJwtPostProcessors.withSubject;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.cricketlegend.AbstractIntegrationTest;
import com.cricketlegend.domain.Club;
import com.cricketlegend.domain.ClubStatus;
import com.cricketlegend.domain.League;
import com.cricketlegend.domain.LeagueSource;
import com.cricketlegend.domain.Person;
import com.cricketlegend.domain.RoleAssignment;
import com.cricketlegend.domain.RoleAssignmentRole;
import com.cricketlegend.domain.ScopeType;
import com.cricketlegend.domain.Season;
import com.cricketlegend.repository.ClubRepository;
import com.cricketlegend.repository.LeaguePlayingConditionsRepository;
import com.cricketlegend.repository.LeagueRepository;
import com.cricketlegend.repository.PersonRepository;
import com.cricketlegend.repository.RoleAssignmentRepository;
import com.cricketlegend.repository.SeasonRepository;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.JwtRequestPostProcessor;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

/**
 * HTTP-layer integration test for LeaguePlayingConditionsController — per
 * docs/specs/050-league-schedule-and-fixtures.md's Test Plan, combining {@code
 * LeagueControllerIntegrationTest}'s seeding/auth/cross-club-404 pattern ({@code withSubject}, a
 * real {@code Person} + {@code RoleAssignment(CLUB_ADMIN, CLUB, clubId)} row) with {@code
 * MediaControllerIntegrationTest}'s exact multipart/temp-storage-dir pattern (a dedicated {@code
 * app.media.storage-path} so this test doesn't pollute or depend on any real dev-environment media
 * directory).
 */
@SpringBootTest(
        properties = "app.media.storage-path=${java.io.tmpdir}/league-playing-conditions-controller-test")
@AutoConfigureMockMvc
@Import(AbstractIntegrationTest.class)
@Transactional
class LeaguePlayingConditionsControllerIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ClubRepository clubRepository;

    @Autowired
    private LeagueRepository leagueRepository;

    @Autowired
    private SeasonRepository seasonRepository;

    @Autowired
    private LeaguePlayingConditionsRepository leaguePlayingConditionsRepository;

    @Autowired
    private PersonRepository personRepository;

    @Autowired
    private RoleAssignmentRepository roleAssignmentRepository;

    @Value("${app.media.storage-path}")
    private String storagePath;

    @AfterEach
    void cleanUpStorageDirectory() throws Exception {
        Path dir = Path.of(storagePath);
        if (Files.exists(dir)) {
            try (var paths = Files.walk(dir)) {
                paths.sorted((a, b) -> b.compareTo(a)).forEach(path -> {
                    try {
                        Files.deleteIfExists(path);
                    } catch (Exception ignored) {
                        // best-effort cleanup
                    }
                });
            }
        }
    }

    @Test
    void getBeforeAnyUploadReturns404() throws Exception {
        Club club = clubRepository.save(newClub("Riverside CC", "riverside-cc"));
        League league = leagueRepository.save(newLeague(club.getId()));
        Season season = seasonRepository.save(newSeason(club.getId()));
        JwtRequestPostProcessor admin = grantClubAdmin("club-admin-sub", club.getId());

        mockMvc.perform(get(
                                "/api/v1/manage/clubs/{clubId}/leagues/{leagueId}/seasons/{seasonId}/playing-conditions",
                                club.getId(),
                                league.getId(),
                                season.getId())
                        .with(admin))
                .andExpect(status().isNotFound());
    }

    @Test
    void uploadingARealPdfSucceedsAndIsFetchableViaGet() throws Exception {
        Club club = clubRepository.save(newClub("Riverside CC", "riverside-cc"));
        League league = leagueRepository.save(newLeague(club.getId()));
        Season season = seasonRepository.save(newSeason(club.getId()));
        JwtRequestPostProcessor admin = grantClubAdmin("club-admin-sub", club.getId());
        MockMultipartFile file =
                new MockMultipartFile("file", "rules.pdf", "application/pdf", "fake-pdf-bytes".getBytes());

        String uploadResponse = mockMvc.perform(multipart(
                                "/api/v1/manage/clubs/{clubId}/leagues/{leagueId}/seasons/{seasonId}/playing-conditions",
                                club.getId(),
                                league.getId(),
                                season.getId())
                        .file(file)
                        .with(admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.documentUrl").exists())
                .andExpect(jsonPath("$.leagueId").value(league.getId().toString()))
                .andExpect(jsonPath("$.seasonId").value(season.getId().toString()))
                .andReturn()
                .getResponse()
                .getContentAsString();
        String documentUrl = com.jayway.jsonpath.JsonPath.read(uploadResponse, "$.documentUrl");
        assertThat(documentUrl).startsWith("/media/");

        mockMvc.perform(get(documentUrl)).andExpect(status().isOk());

        mockMvc.perform(get(
                                "/api/v1/manage/clubs/{clubId}/leagues/{leagueId}/seasons/{seasonId}/playing-conditions",
                                club.getId(),
                                league.getId(),
                                season.getId())
                        .with(admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.documentUrl").value(documentUrl));
    }

    @Test
    void uploadingANonPdfFileIsRejectedWith400() throws Exception {
        Club club = clubRepository.save(newClub("Riverside CC", "riverside-cc"));
        League league = leagueRepository.save(newLeague(club.getId()));
        Season season = seasonRepository.save(newSeason(club.getId()));
        JwtRequestPostProcessor admin = grantClubAdmin("club-admin-sub", club.getId());
        MockMultipartFile file =
                new MockMultipartFile("file", "logo.png", "image/png", "fake-image-bytes".getBytes());

        mockMvc.perform(multipart(
                                "/api/v1/manage/clubs/{clubId}/leagues/{leagueId}/seasons/{seasonId}/playing-conditions",
                                club.getId(),
                                league.getId(),
                                season.getId())
                        .file(file)
                        .with(admin))
                .andExpect(status().isBadRequest());
    }

    /**
     * A second upload for the same {@code (league, season)} replaces the row in place rather than
     * creating a second one — asserted via a repository {@code count()} staying at 1.
     */
    @Test
    void aSecondUploadForTheSamePairReplacesRatherThanDuplicates() throws Exception {
        Club club = clubRepository.save(newClub("Riverside CC", "riverside-cc"));
        League league = leagueRepository.save(newLeague(club.getId()));
        Season season = seasonRepository.save(newSeason(club.getId()));
        JwtRequestPostProcessor admin = grantClubAdmin("club-admin-sub", club.getId());
        MockMultipartFile firstFile =
                new MockMultipartFile("file", "rules-v1.pdf", "application/pdf", "first-version".getBytes());
        MockMultipartFile secondFile =
                new MockMultipartFile("file", "rules-v2.pdf", "application/pdf", "second-version".getBytes());

        String firstResponse = mockMvc.perform(multipart(
                                "/api/v1/manage/clubs/{clubId}/leagues/{leagueId}/seasons/{seasonId}/playing-conditions",
                                club.getId(),
                                league.getId(),
                                season.getId())
                        .file(firstFile)
                        .with(admin))
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getContentAsString();
        String firstDocumentUrl = com.jayway.jsonpath.JsonPath.read(firstResponse, "$.documentUrl");

        String secondResponse = mockMvc.perform(multipart(
                                "/api/v1/manage/clubs/{clubId}/leagues/{leagueId}/seasons/{seasonId}/playing-conditions",
                                club.getId(),
                                league.getId(),
                                season.getId())
                        .file(secondFile)
                        .with(admin))
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getContentAsString();
        String secondDocumentUrl = com.jayway.jsonpath.JsonPath.read(secondResponse, "$.documentUrl");

        assertThat(secondDocumentUrl).isNotEqualTo(firstDocumentUrl);
        assertThat(leaguePlayingConditionsRepository.count()).isEqualTo(1);

        mockMvc.perform(get(
                                "/api/v1/manage/clubs/{clubId}/leagues/{leagueId}/seasons/{seasonId}/playing-conditions",
                                club.getId(),
                                league.getId(),
                                season.getId())
                        .with(admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.documentUrl").value(secondDocumentUrl));
    }

    @Test
    void getAndUploadReturn404ForALeagueIdThatIsRealButBelongsToADifferentClub() throws Exception {
        Club clubX = clubRepository.save(newClub("Riverside CC", "riverside-cc"));
        Club clubY = clubRepository.save(newClub("Lakeside CC", "lakeside-cc"));
        League leagueY = leagueRepository.save(newLeague(clubY.getId()));
        Season seasonX = seasonRepository.save(newSeason(clubX.getId()));
        JwtRequestPostProcessor admin = grantClubAdmin("club-admin-sub", clubX.getId());
        MockMultipartFile file =
                new MockMultipartFile("file", "rules.pdf", "application/pdf", "fake-pdf-bytes".getBytes());

        // clubX is the caller's own club (so @PreAuthorize passes), but leagueY belongs to clubY.
        mockMvc.perform(get(
                                "/api/v1/manage/clubs/{clubId}/leagues/{leagueId}/seasons/{seasonId}/playing-conditions",
                                clubX.getId(),
                                leagueY.getId(),
                                seasonX.getId())
                        .with(admin))
                .andExpect(status().isNotFound());

        mockMvc.perform(multipart(
                                "/api/v1/manage/clubs/{clubId}/leagues/{leagueId}/seasons/{seasonId}/playing-conditions",
                                clubX.getId(),
                                leagueY.getId(),
                                seasonX.getId())
                        .file(file)
                        .with(admin))
                .andExpect(status().isNotFound());
    }

    @Test
    void getAndUploadReturn404ForASeasonIdThatIsRealButBelongsToADifferentClub() throws Exception {
        Club clubX = clubRepository.save(newClub("Riverside CC", "riverside-cc"));
        Club clubY = clubRepository.save(newClub("Lakeside CC", "lakeside-cc"));
        League leagueX = leagueRepository.save(newLeague(clubX.getId()));
        Season seasonY = seasonRepository.save(newSeason(clubY.getId()));
        JwtRequestPostProcessor admin = grantClubAdmin("club-admin-sub", clubX.getId());
        MockMultipartFile file =
                new MockMultipartFile("file", "rules.pdf", "application/pdf", "fake-pdf-bytes".getBytes());

        mockMvc.perform(get(
                                "/api/v1/manage/clubs/{clubId}/leagues/{leagueId}/seasons/{seasonId}/playing-conditions",
                                clubX.getId(),
                                leagueX.getId(),
                                seasonY.getId())
                        .with(admin))
                .andExpect(status().isNotFound());

        mockMvc.perform(multipart(
                                "/api/v1/manage/clubs/{clubId}/leagues/{leagueId}/seasons/{seasonId}/playing-conditions",
                                clubX.getId(),
                                leagueX.getId(),
                                seasonY.getId())
                        .file(file)
                        .with(admin))
                .andExpect(status().isNotFound());
    }

    @Test
    void getAndUploadReturn403ForADifferentClubEvenWhenLeagueAndSeasonBelongToIt() throws Exception {
        Club clubX = clubRepository.save(newClub("Riverside CC", "riverside-cc"));
        Club clubY = clubRepository.save(newClub("Lakeside CC", "lakeside-cc"));
        League leagueY = leagueRepository.save(newLeague(clubY.getId()));
        Season seasonY = seasonRepository.save(newSeason(clubY.getId()));
        JwtRequestPostProcessor admin = grantClubAdmin("club-admin-sub", clubX.getId());
        MockMultipartFile file =
                new MockMultipartFile("file", "rules.pdf", "application/pdf", "fake-pdf-bytes".getBytes());

        mockMvc.perform(get(
                                "/api/v1/manage/clubs/{clubId}/leagues/{leagueId}/seasons/{seasonId}/playing-conditions",
                                clubY.getId(),
                                leagueY.getId(),
                                seasonY.getId())
                        .with(admin))
                .andExpect(status().isForbidden());

        mockMvc.perform(multipart(
                                "/api/v1/manage/clubs/{clubId}/leagues/{leagueId}/seasons/{seasonId}/playing-conditions",
                                clubY.getId(),
                                leagueY.getId(),
                                seasonY.getId())
                        .file(file)
                        .with(admin))
                .andExpect(status().isForbidden());
    }

    private JwtRequestPostProcessor grantClubAdmin(String keycloakUserId, UUID clubId) {
        Person person = personRepository.save(Person.builder()
                .firstName("Casey")
                .lastName("Manager")
                .email(keycloakUserId + "@example.com")
                .keycloakUserId(keycloakUserId)
                .build());
        roleAssignmentRepository.save(RoleAssignment.builder()
                .personId(person.getId())
                .role(RoleAssignmentRole.CLUB_ADMIN)
                .scopeType(ScopeType.CLUB)
                .scopeId(clubId)
                .build());
        return withSubject(keycloakUserId);
    }

    private Club newClub(String name, String slug) {
        return Club.builder().name(name).slug(slug).status(ClubStatus.ACTIVE).build();
    }

    private League newLeague(UUID clubId) {
        return League.builder()
                .clubId(clubId)
                .name("Premier League")
                .source(LeagueSource.INTERNAL)
                .maxPlayingXiSize(11)
                .allowSubstitutions(false)
                .active(true)
                .build();
    }

    private Season newSeason(UUID clubId) {
        return Season.builder()
                .clubId(clubId)
                .label("2026")
                .startDate(LocalDate.of(2026, 1, 1))
                .endDate(LocalDate.of(2026, 12, 31))
                .active(true)
                .build();
    }
}
