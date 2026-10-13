package com.cricketlegend.controller;

import static com.cricketlegend.PlatformRoleJwtPostProcessors.platformAdmin;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.cricketlegend.domain.Address;
import com.cricketlegend.domain.Club;
import com.cricketlegend.domain.ClubPlayingArea;
import com.cricketlegend.domain.Match;
import com.cricketlegend.domain.PlayingArea;
import com.cricketlegend.domain.PlayingAreaCategory;
import com.cricketlegend.domain.PlayingAreaOwnerType;
import com.cricketlegend.domain.PlayingAreaType;
import com.cricketlegend.domain.PlayingAreaVerificationStatus;
import com.cricketlegend.support.AbstractPlayingAreaIntegrationTest;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.JwtRequestPostProcessor;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

/**
 * Integration tests of the platform-admin moderation endpoints ({@code /api/v1/platform/playing-areas}, docs/specs/099):
 * 401/403/200 per role, the queue order, the status transitions over HTTP, and merge (one transaction: matches, venue
 * text and club links move together, and the whole thing rolls back on failure).
 */
class PlatformPlayingAreaControllerIntegrationTest extends AbstractPlayingAreaIntegrationTest {

    private static final String BASE = "/api/v1/platform/playing-areas";
    private static final PlayingAreaVerificationStatus UNVERIFIED = PlayingAreaVerificationStatus.UNVERIFIED;
    private static final PlayingAreaVerificationStatus VERIFIED = PlayingAreaVerificationStatus.VERIFIED;
    private static final PlayingAreaVerificationStatus REJECTED = PlayingAreaVerificationStatus.REJECTED;

    // ---- authorization ------------------------------------------------------------------------------------------

    private MockHttpServletRequestBuilder[] everyEndpoint(UUID id) {
        String json = "{}";
        return new MockHttpServletRequestBuilder[] {
            get(BASE),
            get(BASE + "/summary"),
            get(BASE + "/" + id),
            put(BASE + "/" + id).contentType(MediaType.APPLICATION_JSON).content(json),
            post(BASE + "/" + id + "/verify"),
            post(BASE + "/" + id + "/reject").contentType(MediaType.APPLICATION_JSON).content("{\"reason\":\"x\"}"),
            post(BASE + "/" + id + "/reopen"),
            post(BASE + "/" + id + "/merge")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("{\"targetPlayingAreaId\":\"" + UUID.randomUUID() + "\"}"),
        };
    }

    @Test
    void unauthenticatedGets401OnEveryEndpoint() throws Exception {
        PlayingArea field = area("Oval", "Pretoria", "ZA", UNVERIFIED);
        for (MockHttpServletRequestBuilder request : everyEndpoint(field.getId())) {
            mockMvc.perform(request).andExpect(status().isUnauthorized());
        }
    }

    @Test
    void aClubManagerGets403OnEveryEndpointAndChangesNothing() throws Exception {
        Club club = club("Riverside CC");
        JwtRequestPostProcessor manager = clubAdmin("sub-1", club.getId());
        PlayingArea field = area("Oval", "Pretoria", "ZA", null, PlayingAreaCategory.CLUB, UNVERIFIED, club.getId());

        for (MockHttpServletRequestBuilder request : everyEndpoint(field.getId())) {
            mockMvc.perform(request.with(manager)).andExpect(status().isForbidden());
        }
        PlayingArea after = playingAreaRepository.findById(field.getId()).orElseThrow();
        assertThat(after.getVerificationStatus()).isEqualTo(UNVERIFIED);
        assertThat(after.getMergedIntoId()).isNull();
    }

    @Test
    void aPlatformAdminReachesTheEndpoints() throws Exception {
        PlayingArea field = area("Oval", "Pretoria", "ZA", UNVERIFIED);

        mockMvc.perform(get(BASE).with(platformAdmin())).andExpect(status().isOk());
        mockMvc.perform(get(BASE + "/summary").with(platformAdmin())).andExpect(status().isOk());
        mockMvc.perform(get(BASE + "/{id}", field.getId()).with(platformAdmin())).andExpect(status().isOk());
    }

    // ---- queue --------------------------------------------------------------------------------------------------

    @Test
    void theQueueDefaultsToUnverifiedOldestFirstAndExcludesMergedAwayRows() throws Exception {
        PlayingArea newest = seedAt("Newest", UNVERIFIED, Instant.parse("2026-03-01T00:00:00Z"));
        seedAt("Oldest", UNVERIFIED, Instant.parse("2026-01-01T00:00:00Z"));
        seedAt("Middle", UNVERIFIED, Instant.parse("2026-02-01T00:00:00Z"));
        seedAt("Verified", VERIFIED, Instant.parse("2025-01-01T00:00:00Z"));
        PlayingArea merged = seedAt("Merged", UNVERIFIED, Instant.parse("2025-06-01T00:00:00Z"));
        merged.setMergedIntoId(newest.getId());
        playingAreaRepository.save(merged);

        mockMvc.perform(get(BASE).with(platformAdmin()))
                .andExpect(jsonPath("$.content[*].name", contains("Oldest", "Middle", "Newest")))
                .andExpect(jsonPath("$.totalElements").value(3));
        mockMvc.perform(get(BASE).param("verification", "VERIFIED").with(platformAdmin()))
                .andExpect(jsonPath("$.content[*].name", contains("Verified")));
        mockMvc.perform(get(BASE).param("size", "2").param("page", "1").with(platformAdmin()))
                .andExpect(jsonPath("$.content", hasSize(1)))
                .andExpect(jsonPath("$.totalPages").value(2));
        mockMvc.perform(get(BASE + "/summary").with(platformAdmin()))
                .andExpect(jsonPath("$.unverified").value(3))
                .andExpect(jsonPath("$.verified").value(1))
                .andExpect(jsonPath("$.rejected").value(0));
    }

    @Test
    void theDetailCarriesLinkedClubsMatchCountAndPossibleDuplicates() throws Exception {
        Club club = club("Riverside CC");
        PlayingArea field = area("Centurion Oval", "Pretoria", "ZA", null, PlayingAreaCategory.CLUB, UNVERIFIED, club.getId());
        PlayingArea twin = area("Centurion Oval Ground", "Pretoria", "ZA", VERIFIED);
        home(club.getId(), field.getId());
        match(club.getId(), season(club.getId()).getId(), field.getId(), "Centurion Oval");

        mockMvc.perform(get(BASE + "/{id}", field.getId()).with(platformAdmin()))
                .andExpect(jsonPath("$.createdByClubName").value("Riverside CC"))
                .andExpect(jsonPath("$.matchCount").value(1))
                .andExpect(jsonPath("$.linkedClubs[0].clubName").value("Riverside CC"))
                .andExpect(jsonPath("$.possibleDuplicates[*].id", contains(twin.getId().toString())));
    }

    // ---- transitions --------------------------------------------------------------------------------------------

    @Test
    void verifyClearsTheUnverifiedFlagOnMatchesWithoutEditingThem() throws Exception {
        Club club = club("Riverside CC");
        JwtRequestPostProcessor manager = clubAdmin("sub-1", club.getId());
        PlayingArea field = area("Oval", "Pretoria", "ZA", null, PlayingAreaCategory.CLUB, UNVERIFIED, club.getId());
        Match match = match(club.getId(), season(club.getId()).getId(), field.getId(), "Oval");
        Instant updatedBefore = matchRepository.findById(match.getId()).orElseThrow().getUpdatedAt();

        mockMvc.perform(get("/api/v1/manage/clubs/{c}/matches/{m}", club.getId(), match.getId()).with(manager))
                .andExpect(jsonPath("$.playingAreaVerificationStatus").value("UNVERIFIED"));
        mockMvc.perform(post(BASE + "/{id}/verify", field.getId())
                        .with(platformAdmin(b -> b.subject("admin-sub"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.verificationStatus").value("VERIFIED"))
                .andExpect(jsonPath("$.verifiedBySubject").value("admin-sub"));
        mockMvc.perform(get("/api/v1/manage/clubs/{c}/matches/{m}", club.getId(), match.getId()).with(manager))
                .andExpect(jsonPath("$.playingAreaVerificationStatus").value("VERIFIED"));

        assertThat(matchRepository.findById(match.getId()).orElseThrow().getUpdatedAt()).isEqualTo(updatedBefore);
    }

    @Test
    void rejectNeedsAReasonThenHidesTheFieldAndReopenBringsItBack() throws Exception {
        Club club = club("Riverside CC");
        JwtRequestPostProcessor manager = clubAdmin("sub-1", club.getId());
        PlayingArea field = area("Oval", "Pretoria", "ZA", UNVERIFIED);

        mockMvc.perform(post(BASE + "/{id}/reject", field.getId()).with(platformAdmin())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"reason\":\"  \"}"))
                .andExpect(status().isBadRequest());
        mockMvc.perform(post(BASE + "/{id}/reject", field.getId()).with(platformAdmin())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"reason\":\"Not a cricket field\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.verificationStatus").value("REJECTED"))
                .andExpect(jsonPath("$.rejectionReason").value("Not a cricket field"));
        mockMvc.perform(get("/api/v1/manage/clubs/{c}/playing-areas", club.getId()).with(manager))
                .andExpect(jsonPath("$.content", hasSize(0)));
        // A rejected field must be reopened before it can be verified.
        mockMvc.perform(post(BASE + "/{id}/verify", field.getId()).with(platformAdmin()))
                .andExpect(status().isConflict());

        mockMvc.perform(post(BASE + "/{id}/reopen", field.getId()).with(platformAdmin()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.verificationStatus").value("UNVERIFIED"))
                .andExpect(jsonPath("$.rejectionReason").doesNotExist());
        mockMvc.perform(get("/api/v1/manage/clubs/{c}/playing-areas", club.getId()).with(manager))
                .andExpect(jsonPath("$.content", hasSize(1)));
        mockMvc.perform(post(BASE + "/{id}/reopen", field.getId()).with(platformAdmin()))
                .andExpect(status().isConflict());
    }

    @Test
    void platformAdminCanEditAVerifiedFieldWhereAManagerCannot() throws Exception {
        PlayingArea field = area("Oval", "Pretoria", "ZA", VERIFIED);

        mockMvc.perform(put(BASE + "/{id}", field.getId()).with(platformAdmin())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(fieldBody("Oval Renamed", null, "Pretoria", "ZA", null)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Oval Renamed"));
    }

    // ---- merge --------------------------------------------------------------------------------------------------

    @Test
    void mergeRepointsMatchesSetsTheVenueMovesLinksAndHidesTheSource() throws Exception {
        Club clubA = club("Riverside CC");
        Club clubB = club("Lakeside CC");
        Club clubC = club("Hillside CC");
        PlayingArea source = area("Irene Ovl", "Pretoria", "ZA", UNVERIFIED);
        PlayingArea target = area("Irene Oval", "Pretoria", "ZA", VERIFIED);
        Match matchA = match(clubA.getId(), season(clubA.getId()).getId(), source.getId(), "Irene Ovl");
        Match matchB = match(clubB.getId(), season(clubB.getId()).getId(), source.getId(), "Irene Ovl");
        home(clubA.getId(), source.getId()); // only on the source: moves
        home(clubB.getId(), source.getId()); // on both: de-duplicated
        home(clubB.getId(), target.getId());
        clubPlayingAreaRepository.save(ClubPlayingArea.builder()
                .clubId(clubC.getId()).playingAreaId(source.getId()).home(true).build());
        ClubPlayingArea targetCLink = clubPlayingAreaRepository.save(ClubPlayingArea.builder()
                .clubId(clubC.getId()).playingAreaId(target.getId()).home(false).build());

        mockMvc.perform(post(BASE + "/{id}/merge", source.getId()).with(platformAdmin())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"targetPlayingAreaId\":\"" + target.getId() + "\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(target.getId().toString()))
                .andExpect(jsonPath("$.matchCount").value(2))
                .andExpect(jsonPath("$.linkedClubs", hasSize(3)));

        for (Match m : new Match[] {matchA, matchB}) {
            Match reloaded = matchRepository.findById(m.getId()).orElseThrow();
            assertThat(reloaded.getPlayingAreaId()).isEqualTo(target.getId());
            assertThat(reloaded.getVenue()).isEqualTo("Irene Oval");
        }
        assertThat(playingAreaRepository.findById(source.getId()).orElseThrow().getMergedIntoId())
                .isEqualTo(target.getId());
        assertThat(clubPlayingAreaRepository.findByPlayingAreaId(source.getId())).isEmpty();
        assertThat(clubPlayingAreaRepository.findByPlayingAreaId(target.getId())).hasSize(3);
        // Home stays home: club C was home on the source only, so the surviving link becomes home.
        assertThat(clubPlayingAreaRepository.findById(targetCLink.getId()).orElseThrow().isHome()).isTrue();

        // The source no longer appears anywhere in the directory or the queue.
        JwtRequestPostProcessor manager = clubAdmin("sub-1", clubA.getId());
        mockMvc.perform(get("/api/v1/manage/clubs/{c}/playing-areas", clubA.getId()).with(manager))
                .andExpect(jsonPath("$.content[*].name", contains("Irene Oval")));
        mockMvc.perform(get(BASE).with(platformAdmin())).andExpect(jsonPath("$.content", hasSize(0)));
    }

    @Test
    void mergeRollsBackWholeWhenAStepFails() {
        Club club = club("Riverside CC");
        PlayingArea source = area("Irene Ovl", "Pretoria", "ZA", UNVERIFIED);
        PlayingArea target = area("Irene Oval", "Pretoria", "ZA", VERIFIED);
        Match match = match(club.getId(), season(club.getId()).getId(), source.getId(), "Irene Ovl");
        home(club.getId(), source.getId());

        // A trigger makes the link move (the last write before commit) fail, after the match bulk update ran.
        jdbc.execute("create function fail_link_move() returns trigger language plpgsql as "
                + "$$ begin raise exception 'forced failure'; end $$");
        jdbc.execute("create trigger fail_link_move before update on club_playing_area "
                + "for each row execute function fail_link_move()");
        try {
            assertThatThrownBy(() -> mockMvc.perform(post(BASE + "/{id}/merge", source.getId()).with(platformAdmin())
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"targetPlayingAreaId\":\"" + target.getId() + "\"}")))
                    .hasStackTraceContaining("forced failure");
        } finally {
            jdbc.execute("drop trigger fail_link_move on club_playing_area");
            jdbc.execute("drop function fail_link_move()");
        }

        Match reloaded = matchRepository.findById(match.getId()).orElseThrow();
        assertThat(reloaded.getPlayingAreaId()).isEqualTo(source.getId());
        assertThat(reloaded.getVenue()).isEqualTo("Irene Ovl");
        assertThat(playingAreaRepository.findById(source.getId()).orElseThrow().getMergedIntoId()).isNull();
        assertThat(clubPlayingAreaRepository.findByPlayingAreaId(source.getId())).hasSize(1);
        assertThat(clubPlayingAreaRepository.findByPlayingAreaId(target.getId())).isEmpty();
    }

    @Test
    void mergeIsRefusedForSelfRejectedTargetAndMergedTarget() throws Exception {
        PlayingArea source = area("A", "Pretoria", "ZA", UNVERIFIED);
        PlayingArea rejected = area("B", "Pretoria", "ZA", REJECTED);

        mockMvc.perform(post(BASE + "/{id}/merge", source.getId()).with(platformAdmin())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"targetPlayingAreaId\":\"" + source.getId() + "\"}"))
                .andExpect(status().isConflict());
        mockMvc.perform(post(BASE + "/{id}/merge", source.getId()).with(platformAdmin())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"targetPlayingAreaId\":\"" + rejected.getId() + "\"}"))
                .andExpect(status().isConflict());
        mockMvc.perform(post(BASE + "/{id}/merge", source.getId()).with(platformAdmin())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"targetPlayingAreaId\":\"" + UUID.randomUUID() + "\"}"))
                .andExpect(status().isNotFound());
    }

    private PlayingArea seedAt(String name, PlayingAreaVerificationStatus status, Instant createdAt) {
        return playingAreaRepository.save(PlayingArea.builder()
                .areaType(PlayingAreaType.CRICKET_FIELD)
                .name(name)
                .category(PlayingAreaCategory.CLUB)
                .ownerType(PlayingAreaOwnerType.CLUB)
                .ownerName("Owner")
                .address(Address.builder().city("City " + name).country("ZA").build())
                .verificationStatus(status)
                .createdAt(createdAt)
                .build());
    }
}
