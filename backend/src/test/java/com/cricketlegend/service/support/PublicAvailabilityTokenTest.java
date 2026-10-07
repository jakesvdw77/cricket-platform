package com.cricketlegend.service.support;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.cricketlegend.exception.InvalidPublicTokenException;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class PublicAvailabilityTokenTest {

    private static final Instant NOW = Instant.parse("2026-10-07T10:00:00Z");

    private final UUID pollId = UUID.randomUUID();
    private final UUID playerId = UUID.randomUUID();

    private PublicAvailabilityToken tokenAt(Instant instant, String secret) {
        return new PublicAvailabilityToken(secret, Clock.fixed(instant, ZoneOffset.UTC));
    }

    @Test
    void roundTripValidatesAndExpiresInThirtyMinutes() {
        PublicAvailabilityToken tokens = tokenAt(NOW, "secret");

        PublicAvailabilityToken.Issued issued = tokens.issue(PublicPollKind.POLL, pollId, playerId);

        assertThat(issued.expiresAt()).isEqualTo(NOW.plus(Duration.ofMinutes(30)));
        assertThat(issued.token()).matches("[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+");
        assertThatCode(() -> tokens.validate(issued.token(), PublicPollKind.POLL, pollId, playerId))
                .doesNotThrowAnyException();
    }

    @Test
    void tamperedPayloadOrSignatureIsRejected() {
        PublicAvailabilityToken tokens = tokenAt(NOW, "secret");
        String token = tokens.issue(PublicPollKind.POLL, pollId, playerId).token();
        String[] parts = token.split("\\.");
        String flippedSignature = parts[1].substring(0, parts[1].length() - 1)
                + (parts[1].endsWith("A") ? "B" : "A");
        String otherPayload = tokens.issue(PublicPollKind.POLL, pollId, UUID.randomUUID()).token().split("\\.")[0];

        assertInvalid(tokens, parts[0] + "." + flippedSignature);
        assertInvalid(tokens, otherPayload + "." + parts[1]);
        assertInvalid(tokens, parts[0]);
        assertInvalid(tokens, "not-a-token");
        assertInvalid(tokens, "!!!.???");
        assertInvalid(tokens, "");
        assertInvalid(tokens, null);
    }

    @Test
    void tokenSignedWithAnotherSecretIsRejected() {
        String token = tokenAt(NOW, "other-secret").issue(PublicPollKind.POLL, pollId, playerId).token();

        assertInvalid(tokenAt(NOW, "secret"), token);
    }

    @Test
    void expiredTokenIsRejected() {
        String token = tokenAt(NOW, "secret").issue(PublicPollKind.POLL, pollId, playerId).token();

        assertThatCode(() -> tokenAt(NOW.plus(Duration.ofMinutes(29)), "secret")
                        .validate(token, PublicPollKind.POLL, pollId, playerId))
                .doesNotThrowAnyException();
        assertInvalid(tokenAt(NOW.plus(Duration.ofMinutes(30)), "secret"), token);
        assertInvalid(tokenAt(NOW.plus(Duration.ofHours(2)), "secret"), token);
    }

    @Test
    void wrongScopeIsRejected() {
        PublicAvailabilityToken tokens = tokenAt(NOW, "secret");
        String token = tokens.issue(PublicPollKind.POLL, pollId, playerId).token();

        assertThatThrownBy(() -> tokens.validate(token, PublicPollKind.ROUND, pollId, playerId))
                .isInstanceOf(InvalidPublicTokenException.class);
        assertThatThrownBy(() -> tokens.validate(token, PublicPollKind.POLL, UUID.randomUUID(), playerId))
                .isInstanceOf(InvalidPublicTokenException.class);
        assertThatThrownBy(() -> tokens.validate(token, PublicPollKind.POLL, pollId, UUID.randomUUID()))
                .isInstanceOf(InvalidPublicTokenException.class);
    }

    @Test
    void missingSecretStillWorksWithARandomPerProcessSecret() {
        PublicAvailabilityToken first = tokenAt(NOW, "");
        PublicAvailabilityToken second = tokenAt(NOW, "");
        String token = first.issue(PublicPollKind.ROUND, pollId, playerId).token();

        assertThatCode(() -> first.validate(token, PublicPollKind.ROUND, pollId, playerId))
                .doesNotThrowAnyException();
        assertInvalid(second, token);
    }

    private void assertInvalid(PublicAvailabilityToken tokens, String token) {
        assertThatThrownBy(() -> tokens.validate(token, PublicPollKind.POLL, pollId, playerId))
                .isInstanceOf(InvalidPublicTokenException.class);
    }
}
