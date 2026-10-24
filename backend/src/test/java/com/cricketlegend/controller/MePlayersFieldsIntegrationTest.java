package com.cricketlegend.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.cricketlegend.AbstractIntegrationTest;
import com.cricketlegend.AbstractLinkIntegrationTest;
import com.cricketlegend.domain.Address;
import com.cricketlegend.domain.Club;
import com.cricketlegend.domain.ClubPlayingArea;
import com.cricketlegend.domain.Match;
import com.cricketlegend.domain.Person;
import com.cricketlegend.domain.PersonLink;
import com.cricketlegend.domain.PersonStatus;
import com.cricketlegend.domain.PlayerProfile;
import com.cricketlegend.domain.PlayingArea;
import com.cricketlegend.domain.PlayingAreaCategory;
import com.cricketlegend.domain.PlayingAreaOwnerType;
import com.cricketlegend.domain.PlayingAreaType;
import com.cricketlegend.domain.PlayingAreaVerificationStatus;
import com.cricketlegend.domain.Season;
import com.cricketlegend.domain.Team;
import com.cricketlegend.repository.ClubPlayingAreaRepository;
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
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.web.servlet.MockMvc;

/**
 * docs/specs/121, Integration: the Field Directory ({@code GET /api/v1/me/players/{playerKey}/fields}). Deliberately NOT
 * transactional (the {@code open-in-view=false} trap in docs/standards/backend.md): rows are committed with unique names
 * and left behind, as the other committed link tests do.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(AbstractIntegrationTest.class)
class MePlayersFieldsIntegrationTest extends AbstractLinkIntegrationTest {

    private static final Set<String> KEYS = Set.of("id", "name", "owner", "addressLine1", "city", "provinceState",
            "postalCode", "country", "mapUrl", "verified", "home");

    @Autowired private MockMvc mockMvc;
    @Autowired private PlayingAreaRepository playingAreaRepository;
    @Autowired private ClubPlayingAreaRepository clubPlayingAreaRepository;

    /** A club with a current season, a parent and one linked child. */
    private record Setup(Club club, Season season, Person parent, PersonLink link, Team team) {}

    private Setup setup() {
        Club club = club("Hillcrest");
        Season season = seasonRepository.save(Season.builder().clubId(club.getId()).label(unique("S"))
                .startDate(LocalDate.now().minusDays(30)).endDate(LocalDate.now().plusDays(30)).active(true).build());
        Team team = teamRepository.save(Team.builder().clubId(club.getId()).sectionId(section(club, "U13").getId())
                .name("U13 Colts").active(true).build());
        Person parent = account("Pat", "Parent");
        Person kid = playerPerson("Sam", "Smith", CHILD_DOB);
        profile(club, kid, null);
        return new Setup(club, season, parent, link(parent, kid, club, true), team);
    }

    private PlayingArea field(String name, PlayingAreaVerificationStatus status) {
        return playingAreaRepository.save(PlayingArea.builder().areaType(PlayingAreaType.CRICKET_FIELD)
                .name(unique(name)).category(PlayingAreaCategory.CLUB).ownerType(PlayingAreaOwnerType.CLUB)
                .ownerName("Owner").address(Address.builder().number("1").street("High St").city(unique("City"))
                        .provinceState("WC").postalCode("8000").country("ZA").build())
                .mapUrl("https://maps.example.com/" + name).verificationStatus(status)
                .createdByClubId(club("Creator").getId()).locationNotes("Gate code 1234").build());
    }

    private PlayingArea field(String name) {
        return field(name, PlayingAreaVerificationStatus.VERIFIED);
    }

    private void home(Club club, PlayingArea area) {
        clubPlayingAreaRepository.save(ClubPlayingArea.builder().clubId(club.getId()).playingAreaId(area.getId()).home(true).build());
    }

    private Match match(Setup s, Season season, PlayingArea area, String venue, boolean active) {
        return matchRepository.save(Match.builder().clubId(s.club().getId()).homeTeamId(s.team().getId())
                .awayTeamName("Visitors").seasonId(season.getId()).matchDate(Instant.now().plus(3, ChronoUnit.DAYS))
                .venue(venue).playingAreaId(area == null ? null : area.getId()).active(active).build());
    }

    private String body(Setup s, String key) throws Exception {
        return mockMvc.perform(get("/api/v1/me/players/{k}/fields", key).with(as(s.parent())))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
    }

    private List<String> ids(String json) {
        return JsonPath.read(json, "$[*].id");
    }

    @Test
    void returnsHomeThenAwayFieldsAndAFreeTextVenueAddsNothing() throws Exception {
        Setup s = setup();
        PlayingArea homeField = field("Home");
        PlayingArea awayField = field("Away");
        PlayingArea both = field("Both");
        home(s.club(), homeField);
        home(s.club(), both);
        match(s, s.season(), awayField, "Away ground", true);
        match(s, s.season(), both, "Both ground", true);
        match(s, s.season(), null, "Only free text venue", true);

        String json = body(s, s.link().getId().toString());

        List<String> ids = ids(json);
        assertThat(ids).hasSize(3).containsExactlyInAnyOrder(
                homeField.getId().toString(), awayField.getId().toString(), both.getId().toString());
        assertThat(ids.get(2)).isEqualTo(awayField.getId().toString());
        assertThat((List<Boolean>) JsonPath.read(json, "$[*].home")).containsExactly(true, true, false);
        assertThat((List<Boolean>) JsonPath.read(json, "$[?(@.id=='" + both.getId() + "')].home")).containsExactly(true);
        assertThat((String) JsonPath.read(json, "$[2].addressLine1")).isEqualTo("1 High St");
    }

    @Test
    void aFieldOnlyUsedInAnotherSeasonOrByADeactivatedMatchIsNotReturned() throws Exception {
        Setup s = setup();
        Season old = seasonRepository.save(Season.builder().clubId(s.club().getId()).label(unique("Old"))
                .startDate(LocalDate.now().minusDays(500)).endDate(LocalDate.now().minusDays(400)).active(true).build());
        PlayingArea oldField = field("OldSeason");
        PlayingArea inactiveField = field("Inactive");
        PlayingArea current = field("Current");
        match(s, old, oldField, null, true);
        match(s, s.season(), inactiveField, null, false);
        match(s, s.season(), current, null, true);

        assertThat(ids(body(s, s.link().getId().toString()))).containsExactly(current.getId().toString());
    }

    @Test
    void aMergedFieldResolvesToTheTargetAndRejectedIsExcludedAndUnverifiedIsFlagged() throws Exception {
        Setup s = setup();
        PlayingArea target = field("Target");
        PlayingArea source = field("Source");
        source.setMergedIntoId(target.getId());
        playingAreaRepository.save(source);
        PlayingArea rejected = field("Rejected", PlayingAreaVerificationStatus.REJECTED);
        PlayingArea unverified = field("Unverified", PlayingAreaVerificationStatus.UNVERIFIED);
        match(s, s.season(), source, null, true);
        match(s, s.season(), rejected, null, true);
        match(s, s.season(), unverified, null, true);

        String json = body(s, s.link().getId().toString());

        assertThat(ids(json)).containsExactlyInAnyOrder(target.getId().toString(), unverified.getId().toString());
        assertThat((List<Boolean>) JsonPath.read(json, "$[?(@.id=='" + unverified.getId() + "')].verified")).containsExactly(false);
        assertThat((List<Boolean>) JsonPath.read(json, "$[?(@.id=='" + target.getId() + "')].verified")).containsExactly(true);
    }

    @Test
    void aBlankOwnerIsNullInTheResponse() throws Exception {
        Setup s = setup();
        PlayingArea blank = field("Blank");
        blank.setOwnerName(" ");
        playingAreaRepository.save(blank);
        home(s.club(), blank);

        mockMvc.perform(get("/api/v1/me/players/{k}/fields", s.link().getId()).with(as(s.parent())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].owner").doesNotExist());
    }

    @Test
    void theResponseHasExactlyTheDocumentedKeysAndNoManagerOnlyData() throws Exception {
        Setup s = setup();
        PlayingArea f = field("Keys");
        home(s.club(), f);

        String json = body(s, s.link().getId().toString());

        Map<String, Object> row = JsonPath.read(json, "$[0]");
        assertThat(row.keySet()).isSubsetOf(KEYS).contains("id", "name", "city", "country", "verified", "home");
        for (String banned : List.of("verificationStatus", "verifiedBy", "verifiedAt", "rejectionReason", "createdByClubId",
                "groundId", "areaType", "mergedIntoId", "matchCount", "linkedClubs", "locationNotes", "category", "ownerType",
                "Gate code")) {
            assertThat(json).doesNotContain(banned);
        }
    }

    @Test
    void anAccountWithPlayersAtTwoClubsGetsEachClubsFieldsOnly() throws Exception {
        Setup a = setup();
        Setup b = setup();
        Person parent = a.parent();
        Person kidAtB = playerPerson("Bea", "Brown", CHILD_DOB);
        profile(b.club(), kidAtB, null);
        PersonLink linkB = link(parent, kidAtB, b.club(), true);
        PlayingArea fieldA = field("ClubA");
        PlayingArea fieldB = field("ClubB");
        PlayingArea awayB = field("AwayB");
        PlayingArea foreign = field("ForeignHome");
        home(a.club(), fieldA);
        home(b.club(), fieldB);
        match(b, b.season(), awayB, null, true);
        match(a, a.season(), foreign, null, true);

        List<String> forA = ids(mockMvc.perform(get("/api/v1/me/players/{k}/fields", a.link().getId()).with(as(parent)))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
        List<String> forB = ids(mockMvc.perform(get("/api/v1/me/players/{k}/fields", linkB.getId()).with(as(parent)))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());

        assertThat(forA).containsExactlyInAnyOrder(fieldA.getId().toString(), foreign.getId().toString());
        assertThat(forB).containsExactlyInAnyOrder(fieldB.getId().toString(), awayB.getId().toString());
    }

    @Test
    void theOwnVerifiedRecordKeyWorks() throws Exception {
        Setup s = setup();
        Person me = account("Adult", "Player");
        PlayerProfile own = profile(s.club(), me, null);
        PlayingArea f = field("Own");
        home(s.club(), f);

        mockMvc.perform(get("/api/v1/me/players/{k}/fields", "self:" + own.getId()).with(as(me)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(f.getId().toString()));
    }

    @Test
    void aKeyTheCallerDoesNotHoldIsNotFound() throws Exception {
        Setup s = setup();
        Setup other = setup();
        Person stranger = account("Some", "Stranger");

        // another account's valid key, a malformed key and a random uuid
        mockMvc.perform(get("/api/v1/me/players/{k}/fields", other.link().getId()).with(as(s.parent())))
                .andExpect(status().isNotFound());
        mockMvc.perform(get("/api/v1/me/players/{k}/fields", "not-a-key").with(as(s.parent())))
                .andExpect(status().isNotFound());
        mockMvc.perform(get("/api/v1/me/players/{k}/fields", UUID.randomUUID()).with(as(s.parent())))
                .andExpect(status().isNotFound());
        mockMvc.perform(get("/api/v1/me/players/{k}/fields", s.link().getId()).with(as(stranger)))
                .andExpect(status().isNotFound());
    }

    @Test
    void aManagerWithoutALinkToThePlayerIsNotFound() throws Exception {
        Setup s = setup();
        Person admin = clubAdmin(s.club());

        mockMvc.perform(get("/api/v1/me/players/{k}/fields", s.link().getId()).with(as(admin)))
                .andExpect(status().isNotFound());
    }

    @Test
    void aPlayerWhoDroppedOutIsNotFound() throws Exception {
        Setup s = setup();
        Person parent = s.parent();
        Person kid = playerPerson("Gone", "Away", CHILD_DOB);
        PlayerProfile profile = profile(s.club(), kid, null);
        PersonLink link = link(parent, kid, s.club(), true);
        mockMvc.perform(get("/api/v1/me/players/{k}/fields", link.getId()).with(as(parent))).andExpect(status().isOk());

        profile.setActive(false);
        playerProfileRepository.save(profile);

        mockMvc.perform(get("/api/v1/me/players/{k}/fields", link.getId()).with(as(parent)))
                .andExpect(status().isNotFound());
    }

    @Test
    void unauthenticatedIsUnauthorisedAndASuspendedCallerIsForbidden() throws Exception {
        Setup s = setup();
        mockMvc.perform(get("/api/v1/me/players/{k}/fields", s.link().getId())).andExpect(status().isUnauthorized());

        Person parent = personRepository.findById(s.parent().getId()).orElseThrow();
        parent.setStatus(PersonStatus.SUSPENDED);
        personRepository.save(parent);

        mockMvc.perform(get("/api/v1/me/players/{k}/fields", s.link().getId()).with(as(parent)))
                .andExpect(status().isForbidden());
    }

    @Test
    void aClubWithNoFieldsGetsAnEmptyList() throws Exception {
        Setup s = setup();
        assertThat(new ArrayList<>(ids(body(s, s.link().getId().toString())))).isEmpty();
    }
}
