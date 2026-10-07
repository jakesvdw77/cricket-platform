package com.cricketlegend.controller;

import static com.cricketlegend.PlatformRoleJwtPostProcessors.platformAdmin;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.cricketlegend.domain.Person;
import com.cricketlegend.domain.PlayerProfile;
import com.cricketlegend.domain.PublicAvailabilityAttempt;
import com.cricketlegend.repository.PersonRepository;
import com.cricketlegend.repository.PlayerProfileRepository;
import com.cricketlegend.repository.PublicAvailabilityAttemptRepository;
import com.cricketlegend.service.support.PublicAvailabilityToken;
import com.cricketlegend.service.support.PublicPollKind;
import com.jayway.jsonpath.JsonPath;
import jakarta.persistence.EntityManagerFactory;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;
import org.hibernate.SessionFactory;
import org.hibernate.stat.Statistics;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

/**
 * The security and behaviour tests of docs/specs/077's public form, run once per poll kind (the two
 * subclasses supply the fixtures). Real Postgres, real filter chain, NO Authorization header on any
 * public call. Deliberately not {@code @Transactional} (docs/standards/backend.md): the verify
 * counters commit in their own transactions, so rows are removed in {@code @AfterEach}.
 */
abstract class AbstractPublicAvailabilityIntegrationTest {

    protected static final LocalDate DOB = LocalDate.of(1990, 5, 17);

    @Autowired
    protected MockMvc mockMvc;

    @Autowired
    protected PersonRepository personRepository;

    @Autowired
    protected PlayerProfileRepository playerProfileRepository;

    @Autowired
    protected PublicAvailabilityAttemptRepository attemptRepository;

    @Autowired
    protected JdbcTemplate jdbcTemplate;

    @Autowired
    protected EntityManagerFactory entityManagerFactory;

    @Value("${cricketlegend.public-availability.token-secret}")
    protected String tokenSecret;

    // ---- fixtures supplied per poll kind ----

    /** The kind, for building tokens. */
    protected abstract PublicPollKind kind();

    /** Creates a brand-new club with a brand-new OPEN poll and makes it the current one. */
    protected abstract void createPoll();

    protected abstract UUID currentPollId();

    protected abstract String baseUrl(UUID pollId);

    /** A player who belongs to the current poll. */
    protected abstract UUID addPlayer(String first, String last, LocalDate dob, boolean active);

    /** A player of the same club who does NOT belong to the current poll. */
    protected abstract UUID addOutsider(String first, String last, LocalDate dob);

    /** A player of ANOTHER club (with that club's own squad or section), same name. */
    protected abstract UUID addPlayerOfAnotherClub(String first, String last, LocalDate dob);

    protected abstract void closeCurrentPoll();

    /** A valid PUT body answering every open window of the current poll with {@code status}. */
    protected abstract String answersBody(String status);

    /** The stored source of the player's answer in the current poll (first window for a group poll). */
    protected abstract String storedSource(UUID playerId);

    /** The manager sets the player's status (first window for a group poll) through the real manager endpoint. */
    protected abstract void managerSets(UUID playerId, String status) throws Exception;

    /** The manager Responses page's viaLink for the player (first window for a group poll). */
    protected abstract Boolean managerViaLink(UUID playerId) throws Exception;

    /** The status the answers GET reports for the player's first answer. */
    protected abstract String firstAnswerStatusPath();

    // ---- plumbing ----

    @BeforeEach
    void createFreshPoll() {
        createPoll();
    }

    @AfterEach
    void cleanUp() {
        jdbcTemplate.execute("TRUNCATE TABLE club, person, public_availability_attempt CASCADE");
    }

    protected UUID newProfile(UUID clubId, String first, String last, LocalDate dob, boolean active) {
        Person person = personRepository.save(Person.builder().firstName(first).lastName(last).dateOfBirth(dob)
                .email(first.toLowerCase() + "." + UUID.randomUUID() + "@example.com").phone("0821234567").build());
        return playerProfileRepository.save(PlayerProfile.builder().personId(person.getId()).clubId(clubId)
                .active(active).email("profile-" + UUID.randomUUID() + "@example.com").phone("0829999999").build())
                .getId();
    }

    protected String verifyBody(String first, String last, String dob, UUID playerId) {
        return "{\"firstName\":\"" + first + "\",\"lastName\":\"" + last + "\",\"dateOfBirth\":\"" + dob + "\""
                + (playerId == null ? "" : ",\"playerId\":\"" + playerId + "\"") + "}";
    }

    protected MockHttpServletRequestBuilder verifyRequest(String base, String body, String address) {
        return post(base + "/verify").contentType(MediaType.APPLICATION_JSON).content(body)
                .with(request -> {
                    request.setRemoteAddr(address);
                    return request;
                });
    }

    protected MockHttpServletRequestBuilder verifyRequest(String body) {
        return verifyRequest(baseUrl(currentPollId()), body, "10.1.1.1");
    }

    protected String verifiedToken(String first, String last, LocalDate dob, UUID playerId) throws Exception {
        MvcResult result = mockMvc.perform(verifyRequest(verifyBody(first, last, dob.toString(), playerId)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("VERIFIED")).andReturn();
        return JsonPath.read(result.getResponse().getContentAsString(), "$.token");
    }

    protected MockHttpServletRequestBuilder putAnswers(UUID playerId, String token, String body) {
        MockHttpServletRequestBuilder builder = put(baseUrl(currentPollId()) + "/players/" + playerId + "/answers")
                .contentType(MediaType.APPLICATION_JSON).content(body);
        return token == null ? builder : builder.header("X-Public-Token", token);
    }

    protected MockHttpServletRequestBuilder getAnswers(UUID pollId, UUID playerId, String token) {
        MockHttpServletRequestBuilder builder = get(baseUrl(pollId) + "/players/" + playerId + "/answers");
        return token == null ? builder : builder.header("X-Public-Token", token);
    }

    protected String tokenFor(Clock clock, PublicPollKind tokenKind, UUID pollId, UUID playerId) {
        return new PublicAvailabilityToken(tokenSecret, clock).issue(tokenKind, pollId, playerId).token();
    }

    private void assertGenericFailure(String body, int triesLeft) throws Exception {
        mockMvc.perform(verifyRequest(body))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.detail").value("We could not find a player with those details in this poll."))
                .andExpect(jsonPath("$.triesLeft").value(triesLeft))
                .andExpect(jsonPath("$.token").doesNotExist())
                .andExpect(jsonPath("$.playerId").doesNotExist());
    }

    // ---- header ----

    @Test
    void headerIsPublicAndCarriesNoPlayerData() throws Exception {
        addPlayer("Alice", "Anderson", DOB, true);

        MvcResult result = mockMvc.perform(get(baseUrl(currentPollId())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.open").value(true))
                .andExpect(jsonPath("$.clubId").isNotEmpty())
                .andReturn();

        String raw = result.getResponse().getContentAsString();
        assertThat(raw).doesNotContainIgnoringCase("alice").doesNotContainIgnoringCase("anderson")
                .doesNotContain("dateOfBirth").doesNotContain("1990-05-17").doesNotContain("@example.com")
                .doesNotContain("0821234567").doesNotContain("0829999999").doesNotContain("\"responses\"").doesNotContain("\"players\"");
    }

    @Test
    void headerOfAnUnknownPollIsNotFound() throws Exception {
        mockMvc.perform(get(baseUrl(UUID.randomUUID()))).andExpect(status().isNotFound());
    }

    // ---- verify: outcomes ----

    @Test
    void verifySucceedsAndReturnsOnlyTheVerifiedPlayerAndAToken() throws Exception {
        UUID alice = addPlayer("Alice", "Anderson", DOB, true);
        addPlayer("Bob", "Brown", LocalDate.of(1991, 1, 1), true);

        MvcResult result = mockMvc.perform(verifyRequest(verifyBody("Alice", "Anderson", "1990-05-17", null)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("VERIFIED"))
                .andExpect(jsonPath("$.playerId").value(alice.toString()))
                .andExpect(jsonPath("$.firstName").value("Alice"))
                .andExpect(jsonPath("$.lastName").value("Anderson"))
                .andExpect(jsonPath("$.token").isNotEmpty())
                .andExpect(jsonPath("$.expiresAt").isNotEmpty())
                .andExpect(jsonPath("$.candidates").doesNotExist())
                .andReturn();

        String raw = result.getResponse().getContentAsString();
        assertThat(raw).doesNotContain("Bob").doesNotContain("dateOfBirth").doesNotContain("1990-05-17")
                .doesNotContain("@example.com").doesNotContain("0821234567").doesNotContain("0829999999");
    }

    @Test
    void aLenientSpellingOfTheNameWithTheRightDateVerifies() throws Exception {
        UUID player = addPlayer("Jaco", "van der Westhuizen", DOB, true);

        for (String[] typed : new String[][] {
            {"jaco", "VanderWesthuizen"}, {"Jaco", "Westhuizen"}, {"Jaco", "Wessthuizen"}, {" Jaco ", "v.d. Westhuizen"}}) {
            mockMvc.perform(verifyRequest(verifyBody(typed[0], typed[1], "1990-05-17", null)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.playerId").value(player.toString()));
        }
    }

    @Test
    void aLenientNameMatchWithTheWrongDateStillFailsWithTheSameGenericBody() throws Exception {
        addPlayer("Jaco", "van der Westhuizen", DOB, true);

        assertGenericFailure(verifyBody("Jaco", "Wessthuizen", "1990-05-18", null), 4);
    }

    @Test
    void wrongNameFailsGenericallyAndCountsDown() throws Exception {
        addPlayer("Alice", "Anderson", DOB, true);

        assertGenericFailure(verifyBody("Alicia", "Smith", "1990-05-17", null), 4);
        assertGenericFailure(verifyBody("Alicia", "Smith", "1990-05-17", null), 3);
    }

    @Test
    void wrongDateOfBirthFailsGenerically() throws Exception {
        addPlayer("Alice", "Anderson", DOB, true);

        assertGenericFailure(verifyBody("Alice", "Anderson", "1990-05-18", null), 4);
    }

    @Test
    void aPlayerOutsideThePollLooksExactlyLikeAnUnknownName() throws Exception {
        addOutsider("Olive", "Outside", DOB);

        assertGenericFailure(verifyBody("Olive", "Outside", "1990-05-17", null), 4);
    }

    @Test
    void anotherClubsPlayerCannotVerifyHere() throws Exception {
        addPlayerOfAnotherClub("Alice", "Anderson", DOB);

        assertGenericFailure(verifyBody("Alice", "Anderson", "1990-05-17", null), 4);
    }

    @Test
    void anInactivePlayerCannotVerify() throws Exception {
        addPlayer("Ina", "Inactive", DOB, false);

        assertGenericFailure(verifyBody("Ina", "Inactive", "1990-05-17", null), 4);
    }

    @Test
    void aPlayerWithoutDateOfBirthGetsNoDateOfBirthAndIsNotCountedAsAFailure() throws Exception {
        addPlayer("Nodate", "Nobirth", null, true);

        MvcResult result = mockMvc.perform(verifyRequest(verifyBody("Nodate", "Nobirth", "1990-05-17", null)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("NO_DATE_OF_BIRTH"))
                .andExpect(jsonPath("$.token").doesNotExist())
                .andExpect(jsonPath("$.playerId").doesNotExist())
                .andReturn();
        assertThat(result.getResponse().getContentAsString()).isEqualTo("{\"status\":\"NO_DATE_OF_BIRTH\"}");

        // Not counted as a failed attempt: no 'name:' counter row exists (only the address counter).
        assertThat(attemptRepository.findAll()).noneMatch(a -> a.getScopeKey().startsWith("name:"));
    }

    @Test
    void sameNameDifferentDatesResolvesToTheRightPlayer() throws Exception {
        UUID older = addPlayer("Sam", "Smit", LocalDate.of(1980, 1, 1), true);
        UUID younger = addPlayer("Sam", "Smit", LocalDate.of(2005, 6, 6), true);

        mockMvc.perform(verifyRequest(verifyBody("Sam", "Smit", "2005-06-06", null)))
                .andExpect(jsonPath("$.status").value("VERIFIED"))
                .andExpect(jsonPath("$.playerId").value(younger.toString()));
        mockMvc.perform(verifyRequest(verifyBody("Sam", "Smit", "1980-01-01", null)))
                .andExpect(jsonPath("$.playerId").value(older.toString()));
    }

    @Test
    void similarNamesAreSeparatedOnlyByDateOfBirth() throws Exception {
        UUID johan = addPlayer("Johan", "Pretorius", LocalDate.of(1985, 1, 1), true);
        UUID johann = addPlayer("Johann", "Pretorius", LocalDate.of(1992, 2, 2), true);

        mockMvc.perform(verifyRequest(verifyBody("Johan", "Pretorius", "1992-02-02", null)))
                .andExpect(jsonPath("$.playerId").value(johann.toString()));
        mockMvc.perform(verifyRequest(verifyBody("Johann", "Pretorius", "1985-01-01", null)))
                .andExpect(jsonPath("$.playerId").value(johan.toString()));
    }

    @Test
    void sameNameSameDateOffersAPickThenVerifiesTheChosenPlayer() throws Exception {
        UUID first = addPlayer("Sam", "Smit", DOB, true);
        UUID second = addPlayer("Sam", "Smit", DOB, true);

        MvcResult pick = mockMvc.perform(verifyRequest(verifyBody("Sam", "Smit", "1990-05-17", null)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("PICK"))
                .andExpect(jsonPath("$.token").doesNotExist())
                .andExpect(jsonPath("$.playerId").doesNotExist())
                .andExpect(jsonPath("$.candidates.length()").value(2))
                .andReturn();
        String raw = pick.getResponse().getContentAsString();
        List<String> ids = JsonPath.read(raw, "$.candidates[*].playerId");
        assertThat(ids).containsExactlyInAnyOrder(first.toString(), second.toString());
        assertThat(raw).doesNotContain("dateOfBirth").doesNotContain("@example.com").doesNotContain("Smit");

        mockMvc.perform(verifyRequest(verifyBody("Sam", "Smit", "1990-05-17", second)))
                .andExpect(jsonPath("$.status").value("VERIFIED"))
                .andExpect(jsonPath("$.playerId").value(second.toString()));
        // A playerId that is not one of the candidates fails generically, with the date still required.
        assertGenericFailure(verifyBody("Sam", "Smit", "1990-05-17", UUID.randomUUID()), 4);
        assertGenericFailure(verifyBody("Sam", "Smit", "1990-05-18", second), 3);
    }

    @Test
    void verifyRejectsAMalformedBody() throws Exception {
        mockMvc.perform(verifyRequest("{\"firstName\":\"\",\"lastName\":\"x\",\"dateOfBirth\":\"1990-05-17\"}"))
                .andExpect(status().isBadRequest());
        mockMvc.perform(verifyRequest("{\"firstName\":\"a\",\"lastName\":\"x\",\"dateOfBirth\":\"17/05/1990\"}"))
                .andExpect(status().isBadRequest());
        mockMvc.perform(verifyRequest("{\"firstName\":\"a\",\"lastName\":\"x\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void verifyOfAnUnknownPollIsNotFound() throws Exception {
        mockMvc.perform(verifyRequest(baseUrl(UUID.randomUUID()), verifyBody("A", "B", "1990-05-17", null), "10.1.1.1"))
                .andExpect(status().isNotFound());
    }

    // ---- attempts and limits ----

    @Test
    void fiveFailuresLockTheNameAndTheLockEndsAfterTheWindow() throws Exception {
        UUID alice = addPlayer("Alice", "van Anderson", DOB, true);
        String wrong = verifyBody("Alice", "van Anderson", "1990-05-18", null);

        for (int tries = 4; tries >= 0; tries--) {
            assertGenericFailure(wrong, tries);
        }
        // Locked now, even with the correct date, and spelling variants share the same counter.
        mockMvc.perform(verifyRequest(verifyBody("Alice", "van Anderson", "1990-05-17", null)))
                .andExpect(status().is(423))
                .andExpect(jsonPath("$.retryAfterSeconds").value(org.hamcrest.Matchers.greaterThan(0)))
                .andExpect(jsonPath("$.token").doesNotExist());
        mockMvc.perform(verifyRequest(verifyBody("  ALICE ", "Anderson", "1990-05-17", null)))
                .andExpect(status().is(423));
        // Another name in the same poll is not locked.
        mockMvc.perform(verifyRequest(verifyBody("Zed", "Zulu", "1990-05-17", null))).andExpect(status().isForbidden());

        // Move the lock and the window into the past instead of sleeping.
        Instant past = Instant.now().minus(16, ChronoUnit.MINUTES);
        for (PublicAvailabilityAttempt attempt : attemptRepository.findAll()) {
            if (attempt.getScopeKey().startsWith("name:")) {
                attempt.setWindowStartedAt(past);
                attempt.setLockedUntil(Instant.now().minus(1, ChronoUnit.MINUTES));
                attemptRepository.save(attempt);
            }
        }
        mockMvc.perform(verifyRequest(verifyBody("Alice", "van Anderson", "1990-05-17", null)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.playerId").value(alice.toString()));
        // Success cleared Alice's counter: only the unrelated "Zed Zulu" name row is left.
        assertThat(attemptRepository.findAll().stream().filter(a -> a.getScopeKey().startsWith("name:")).count())
                .isEqualTo(1);
    }

    @Test
    void anExpiredFailureWindowRestartsTheCounter() throws Exception {
        addPlayer("Alice", "Anderson", DOB, true);
        String wrong = verifyBody("Alice", "Anderson", "1990-05-18", null);
        assertGenericFailure(wrong, 4);
        assertGenericFailure(wrong, 3);
        for (PublicAvailabilityAttempt attempt : attemptRepository.findAll()) {
            if (attempt.getScopeKey().startsWith("name:")) {
                attempt.setWindowStartedAt(Instant.now().minus(16, ChronoUnit.MINUTES));
                attemptRepository.save(attempt);
            }
        }

        assertGenericFailure(wrong, 4);
    }

    @Test
    void aSuccessfulVerifyResetsTheFailureCounter() throws Exception {
        addPlayer("Alice", "Anderson", DOB, true);
        assertGenericFailure(verifyBody("Alice", "Anderson", "1990-05-18", null), 4);
        assertGenericFailure(verifyBody("Alice", "Anderson", "1990-05-18", null), 3);
        mockMvc.perform(verifyRequest(verifyBody("Alice", "Anderson", "1990-05-17", null))).andExpect(status().isOk());

        assertGenericFailure(verifyBody("Alice", "Anderson", "1990-05-18", null), 4);
    }

    @Test
    void theLockIsPerPoll() throws Exception {
        addPlayer("Alice", "Anderson", DOB, true);
        UUID firstPoll = currentPollId();
        for (int i = 0; i < 5; i++) {
            mockMvc.perform(verifyRequest(verifyBody("Alice", "Anderson", "1990-05-18", null)))
                    .andExpect(status().isForbidden());
        }
        mockMvc.perform(verifyRequest(verifyBody("Alice", "Anderson", "1990-05-17", null))).andExpect(status().is(423));

        createPoll();
        addPlayer("Alice", "Anderson", DOB, true);
        mockMvc.perform(verifyRequest(verifyBody("Alice", "Anderson", "1990-05-17", null))).andExpect(status().isOk());
        assertThat(currentPollId()).isNotEqualTo(firstPoll);
    }

    @Test
    void theThirtyFirstVerifyCallFromOneAddressIsRateLimited() throws Exception {
        addPlayer("Alice", "Anderson", DOB, true);
        String base = baseUrl(currentPollId());

        for (int call = 0; call < 30; call++) {
            // A different unknown name each time so no name lock interferes: only the address limit counts.
            mockMvc.perform(verifyRequest(base, verifyBody("Name" + call, "Nobody" + call, "1990-05-17", null),
                            "192.0.2.50"))
                    .andExpect(status().isForbidden());
        }
        mockMvc.perform(verifyRequest(base, verifyBody("Alice", "Anderson", "1990-05-17", null), "192.0.2.50"))
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.retryAfterSeconds").value(org.hamcrest.Matchers.greaterThan(0)))
                .andExpect(jsonPath("$.token").doesNotExist());
        // Another address is unaffected.
        mockMvc.perform(verifyRequest(base, verifyBody("Alice", "Anderson", "1990-05-17", null), "192.0.2.51"))
                .andExpect(status().isOk());

        // After the window the first address works again.
        for (PublicAvailabilityAttempt attempt : attemptRepository.findAll()) {
            if (attempt.getScopeKey().equals("ip:192.0.2.50")) {
                attempt.setWindowStartedAt(Instant.now().minus(16, ChronoUnit.MINUTES));
                attemptRepository.save(attempt);
            }
        }
        mockMvc.perform(verifyRequest(base, verifyBody("Alice", "Anderson", "1990-05-17", null), "192.0.2.50"))
                .andExpect(status().isOk());
    }

    // ---- answers: token rules ----

    @Test
    void answersNeedAValidTokenForThisPollAndPlayer() throws Exception {
        UUID alice = addPlayer("Alice", "Anderson", DOB, true);
        UUID bob = addPlayer("Bob", "Brown", LocalDate.of(1991, 1, 1), true);
        String aliceToken = verifiedToken("Alice", "Anderson", DOB, null);
        UUID otherPoll = UUID.randomUUID();
        Clock past = Clock.fixed(Instant.now().minus(31, ChronoUnit.MINUTES), ZoneOffset.UTC);

        mockMvc.perform(getAnswers(currentPollId(), alice, null)).andExpect(status().isUnauthorized());
        mockMvc.perform(getAnswers(currentPollId(), alice, "garbage")).andExpect(status().isUnauthorized());
        mockMvc.perform(getAnswers(currentPollId(), bob, aliceToken)).andExpect(status().isUnauthorized());
        mockMvc.perform(getAnswers(otherPoll, alice, aliceToken)).andExpect(status().isNotFound());
        mockMvc.perform(getAnswers(currentPollId(), alice, tokenFor(past, kind(), currentPollId(), alice)))
                .andExpect(status().isUnauthorized());
        PublicPollKind otherKind = kind() == PublicPollKind.POLL ? PublicPollKind.ROUND : PublicPollKind.POLL;
        mockMvc.perform(getAnswers(currentPollId(), alice, tokenFor(Clock.systemUTC(), otherKind, currentPollId(), alice)))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(putAnswers(alice, null, answersBody("AVAILABLE"))).andExpect(status().isUnauthorized());
        mockMvc.perform(putAnswers(bob, aliceToken, answersBody("AVAILABLE"))).andExpect(status().isUnauthorized());
        mockMvc.perform(getAnswers(currentPollId(), alice, aliceToken)).andExpect(status().isOk());
    }

    @Test
    void aTokenForAnotherPollOfTheSameKindIsRefused() throws Exception {
        UUID alice = addPlayer("Alice", "Anderson", DOB, true);
        String token = verifiedToken("Alice", "Anderson", DOB, null);
        UUID firstPoll = currentPollId();
        createPoll();
        addPlayer("Alice", "Anderson", DOB, true);

        mockMvc.perform(getAnswers(currentPollId(), alice, token)).andExpect(status().isUnauthorized());
        assertThat(firstPoll).isNotEqualTo(currentPollId());
    }

    @Test
    void aValidTokenForAPlayerWhoDoesNotBelongToThePollIsNotFound() throws Exception {
        addPlayer("Alice", "Anderson", DOB, true);
        UUID outsider = addOutsider("Olive", "Outside", DOB);
        String forged = tokenFor(Clock.systemUTC(), kind(), currentPollId(), outsider);

        mockMvc.perform(getAnswers(currentPollId(), outsider, forged)).andExpect(status().isNotFound());
        mockMvc.perform(putAnswers(outsider, forged, answersBody("AVAILABLE"))).andExpect(status().isNotFound());
    }

    // ---- answers: save, source and manager marker ----

    @Test
    void answersAreEmptyUntilSavedThenSavedAsPublicLinkAndShownToTheManager() throws Exception {
        UUID alice = addPlayer("Alice", "Anderson", DOB, true);
        String token = verifiedToken("Alice", "Anderson", DOB, null);

        mockMvc.perform(getAnswers(currentPollId(), alice, token))
                .andExpect(status().isOk()).andExpect(jsonPath("$.answers.length()").value(0));

        mockMvc.perform(putAnswers(alice, token, answersBody("UNSURE")))
                .andExpect(status().isOk())
                .andExpect(jsonPath(firstAnswerStatusPath()).value("UNSURE"));
        mockMvc.perform(getAnswers(currentPollId(), alice, token))
                .andExpect(jsonPath(firstAnswerStatusPath()).value("UNSURE"));
        // Changing the answer replaces it (upsert), it does not add a second one.
        mockMvc.perform(putAnswers(alice, token, answersBody("AVAILABLE")))
                .andExpect(jsonPath(firstAnswerStatusPath()).value("AVAILABLE"));
        mockMvc.perform(getAnswers(currentPollId(), alice, token))
                .andExpect(jsonPath(firstAnswerStatusPath()).value("AVAILABLE"));

        assertThat(storedSource(alice)).isEqualTo("PUBLIC_LINK");
        assertThat(managerViaLink(alice)).isTrue();

        managerSets(alice, "UNAVAILABLE");

        assertThat(storedSource(alice)).isEqualTo("MANAGER");
        assertThat(managerViaLink(alice)).isFalse();
    }

    @Test
    void aClosedPollRefusesAnswersWith409() throws Exception {
        UUID alice = addPlayer("Alice", "Anderson", DOB, true);
        String token = verifiedToken("Alice", "Anderson", DOB, null);
        String body = answersBody("AVAILABLE");
        closeCurrentPoll();

        mockMvc.perform(putAnswers(alice, token, body)).andExpect(status().isConflict());
        mockMvc.perform(get(baseUrl(currentPollId()))).andExpect(jsonPath("$.open").value(false));
    }

    @Test
    void noPublicResponseBeforeVerificationContainsPlayerDataOrAList() throws Exception {
        addPlayer("Alice", "Anderson", DOB, true);
        addPlayer("Bob", "Brown", LocalDate.of(1991, 1, 1), true);
        UUID alice = UUID.randomUUID();
        String[] bodies = {
            mockMvc.perform(get(baseUrl(currentPollId()))).andReturn().getResponse().getContentAsString(),
            mockMvc.perform(verifyRequest(verifyBody("Alice", "Anderson", "1990-05-18", null))).andReturn()
                    .getResponse().getContentAsString(),
            mockMvc.perform(verifyRequest(verifyBody("Nobody", "Here", "1990-05-18", null))).andReturn()
                    .getResponse().getContentAsString(),
            mockMvc.perform(getAnswers(currentPollId(), alice, null)).andReturn().getResponse().getContentAsString(),
            mockMvc.perform(putAnswers(alice, null, answersBody("AVAILABLE"))).andReturn().getResponse()
                    .getContentAsString(),
        };
        for (String raw : bodies) {
            assertThat(raw).doesNotContainIgnoringCase("alice").doesNotContainIgnoringCase("bob")
                    .doesNotContainIgnoringCase("anderson").doesNotContain("dateOfBirth").doesNotContain("1990-05-17")
                    .doesNotContain("1991-01-01").doesNotContain("@example.com").doesNotContain("0821234567").doesNotContain("0829999999")
                    .doesNotContain("\"responses\"").doesNotContain("\"players\"");
        }
    }

    // ---- removed endpoints ----

    @Test
    void theOldPublicEndpointsAreGone() throws Exception {
        UUID alice = addPlayer("Alice", "Anderson", DOB, true);

        int status = mockMvc.perform(put(baseUrl(currentPollId()) + "/players/" + alice)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"status\":\"AVAILABLE\"}"))
                .andReturn().getResponse().getStatus();
        assertThat(status).isIn(404, 405);
        mockMvc.perform(get(baseUrl(currentPollId()) + "/players")).andExpect(status().isNotFound());
        // The header response has no 'responses' list any more.
        mockMvc.perform(get(baseUrl(currentPollId()))).andExpect(jsonPath("$.responses").doesNotExist());
    }

    // ---- statement count ----

    @Test
    void verifyIssuesTheSameNumberOfStatementsForThreeAndForThirtyPlayers() throws Exception {
        for (int i = 0; i < 3; i++) {
            addPlayer("Filler" + i, "Small" + i, LocalDate.of(1980 + i, 1, 1), true);
        }
        addPlayer("Alice", "Anderson", DOB, true);
        long small = statementsForVerify();

        createPoll();
        for (int i = 0; i < 30; i++) {
            addPlayer("Filler" + i, "Large" + i, LocalDate.of(1970 + i, 1, 1), true);
        }
        addPlayer("Alice", "Anderson", DOB, true);
        long large = statementsForVerify();

        assertThat(large).isEqualTo(small);
    }

    private long statementsForVerify() throws Exception {
        Statistics statistics = entityManagerFactory.unwrap(SessionFactory.class).getStatistics();
        assertThat(statistics.isStatisticsEnabled()).isTrue();
        statistics.clear();
        mockMvc.perform(verifyRequest(verifyBody("Alice", "Anderson", "1990-05-17", null)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("VERIFIED"));
        return statistics.getPrepareStatementCount();
    }

    protected MockHttpServletRequestBuilder managerGet(String url) {
        return get(url).with(platformAdmin());
    }
}
