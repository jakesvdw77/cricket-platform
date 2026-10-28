package com.cricketlegend.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.cricketlegend.AbstractIntegrationTest;
import com.cricketlegend.AbstractLinkIntegrationTest;
import com.cricketlegend.domain.Address;
import com.cricketlegend.domain.Club;
import com.cricketlegend.domain.ClubProfile;
import com.cricketlegend.domain.League;
import com.cricketlegend.domain.LeagueAffiliation;
import com.cricketlegend.domain.LeagueFormat;
import com.cricketlegend.domain.LeaguePlayingConditions;
import com.cricketlegend.domain.LeagueSource;
import com.cricketlegend.domain.LeagueTeam;
import com.cricketlegend.domain.Match;
import com.cricketlegend.domain.MatchResult;
import com.cricketlegend.domain.Person;
import com.cricketlegend.domain.PersonLink;
import com.cricketlegend.domain.PersonStatus;
import com.cricketlegend.domain.PlayerProfile;
import com.cricketlegend.domain.PlayingArea;
import com.cricketlegend.domain.PlayingAreaCategory;
import com.cricketlegend.domain.PlayingAreaOwnerType;
import com.cricketlegend.domain.PlayingAreaType;
import com.cricketlegend.domain.PlayingAreaVerificationStatus;
import com.cricketlegend.domain.ResultDecidedBy;
import com.cricketlegend.domain.ResultDetailLevel;
import com.cricketlegend.domain.ResultMarginType;
import com.cricketlegend.domain.ResultOutcomeType;
import com.cricketlegend.domain.ResultSide;
import com.cricketlegend.domain.ResultStatus;
import com.cricketlegend.domain.Season;
import com.cricketlegend.domain.Team;
import com.cricketlegend.domain.TeamSquadMember;
import com.cricketlegend.repository.ClubProfileRepository;
import com.cricketlegend.repository.LeagueAffiliationRepository;
import com.cricketlegend.repository.LeaguePlayingConditionsRepository;
import com.cricketlegend.repository.LeagueRepository;
import com.cricketlegend.repository.LeagueTeamRepository;
import com.cricketlegend.repository.MatchResultRepository;
import com.cricketlegend.repository.PlayingAreaRepository;
import com.jayway.jsonpath.JsonPath;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;

/**
 * docs/specs/123, Integration: the Player Hub leagues ({@code GET /api/v1/me/players/{playerKey}/leagues} and
 * {@code .../leagues/{leagueId}}). Deliberately NOT transactional (the {@code open-in-view=false} trap in
 * docs/standards/backend.md): rows are committed with unique names. Everything it commits to the shared leagues,
 * matches, seasons, teams and playing-area tables is removed again in {@code @AfterEach}, because other tests share this
 * database.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(AbstractIntegrationTest.class)
class MePlayersLeaguesIntegrationTest extends AbstractLinkIntegrationTest {

    private static final Set<String> LIST_KEYS = Set.of("seasons", "seasonId", "leagues");
    private static final Set<String> SEASON_OPTION_KEYS = Set.of("id", "name", "current");
    private static final Set<String> CARD_KEYS = Set.of("id", "name", "logoUrl", "minAge", "maxAge", "teamCount", "myTeams",
            "nextMatchDate", "matchCount");
    private static final Set<String> TEAM_REF_KEYS = Set.of("id", "name");
    private static final Set<String> DETAIL_KEYS = Set.of("league", "season", "playingConditions", "teams", "schedule",
            "results", "keyDates", "shareDisabledFormats", "fields");
    private static final Set<String> LEAGUE_KEYS = Set.of("id", "name", "logoUrl", "minAge", "maxAge", "ageCutoffDay",
            "ageCutoffMonth", "format", "website", "socialLinks");
    private static final Set<String> SEASON_KEYS = Set.of("id", "name", "startDate", "endDate");
    private static final Set<String> TEAM_KEYS = Set.of("id", "name", "abbreviation", "logoUrl", "mine");
    private static final Set<String> SCHEDULE_KEYS = Set.of("matchId", "date", "time", "homeName", "homeLogoUrl", "awayName",
            "awayLogoUrl", "venue", "mine");
    private static final Set<String> RESULT_KEYS = Set.of("matchId", "date", "homeName", "awayName", "homeScore", "awayScore",
            "resultLine", "mine");
    private static final Set<String> KEY_DATE_KEYS = Set.of("seasonStart", "seasonEnd", "firstMatchDate", "lastMatchDate",
            "nextMatchDate");
    private static final Set<String> CONDITION_KEYS = Set.of("documentUrl", "maxOversPerInnings", "maxBallsPerOver",
            "freeHitOnNoBall", "powerplayOvers", "maxOversPerBowler", "fieldingRestrictionsNotes", "allowSubstitutions",
            "pointsForWin", "pointsForLoss", "pointsForDraw", "pointsForNoResult", "pointsForForfeitWin",
            "bonusPointsEnabled", "bonusBattingOversThreshold", "bonusBowlingRestrictionPercentage", "additionalNotes");
    private static final Set<String> FIELD_KEYS = Set.of("id", "name", "owner", "addressLine1", "city", "provinceState",
            "postalCode", "country", "mapUrl", "verified", "home");
    private static final List<String> BANNED = List.of("contact", "phone", "email", "0821234567", "league@secret.example",
            "\"active\"", "clubId", "createdAt", "updatedAt", "updatedBy", "uploadedBy", "uploadedAt", "affiliation",
            "children", "scorecard", "innings", "DRAFT");

    @Autowired private MockMvc mockMvc;
    @Autowired private LeagueRepository leagueRepository;
    @Autowired private LeagueAffiliationRepository affiliationRepository;
    @Autowired private LeagueTeamRepository leagueTeamRepository;
    @Autowired private LeaguePlayingConditionsRepository conditionsRepository;
    @Autowired private MatchResultRepository matchResultRepository;
    @Autowired private ClubProfileRepository clubProfileRepository;
    @Autowired private PlayingAreaRepository playingAreaRepository;
    @Autowired private JdbcTemplate jdbc;

    private final List<UUID> clubIds = new ArrayList<>();
    private final List<UUID> playingAreaIds = new ArrayList<>();

    /** Removes what this class committed to the shared tables (children first); persons, profiles and clubs stay. */
    @AfterEach
    void cleanUp() {
        for (UUID id : clubIds) {
            jdbc.update("delete from match_result where club_id = ?", id);
            jdbc.update("delete from match where club_id = ?", id);
            jdbc.update("delete from league_playing_conditions where league_id in (select id from league where club_id = ?)", id);
            jdbc.update("delete from league_season where league_id in (select id from league where club_id = ?)", id);
            jdbc.update("delete from league_team where league_id in (select id from league where club_id = ?)", id);
            jdbc.update("delete from league_affiliation where league_id in (select id from league where club_id = ?)", id);
            jdbc.update("delete from team_squad_member where team_id in (select id from team where club_id = ?)", id);
            jdbc.update("delete from team where club_id = ?", id);
            jdbc.update("delete from league where club_id = ?", id);
            jdbc.update("delete from season where club_id = ?", id);
            jdbc.update("delete from club_playing_area where club_id = ?", id);
            jdbc.update("delete from club_profile where club_id = ?", id);
        }
        for (UUID id : playingAreaIds) {
            jdbc.update("delete from playing_area where id = ?", id);
        }
        clubIds.clear();
        playingAreaIds.clear();
    }

    /** A club with a current season, a team, a league the team is in, and a parent holding one player in that team. */
    private record World(Club club, Season season, Team team, League league, Person parent, PersonLink link, PlayerProfile profile) {}

    private World world() {
        Club club = trackedClub("Hillcrest");
        Season season = season(club, LocalDate.now().minusDays(30), LocalDate.now().plusDays(30));
        Team team = team(club, "U13 Colts", true);
        League league = league(club, "Division 1");
        Person parent = account("Pat", "Parent");
        Person kid = playerPerson("Sam", "Smith", CHILD_DOB);
        PlayerProfile profile = profile(club, kid, null);
        squad(team, season, profile);
        affiliate(league, team, season);
        return new World(club, season, team, league, parent, link(parent, kid, club, true), profile);
    }

    private Club trackedClub(String name) {
        Club club = club(name);
        clubIds.add(club.getId());
        return club;
    }

    private Season season(Club club, LocalDate start, LocalDate end) {
        return seasonRepository.save(Season.builder().clubId(club.getId()).label(unique("S")).startDate(start).endDate(end)
                .active(true).build());
    }

    private Team team(Club club, String name, boolean active) {
        return teamRepository.save(Team.builder().clubId(club.getId()).sectionId(section(club, "U13").getId())
                .name(name).abbreviation("AB").active(active).build());
    }

    private League league(Club club, String name) {
        return leagueRepository.save(League.builder().clubId(club.getId()).name(name).source(LeagueSource.INTERNAL)
                .maxPlayingXiSize(11).minAge(10).maxAge(13).format(LeagueFormat.T20).phone("0821234567")
                .email("league@secret.example").website("https://league.example").active(true).build());
    }

    private void squad(Team team, Season season, PlayerProfile profile) {
        squadMemberRepository.save(TeamSquadMember.builder().teamId(team.getId()).seasonId(season.getId())
                .playerProfileId(profile.getId()).build());
    }

    private void affiliate(League league, Team team, Season season) {
        affiliationRepository.save(LeagueAffiliation.builder().leagueId(league.getId()).teamId(team.getId())
                .seasonId(season.getId()).build());
    }

    private Match match(World w, UUID homeTeamId, UUID awayTeamId, String awayName, int daysAhead, UUID playingAreaId) {
        return matchRepository.save(Match.builder().clubId(w.club().getId()).leagueId(w.league().getId())
                .seasonId(w.season().getId()).homeTeamId(homeTeamId).awayTeamId(awayTeamId).awayTeamName(awayName)
                .venue("Free text ground").playingAreaId(playingAreaId)
                .matchDate(Instant.now().plus(daysAhead, ChronoUnit.DAYS)).active(true).build());
    }

    private void result(World w, Match match, ResultStatus status) {
        matchResultRepository.save(MatchResult.builder().clubId(w.club().getId()).matchId(match.getId()).status(status)
                .detailLevel(ResultDetailLevel.SUMMARY).decidedBy(ResultDecidedBy.REGULAR).source("MANUAL").ballsPerOver(6)
                .outcomeType(ResultOutcomeType.WON).winningSide(ResultSide.HOME).marginType(ResultMarginType.RUNS)
                .marginValue(24).build());
    }

    private String list(World w, String key, String query) throws Exception {
        return mockMvc.perform(get("/api/v1/me/players/{k}/leagues" + query, key).with(as(w.parent())))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
    }

    private String detail(World w, League league, String query) throws Exception {
        return mockMvc.perform(get("/api/v1/me/players/{k}/leagues/{l}" + query, w.link().getId(), league.getId())
                        .with(as(w.parent())))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
    }

    private static Set<String> keys(String json, String path) {
        Map<String, Object> map = JsonPath.read(json, path);
        return map.keySet();
    }

    private static List<String> leagueIds(String json) {
        return JsonPath.read(json, "$.leagues[*].id");
    }

    // --- list ---

    @Test
    void listsExactlyTheLeaguesOfTheHeldPlayersSquadTeamsForTheCurrentSeason() throws Exception {
        World w = world();
        League otherLeagueSameClub = league(w.club(), "Division 2");
        Team otherTeam = team(w.club(), "U15 Colts", true);
        affiliate(otherLeagueSameClub, otherTeam, w.season());
        World otherClub = world();

        String json = list(w, w.link().getId().toString(), "");

        assertThat(leagueIds(json)).containsExactly(w.league().getId().toString());
        assertThat(leagueIds(json)).doesNotContain(
                otherLeagueSameClub.getId().toString(), otherClub.league().getId().toString());
        assertThat((String) JsonPath.read(json, "$.seasonId")).isEqualTo(w.season().getId().toString());
        assertThat((String) JsonPath.read(json, "$.leagues[0].myTeams[0].name")).isEqualTo("U13 Colts");
    }

    @Test
    void aSeasonSwitchReturnsThatSeasonsLeaguesAndTheSeasonListIsNewestFirstWithTheCurrentFlag() throws Exception {
        World w = world();
        Season past = season(w.club(), LocalDate.now().minusDays(500), LocalDate.now().minusDays(400));
        League pastLeague = league(w.club(), "Old Division");
        squad(w.team(), past, w.profile());
        affiliate(pastLeague, w.team(), past);
        season(w.club(), LocalDate.now().minusDays(900), LocalDate.now().minusDays(800)); // no leagues: not offered

        String current = list(w, w.link().getId().toString(), "");
        String switched = list(w, w.link().getId().toString(), "?seasonId=" + past.getId());

        assertThat((List<Boolean>) JsonPath.read(current, "$.seasons[*].current")).containsExactly(true, false);
        assertThat((List<String>) JsonPath.read(current, "$.seasons[*].id"))
                .containsExactly(w.season().getId().toString(), past.getId().toString());
        assertThat(leagueIds(switched)).containsExactly(pastLeague.getId().toString());
    }

    @Test
    void anInactiveLeagueIsHiddenFromTheListAndTheDetailIsNotFound() throws Exception {
        World w = world();
        League inactive = league(w.club(), "Dormant");
        inactive.setActive(false);
        leagueRepository.save(inactive);
        affiliate(inactive, w.team(), w.season());

        assertThat(leagueIds(list(w, w.link().getId().toString(), ""))).containsExactly(w.league().getId().toString());
        mockMvc.perform(get("/api/v1/me/players/{k}/leagues/{l}", w.link().getId(), inactive.getId()).with(as(w.parent())))
                .andExpect(status().isNotFound());
    }

    @Test
    void anInvalidSeasonIdIsNotFoundOnTheListAndTheDetail() throws Exception {
        World w = world();
        Club other = trackedClub("Elsewhere");
        Season foreignSeason = season(other, LocalDate.now().minusDays(1), LocalDate.now().plusDays(1));

        for (UUID bad : List.of(UUID.randomUUID(), foreignSeason.getId())) {
            mockMvc.perform(get("/api/v1/me/players/{k}/leagues", w.link().getId()).param("seasonId", bad.toString())
                            .with(as(w.parent())))
                    .andExpect(status().isNotFound());
            mockMvc.perform(get("/api/v1/me/players/{k}/leagues/{l}", w.link().getId(), w.league().getId())
                            .param("seasonId", bad.toString()).with(as(w.parent())))
                    .andExpect(status().isNotFound());
        }
    }

    @Test
    void aPlayerInNoSquadGetsAnEmptyList() throws Exception {
        World w = world();
        Person kid2 = playerPerson("Lone", "Wolf", CHILD_DOB);
        profile(w.club(), kid2, null);
        PersonLink link2 = link(w.parent(), kid2, w.club(), false);

        mockMvc.perform(get("/api/v1/me/players/{k}/leagues", link2.getId()).with(as(w.parent())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.leagues").isEmpty());
    }

    @Test
    void theListHasExactlyTheDocumentedKeysAndNoManagerOnlyData() throws Exception {
        World w = world();
        match(w, w.team().getId(), null, "Visitors", 3, null);

        String json = list(w, w.link().getId().toString(), "");

        assertThat(keys(json, "$")).isSubsetOf(LIST_KEYS).contains("seasons", "seasonId", "leagues");
        assertThat(keys(json, "$.seasons[0]")).isEqualTo(SEASON_OPTION_KEYS);
        assertThat(keys(json, "$.leagues[0]")).isSubsetOf(CARD_KEYS).contains("id", "name", "teamCount", "myTeams", "matchCount");
        assertThat(keys(json, "$.leagues[0].myTeams[0]")).isEqualTo(TEAM_REF_KEYS);
        assertThat((Integer) JsonPath.read(json, "$.leagues[0].matchCount")).isEqualTo(1);
        assertThat((Integer) JsonPath.read(json, "$.leagues[0].teamCount")).isEqualTo(1);
        for (String banned : BANNED) {
            assertThat(json).doesNotContain(banned);
        }
    }

    // --- detail ---

    @Test
    void theDetailHasTheWholeScheduleWithMineForHomeAndAwayAndPublishedResultsOnly() throws Exception {
        World w = world();
        Team rival = team(w.club(), "Rivals", true);
        affiliate(w.league(), rival, w.season());
        Team third = team(w.club(), "Third XI", true);
        affiliate(w.league(), third, w.season());
        Match home = match(w, w.team().getId(), null, "Visitors", 1, null);
        Match away = match(w, rival.getId(), w.team().getId(), null, 2, null);
        Match others = match(w, rival.getId(), third.getId(), null, 3, null);
        Match draft = match(w, w.team().getId(), rival.getId(), null, 4, null);
        result(w, home, ResultStatus.PUBLISHED);
        result(w, draft, ResultStatus.DRAFT);

        String json = detail(w, w.league(), "");

        assertThat((List<String>) JsonPath.read(json, "$.schedule[*].matchId")).containsExactly(
                home.getId().toString(), away.getId().toString(), others.getId().toString(), draft.getId().toString());
        assertThat((List<Boolean>) JsonPath.read(json, "$.schedule[*].mine")).containsExactly(true, true, false, true);
        assertThat((String) JsonPath.read(json, "$.schedule[0].awayName")).isEqualTo("Visitors");
        assertThat((String) JsonPath.read(json, "$.schedule[0].homeName")).isEqualTo("U13 Colts");
        assertThat((List<String>) JsonPath.read(json, "$.results[*].matchId")).containsExactly(home.getId().toString());
        assertThat((String) JsonPath.read(json, "$.results[0].resultLine")).isEqualTo("U13 Colts won by 24 runs");
        assertThat((Boolean) JsonPath.read(json, "$.results[0].mine")).isTrue();
        assertThat((String) JsonPath.read(json, "$.keyDates.nextMatchDate")).isNotNull();
        assertThat((List<String>) JsonPath.read(json, "$.teams[*].name")).containsExactly("Rivals", "Third XI", "U13 Colts");
        assertThat((List<Boolean>) JsonPath.read(json, "$.teams[*].mine")).containsExactly(false, false, true);
    }

    @Test
    void theDetailHasExactlyTheDocumentedKeysAndNoManagerOnlyData() throws Exception {
        World w = world();
        Match played = match(w, w.team().getId(), null, "Visitors", 1, null);
        result(w, played, ResultStatus.PUBLISHED);
        conditionsRepository.save(LeaguePlayingConditions.builder().leagueId(w.league().getId())
                .seasonId(w.season().getId()).maxOversPerInnings(20).powerplayOvers(6).pointsForWin(2).pointsForLoss(0)
                .pointsForDraw(1).pointsForNoResult(1).pointsForForfeitWin(2).uploadedBy(UUID.randomUUID())
                .uploadedAt(Instant.now()).documentUrl("/media/pc.pdf").build());
        leagueTeamRepository.save(LeagueTeam.builder().leagueId(w.league().getId()).seasonId(w.season().getId())
                .name("Visitors").active(true).build());

        String json = detail(w, w.league(), "");

        assertThat(keys(json, "$")).isSubsetOf(DETAIL_KEYS).contains("league", "season", "teams", "schedule", "results",
                "keyDates", "shareDisabledFormats", "fields", "playingConditions");
        assertThat(keys(json, "$.league")).isSubsetOf(LEAGUE_KEYS).contains("id", "name", "minAge", "maxAge", "format", "website");
        assertThat(keys(json, "$.season")).isSubsetOf(SEASON_KEYS).contains("id", "name");
        assertThat(keys(json, "$.teams[0]")).isSubsetOf(TEAM_KEYS).contains("id", "name", "mine");
        assertThat(keys(json, "$.schedule[0]")).isSubsetOf(SCHEDULE_KEYS).contains("matchId", "date", "homeName", "awayName", "mine");
        assertThat(keys(json, "$.results[0]")).isSubsetOf(RESULT_KEYS).contains("matchId", "resultLine", "mine");
        assertThat(keys(json, "$.keyDates")).isSubsetOf(KEY_DATE_KEYS);
        assertThat(keys(json, "$.playingConditions")).isSubsetOf(CONDITION_KEYS)
                .contains("maxOversPerInnings", "freeHitOnNoBall", "pointsForWin");
        for (String banned : BANNED) {
            assertThat(json).doesNotContain(banned);
        }
    }

    @Test
    void thePlayingConditionsCarryBallsPerOverAndFreeHitAndAreNullWhenNoneAreSet() throws Exception {
        World w = world();
        assertThat((Object) JsonPath.read(detail(w, w.league(), ""), "$.playingConditions")).isNull();

        conditionsRepository.save(LeaguePlayingConditions.builder().leagueId(w.league().getId())
                .seasonId(w.season().getId()).maxOversPerInnings(20).maxBallsPerOver(8).freeHitOnNoBall(false)
                .powerplayOvers(6).pointsForWin(2).pointsForLoss(0).pointsForDraw(1).pointsForNoResult(1)
                .pointsForForfeitWin(2).build());

        mockMvc.perform(get("/api/v1/me/players/{k}/leagues/{l}", w.link().getId(), w.league().getId()).with(as(w.parent())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.playingConditions.maxBallsPerOver").value(8))
                .andExpect(jsonPath("$.playingConditions.freeHitOnNoBall").value(false));
    }

    @Test
    void conditionsSavedWithoutTheNewRulesShowNoLimitAndFreeHitOn() throws Exception {
        World w = world();
        conditionsRepository.save(LeaguePlayingConditions.builder().leagueId(w.league().getId())
                .seasonId(w.season().getId()).maxOversPerInnings(20).powerplayOvers(6).pointsForWin(2).pointsForLoss(0)
                .pointsForDraw(1).pointsForNoResult(1).pointsForForfeitWin(2).build());

        mockMvc.perform(get("/api/v1/me/players/{k}/leagues/{l}", w.link().getId(), w.league().getId()).with(as(w.parent())))
                .andExpect(jsonPath("$.playingConditions.maxBallsPerOver").doesNotExist())
                .andExpect(jsonPath("$.playingConditions.freeHitOnNoBall").value(true));
    }

    @Test
    void shareDisabledFormatsComeFromTheClubsLeagueSetting() throws Exception {
        World w = world();
        mockMvc.perform(get("/api/v1/me/players/{k}/leagues/{l}", w.link().getId(), w.league().getId()).with(as(w.parent())))
                .andExpect(jsonPath("$.shareDisabledFormats").isEmpty());

        clubProfileRepository.save(ClubProfile.builder().clubId(w.club().getId())
                .shareDisabledFormats("{\"LEAGUE\":[\"FACEBOOK\",\"POSTER\"],\"RESULT\":[\"TV\"]}").build());

        mockMvc.perform(get("/api/v1/me/players/{k}/leagues/{l}", w.link().getId(), w.league().getId()).with(as(w.parent())))
                .andExpect(jsonPath("$.shareDisabledFormats.length()").value(2))
                .andExpect(jsonPath("$.shareDisabledFormats[0]").value("FACEBOOK"))
                .andExpect(jsonPath("$.shareDisabledFormats[1]").value("POSTER"));
    }

    @Test
    void fieldsComeFromThePlayingAreaIdOnlyAndNotFromTheFreeTextVenue() throws Exception {
        World w = world();
        PlayingArea field = playingAreaRepository.save(PlayingArea.builder().areaType(PlayingAreaType.CRICKET_FIELD)
                .name(unique("Oval")).category(PlayingAreaCategory.CLUB).ownerType(PlayingAreaOwnerType.CLUB)
                .ownerName("Owner").address(Address.builder().number("1").street("High St").city(unique("City"))
                        .provinceState("WC").postalCode("8000").country("ZA").build())
                .mapUrl("https://maps.example.com/oval").verificationStatus(PlayingAreaVerificationStatus.VERIFIED)
                .createdByClubId(w.club().getId()).locationNotes("Gate code 1234").build());
        playingAreaIds.add(field.getId());
        match(w, w.team().getId(), null, "Visitors", 1, field.getId());
        match(w, w.team().getId(), null, "Visitors", 2, null);

        String json = detail(w, w.league(), "");

        assertThat((List<String>) JsonPath.read(json, "$.fields[*].id")).containsExactly(field.getId().toString());
        assertThat(keys(json, "$.fields[0]")).isSubsetOf(FIELD_KEYS);
        assertThat(json).doesNotContain("Gate code").doesNotContain("Free text ground\",\"verified");
        assertThat((List<?>) JsonPath.read(json, "$.fields")).hasSize(1);
    }

    // --- authorisation ---

    @Test
    void aLeagueThePlayersTeamsAreNotInIsNotFoundForTheSameClubAndForAnotherClub() throws Exception {
        World w = world();
        League sameClub = league(w.club(), "Other Division");
        affiliate(sameClub, team(w.club(), "Seniors", true), w.season());
        World other = world();

        for (League foreign : List.of(sameClub, other.league())) {
            mockMvc.perform(get("/api/v1/me/players/{k}/leagues/{l}", w.link().getId(), foreign.getId()).with(as(w.parent())))
                    .andExpect(status().isNotFound());
        }
        mockMvc.perform(get("/api/v1/me/players/{k}/leagues/{l}", w.link().getId(), UUID.randomUUID()).with(as(w.parent())))
                .andExpect(status().isNotFound());
    }

    @Test
    void aKeyTheCallerDoesNotHoldIsNotFoundOnBothEndpoints() throws Exception {
        World w = world();
        World other = world();
        Person stranger = account("Some", "Stranger");

        for (String path : List.of("/api/v1/me/players/{k}/leagues", "/api/v1/me/players/{k}/leagues/" + w.league().getId())) {
            mockMvc.perform(get(path, other.link().getId()).with(as(w.parent()))).andExpect(status().isNotFound());
            mockMvc.perform(get(path, "not-a-key").with(as(w.parent()))).andExpect(status().isNotFound());
            mockMvc.perform(get(path, UUID.randomUUID()).with(as(w.parent()))).andExpect(status().isNotFound());
            mockMvc.perform(get(path, w.link().getId()).with(as(stranger))).andExpect(status().isNotFound());
        }
    }

    @Test
    void aManagerWithoutALinkToThePlayerIsNotFound() throws Exception {
        World w = world();
        Person admin = clubAdmin(w.club());

        mockMvc.perform(get("/api/v1/me/players/{k}/leagues", w.link().getId()).with(as(admin))).andExpect(status().isNotFound());
        mockMvc.perform(get("/api/v1/me/players/{k}/leagues/{l}", w.link().getId(), w.league().getId()).with(as(admin)))
                .andExpect(status().isNotFound());
    }

    @Test
    void aPlayerWhoDroppedOutIsNotFound() throws Exception {
        World w = world();
        w.profile().setActive(false);
        playerProfileRepository.save(w.profile());

        mockMvc.perform(get("/api/v1/me/players/{k}/leagues", w.link().getId()).with(as(w.parent())))
                .andExpect(status().isNotFound());
        mockMvc.perform(get("/api/v1/me/players/{k}/leagues/{l}", w.link().getId(), w.league().getId()).with(as(w.parent())))
                .andExpect(status().isNotFound());
    }

    @Test
    void theOwnVerifiedRecordKeyWorks() throws Exception {
        World w = world();
        Person me = account("Adult", "Player");
        PlayerProfile own = profile(w.club(), me, null);
        squad(w.team(), w.season(), own);

        mockMvc.perform(get("/api/v1/me/players/{k}/leagues", "self:" + own.getId()).with(as(me)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.leagues[0].id").value(w.league().getId().toString()));
    }

    @Test
    void unauthenticatedIsUnauthorisedAndASuspendedCallerIsForbidden() throws Exception {
        World w = world();
        mockMvc.perform(get("/api/v1/me/players/{k}/leagues", w.link().getId())).andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/v1/me/players/{k}/leagues/{l}", w.link().getId(), w.league().getId()))
                .andExpect(status().isUnauthorized());

        Person parent = personRepository.findById(w.parent().getId()).orElseThrow();
        parent.setStatus(PersonStatus.SUSPENDED);
        personRepository.save(parent);

        mockMvc.perform(get("/api/v1/me/players/{k}/leagues", w.link().getId()).with(as(parent))).andExpect(status().isForbidden());
        mockMvc.perform(get("/api/v1/me/players/{k}/leagues/{l}", w.link().getId(), w.league().getId()).with(as(parent)))
                .andExpect(status().isForbidden());
    }

    @Test
    void aParentWithPlayersAtTwoClubsGetsEachClubsLeaguesForEachKeyAndNoCrossClubData() throws Exception {
        World a = world();
        World b = world();
        Person parent = a.parent();
        Person kidAtB = playerPerson("Bea", "Brown", CHILD_DOB);
        PlayerProfile profileB = profile(b.club(), kidAtB, null);
        squad(b.team(), b.season(), profileB);
        PersonLink linkB = link(parent, kidAtB, b.club(), false);

        String forA = mockMvc.perform(get("/api/v1/me/players/{k}/leagues", a.link().getId()).with(as(parent)))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        String forB = mockMvc.perform(get("/api/v1/me/players/{k}/leagues", linkB.getId()).with(as(parent)))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();

        assertThat(leagueIds(forA)).containsExactly(a.league().getId().toString());
        assertThat(leagueIds(forB)).containsExactly(b.league().getId().toString());
        assertThat((String) JsonPath.read(forB, "$.seasonId")).isEqualTo(b.season().getId().toString());
        // the A league is not reachable with B's key and the other way round
        mockMvc.perform(get("/api/v1/me/players/{k}/leagues/{l}", linkB.getId(), a.league().getId()).with(as(parent)))
                .andExpect(status().isNotFound());
        mockMvc.perform(get("/api/v1/me/players/{k}/leagues/{l}", a.link().getId(), b.league().getId()).with(as(parent)))
                .andExpect(status().isNotFound());
    }
}
