package com.cricketlegend.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.containsInAnyOrder;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.not;
import static org.hamcrest.Matchers.hasItem;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.cricketlegend.domain.Club;
import com.cricketlegend.domain.PlayingArea;
import com.cricketlegend.domain.PlayingAreaCategory;
import com.cricketlegend.domain.PlayingAreaVerificationStatus;
import com.cricketlegend.support.AbstractPlayingAreaIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.JwtRequestPostProcessor;

/**
 * HTTP + Postgres integration test of the club-scoped Fields directory
 * ({@code /api/v1/manage/clubs/{clubId}/playing-areas}, docs/specs/099-fields-directory.md): search, filters, paging,
 * home-first ordering, exclusion of rejected and merged rows, summary, filter-options, similar, create / edit rules and
 * club isolation. Not {@code @Transactional}: see {@link AbstractPlayingAreaIntegrationTest}.
 */
class PlayingAreaControllerIntegrationTest extends AbstractPlayingAreaIntegrationTest {

    private static final String BASE = "/api/v1/manage/clubs/{clubId}/playing-areas";

    private static final PlayingAreaVerificationStatus UNVERIFIED = PlayingAreaVerificationStatus.UNVERIFIED;
    private static final PlayingAreaVerificationStatus VERIFIED = PlayingAreaVerificationStatus.VERIFIED;
    private static final PlayingAreaVerificationStatus REJECTED = PlayingAreaVerificationStatus.REJECTED;

    // ---- search ----------------------------------------------------------------------------------------------

    @Test
    void searchMatchesNameOrCityIgnoringCase() throws Exception {
        Club club = club("Riverside CC");
        JwtRequestPostProcessor admin = clubAdmin("sub-1", club.getId());
        area("Centurion Oval", "Pretoria", "ZA", VERIFIED);
        area("Newlands", "Cape Town", "ZA", VERIFIED);
        area("Village Green", "Centurion", "ZA", VERIFIED);

        mockMvc.perform(get(BASE, club.getId()).param("q", "CENTURION").with(admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[*].name", containsInAnyOrder("Centurion Oval", "Village Green")));
    }

    @Test
    void searchEscapesLikeWildcards() throws Exception {
        Club club = club("Riverside CC");
        JwtRequestPostProcessor admin = clubAdmin("sub-1", club.getId());
        area("Centurion Oval", "Pretoria", "ZA", VERIFIED);

        mockMvc.perform(get(BASE, club.getId()).param("q", "%").with(admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content", hasSize(0)));
    }

    @Test
    void filtersByCategoryCountryProvinceCityAndVerification() throws Exception {
        Club club = club("Riverside CC");
        JwtRequestPostProcessor admin = clubAdmin("sub-1", club.getId());
        area("School Ground", "Pretoria", "ZA", "Gauteng", PlayingAreaCategory.SCHOOL, VERIFIED, null);
        area("Council Park", "Durban", "ZA", "KwaZulu-Natal", PlayingAreaCategory.MUNICIPAL, UNVERIFIED, null);
        area("Lords Annex", "London", "GB", "Greater London", PlayingAreaCategory.CLUB, VERIFIED, null);

        mockMvc.perform(get(BASE, club.getId())
                        .param("category", "SCHOOL", "MUNICIPAL").with(admin))
                .andExpect(jsonPath("$.content[*].name", containsInAnyOrder("School Ground", "Council Park")));
        mockMvc.perform(get(BASE, club.getId()).param("country", "gb").with(admin))
                .andExpect(jsonPath("$.content[*].name", contains("Lords Annex")));
        mockMvc.perform(get(BASE, club.getId()).param("province", "kwazulu-natal").with(admin))
                .andExpect(jsonPath("$.content[*].name", contains("Council Park")));
        mockMvc.perform(get(BASE, club.getId()).param("city", "pretoria").with(admin))
                .andExpect(jsonPath("$.content[*].name", contains("School Ground")));
        mockMvc.perform(get(BASE, club.getId()).param("verification", "UNVERIFIED").with(admin))
                .andExpect(jsonPath("$.content[*].name", contains("Council Park")));
    }

    @Test
    void mineReturnsOnlyTheCallersHomeFields() throws Exception {
        Club club = club("Riverside CC");
        Club other = club("Lakeside CC");
        JwtRequestPostProcessor admin = clubAdmin("sub-1", club.getId());
        PlayingArea mine = area("Mine", "Pretoria", "ZA", VERIFIED);
        PlayingArea theirs = area("Theirs", "Pretoria", "ZA", VERIFIED);
        area("Nobody", "Pretoria", "ZA", VERIFIED);
        home(club.getId(), mine.getId());
        home(other.getId(), theirs.getId());

        mockMvc.perform(get(BASE, club.getId()).param("mine", "true").with(admin))
                .andExpect(jsonPath("$.content[*].name", contains("Mine")))
                .andExpect(jsonPath("$.content[0].linkedHome").value(true));
    }

    @Test
    void rejectedAndMergedAwayFieldsNeverAppearInTheListOrCounters() throws Exception {
        Club club = club("Riverside CC");
        JwtRequestPostProcessor admin = clubAdmin("sub-1", club.getId());
        PlayingArea shown = area("Shown", "Pretoria", "ZA", VERIFIED);
        area("Rejected", "Pretoria", "ZA", REJECTED);
        PlayingArea merged = area("Merged", "Pretoria", "ZA", UNVERIFIED);
        merged.setMergedIntoId(shown.getId());
        playingAreaRepository.save(merged);

        mockMvc.perform(get(BASE, club.getId()).with(admin))
                .andExpect(jsonPath("$.content[*].name", contains("Shown")))
                .andExpect(jsonPath("$.totalElements").value(1));
        mockMvc.perform(get(BASE + "/summary", club.getId()).with(admin))
                .andExpect(jsonPath("$.inDirectory").value(1))
                .andExpect(jsonPath("$.unverified").value(0));
    }

    @Test
    void rejectedIsNotAValidVerificationFilter() throws Exception {
        Club club = club("Riverside CC");

        mockMvc.perform(get(BASE, club.getId()).param("verification", "REJECTED").with(clubAdmin("sub-1", club.getId())))
                .andExpect(status().isBadRequest());
    }

    // ---- paging and ordering -----------------------------------------------------------------------------------

    @Test
    void pagesWithARealLimitAndOffsetAndReportsTheTrueTotal() throws Exception {
        Club club = club("Riverside CC");
        JwtRequestPostProcessor admin = clubAdmin("sub-1", club.getId());
        for (String name : new String[] {"A", "B", "C", "D", "E"}) {
            area(name + " Oval", "Pretoria", "ZA", VERIFIED);
        }

        mockMvc.perform(get(BASE, club.getId()).param("size", "2").param("page", "1").with(admin))
                .andExpect(jsonPath("$.content[*].name", contains("C Oval", "D Oval")))
                .andExpect(jsonPath("$.totalElements").value(5))
                .andExpect(jsonPath("$.totalPages").value(3));
        mockMvc.perform(get(BASE, club.getId()).param("size", "2").param("page", "2").with(admin))
                .andExpect(jsonPath("$.content", hasSize(1)));
    }

    @Test
    void homeFieldsComeFirstThenNameAndNameCanBeDescending() throws Exception {
        Club club = club("Riverside CC");
        JwtRequestPostProcessor admin = clubAdmin("sub-1", club.getId());
        area("Alpha", "Pretoria", "ZA", VERIFIED);
        PlayingArea zulu = area("Zulu", "Pretoria", "ZA", VERIFIED);
        PlayingArea yankee = area("Yankee", "Pretoria", "ZA", VERIFIED);
        area("Bravo", "Pretoria", "ZA", VERIFIED);
        home(club.getId(), zulu.getId());
        home(club.getId(), yankee.getId());

        mockMvc.perform(get(BASE, club.getId()).with(admin))
                .andExpect(jsonPath("$.content[*].name", contains("Yankee", "Zulu", "Alpha", "Bravo")));
        mockMvc.perform(get(BASE, club.getId()).param("sort", "name,desc").with(admin))
                .andExpect(jsonPath("$.content[*].name", contains("Zulu", "Yankee", "Bravo", "Alpha")));
    }

    // ---- summary, filter options, similar -----------------------------------------------------------------------

    @Test
    void filterOptionsAreDistinctCaseInsensitiveSortedAndExcludeRejectedAndMergedRows() throws Exception {
        Club club = club("Riverside CC");
        JwtRequestPostProcessor admin = clubAdmin("sub-1", club.getId());
        area("One", "Pretoria", "ZA", "gauteng", PlayingAreaCategory.CLUB, VERIFIED, null);
        area("Two", "pretoria", "ZA", "Gauteng", PlayingAreaCategory.CLUB, VERIFIED, null);
        area("Three", "Cape Town", "ZA", "Western Cape", PlayingAreaCategory.CLUB, UNVERIFIED, null);
        area("Four", "Durban", "ZA", "KwaZulu-Natal", PlayingAreaCategory.CLUB, REJECTED, null);
        PlayingArea merged = area("Five", "Soweto", "ZA", "Gauteng", PlayingAreaCategory.CLUB, VERIFIED, null);
        PlayingArea survivor = area("Six", "Cape Town", "ZA", "Western Cape", PlayingAreaCategory.CLUB, VERIFIED, null);
        jdbc.update("update playing_area set merged_into_id = ? where id = ?", survivor.getId(), merged.getId());

        mockMvc.perform(get(BASE + "/filter-options", club.getId()).param("province", "GAUTENG").with(admin))
                .andExpect(jsonPath("$.countries", contains("ZA")))
                .andExpect(jsonPath("$.provinces", hasSize(2)))
                .andExpect(jsonPath("$.provinces[1]").value("Western Cape"))
                .andExpect(jsonPath("$.cities", hasSize(1)))
                .andExpect(jsonPath("$.cities[0]").value(org.hamcrest.Matchers.equalToIgnoringCase("pretoria")));
    }

    @Test
    void usedByClubReturnsFieldsLinkedHomeOrUsedOnAnyOfTheClubsMatchesOnly() throws Exception {
        Club club = club("Riverside CC");
        Club other = club("Lakeside CC");
        JwtRequestPostProcessor admin = clubAdmin("sub-1", club.getId());
        PlayingArea linked = area("Linked", "Pretoria", "ZA", VERIFIED);
        PlayingArea played = area("Played", "Pretoria", "ZA", VERIFIED);
        PlayingArea both = area("Both", "Pretoria", "ZA", VERIFIED);
        PlayingArea rejectedUsed = area("Rejected used", "Pretoria", "ZA", REJECTED);
        PlayingArea otherClubsOnly = area("Other club only", "Pretoria", "ZA", VERIFIED);
        area("Nobody", "Pretoria", "ZA", VERIFIED);
        home(club.getId(), linked.getId());
        home(club.getId(), both.getId());
        home(other.getId(), otherClubsOnly.getId());
        match(club.getId(), season(club.getId()).getId(), played.getId(), "Played");
        match(club.getId(), season(club.getId()).getId(), both.getId(), "Both");
        match(club.getId(), season(club.getId()).getId(), rejectedUsed.getId(), "Rejected used");
        match(other.getId(), season(other.getId()).getId(), otherClubsOnly.getId(), "Other");

        mockMvc.perform(get(BASE, club.getId()).param("usedByClub", "true").with(admin))
                .andExpect(jsonPath("$.totalElements").value(3))
                .andExpect(jsonPath("$.content[*].name", contains("Both", "Linked", "Played")));
        mockMvc.perform(get(BASE, club.getId()).with(admin))
                .andExpect(jsonPath("$.totalElements").value(5));
        mockMvc.perform(get(BASE + "/summary", club.getId()).param("usedByClub", "true").with(admin))
                .andExpect(jsonPath("$.inDirectory").value(5));
    }

    @Test
    void summaryCountsOurFieldsDirectoryAndUnverified() throws Exception {
        Club club = club("Riverside CC");
        JwtRequestPostProcessor admin = clubAdmin("sub-1", club.getId());
        PlayingArea mine = area("Mine", "Pretoria", "ZA", UNVERIFIED);
        area("Other", "Pretoria", "ZA", VERIFIED);
        home(club.getId(), mine.getId());

        mockMvc.perform(get(BASE + "/summary", club.getId()).with(admin))
                .andExpect(jsonPath("$.ourFields").value(1))
                .andExpect(jsonPath("$.inDirectory").value(2))
                .andExpect(jsonPath("$.unverified").value(1));
    }

    @Test
    void filterOptionsIgnoreTheirOwnPickAndUppercaseCountries() throws Exception {
        Club club = club("Riverside CC");
        JwtRequestPostProcessor admin = clubAdmin("sub-1", club.getId());
        area("One", "Pretoria", "ZA", "Gauteng", PlayingAreaCategory.CLUB, VERIFIED, null);
        area("Two", "Cape Town", "ZA", "Western Cape", PlayingAreaCategory.CLUB, VERIFIED, null);
        area("Three", "London", "GB", "Greater London", PlayingAreaCategory.CLUB, VERIFIED, null);
        area("Gone", "Paris", "FR", "IDF", PlayingAreaCategory.CLUB, REJECTED, null);

        mockMvc.perform(get(BASE + "/filter-options", club.getId()).param("country", "za").with(admin))
                .andExpect(jsonPath("$.countries", contains("GB", "ZA")))
                .andExpect(jsonPath("$.provinces", contains("Gauteng", "Western Cape")))
                .andExpect(jsonPath("$.cities", contains("Cape Town", "Pretoria")));
    }

    @Test
    void similarReturnsNearNamesInTheSameCountryOnly() throws Exception {
        Club club = club("Riverside CC");
        JwtRequestPostProcessor admin = clubAdmin("sub-1", club.getId());
        area("Centurion Oval Ground", "Pretoria", "ZA", VERIFIED);
        area("Centurion Oval", "London", "GB", VERIFIED);
        area("Centurion Oval Annexe", "Pretoria", "ZA", REJECTED);
        area("Newlands", "Cape Town", "ZA", VERIFIED);

        mockMvc.perform(get(BASE + "/similar", club.getId())
                        .param("name", "Centurion  Oval!").param("city", "Pretoria").param("country", "ZA").with(admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[*].name", contains("Centurion Oval Ground")));
        mockMvc.perform(get(BASE + "/similar", club.getId()).param("name", "Centurion").with(admin))
                .andExpect(jsonPath("$", hasSize(0)));
    }

    @Test
    void similarPutsSameCityMatchesFirstIgnoringCaseThenKeepsTheExistingOrderAndCapsAtFive() throws Exception {
        Club club = club("Riverside CC");
        JwtRequestPostProcessor admin = clubAdmin("sub-1", club.getId());
        area("Oval A", "Cape Town", "ZA", VERIFIED);
        area("Oval B", "Cape Town", "ZA", VERIFIED);
        area("Oval C", "pretoria", "ZA", VERIFIED);
        area("Oval Z", "PRETORIA", "ZA", VERIFIED);
        area("Oval D", "Durban", "ZA", VERIFIED);
        area("Oval E", "Durban", "ZA", VERIFIED);
        area("Oval F", "Durban", "ZA", VERIFIED);

        mockMvc.perform(get(BASE + "/similar", club.getId())
                        .param("name", "Oval").param("city", "Pretoria").param("country", "ZA").with(admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(5)))
                .andExpect(jsonPath("$[*].name", contains("Oval C", "Oval Z", "Oval A", "Oval B", "Oval D")));
    }

    // ---- create and edit ----------------------------------------------------------------------------------------

    @Test
    void createIsUnverifiedAndNeverLinkedToTheClubByDefault() throws Exception {
        Club club = club("Riverside CC");
        JwtRequestPostProcessor admin = clubAdmin("sub-1", club.getId());

        mockMvc.perform(post(BASE, club.getId()).with(admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(fieldBody("Council Park", null, "Durban", "ZA", "https://maps.example.com/x")))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.verificationStatus").value("UNVERIFIED"))
                .andExpect(jsonPath("$.areaType").value("CRICKET_FIELD"))
                .andExpect(jsonPath("$.category").value("MUNICIPAL"))
                .andExpect(jsonPath("$.linkedHome").value(false))
                .andExpect(jsonPath("$.createdByClubId").value(club.getId().toString()))
                .andExpect(jsonPath("$.createdByClubName").value("Riverside CC"));

        assertThat(clubPlayingAreaRepository.count()).isZero();
        mockMvc.perform(get(BASE + "/summary", club.getId()).with(admin))
                .andExpect(jsonPath("$.ourFields").value(0));
    }

    @Test
    void createWithLinkHomeTrueLinksTheClub() throws Exception {
        Club club = club("Riverside CC");
        JwtRequestPostProcessor admin = clubAdmin("sub-1", club.getId());

        mockMvc.perform(post(BASE, club.getId()).param("linkHome", "true").with(admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(fieldBody("Council Park", "1 Main Rd", "Durban", "ZA", null)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.linkedHome").value(true));

        assertThat(clubPlayingAreaRepository.count()).isEqualTo(1);
    }

    @Test
    void createRefusesAnExactDuplicateWith409AndTheExistingId() throws Exception {
        Club club = club("Riverside CC");
        JwtRequestPostProcessor admin = clubAdmin("sub-1", club.getId());
        PlayingArea existing = area("Council Park", "Durban", "ZA", VERIFIED);

        mockMvc.perform(post(BASE, club.getId()).with(admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(fieldBody("COUNCIL PARK", null, "durban", "ZA", null)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.existingPlayingAreaId").value(existing.getId().toString()));
        // The same name in another city is a different field.
        mockMvc.perform(post(BASE, club.getId()).with(admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(fieldBody("Council Park", null, "Cape Town", "ZA", null)))
                .andExpect(status().isCreated());
    }

    @Test
    void createValidatesAddressMapUrlAndCountry() throws Exception {
        Club club = club("Riverside CC");
        JwtRequestPostProcessor admin = clubAdmin("sub-1", club.getId());

        for (String badBody : new String[] {
            fieldBody("X", null, "Durban", "ZA", "javascript:alert(1)"),
            fieldBody("X", null, "Durban", "ZA", "http://insecure.example.com"),
            fieldBody("X", null, "Durban", "QQ", null),
            fieldBody("X", null, " ", "ZA", null),
            """
            {"name": "X", "category": "CLUB", "ownerType": "CLUB", "ownerName": "O", "address": {"city": "Durban"}}
            """,
        }) {
            mockMvc.perform(post(BASE, club.getId()).with(admin)
                            .contentType(MediaType.APPLICATION_JSON).content(badBody))
                    .andExpect(status().isBadRequest());
        }
        assertThat(playingAreaRepository.count()).isZero();
    }

    @Test
    void getReturnsTheDetailWithCreatorNameAndMatchCount() throws Exception {
        Club club = club("Riverside CC");
        JwtRequestPostProcessor admin = clubAdmin("sub-1", club.getId());
        PlayingArea field = area("Oval", "Pretoria", "ZA", null, PlayingAreaCategory.CLUB, VERIFIED, club.getId());
        match(club.getId(), season(club.getId()).getId(), field.getId(), "Oval");

        mockMvc.perform(get(BASE + "/{id}", club.getId(), field.getId()).with(admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.createdByClubName").value("Riverside CC"))
                .andExpect(jsonPath("$.matchCount").value(1));
    }

    @Test
    void getOfAMergedAwayIdReturnsTheSurvivor() throws Exception {
        Club club = club("Riverside CC");
        JwtRequestPostProcessor admin = clubAdmin("sub-1", club.getId());
        PlayingArea survivor = area("Survivor", "Pretoria", "ZA", VERIFIED);
        PlayingArea merged = area("Merged", "Pretoria", "ZA", UNVERIFIED);
        merged.setMergedIntoId(survivor.getId());
        playingAreaRepository.save(merged);

        mockMvc.perform(get(BASE + "/{id}", club.getId(), merged.getId()).with(admin))
                .andExpect(jsonPath("$.id").value(survivor.getId().toString()));
    }

    @Test
    void creatorEditsItsUnverifiedFieldButNotAVerifiedOneNorAnotherClubs() throws Exception {
        Club club = club("Riverside CC");
        Club other = club("Lakeside CC");
        JwtRequestPostProcessor admin = clubAdmin("sub-1", club.getId());
        JwtRequestPostProcessor otherAdmin = clubAdmin("sub-2", other.getId());
        PlayingArea mine = area("Mine", "Pretoria", "ZA", null, PlayingAreaCategory.CLUB, UNVERIFIED, club.getId());
        PlayingArea verified = area("Locked", "Pretoria", "ZA", null, PlayingAreaCategory.CLUB, VERIFIED, club.getId());

        mockMvc.perform(put(BASE + "/{id}", club.getId(), mine.getId()).with(admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(fieldBody("Mine Renamed", null, "Pretoria", "ZA", null)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Mine Renamed"));
        // Another club's manager, acting for their own club, cannot edit a field they did not capture.
        mockMvc.perform(put(BASE + "/{id}", other.getId(), mine.getId()).with(otherAdmin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(fieldBody("Hijacked", null, "Pretoria", "ZA", null)))
                .andExpect(status().isConflict());
        // The creator cannot edit once verified.
        mockMvc.perform(put(BASE + "/{id}", club.getId(), verified.getId()).with(admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(fieldBody("Changed", null, "Pretoria", "ZA", null)))
                .andExpect(status().isConflict());

        assertThat(playingAreaRepository.findById(verified.getId()).orElseThrow().getName()).isEqualTo("Locked");
        assertThat(playingAreaRepository.findById(mine.getId()).orElseThrow().getName()).isEqualTo("Mine Renamed");
    }

    // ---- home links ---------------------------------------------------------------------------------------------

    @Test
    void linkAndUnlinkHomeAreIdempotentAndSeveralClubsCanShareAField() throws Exception {
        Club club = club("Riverside CC");
        Club other = club("Lakeside CC");
        JwtRequestPostProcessor admin = clubAdmin("sub-1", club.getId());
        JwtRequestPostProcessor otherAdmin = clubAdmin("sub-2", other.getId());
        PlayingArea field = area("Shared", "Pretoria", "ZA", VERIFIED);

        for (int i = 0; i < 2; i++) {
            mockMvc.perform(put(BASE + "/{id}/home", club.getId(), field.getId()).with(admin))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.linkedHome").value(true));
        }
        mockMvc.perform(put(BASE + "/{id}/home", other.getId(), field.getId()).with(otherAdmin))
                .andExpect(status().isOk());
        assertThat(clubPlayingAreaRepository.findByPlayingAreaId(field.getId())).hasSize(2);

        mockMvc.perform(delete(BASE + "/{id}/home", club.getId(), field.getId()).with(admin))
                .andExpect(status().isNoContent());
        mockMvc.perform(delete(BASE + "/{id}/home", club.getId(), field.getId()).with(admin))
                .andExpect(status().isNoContent());
        assertThat(clubPlayingAreaRepository.findByPlayingAreaId(field.getId())).hasSize(1);
    }

    @Test
    void aRejectedFieldCannotBeLinked() throws Exception {
        Club club = club("Riverside CC");
        PlayingArea rejected = area("Bad", "Pretoria", "ZA", REJECTED);

        mockMvc.perform(put(BASE + "/{id}/home", club.getId(), rejected.getId()).with(clubAdmin("sub-1", club.getId())))
                .andExpect(status().isBadRequest());
        assertThat(clubPlayingAreaRepository.count()).isZero();
    }

    // ---- authorization ------------------------------------------------------------------------------------------

    @Test
    void clubXCannotReadLinkOrWriteThroughClubYsClubId() throws Exception {
        Club clubX = club("Riverside CC");
        Club clubY = club("Lakeside CC");
        JwtRequestPostProcessor adminX = clubAdmin("sub-1", clubX.getId());
        PlayingArea field = area("Oval", "Pretoria", "ZA", null, PlayingAreaCategory.CLUB, UNVERIFIED, clubY.getId());

        mockMvc.perform(get(BASE, clubY.getId()).with(adminX)).andExpect(status().isForbidden());
        mockMvc.perform(get(BASE + "/summary", clubY.getId()).with(adminX)).andExpect(status().isForbidden());
        mockMvc.perform(get(BASE + "/filter-options", clubY.getId()).with(adminX)).andExpect(status().isForbidden());
        mockMvc.perform(get(BASE + "/similar", clubY.getId()).with(adminX)).andExpect(status().isForbidden());
        mockMvc.perform(get(BASE + "/{id}", clubY.getId(), field.getId()).with(adminX)).andExpect(status().isForbidden());
        mockMvc.perform(post(BASE, clubY.getId()).param("linkHome", "true").with(adminX)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(fieldBody("Sneaky", null, "Pretoria", "ZA", null)))
                .andExpect(status().isForbidden());
        mockMvc.perform(put(BASE + "/{id}", clubY.getId(), field.getId()).with(adminX)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(fieldBody("Sneaky", null, "Pretoria", "ZA", null)))
                .andExpect(status().isForbidden());
        mockMvc.perform(put(BASE + "/{id}/home", clubY.getId(), field.getId()).with(adminX))
                .andExpect(status().isForbidden());
        mockMvc.perform(delete(BASE + "/{id}/home", clubY.getId(), field.getId()).with(adminX))
                .andExpect(status().isForbidden());

        assertThat(clubPlayingAreaRepository.count()).isZero();
        assertThat(playingAreaRepository.count()).isEqualTo(1);
    }

    @Test
    void homeFlagsAndOurFieldsAreRelativeToTheCallingClub() throws Exception {
        Club clubX = club("Riverside CC");
        Club clubY = club("Lakeside CC");
        PlayingArea field = area("Oval", "Pretoria", "ZA", VERIFIED);
        home(clubY.getId(), field.getId());

        mockMvc.perform(get(BASE, clubX.getId()).with(clubAdmin("sub-1", clubX.getId())))
                .andExpect(jsonPath("$.content[0].linkedHome").value(false));
        mockMvc.perform(get(BASE + "/summary", clubX.getId()).with(clubAdmin("sub-1x", clubX.getId())))
                .andExpect(jsonPath("$.ourFields").value(0));
    }

    @Test
    void unauthenticatedGets401() throws Exception {
        Club club = club("Riverside CC");

        mockMvc.perform(get(BASE, club.getId())).andExpect(status().isUnauthorized());
        mockMvc.perform(post(BASE, club.getId()).contentType(MediaType.APPLICATION_JSON)
                        .content(fieldBody("X", null, "Durban", "ZA", null)))
                .andExpect(status().isUnauthorized());
    }
}
