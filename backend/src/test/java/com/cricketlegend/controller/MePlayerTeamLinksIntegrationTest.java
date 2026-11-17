package com.cricketlegend.controller;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.cricketlegend.AbstractIntegrationTest;
import com.cricketlegend.domain.Club;
import com.cricketlegend.domain.Season;
import com.cricketlegend.domain.SocialLink;
import com.cricketlegend.domain.Team;
import com.cricketlegend.domain.TeamSquadMember;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;

/**
 * docs/specs/157-photo-gallery.md (Hub Social Media): the social links of the teams a held player is in
 * ({@code /api/v1/me/players/{playerKey}/team-links}): only active-season teams that have an https link, the club's Links
 * switch, and the held-player boundary.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(AbstractIntegrationTest.class)
class MePlayerTeamLinksIntegrationTest extends AbstractClubInfoIntegrationTest {

    private final List<UUID> clubs = new ArrayList<>();

    @AfterEach
    void clean() {
        for (UUID id : clubs) {
            jdbc.update("delete from team_squad_member where team_id in (select id from team where club_id = ?)", id);
            jdbc.update("delete from team_social_link where team_id in (select id from team where club_id = ?)", id);
            jdbc.update("delete from team where club_id = ?", id);
            jdbc.update("delete from season where club_id = ?", id);
        }
        clubs.clear();
    }

    private Club club() {
        Club club = clubWithProfile();
        clubs.add(club.getId());
        return club;
    }

    private Season season(Club club, boolean active) {
        return seasonRepository.save(Season.builder().clubId(club.getId()).label(unique("S")).startDate(LocalDate.of(2026, 1, 1))
                .endDate(LocalDate.of(2026, 12, 31)).active(active).build());
    }

    private Team team(Club club, String name, boolean active, SocialLink... links) {
        Team saved = teamRepository.save(Team.builder().clubId(club.getId()).sectionId(section(club, unique("Sec")).getId()).name(name)
                .active(active).socialLinks(new ArrayList<>(List.of(links))).build());
        return saved;
    }

    private void squad(Team team, Season season, UUID profileId) {
        squadMemberRepository.save(TeamSquadMember.builder().teamId(team.getId()).seasonId(season.getId()).playerProfileId(profileId).build());
    }

    private static SocialLink link(String platform, String url) {
        return SocialLink.builder().platform(platform).url(url).build();
    }

    @Test
    void listsTheLinksOfTheTeamsThePlayerIsInSortedByTeamNameWithOnlyHttpsLinks() throws Exception {
        Club club = club();
        Own me = adultSelf(club);
        Season active = season(club, true);
        squad(team(club, "Zebras", true, link("facebook", "https://facebook.com/zebras")), active, me.profile().getId());
        squad(team(club, "Aces", true, link("instagram", "https://instagram.com/aces"), link("x", "http://insecure.example/aces")), active, me.profile().getId());

        mockMvc.perform(get("/api/v1/me/players/{k}/team-links", me.key()).with(as(me.person())))
                .andExpect(status().isOk())
                .andExpect(header().string("Cache-Control", org.hamcrest.Matchers.containsString("no-store")))
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].teamName").value("Aces"))
                .andExpect(jsonPath("$[0].social.length()").value(1))
                .andExpect(jsonPath("$[0].social[0].url").value("https://instagram.com/aces"))
                .andExpect(jsonPath("$[1].teamName").value("Zebras"));
    }

    @Test
    void leavesOutATeamWithNoLinksAnInactiveTeamAnOldSeasonAndATeamThePlayerIsNotIn() throws Exception {
        Club club = club();
        Own me = adultSelf(club);
        Own other = adultSelf(club);
        Season active = season(club, true);
        Season old = season(club, false);
        squad(team(club, "No Links", true), active, me.profile().getId());
        squad(team(club, "Inactive", false, link("facebook", "https://facebook.com/inactive")), active, me.profile().getId());
        squad(team(club, "Last Year", true, link("facebook", "https://facebook.com/lastyear")), old, me.profile().getId());
        squad(team(club, "Not Mine", true, link("facebook", "https://facebook.com/notmine")), active, other.profile().getId());

        mockMvc.perform(get("/api/v1/me/players/{k}/team-links", me.key()).with(as(me.person())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(0));
    }

    @Test
    void isEmptyWhenTheClubSwitchedItsHubLinksOff() throws Exception {
        Club club = club();
        Own me = adultSelf(club);
        squad(team(club, "Aces", true, link("facebook", "https://facebook.com/aces")), season(club, true), me.profile().getId());
        setSwitch(club, "hub_info_links", false);

        mockMvc.perform(get("/api/v1/me/players/{k}/team-links", me.key()).with(as(me.person())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(0));
    }

    @Test
    void aKeyTheCallerDoesNotHoldIsNotFound() throws Exception {
        Club club = club();
        Own me = adultSelf(club);
        Own stranger = adultSelf(club);
        mockMvc.perform(get("/api/v1/me/players/{k}/team-links", me.key()).with(as(stranger.person()))).andExpect(status().isNotFound());
    }
}
