package com.cricketlegend.support;

import static com.cricketlegend.PlatformRoleJwtPostProcessors.withSubject;

import com.cricketlegend.AbstractIntegrationTest;
import com.cricketlegend.domain.Address;
import com.cricketlegend.domain.Club;
import com.cricketlegend.domain.ClubPlayingArea;
import com.cricketlegend.domain.ClubStatus;
import com.cricketlegend.domain.Match;
import com.cricketlegend.domain.Person;
import com.cricketlegend.domain.PlayingArea;
import com.cricketlegend.domain.PlayingAreaCategory;
import com.cricketlegend.domain.PlayingAreaOwnerType;
import com.cricketlegend.domain.PlayingAreaType;
import com.cricketlegend.domain.PlayingAreaVerificationStatus;
import com.cricketlegend.domain.RoleAssignment;
import com.cricketlegend.domain.RoleAssignmentRole;
import com.cricketlegend.domain.ScopeType;
import com.cricketlegend.domain.Season;
import com.cricketlegend.repository.ClubPlayingAreaRepository;
import com.cricketlegend.repository.ClubRepository;
import com.cricketlegend.repository.MatchRepository;
import com.cricketlegend.repository.PersonRepository;
import com.cricketlegend.repository.PlayingAreaRepository;
import com.cricketlegend.repository.RoleAssignmentRepository;
import com.cricketlegend.repository.SeasonRepository;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.JwtRequestPostProcessor;
import org.springframework.test.web.servlet.MockMvc;

/**
 * Shared fixtures for the Fields directory integration tests (docs/specs/099-fields-directory.md). Deliberately NOT
 * {@code @Transactional} (docs/standards/backend.md): each HTTP request gets exactly the session the service method
 * opens, as in production with {@code open-in-view=false}, so a missing service-level transaction on a lazy mapping
 * would surface as a failure. Rows are therefore removed in {@code @AfterEach}; the context (and Postgres container)
 * is shared with the rolled-back tests, so nothing may be left behind.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(AbstractIntegrationTest.class)
public abstract class AbstractPlayingAreaIntegrationTest {

    @Autowired
    protected MockMvc mockMvc;

    @Autowired
    protected JdbcTemplate jdbc;

    @Autowired
    protected ClubRepository clubRepository;

    @Autowired
    protected PersonRepository personRepository;

    @Autowired
    protected RoleAssignmentRepository roleAssignmentRepository;

    @Autowired
    protected PlayingAreaRepository playingAreaRepository;

    @Autowired
    protected ClubPlayingAreaRepository clubPlayingAreaRepository;

    @Autowired
    protected MatchRepository matchRepository;

    @Autowired
    protected SeasonRepository seasonRepository;

    private final List<UUID> clubIds = new ArrayList<>();
    private final List<Person> persons = new ArrayList<>();
    private final List<RoleAssignment> roles = new ArrayList<>();

    @AfterEach
    void cleanUpPlayingAreaFixtures() {
        for (UUID clubId : clubIds) {
            jdbc.update("delete from match where club_id = ?", clubId);
        }
        jdbc.update("delete from club_playing_area");
        roleAssignmentRepository.deleteAll(roles);
        personRepository.deleteAll(persons);
        // Merged-away rows first: un-merging them would collide with the identity index of their survivors.
        jdbc.update("delete from playing_area where merged_into_id is not null");
        jdbc.update("delete from playing_area");
        for (UUID clubId : clubIds) {
            jdbc.update("delete from season where club_id = ?", clubId);
            jdbc.update("delete from club where id = ?", clubId);
        }
    }

    protected Club club(String name) {
        Club club = clubRepository.save(Club.builder()
                .name(name)
                .slug(name.toLowerCase().replace(' ', '-') + "-" + UUID.randomUUID().toString().substring(0, 6))
                .status(ClubStatus.ACTIVE)
                .build());
        clubIds.add(club.getId());
        return club;
    }

    protected JwtRequestPostProcessor clubAdmin(String subject, UUID clubId) {
        Person person = personRepository.save(Person.builder()
                .firstName("Casey")
                .lastName("Manager")
                .email(subject + "@example.com")
                .keycloakUserId(subject)
                .build());
        persons.add(person);
        roles.add(roleAssignmentRepository.save(RoleAssignment.builder()
                .personId(person.getId())
                .role(RoleAssignmentRole.CLUB_ADMIN)
                .scopeType(ScopeType.CLUB)
                .scopeId(clubId)
                .build()));
        return withSubject(subject);
    }

    protected Season season(UUID clubId) {
        return seasonRepository.save(Season.builder()
                .clubId(clubId)
                .label("2026")
                .startDate(LocalDate.of(2026, 1, 1))
                .endDate(LocalDate.of(2026, 12, 31))
                .active(true)
                .build());
    }

    protected PlayingArea area(String name, String city, String country, PlayingAreaVerificationStatus status) {
        return area(name, city, country, null, PlayingAreaCategory.CLUB, status, null);
    }

    protected PlayingArea area(
            String name,
            String city,
            String country,
            String province,
            PlayingAreaCategory category,
            PlayingAreaVerificationStatus status,
            UUID createdByClubId) {
        return playingAreaRepository.save(PlayingArea.builder()
                .areaType(PlayingAreaType.CRICKET_FIELD)
                .name(name)
                .category(category)
                .ownerType(PlayingAreaOwnerType.CLUB)
                .ownerName("Owner")
                .address(Address.builder().city(city).country(country).provinceState(province).build())
                .verificationStatus(status)
                .createdByClubId(createdByClubId)
                .build());
    }

    protected ClubPlayingArea home(UUID clubId, UUID areaId) {
        return clubPlayingAreaRepository.save(
                ClubPlayingArea.builder().clubId(clubId).playingAreaId(areaId).home(true).build());
    }

    protected Match match(UUID clubId, UUID seasonId, UUID areaId, String venue) {
        return matchRepository.save(Match.builder()
                .clubId(clubId)
                .homeTeamName("Home XI")
                .awayTeamName("Away XI")
                .seasonId(seasonId)
                .matchDate(Instant.now().plus(7, ChronoUnit.DAYS))
                .venue(venue)
                .playingAreaId(areaId)
                .active(true)
                .build());
    }

    protected static String fieldBody(String name, String street, String city, String country, String mapUrl) {
        return """
                {
                    "name": "%s",
                    "category": "MUNICIPAL",
                    "ownerType": "OTHER",
                    "ownerName": "City Council",
                    "address": {"street": %s, "city": "%s", "country": "%s", "provinceState": "Gauteng"},
                    "mapUrl": %s
                }
                """.formatted(
                name,
                street == null ? "null" : "\"" + street + "\"",
                city,
                country,
                mapUrl == null ? "null" : "\"" + mapUrl + "\"");
    }
}
