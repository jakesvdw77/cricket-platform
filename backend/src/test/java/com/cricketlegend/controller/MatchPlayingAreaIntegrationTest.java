package com.cricketlegend.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.contains;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.cricketlegend.domain.Club;
import com.cricketlegend.domain.Match;
import com.cricketlegend.domain.PlayingArea;
import com.cricketlegend.domain.PlayingAreaCategory;
import com.cricketlegend.domain.PlayingAreaVerificationStatus;
import com.cricketlegend.domain.Season;
import com.cricketlegend.support.AbstractPlayingAreaIntegrationTest;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.JwtRequestPostProcessor;

/**
 * The Match side of docs/specs/099-fields-directory.md over real HTTP and Postgres: a chosen field writes the venue
 * text and wins over a conflicting {@code venue}, a rejected or unknown field is refused, a merged-away id resolves to
 * its survivor, clearing the field keeps the sent text, and {@code GET /matches?playingAreaId=} filters (club-scoped)
 * while list items carry the field's name and status.
 */
class MatchPlayingAreaIntegrationTest extends AbstractPlayingAreaIntegrationTest {

    private static final String MATCHES = "/api/v1/manage/clubs/{clubId}/matches";

    private static String body(UUID seasonId, UUID playingAreaId, String venue) {
        return """
                {
                    "homeTeamName": "Riverside 1st XI",
                    "awayTeamName": "Occasionals",
                    "seasonId": "%s",
                    "matchDate": "%s",
                    "venue": %s,
                    "playingAreaId": %s
                }
                """.formatted(
                seasonId,
                Instant.now().plus(7, ChronoUnit.DAYS),
                venue == null ? "null" : "\"" + venue + "\"",
                playingAreaId == null ? "null" : "\"" + playingAreaId + "\"");
    }

    @Test
    void createWithAFieldWritesTheFieldNameAsVenueAndItWinsOverAConflictingVenue() throws Exception {
        Club club = club("Riverside CC");
        JwtRequestPostProcessor admin = clubAdmin("sub-1", club.getId());
        Season season = season(club.getId());
        PlayingArea field = area("Irene Oval", "Pretoria", "ZA", PlayingAreaVerificationStatus.UNVERIFIED);

        mockMvc.perform(post(MATCHES, club.getId()).with(admin).contentType(MediaType.APPLICATION_JSON)
                        .content(body(season.getId(), field.getId(), "Typed By Hand")))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.venue").value("Irene Oval"))
                .andExpect(jsonPath("$.playingAreaId").value(field.getId().toString()))
                .andExpect(jsonPath("$.playingAreaName").value("Irene Oval"))
                .andExpect(jsonPath("$.playingAreaVerificationStatus").value("UNVERIFIED"));
    }

    @Test
    void createWithoutAFieldStoresTheSentVenueUnchanged() throws Exception {
        Club club = club("Riverside CC");
        Season season = season(club.getId());

        mockMvc.perform(post(MATCHES, club.getId()).with(clubAdmin("sub-1", club.getId()))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body(season.getId(), null, "Home Ground")))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.venue").value("Home Ground"))
                .andExpect(jsonPath("$.playingAreaId").doesNotExist())
                .andExpect(jsonPath("$.playingAreaName").doesNotExist());
    }

    @Test
    void updateSwitchesFieldThenClearingItKeepsTheSentText() throws Exception {
        Club club = club("Riverside CC");
        JwtRequestPostProcessor admin = clubAdmin("sub-1", club.getId());
        Season season = season(club.getId());
        PlayingArea first = area("First Oval", "Pretoria", "ZA", PlayingAreaVerificationStatus.VERIFIED);
        PlayingArea second = area("Second Oval", "Pretoria", "ZA", PlayingAreaVerificationStatus.VERIFIED);
        Match match = match(club.getId(), season.getId(), first.getId(), "First Oval");

        mockMvc.perform(put(MATCHES + "/{id}", club.getId(), match.getId()).with(admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body(season.getId(), second.getId(), null)))
                .andExpect(jsonPath("$.venue").value("Second Oval"));
        mockMvc.perform(put(MATCHES + "/{id}", club.getId(), match.getId()).with(admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body(season.getId(), null, "Somewhere Else")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.venue").value("Somewhere Else"))
                .andExpect(jsonPath("$.playingAreaId").doesNotExist());
        assertThat(matchRepository.findById(match.getId()).orElseThrow().getPlayingAreaId()).isNull();
    }

    @Test
    void aRejectedFieldIsRefusedOnCreateAndUpdate() throws Exception {
        Club club = club("Riverside CC");
        JwtRequestPostProcessor admin = clubAdmin("sub-1", club.getId());
        Season season = season(club.getId());
        PlayingArea rejected = area("Bad Oval", "Pretoria", "ZA", PlayingAreaVerificationStatus.REJECTED);
        Match match = match(club.getId(), season.getId(), null, "Original");

        mockMvc.perform(post(MATCHES, club.getId()).with(admin).contentType(MediaType.APPLICATION_JSON)
                        .content(body(season.getId(), rejected.getId(), null)))
                .andExpect(status().isBadRequest());
        mockMvc.perform(put(MATCHES + "/{id}", club.getId(), match.getId()).with(admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body(season.getId(), rejected.getId(), null)))
                .andExpect(status().isBadRequest());
        assertThat(matchRepository.findById(match.getId()).orElseThrow().getVenue()).isEqualTo("Original");
    }

    @Test
    void anUnknownFieldIsNotFoundAndAMergedAwayFieldResolvesToItsSurvivor() throws Exception {
        Club club = club("Riverside CC");
        JwtRequestPostProcessor admin = clubAdmin("sub-1", club.getId());
        Season season = season(club.getId());
        PlayingArea survivor = area("Survivor Oval", "Pretoria", "ZA", PlayingAreaVerificationStatus.VERIFIED);
        PlayingArea merged = area("Old Oval", "Pretoria", "ZA", PlayingAreaVerificationStatus.UNVERIFIED);
        merged.setMergedIntoId(survivor.getId());
        playingAreaRepository.save(merged);

        mockMvc.perform(post(MATCHES, club.getId()).with(admin).contentType(MediaType.APPLICATION_JSON)
                        .content(body(season.getId(), UUID.randomUUID(), null)))
                .andExpect(status().isNotFound());
        mockMvc.perform(post(MATCHES, club.getId()).with(admin).contentType(MediaType.APPLICATION_JSON)
                        .content(body(season.getId(), merged.getId(), null)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.playingAreaId").value(survivor.getId().toString()))
                .andExpect(jsonPath("$.venue").value("Survivor Oval"));
    }

    @Test
    void listFiltersByPlayingAreaIdWithinTheClubAndEnrichesEachItem() throws Exception {
        Club club = club("Riverside CC");
        Club other = club("Lakeside CC");
        JwtRequestPostProcessor admin = clubAdmin("sub-1", club.getId());
        Season season = season(club.getId());
        Season otherSeason = season(other.getId());
        PlayingArea field = area("Irene Oval", "Pretoria", "ZA", PlayingAreaVerificationStatus.UNVERIFIED);
        PlayingArea elsewhere = area("Elsewhere", "Pretoria", "ZA", PlayingAreaVerificationStatus.VERIFIED);
        Match onField = match(club.getId(), season.getId(), field.getId(), "Irene Oval");
        match(club.getId(), season.getId(), elsewhere.getId(), "Elsewhere");
        match(club.getId(), season.getId(), null, "Free text");
        match(other.getId(), otherSeason.getId(), field.getId(), "Irene Oval"); // another club, same field

        mockMvc.perform(get(MATCHES, club.getId()).param("playingAreaId", field.getId().toString()).with(admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[*].id", contains(onField.getId().toString())))
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].playingAreaName").value("Irene Oval"))
                .andExpect(jsonPath("$.content[0].playingAreaVerificationStatus").value("UNVERIFIED"));
        // Without the filter, every one of the club's matches comes back, free-text ones with no field.
        mockMvc.perform(get(MATCHES, club.getId()).with(admin))
                .andExpect(jsonPath("$.totalElements").value(3));
    }

    @Test
    void aFieldRejectedAfterTheFactIsFlaggedOnItsExistingMatches() throws Exception {
        Club club = club("Riverside CC");
        JwtRequestPostProcessor admin = clubAdmin("sub-1", club.getId());
        PlayingArea field = area("Irene Oval", "Pretoria", "ZA", PlayingAreaVerificationStatus.REJECTED);
        Match match = match(club.getId(), season(club.getId()).getId(), field.getId(), "Irene Oval");

        mockMvc.perform(get(MATCHES + "/{id}", club.getId(), match.getId()).with(admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.playingAreaVerificationStatus").value("REJECTED"));
    }
}
