package com.cricketlegend.service.support;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.cricketlegend.dto.PublicVerifyRequest;
import com.cricketlegend.dto.PublicVerifyResponseDto;
import com.cricketlegend.dto.PublicVerifyStatus;
import com.cricketlegend.exception.PublicRateLimitedException;
import com.cricketlegend.exception.PublicVerificationFailedException;
import com.cricketlegend.exception.PublicVerificationLockedException;
import com.cricketlegend.repository.PlayerDateOfBirthView;
import com.cricketlegend.repository.PlayerProfileRepository;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class PublicAvailabilityVerifierTest {

    private static final Instant NOW = Instant.parse("2026-10-07T10:00:00Z");
    private static final LocalDate DOB = LocalDate.of(1990, 5, 17);

    @Mock
    private PlayerProfileRepository playerProfileRepository;

    @Mock
    private PublicAttemptTracker tracker;

    private final PublicAvailabilityToken tokens =
            new PublicAvailabilityToken("secret", Clock.fixed(NOW, ZoneOffset.UTC));

    private PublicAvailabilityVerifier verifier;
    private final UUID pollId = UUID.randomUUID();
    private final UUID jaco = UUID.randomUUID();
    private final UUID other = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        verifier = new PublicAvailabilityVerifier(playerProfileRepository, tracker, tokens);
    }

    private static PlayerDateOfBirthView view(UUID id, LocalDate dob) {
        return new PlayerDateOfBirthView() {
            @Override
            public UUID getPlayerProfileId() {
                return id;
            }

            @Override
            public LocalDate getDateOfBirth() {
                return dob;
            }
        };
    }

    private void callsAllowed() {
        when(tracker.increment(startsWith("ip:"), anyInt())).thenReturn(new AttemptState(1, NOW));
        when(tracker.lockedUntil(anyString())).thenReturn(Optional.empty());
    }

    private static String startsWith(String prefix) {
        return org.mockito.ArgumentMatchers.startsWith(prefix);
    }

    private PublicVerifyResponseDto callVerify(List<PublicAudienceMember> audience, String first, String last,
            LocalDate dob, UUID playerId) {
        return verifier.verify(PublicPollKind.POLL, pollId, audience,
                new PublicVerifyRequest(first, last, dob, playerId), "10.0.0.1", () -> "1st XI");
    }

    private PublicAudienceMember member(UUID id, String first, String last) {
        return new PublicAudienceMember(id, first, last, 7);
    }

    @Test
    void exactNameAndDateVerifiesAndIssuesAScopedToken() {
        callsAllowed();
        when(playerProfileRepository.findActiveDatesOfBirth(any())).thenReturn(List.of(view(jaco, DOB)));

        PublicVerifyResponseDto response = callVerify(
                List.of(member(jaco, "Jaco", "van der Westhuizen"), member(other, "Pieter", "Smit")),
                "Jaco", "van der Westhuizen", DOB, null);

        assertThat(response.status()).isEqualTo(PublicVerifyStatus.VERIFIED);
        assertThat(response.playerId()).isEqualTo(jaco);
        assertThat(response.firstName()).isEqualTo("Jaco");
        assertThat(response.expiresAt()).isEqualTo(NOW.plusSeconds(1800));
        tokens.validate(response.token(), PublicPollKind.POLL, pollId, jaco);
        verify(tracker).clear(PublicAvailabilityVerifier.nameKey(PublicPollKind.POLL, pollId, "Jaco", "Westhuizen"));
    }

    @Test
    void lenientNameWithTheRightDateVerifies() {
        callsAllowed();
        when(playerProfileRepository.findActiveDatesOfBirth(any())).thenReturn(List.of(view(jaco, DOB)));

        PublicVerifyResponseDto response = callVerify(
                List.of(member(jaco, "Jaco", "van der Westhuizen")), "jaco", "Wessthuizen", DOB, null);

        assertThat(response.status()).isEqualTo(PublicVerifyStatus.VERIFIED);
    }

    @Test
    void lenientNameWithTheWrongDateFailsGenericallyAndCountsOnTheNameKey() {
        callsAllowed();
        when(playerProfileRepository.findActiveDatesOfBirth(any())).thenReturn(List.of(view(jaco, DOB)));
        // The lock key uses the typed spelling (particles stripped, no typo tolerance).
        String key = PublicAvailabilityVerifier.nameKey(PublicPollKind.POLL, pollId, "Jaco", "Wessthuizen");
        when(tracker.increment(key, 5)).thenReturn(new AttemptState(2, NOW));

        assertThatThrownBy(() -> callVerify(List.of(member(jaco, "Jaco", "van der Westhuizen")),
                        "Jaco", "Wessthuizen", DOB.plusDays(1), null))
                .isInstanceOf(PublicVerificationFailedException.class)
                .hasMessage("We could not find a player with those details in this poll.")
                .satisfies(ex -> assertThat(((PublicVerificationFailedException) ex).getTriesLeft()).isEqualTo(3));
    }

    @Test
    void unknownNameFailsTheSameWayAndSkipsTheDateOfBirthQuery() {
        callsAllowed();
        when(tracker.increment(anyString(), eq(5))).thenReturn(new AttemptState(5, NOW));

        assertThatThrownBy(() -> callVerify(List.of(member(jaco, "Jaco", "Westhuizen")), "Jaco", "Smith", DOB, null))
                .isInstanceOf(PublicVerificationFailedException.class)
                .satisfies(ex -> assertThat(((PublicVerificationFailedException) ex).getTriesLeft()).isZero());
        verify(playerProfileRepository, never()).findActiveDatesOfBirth(any());
    }

    @Test
    void spellingVariantsShareOneLockKey() {
        String a = PublicAvailabilityVerifier.nameKey(PublicPollKind.POLL, pollId, "Jaco", "van der Westhuizen");
        String b = PublicAvailabilityVerifier.nameKey(PublicPollKind.POLL, pollId, " jaco ", "VanderWesthuizen");
        String c = PublicAvailabilityVerifier.nameKey(PublicPollKind.POLL, pollId, "Jaco", "Westhuizen");

        assertThat(a).isEqualTo(b).isEqualTo(c).startsWith("name:POLL:" + pollId + ":");
        assertThat(PublicAvailabilityVerifier.nameKey(PublicPollKind.ROUND, pollId, "Jaco", "Westhuizen"))
                .isNotEqualTo(a);
        assertThat(PublicAvailabilityVerifier.nameKey(PublicPollKind.POLL, UUID.randomUUID(), "Jaco", "Westhuizen"))
                .isNotEqualTo(a);
        assertThat(a.length()).isLessThan(255);
    }

    @Test
    void onlyTheDateSeparatesTwoSimilarNames() {
        callsAllowed();
        UUID johan = UUID.randomUUID();
        UUID johann = UUID.randomUUID();
        when(playerProfileRepository.findActiveDatesOfBirth(any()))
                .thenReturn(List.of(view(johan, LocalDate.of(1985, 1, 1)), view(johann, LocalDate.of(1992, 2, 2))));
        List<PublicAudienceMember> audience =
                List.of(member(johan, "Johan", "Pretorius"), member(johann, "Johann", "Pretorius"));

        assertThat(callVerify(audience, "Johan", "Pretorius", LocalDate.of(1992, 2, 2), null).playerId())
                .isEqualTo(johann);
        assertThat(callVerify(audience, "Johann", "Pretorius", LocalDate.of(1985, 1, 1), null).playerId())
                .isEqualTo(johan);
    }

    @Test
    void sameNameSameDateOffersPickAndThenVerifiesTheChosenPlayer() {
        callsAllowed();
        when(playerProfileRepository.findActiveDatesOfBirth(any())).thenReturn(List.of(view(jaco, DOB), view(other, DOB)));
        List<PublicAudienceMember> audience = List.of(member(jaco, "Sam", "Smit"), member(other, "Sam", "Smit"));

        PublicVerifyResponseDto pick = callVerify(audience, "Sam", "Smit", DOB, null);

        assertThat(pick.status()).isEqualTo(PublicVerifyStatus.PICK);
        assertThat(pick.token()).isNull();
        assertThat(pick.playerId()).isNull();
        assertThat(pick.candidates()).extracting("playerId").containsExactlyInAnyOrder(jaco, other);
        assertThat(pick.candidates()).allSatisfy(c -> {
            assertThat(c.shirtNumber()).isEqualTo(7);
            assertThat(c.teamLabel()).isEqualTo("1st XI");
        });
        verify(tracker, never()).increment(startsWith("name:"), anyInt());

        PublicVerifyResponseDto chosen = callVerify(audience, "Sam", "Smit", DOB, other);
        assertThat(chosen.status()).isEqualTo(PublicVerifyStatus.VERIFIED);
        assertThat(chosen.playerId()).isEqualTo(other);
    }

    @Test
    void aPlayerIdThatIsNotACandidateFails() {
        callsAllowed();
        when(playerProfileRepository.findActiveDatesOfBirth(any())).thenReturn(List.of(view(jaco, DOB)));
        when(tracker.increment(startsWith("name:"), eq(5))).thenReturn(new AttemptState(1, NOW));

        assertThatThrownBy(() -> callVerify(List.of(member(jaco, "Sam", "Smit")), "Sam", "Smit", DOB, UUID.randomUUID()))
                .isInstanceOf(PublicVerificationFailedException.class);
    }

    @Test
    void missingDateOfBirthIsReportedWithoutCountingAFailure() {
        callsAllowed();
        when(playerProfileRepository.findActiveDatesOfBirth(any())).thenReturn(List.of(view(jaco, null)));

        PublicVerifyResponseDto response = callVerify(List.of(member(jaco, "Jaco", "Smit")), "Jaco", "Smit", DOB, null);

        assertThat(response.status()).isEqualTo(PublicVerifyStatus.NO_DATE_OF_BIRTH);
        assertThat(response.token()).isNull();
        verify(tracker, never()).increment(startsWith("name:"), anyInt());
    }

    @Test
    void anInactivePlayerIsTreatedAsUnknown() {
        callsAllowed();
        when(playerProfileRepository.findActiveDatesOfBirth(any())).thenReturn(List.of());
        when(tracker.increment(startsWith("name:"), eq(5))).thenReturn(new AttemptState(1, NOW));

        assertThatThrownBy(() -> callVerify(List.of(member(jaco, "Jaco", "Smit")), "Jaco", "Smit", DOB, null))
                .isInstanceOf(PublicVerificationFailedException.class);
    }

    @Test
    void aLockedNameReturnsLockedWithoutLookingAtPlayers() {
        when(tracker.increment(startsWith("ip:"), anyInt())).thenReturn(new AttemptState(1, NOW));
        when(tracker.lockedUntil(anyString())).thenReturn(Optional.of(NOW.plusSeconds(600)));
        when(tracker.secondsUntil(NOW.plusSeconds(600))).thenReturn(601L);

        assertThatThrownBy(() -> callVerify(List.of(member(jaco, "Jaco", "Smit")), "Jaco", "Smit", DOB, null))
                .isInstanceOf(PublicVerificationLockedException.class)
                .satisfies(ex -> assertThat(((PublicVerificationLockedException) ex).getRetryAfterSeconds())
                        .isEqualTo(601));
        verify(playerProfileRepository, never()).findActiveDatesOfBirth(any());
    }

    @Test
    void theThirtyFirstCallFromOneAddressIsRateLimited() {
        when(tracker.increment(startsWith("ip:"), eq(31))).thenReturn(new AttemptState(31, NOW.minusSeconds(100)));
        when(tracker.secondsUntil(NOW.minusSeconds(100).plus(PublicAttemptTracker.WINDOW))).thenReturn(801L);

        assertThatThrownBy(() -> callVerify(List.of(member(jaco, "Jaco", "Smit")), "Jaco", "Smit", DOB, null))
                .isInstanceOf(PublicRateLimitedException.class)
                .satisfies(ex -> assertThat(((PublicRateLimitedException) ex).getRetryAfterSeconds()).isEqualTo(801));
        verify(tracker, never()).lockedUntil(anyString());
    }
}
