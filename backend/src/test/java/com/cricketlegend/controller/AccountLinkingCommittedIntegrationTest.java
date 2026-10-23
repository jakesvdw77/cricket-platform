package com.cricketlegend.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.reset;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.cricketlegend.AbstractIntegrationTest;
import com.cricketlegend.AbstractLinkIntegrationTest;
import com.cricketlegend.domain.Club;
import com.cricketlegend.domain.LinkRequest;
import com.cricketlegend.domain.LinkRequestStatus;
import com.cricketlegend.domain.Person;
import com.cricketlegend.domain.PersonLink;
import com.cricketlegend.domain.PersonLinkStatus;
import com.cricketlegend.domain.PlayerProfile;
import com.cricketlegend.repository.LinkRequestRepository;
import com.cricketlegend.service.EmailService;
import com.jayway.jsonpath.JsonPath;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

/**
 * docs/specs/119, the behaviours that only exist across real commits, so this class is deliberately NOT transactional (it
 * leaves unique rows behind, like the other committed integration tests): the 423 lock after repeated bad confirmations
 * (counted in their own transaction), the one-main-agent invariant under concurrent accepts, and the outcome email going
 * out only after the decision has committed and never undoing it when the send throws.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(AbstractIntegrationTest.class)
class AccountLinkingCommittedIntegrationTest extends AbstractLinkIntegrationTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private LinkRequestRepository linkRequestRepository;
    @Autowired private com.cricketlegend.service.support.LinkAttemptLimiter limiter;
    @MockitoBean private EmailService emailService;

    @BeforeEach
    void resetMail() {
        reset(emailService);
    }

    @Test
    void fiveBadConfirmationsInAnHourLockTheAccountWith423EvenForAValidRefAndOthersAreUnaffected() throws Exception {
        Club club = club("Hillcrest");
        Person parent = account("Pat", "Parent");
        Person bystander = account("Bea", "Bystander");
        PlayerProfile mine = profile(club, playerPerson("Sam", "Smith", CHILD_DOB), parent.getEmail());
        PlayerProfile bystandersKid = profile(club, playerPerson("Zoe", "Zulu", CHILD_DOB), bystander.getEmail());

        for (int i = 0; i < 5; i++) {
            mockMvc.perform(post("/api/v1/me/links").with(as(parent)).contentType(MediaType.APPLICATION_JSON)
                            .content("{\"playerRefs\":[\"" + UUID.randomUUID() + "\"],\"confirm\":true}"))
                    .andExpect(status().isBadRequest());
        }
        String locked = mockMvc.perform(post("/api/v1/me/links").with(as(parent)).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"playerRefs\":[\"" + mine.getId() + "\"],\"confirm\":true}"))
                .andExpect(status().isLocked())
                .andReturn().getResponse().getContentAsString();

        assertThat(JsonPath.<Integer>read(locked, "$.retryAfterSeconds")).isBetween(1, 3600);
        assertThat(personLinkRepository.findByAccountPersonIdAndStatus(parent.getId(), PersonLinkStatus.ACTIVE)).isEmpty();
        mockMvc.perform(post("/api/v1/me/links").with(as(bystander)).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"playerRefs\":[\"" + bystandersKid.getId() + "\"],\"confirm\":true}"))
                .andExpect(status().isOk());
    }

    @Test
    void concurrentAcceptsOfTwoHandOversNeverLeaveMoreThanOneActiveMainAgent() throws Exception {
        ExecutorService pool = Executors.newFixedThreadPool(2);
        try {
            for (int round = 0; round < 3; round++) {
                Club club = club("Hillcrest");
                Person kid = playerPerson("Sam", "Smith", CHILD_DOB);
                profile(club, kid, null);
                Person main = account("Mary", "Main");
                link(main, kid, club, true);
                Person a = account("Ann", "Agent");
                Person b = account("Bob", "Agent");
                PersonLink toA = invitation(kid, club, a.getEmail(), main, true);
                PersonLink toB = invitation(kid, club, b.getEmail(), main, true);

                CountDownLatch go = new CountDownLatch(1);
                List<Future<Integer>> outcomes = new ArrayList<>();
                for (Object[] pair : new Object[][] {{a, toA}, {b, toB}}) {
                    Person who = (Person) pair[0];
                    PersonLink invite = (PersonLink) pair[1];
                    outcomes.add(pool.submit(() -> {
                        go.await();
                        return mockMvc.perform(post("/api/v1/me/links/{id}/accept", invite.getId()).with(as(who)))
                                .andReturn().getResponse().getStatus();
                    }));
                }
                go.countDown();
                List<Integer> statuses = new ArrayList<>();
                for (Future<Integer> f : outcomes) {
                    statuses.add(f.get(60, TimeUnit.SECONDS));
                }

                assertThat(statuses).allMatch(s -> s == 204 || s == 409);
                assertThat(statuses).contains(204);
                List<PersonLink> active = personLinkRepository.findActiveBySubjectAndClub(kid.getId(), club.getId());
                assertThat(active.stream().filter(PersonLink::isMain)).as("round " + round + " statuses " + statuses).hasSize(1);
            }
        } finally {
            pool.shutdownNow();
        }
    }

    // ---- the outcome email ----

    private LinkRequest pending(Person requester, Club club) {
        return linkRequestRepository.save(LinkRequest.builder().accountPersonId(requester.getId()).clubId(club.getId())
                .typedFirstName("Sam").typedLastName("Smith").typedDateOfBirth(CHILD_DOB).contactNumber("0821234567")
                .status(LinkRequestStatus.PENDING).build());
    }

    @Test
    void approvingSendsTheOutcomeEmailAfterTheCommitAndStampsRequesterNotifiedAt() throws Exception {
        Club club = club("Hillcrest");
        Person admin = clubAdmin(club);
        Person parent = account("Pat", "Parent");
        PlayerProfile profile = profile(club, playerPerson("Sam", "Smith", CHILD_DOB), null);
        LinkRequest request = pending(parent, club);

        mockMvc.perform(post("/api/v1/manage/clubs/{c}/link-requests/{r}/approve", club.getId(), request.getId()).with(as(admin))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"playerId\":\"" + profile.getId() + "\",\"mainAgentMode\":\"ADD\",\"confirm\":true}"))
                .andExpect(status().isNoContent());

        verify(emailService).send(eq(parent.getEmail()), anyString(), contains("accepted"), anyString());
        LinkRequest stored = linkRequestRepository.findById(request.getId()).orElseThrow();
        assertThat(stored.getStatus()).isEqualTo(LinkRequestStatus.APPROVED);
        assertThat(stored.getRequesterNotifiedAt()).isNotNull();
    }

    @Test
    void aThrownSendFailureIsLoggedAndTheDeclineStandsWithNoNotifiedStamp() throws Exception {
        Club club = club("Hillcrest");
        Person admin = clubAdmin(club);
        Person parent = account("Pat", "Parent");
        LinkRequest request = pending(parent, club);
        doThrow(new IllegalStateException("smtp down")).when(emailService).send(any(), any(), any(), any());

        mockMvc.perform(post("/api/v1/manage/clubs/{c}/link-requests/{r}/decline", club.getId(), request.getId()).with(as(admin))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"note\":\"Not a member.\"}"))
                .andExpect(status().isNoContent());

        verify(emailService).send(eq(parent.getEmail()), anyString(), contains("declined"), anyString());
        LinkRequest stored = linkRequestRepository.findById(request.getId()).orElseThrow();
        assertThat(stored.getStatus()).isEqualTo(LinkRequestStatus.DECLINED);
        assertThat(stored.getDecisionNote()).isEqualTo("Not a member.");
        assertThat(stored.getRequesterNotifiedAt()).isNull();
    }

    @Test
    void aRefusedDecisionSendsNoEmail() throws Exception {
        Club club = club("Hillcrest");
        Person admin = clubAdmin(club);
        Person parent = account("Pat", "Parent");
        LinkRequest request = pending(parent, club);

        mockMvc.perform(post("/api/v1/manage/clubs/{c}/link-requests/{r}/approve", club.getId(), request.getId()).with(as(admin))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"playerId\":\"" + UUID.randomUUID() + "\",\"mainAgentMode\":\"ADD\",\"confirm\":false}"))
                .andExpect(status().isBadRequest());

        verify(emailService, never()).send(any(), any(), any(), any());
        assertThat(linkRequestRepository.findById(request.getId()).orElseThrow().getStatus()).isEqualTo(LinkRequestStatus.PENDING);
    }

    // ---- atomic decisions and counters ----

    @Test
    void twoManagersDecidingTheSameRequestAtOnceGetOne204AndOne409AndExactlyOneEmail() throws Exception {
        ExecutorService pool = Executors.newFixedThreadPool(2);
        try {
            for (int round = 0; round < 3; round++) {
                reset(emailService);
                Club club = club("Hillcrest");
                Person adminA = clubAdmin(club);
                Person adminB = clubAdmin(club);
                Person parent = account("Pat", "Parent");
                PlayerProfile profile = profile(club, playerPerson("Sam", "Smith", CHILD_DOB), null);
                LinkRequest request = pending(parent, club);

                CountDownLatch go = new CountDownLatch(1);
                List<Future<Integer>> outcomes = new ArrayList<>();
                for (Person admin : List.of(adminA, adminB)) {
                    outcomes.add(pool.submit(() -> {
                        go.await();
                        return mockMvc.perform(post("/api/v1/manage/clubs/{c}/link-requests/{r}/approve", club.getId(),
                                                request.getId())
                                        .with(as(admin)).contentType(MediaType.APPLICATION_JSON)
                                        .content("{\"playerId\":\"" + profile.getId()
                                                + "\",\"mainAgentMode\":\"ADD\",\"confirm\":true}"))
                                .andReturn().getResponse().getStatus();
                    }));
                }
                go.countDown();
                List<Integer> statuses = new ArrayList<>();
                for (Future<Integer> f : outcomes) {
                    statuses.add(f.get(60, TimeUnit.SECONDS));
                }

                assertThat(statuses).as("round " + round).containsExactlyInAnyOrder(204, 409);
                verify(emailService, org.mockito.Mockito.times(1)).send(eq(parent.getEmail()), anyString(), anyString(), anyString());
                assertThat(personLinkRepository.findActiveBySubjectAndClub(profile.getPersonId(), club.getId())).hasSize(1);
            }
        } finally {
            pool.shutdownNow();
        }
    }

    @Test
    void concurrentFirstLinkRequestsNeverFailAndTheDailyLimitIsNeverOvershot() throws Exception {
        Person parent = account("Pat", "Parent");
        ExecutorService pool = Executors.newFixedThreadPool(8);
        try {
            CountDownLatch go = new CountDownLatch(1);
            List<Future<Integer>> outcomes = new ArrayList<>();
            for (int i = 0; i < 15; i++) {
                outcomes.add(pool.submit(() -> {
                    go.await();
                    try {
                        limiter.countRequest(parent.getId());
                        return 200;
                    } catch (com.cricketlegend.exception.LinkRateLimitedException e) {
                        return 429;
                    }
                }));
            }
            go.countDown();
            List<Integer> statuses = new ArrayList<>();
            for (Future<Integer> f : outcomes) {
                statuses.add(f.get(60, TimeUnit.SECONDS)); // any other exception (a unique violation, a 500) fails here
            }

            assertThat(statuses.stream().filter(s -> s == 200).count()).isEqualTo(10);
            assertThat(statuses.stream().filter(s -> s == 429).count()).isEqualTo(5);
        } finally {
            pool.shutdownNow();
        }
    }

    @Test
    void aMissingConfirmOnRevokeIsA400ProblemBody() throws Exception {
        Club club = club("Hillcrest");
        Person admin = clubAdmin(club);

        String body = mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                        .delete("/api/v1/manage/clubs/{c}/players/{p}/links/{l}", club.getId(), UUID.randomUUID(), UUID.randomUUID())
                        .with(as(admin)))
                .andExpect(status().isBadRequest())
                .andReturn().getResponse().getContentAsString();

        assertThat(JsonPath.<String>read(body, "$.detail")).contains("confirm");
    }
}
