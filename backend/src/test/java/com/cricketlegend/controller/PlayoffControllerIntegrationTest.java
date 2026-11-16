package com.cricketlegend.controller;

import static com.cricketlegend.PlatformRoleJwtPostProcessors.withSubject;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.cricketlegend.AbstractIntegrationTest;
import com.cricketlegend.domain.*;
import com.cricketlegend.repository.*;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

// docs/specs/155-playoff-and-knockout-fixtures.md: the preview writes nothing, the create writes the games with their stages, a bad side is
// a 400, a manager of another club is refused, and Edit Match resolves a TBC side.
@SpringBootTest
@AutoConfigureMockMvc
@Import(AbstractIntegrationTest.class)
class PlayoffControllerIntegrationTest {
    @Autowired MockMvc mockMvc;
    @Autowired ClubRepository clubRepository;
    @Autowired SeasonRepository seasonRepository;
    @Autowired LeagueRepository leagueRepository;
    @Autowired MatchRepository matchRepository;
    @Autowired PersonRepository personRepository;
    @Autowired RoleAssignmentRepository roleAssignmentRepository;
    @Autowired LeagueSeasonRepository leagueSeasonRepository;

    private record Fixture(Club club, Season season, League league, org.springframework.test.web.servlet.request.RequestPostProcessor admin, String slug) {
        String base() {
            return "/api/v1/manage/clubs/" + club.getId() + "/leagues/" + league.getId() + "/seasons/" + season.getId() + "/playoffs";
        }
    }

    private Fixture fixture() {
        String slug = "pf-" + UUID.randomUUID().toString().substring(0, 8);
        Club club = clubRepository.save(Club.builder().name("Playoff CC").slug(slug).status(ClubStatus.ACTIVE).build());
        Season season = seasonRepository.save(Season.builder().clubId(club.getId()).label("2026")
                .startDate(LocalDate.of(2026, 1, 1)).endDate(LocalDate.of(2026, 12, 31)).active(true).build());
        League league = leagueRepository.save(League.builder().clubId(club.getId()).name("League").source(LeagueSource.INTERNAL).maxPlayingXiSize(11).active(true).build());
        Person person = personRepository.save(Person.builder().firstName("C").lastName("M").email(slug + "@example.com").keycloakUserId(slug).build());
        roleAssignmentRepository.save(RoleAssignment.builder().personId(person.getId()).role(RoleAssignmentRole.CLUB_ADMIN).scopeType(ScopeType.CLUB).scopeId(club.getId()).build());
        var admin = withSubject(slug);
        return new Fixture(club, season, league, admin, slug);
    }


    private static String when() {
        return Instant.now().plus(10, ChronoUnit.DAYS).toString();
    }

    private static String body(String when) {
        return """
                {"stage":"Playoff","games":[
                  {"label":"1st v 2nd","home":{"placeholder":"1st in the pool"},"away":{"placeholder":"2nd in the pool"},"matchDate":"%s"},
                  {"stage":"Final","label":"Final","home":{"placeholder":"Winner SF1"},"away":{"placeholder":"Winner SF2"},"matchDate":"%s"}]}
                """.formatted(when, when);
    }

    @Test
    void previewReportsTheGamesAndWritesNothing() throws Exception {
        Fixture f = fixture();
        long before = matchRepository.count();

        mockMvc.perform(post(f.base() + "/preview").with(f.admin()).contentType(MediaType.APPLICATION_JSON).content(body(when())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].homePlaceholder").value(true))
                .andExpect(jsonPath("$[0].homeTeamName").value("1st in the pool"));

        assertThat(matchRepository.count()).isEqualTo(before);
    }

    @Test
    void createWritesBothGamesWithTheirStagesAndLabels() throws Exception {
        Fixture f = fixture();
        long before = matchRepository.count();

        mockMvc.perform(post(f.base()).with(f.admin()).contentType(MediaType.APPLICATION_JSON).content(body(when())))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$[0].stage").value("Playoff"))
                .andExpect(jsonPath("$[0].stageLabel").value("1st v 2nd"))
                .andExpect(jsonPath("$[1].stage").value("Final"))
                .andExpect(jsonPath("$[1].awayPlaceholder").value(true));

        assertThat(matchRepository.count()).isEqualTo(before + 2);
    }

    @Test
    void aSideWithBothTextAndATeamIsABadRequestAndNothingIsWritten() throws Exception {
        Fixture f = fixture();
        long before = matchRepository.count();
        String bad = "{\"stage\":\"Playoff\",\"games\":[{\"home\":{\"placeholder\":\"x\",\"teamId\":\"" + UUID.randomUUID()
                + "\"},\"away\":{\"placeholder\":\"y\"},\"matchDate\":\"" + when() + "\"}]}";

        mockMvc.perform(post(f.base()).with(f.admin()).contentType(MediaType.APPLICATION_JSON).content(bad))
                .andExpect(status().isBadRequest());

        assertThat(matchRepository.count()).isEqualTo(before);
    }

    @Test
    void aRoundWithNoGamesOrNoStageIsABadRequest() throws Exception {
        Fixture f = fixture();

        mockMvc.perform(post(f.base()).with(f.admin()).contentType(MediaType.APPLICATION_JSON).content("{\"stage\":\"Playoff\",\"games\":[]}"))
                .andExpect(status().isBadRequest());
        mockMvc.perform(post(f.base()).with(f.admin()).contentType(MediaType.APPLICATION_JSON).content(body(when()).replace("\"stage\":\"Playoff\",", "\"stage\":\" \",")))
                .andExpect(status().isBadRequest());
    }

    @Test
    void aGameOutsideTheLeagueSeasonDatesIsRefusedWithTheRange() throws Exception {
        Fixture f = fixture();
        LeagueSeason dates = new LeagueSeason();
        dates.setLeagueId(f.league().getId());
        dates.setSeasonId(f.season().getId());
        dates.setStartDate(LocalDate.now().plusDays(1));
        dates.setEndDate(LocalDate.now().plusDays(3));
        leagueSeasonRepository.save(dates);
        long before = matchRepository.count();

        mockMvc.perform(post(f.base()).with(f.admin()).contentType(MediaType.APPLICATION_JSON).content(body(when())))
                .andExpect(status().is4xxClientError())
                .andExpect(jsonPath("$.detail").value(org.hamcrest.Matchers.containsString("This league runs from")));

        assertThat(matchRepository.count()).isEqualTo(before);
    }

    @Test
    void aManagerOfAnotherClubIsRefusedAndNothingIsWritten() throws Exception {
        Fixture mine = fixture();
        Fixture other = fixture();
        long before = matchRepository.count();

        mockMvc.perform(post(mine.base()).with(other.admin()).contentType(MediaType.APPLICATION_JSON).content(body(when())))
                .andExpect(status().is4xxClientError());

        assertThat(matchRepository.count()).isEqualTo(before);
    }

    @Test
    void anAnonymousCallerIsRefused() throws Exception {
        Fixture f = fixture();

        mockMvc.perform(post(f.base()).contentType(MediaType.APPLICATION_JSON).content(body(when())))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void editMatchResolvesATbcSideToARealOneAndLeavesTheOtherTbc() throws Exception {
        Fixture f = fixture();
        String when = when();
        String created = mockMvc.perform(post(f.base()).with(f.admin()).contentType(MediaType.APPLICATION_JSON).content(body(when)))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        String id = com.jayway.jsonpath.JsonPath.read(created, "$[0].id");
        String put = """
                {"homeTeamName":"Real FC","awayTeamName":"2nd in the pool","awayPlaceholder":true,"stage":"Playoff","seasonId":"%s","leagueId":"%s","matchDate":"%s"}
                """.formatted(f.season().getId(), f.league().getId(), when);

        mockMvc.perform(put("/api/v1/manage/clubs/" + f.club().getId() + "/matches/" + id).with(f.admin()).contentType(MediaType.APPLICATION_JSON).content(put))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.homePlaceholder").value(false))
                .andExpect(jsonPath("$.homeTeamName").value("Real FC"))
                .andExpect(jsonPath("$.awayPlaceholder").value(true))
                .andExpect(jsonPath("$.stage").value("Playoff"));
    }
}
