package com.cricketlegend.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.cricketlegend.AbstractIntegrationTest;
import com.cricketlegend.AbstractLinkIntegrationTest;
import com.cricketlegend.domain.AnswerSource;
import com.cricketlegend.domain.AvailabilityStatus;
import com.cricketlegend.domain.Club;
import com.cricketlegend.domain.Match;
import com.cricketlegend.domain.MatchAvailabilityPoll;
import com.cricketlegend.domain.MatchSide;
import com.cricketlegend.domain.MatchSidePlayer;
import com.cricketlegend.domain.Person;
import com.cricketlegend.domain.PersonLink;
import com.cricketlegend.domain.PlayerAvailability;
import com.cricketlegend.domain.PlayerProfile;
import com.cricketlegend.domain.PlayingRole;
import com.cricketlegend.domain.Season;
import com.cricketlegend.domain.Section;
import com.cricketlegend.domain.Team;
import com.cricketlegend.domain.TeamSquadMember;
import com.cricketlegend.repository.MatchSidePlayerRepository;
import com.cricketlegend.repository.MatchSideRepository;
import com.cricketlegend.repository.PlayerAvailabilityRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.TreeSet;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

/**
 * docs/specs/135 Integration: the Player Hub matches list and match read. Scoping to the held player's teams (404, never
 * 403), the phases, junior initials, an unannounced XI hidden, the own availability answer only, the stream only while
 * live and the exact JSON keys. Rolled back after each test.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(AbstractIntegrationTest.class)
@Transactional
class MyPlayerMatchesIntegrationTest extends AbstractLinkIntegrationTest {

    private static final String LIST = "/api/v1/me/players/{k}/matches";
    private static final String ONE = "/api/v1/me/players/{k}/matches/{m}";
    private static final String YT = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private MatchSideRepository sideRepository;
    @Autowired private MatchSidePlayerRepository sidePlayerRepository;
    @Autowired private PlayerAvailabilityRepository availabilityRepository;

    private Club club;
    private Section section;
    private Person parent;
    private Person kid;
    private PlayerProfile kidProfile;
    private PersonLink link;
    private Season season;
    private Team team;

    @BeforeEach
    void fixture() {
        club = club("Hillcrest");
        section = section(club, "Juniors");
        parent = account("Pat", "Parent");
        kid = playerPerson("Sam", "Smith", CHILD_DOB);
        kidProfile = profile(club, kid, null);
        link = link(parent, kid, club, true);
        season = seasonRepository.save(Season.builder().clubId(club.getId()).label("Now")
                .startDate(LocalDate.now().minusDays(60)).endDate(LocalDate.now().plusDays(60)).active(true).build());
        team = team(club, section, "U13 Colts");
        squad(team, season, kidProfile);
    }

    private Team team(Club c, Section s, String name) {
        return teamRepository.save(Team.builder().clubId(c.getId()).sectionId(s.getId()).name(name).active(true).build());
    }

    private void squad(Team t, Season s, PlayerProfile p) {
        squadMemberRepository.save(TeamSquadMember.builder().teamId(t.getId()).seasonId(s.getId())
                .playerProfileId(p.getId()).build());
    }

    private Match match(Team home, Season s, Instant when) {
        return matchRepository.save(Match.builder().clubId(home.getClubId()).homeTeamId(home.getId())
                .awayTeamName("Occasionals").seasonId(s.getId()).matchDate(when).venue("The Oval").active(true).build());
    }

    private static Instant hoursFromNow(long hours) {
        return Instant.now().plus(hours, ChronoUnit.HOURS);
    }

    // ---- scoping ----

    @Test
    void theListHoldsOnlyTheMatchesOfTheHeldPlayersTeamsInLivePhases() throws Exception {
        Match live = match(team, season, hoursFromNow(-1));
        Match upcoming = match(team, season, hoursFromNow(48));
        Match recent = match(team, season, hoursFromNow(-72));
        Team otherTeam = team(club, section, "U15");
        match(otherTeam, season, hoursFromNow(-1));
        Club otherClub = club("Elsewhere");
        Team foreignTeam = team(otherClub, section(otherClub, "Juniors"), "Foreign");
        Season foreignSeason = seasonRepository.save(Season.builder().clubId(otherClub.getId()).label("F")
                .startDate(LocalDate.now().minusDays(60)).endDate(LocalDate.now().plusDays(60)).active(true).build());
        match(foreignTeam, foreignSeason, hoursFromNow(-1));

        mockMvc.perform(get(LIST, link.getId()).with(as(parent)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.live.length()").value(1))
                .andExpect(jsonPath("$.live[0].matchId").value(live.getId().toString()))
                .andExpect(jsonPath("$.live[0].phase").value("LIVE"))
                .andExpect(jsonPath("$.live[0].startedAt").isNotEmpty())
                .andExpect(jsonPath("$.live[0].selection").value("NOT_ANNOUNCED"))
                .andExpect(jsonPath("$.upcoming.length()").value(1))
                .andExpect(jsonPath("$.upcoming[0].matchId").value(upcoming.getId().toString()))
                .andExpect(jsonPath("$.upcoming[0].phase").value("UPCOMING"))
                .andExpect(jsonPath("$.upcoming[0].startedAt").doesNotExist())
                .andExpect(jsonPath("$.recent.length()").value(1))
                .andExpect(jsonPath("$.recent[0].matchId").value(recent.getId().toString()))
                .andExpect(jsonPath("$.recent[0].phase").value("RECENT"));
    }

    @Test
    void aMatchOutsideThePlayersTeamsOrAnotherClubOrUnknownIs404() throws Exception {
        Team otherTeam = team(club, section, "U15");
        Match otherTeamMatch = match(otherTeam, season, hoursFromNow(24));
        Club otherClub = club("Elsewhere");
        Team foreignTeam = team(otherClub, section(otherClub, "Juniors"), "Foreign");
        Match foreign = match(foreignTeam, season, hoursFromNow(24));
        // the player is in the squad of the team for another season only
        Season lastSeason = seasonRepository.save(Season.builder().clubId(club.getId()).label("Old")
                .startDate(LocalDate.now().minusDays(400)).endDate(LocalDate.now().minusDays(100)).active(true).build());
        Match otherSeason = match(team, lastSeason, hoursFromNow(24));

        for (UUID id : List.of(otherTeamMatch.getId(), foreign.getId(), otherSeason.getId(), UUID.randomUUID())) {
            mockMvc.perform(get(ONE, link.getId(), id).with(as(parent))).andExpect(status().isNotFound());
        }
    }

    @Test
    void anotherAccountsKeyAMalformedKeyAndAManagerWithoutALinkAre404AndNoLoginIs401() throws Exception {
        Match m = match(team, season, hoursFromNow(24));
        Person stranger = account("Sue", "Stranger");
        Person manager = clubAdmin(club);

        for (Person who : List.of(stranger, manager)) {
            mockMvc.perform(get(ONE, link.getId(), m.getId()).with(as(who))).andExpect(status().isNotFound());
            mockMvc.perform(get(LIST, link.getId()).with(as(who))).andExpect(status().isNotFound());
        }
        mockMvc.perform(get(ONE, "nonsense", m.getId()).with(as(parent))).andExpect(status().isNotFound());
        mockMvc.perform(get(LIST, "self:" + UUID.randomUUID()).with(as(parent))).andExpect(status().isNotFound());
        mockMvc.perform(get(ONE, link.getId(), m.getId())).andExpect(status().isUnauthorized());
        mockMvc.perform(get(LIST, link.getId())).andExpect(status().isUnauthorized());
    }

    @Test
    void aSuspendedCallerIs403() throws Exception {
        Match m = match(team, season, hoursFromNow(24));
        parent.setStatus(com.cricketlegend.domain.PersonStatus.SUSPENDED);
        personRepository.save(parent);

        mockMvc.perform(get(ONE, link.getId(), m.getId()).with(as(parent))).andExpect(status().isForbidden());
        mockMvc.perform(get(LIST, link.getId()).with(as(parent))).andExpect(status().isForbidden());
    }

    // ---- privacy ----

    @Test
    void anUnannouncedXiIsNotReturnedAndAnAnnouncedOneShowsJuniorsAsInitials() throws Exception {
        Person other = playerPerson("Mandla", "Naidoo", CHILD_DOB);
        PlayerProfile otherProfile = profile(club, other, null);
        squad(team, season, otherProfile);
        Match m = match(team, season, hoursFromNow(24));
        MatchSide side = sideRepository.save(MatchSide.builder().matchId(m.getId()).teamId(team.getId())
                .captainPlayerId(otherProfile.getId()).announced(false).build());
        sidePlayerRepository.save(MatchSidePlayer.builder().matchSideId(side.getId()).playerProfileId(otherProfile.getId())
                .battingOrder(1).role(PlayingRole.BATSMAN).build());

        mockMvc.perform(get(ONE, link.getId(), m.getId()).with(as(parent)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.selection").value("NOT_ANNOUNCED"))
                .andExpect(jsonPath("$.home.announced").value(false))
                .andExpect(jsonPath("$.home.players.length()").value(0))
                .andExpect(jsonPath("$.home.mine").value(true));

        side.setAnnounced(true);
        sideRepository.save(side);
        sidePlayerRepository.save(MatchSidePlayer.builder().matchSideId(side.getId()).playerProfileId(kidProfile.getId())
                .battingOrder(2).role(PlayingRole.BOWLER).build());

        mockMvc.perform(get(ONE, link.getId(), m.getId()).with(as(parent)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.selection").value("SELECTED"))
                .andExpect(jsonPath("$.home.players.length()").value(2))
                .andExpect(jsonPath("$.home.players[0].name").value("M. Naidoo"))
                .andExpect(jsonPath("$.home.players[0].captain").value(true))
                .andExpect(jsonPath("$.home.players[1].name").value("S. Smith"));
    }

    @Test
    void aPlayerLeftOutOfAnAnnouncedXiIsNotSelected() throws Exception {
        Match m = match(team, season, hoursFromNow(24));
        sideRepository.save(MatchSide.builder().matchId(m.getId()).teamId(team.getId()).announced(true).build());

        mockMvc.perform(get(ONE, link.getId(), m.getId()).with(as(parent)))
                .andExpect(jsonPath("$.selection").value("NOT_SELECTED"));
        mockMvc.perform(get(LIST, link.getId()).with(as(parent)))
                .andExpect(jsonPath("$.upcoming[0].selection").value("NOT_SELECTED"));
    }

    @Test
    void onlyTheHeldPlayersOwnAnswerIsReturned() throws Exception {
        Person other = playerPerson("Mandla", "Naidoo", CHILD_DOB);
        PlayerProfile otherProfile = profile(club, other, null);
        squad(team, season, otherProfile);
        Match m = match(team, season, hoursFromNow(24));
        MatchAvailabilityPoll poll = pollRepository.save(MatchAvailabilityPoll.builder().matchId(m.getId())
                .teamId(team.getId()).open(true).scheduledCloseAt(hoursFromNow(12)).build());
        availabilityRepository.save(PlayerAvailability.builder().pollId(poll.getId()).playerProfileId(otherProfile.getId())
                .status(AvailabilityStatus.UNAVAILABLE).source(AnswerSource.MANAGER).build());

        mockMvc.perform(get(ONE, link.getId(), m.getId()).with(as(parent)))
                .andExpect(jsonPath("$.availability.pollId").value(poll.getId().toString()))
                .andExpect(jsonPath("$.availability.pollOpen").value(true))
                .andExpect(jsonPath("$.availability.answer").doesNotExist());

        availabilityRepository.save(PlayerAvailability.builder().pollId(poll.getId()).playerProfileId(kidProfile.getId())
                .status(AvailabilityStatus.AVAILABLE).source(AnswerSource.LINKED_ACCOUNT).build());

        mockMvc.perform(get(ONE, link.getId(), m.getId()).with(as(parent)))
                .andExpect(jsonPath("$.availability.answer").value("AVAILABLE"));
    }

    // ---- links ----

    @Test
    void theStreamIsNotReturnedBeforeTheMatchAndOnlyOverHttps() throws Exception {
        Match live = match(team, season, hoursFromNow(-1));
        live.setStreamingUrl(YT);
        live.setScoringUrl("https://scores.example.com/m/1");
        matchRepository.save(live);
        Match upcoming = match(team, season, hoursFromNow(24));
        upcoming.setStreamingUrl(YT);
        upcoming.setScoringUrl("https://scores.example.com/m/2");
        matchRepository.save(upcoming);
        Match recent = match(team, season, hoursFromNow(-30));
        recent.setStreamingUrl(YT);
        recent.setScoringUrl("https://scores.example.com/m/3");
        matchRepository.save(recent);

        mockMvc.perform(get(ONE, link.getId(), live.getId()).with(as(parent)))
                .andExpect(jsonPath("$.phase").value("LIVE"))
                .andExpect(jsonPath("$.stream.provider").value("YOUTUBE"))
                .andExpect(jsonPath("$.stream.embedUrl").value("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"))
                .andExpect(jsonPath("$.liveScore.kind").value("EXTERNAL"))
                .andExpect(jsonPath("$.liveScore.host").value("scores.example.com"));
        mockMvc.perform(get(ONE, link.getId(), upcoming.getId()).with(as(parent)))
                .andExpect(jsonPath("$.stream").doesNotExist())
                .andExpect(jsonPath("$.liveScore.kind").value("EXTERNAL"));
        // A finished match keeps its recording and scoring links (owner, 2026-11-12).
        mockMvc.perform(get(ONE, link.getId(), recent.getId()).with(as(parent)))
                .andExpect(jsonPath("$.stream.provider").value("YOUTUBE"))
                .andExpect(jsonPath("$.liveScore.host").value("scores.example.com"));

        live.setStreamingUrl("javascript:alert(1)");
        live.setScoringUrl("http://scores.example.com/m/1");
        matchRepository.save(live);
        mockMvc.perform(get(ONE, link.getId(), live.getId()).with(as(parent)))
                .andExpect(jsonPath("$.stream").doesNotExist())
                .andExpect(jsonPath("$.liveScore").doesNotExist());
        mockMvc.perform(get(LIST, link.getId()).with(as(parent)))
                .andExpect(jsonPath("$.live[0].hasStream").value(false))
                .andExpect(jsonPath("$.live[0].hasLiveScore").value(false));
    }

    @Test
    void recentLimitDefaultsToTenGrowsOnRequestAndTheTotalsAreUncapped() throws Exception {
        for (int i = 1; i <= 12; i++) {
            match(team, season, hoursFromNow(-24L * i - 12));
        }
        match(team, season, hoursFromNow(48));
        match(team, season, hoursFromNow(72));

        mockMvc.perform(get(LIST, link.getId()).with(as(parent)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.recent.length()").value(10))
                .andExpect(jsonPath("$.recentTotal").value(12))
                .andExpect(jsonPath("$.upcomingTotal").value(2));
        mockMvc.perform(get(LIST, link.getId()).param("recentLimit", "25").with(as(parent)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.recent.length()").value(12))
                .andExpect(jsonPath("$.recentTotal").value(12));
        mockMvc.perform(get(LIST, link.getId()).param("recentLimit", "0").with(as(parent)))
                .andExpect(status().isBadRequest());
        mockMvc.perform(get(LIST, link.getId()).param("recentLimit", "101").with(as(parent)))
                .andExpect(status().isBadRequest());
    }

    // ---- contract ----

    @Test
    void theResponsesCarryExactlyTheDocumentedKeys() throws Exception {
        Match m = match(team, season, hoursFromNow(-1));
        m.setStreamingUrl(YT);
        m.setScoringUrl("https://scores.example.com/m/1");
        matchRepository.save(m);

        String one = mockMvc.perform(get(ONE, link.getId(), m.getId()).with(as(parent)))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        JsonNode node = objectMapper.readTree(one);
        assertThat(keys(node)).containsExactlyInAnyOrder(
                "matchId", "date", "time", "startedAt", "phase", "status", "league", "season", "venue", "playingAreaId",
                "playingAreaName", "playingAreaLatitude", "playingAreaLongitude", "playingAreaAccessLatitude",
                "playingAreaAccessLongitude", "playingAreaAccessNote", "home", "away", "selection", "availability",
                "liveScore", "stream", "result");
        assertThat(keys(node.get("home"))).containsExactlyInAnyOrder("name", "logoUrl", "mine", "announced", "players");
        assertThat(keys(node.get("stream"))).containsExactlyInAnyOrder("url", "provider", "embedUrl");
        assertThat(keys(node.get("liveScore"))).containsExactlyInAnyOrder("kind", "url", "host");

        String list = mockMvc.perform(get(LIST, link.getId()).with(as(parent)))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        JsonNode lists = objectMapper.readTree(list);
        assertThat(keys(lists)).containsExactlyInAnyOrder(
                "live", "upcoming", "recent", "upcomingTotal", "recentTotal");
        assertThat(keys(lists.get("live").get(0))).containsExactlyInAnyOrder(
                "matchId", "phase", "date", "time", "startedAt", "home", "away", "league", "venue", "mine", "selection",
                "hasLiveScore", "hasStream", "result", "outcome", "availability");
    }

    private static Set<String> keys(JsonNode node) {
        Set<String> out = new TreeSet<>();
        node.fieldNames().forEachRemaining(out::add);
        return out;
    }
}
