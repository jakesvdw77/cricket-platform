package com.cricketlegend.service.support;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.cricketlegend.exception.ImportConfirmationInvalidException;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Base64;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;

/** docs/specs/097, principle 1: the HMAC token is bound to batch, revision, digest and user, and expires. */
class ImportConfirmationTokenTest {

    private static final Instant NOW = Instant.parse("2026-10-30T10:00:00Z");
    private final UUID batch = UUID.randomUUID();
    private final UUID user = UUID.randomUUID();

    private static ImportConfirmationToken tokens(String secret, Instant now) {
        return new ImportConfirmationToken(secret, new MockEnvironment(), Clock.fixed(now, ZoneOffset.UTC));
    }

    @Test
    void roundTripValidates() {
        ImportConfirmationToken tokens = tokens("secret-one", NOW);
        ImportConfirmationToken.Issued issued = tokens.issue(batch, 3, "digest-a", user);
        assertThat(issued.issuedAt()).isEqualTo(NOW);
        assertThatCode(() -> tokens.validate(issued.token(), batch, 3, "digest-a", user, true)).doesNotThrowAnyException();
    }

    @Test
    void aTokenIsBoundToItsBatchRevisionDigestAndUser() {
        ImportConfirmationToken tokens = tokens("secret-one", NOW);
        String token = tokens.issue(batch, 3, "digest-a", user).token();
        assertInvalid(() -> tokens.validate(token, UUID.randomUUID(), 3, "digest-a", user, true));
        assertInvalid(() -> tokens.validate(token, batch, 4, "digest-a", user, true));
        assertInvalid(() -> tokens.validate(token, batch, 3, "digest-b", user, true));
        assertInvalid(() -> tokens.validate(token, batch, 3, "digest-a", UUID.randomUUID(), true));
    }

    @Test
    void aTokenSignedWithAnotherSecretIsRefused() {
        String token = tokens("secret-one", NOW).issue(batch, 1, "d", user).token();
        assertInvalid(() -> tokens("secret-two", NOW).validate(token, batch, 1, "d", user, true));
    }

    @Test
    void aTamperedPayloadOrSignatureIsRefused() {
        ImportConfirmationToken tokens = tokens("secret-one", NOW);
        String token = tokens.issue(batch, 1, "d", user).token();
        int dot = token.indexOf('.');
        String forgedPayload = Base64.getUrlEncoder().withoutPadding()
                .encodeToString((batch + "|9|d|" + user + "|" + NOW.getEpochSecond()).getBytes(StandardCharsets.UTF_8));
        assertInvalid(() -> tokens.validate(forgedPayload + token.substring(dot), batch, 9, "d", user, true));
        // First signature character: the last base64 character of a 32-byte MAC carries padding bits, so flipping it can decode unchanged.
        char first = token.charAt(dot + 1);
        String flipped = token.substring(0, dot + 1) + (first == 'A' ? 'B' : 'A') + token.substring(dot + 2);
        assertInvalid(() -> tokens.validate(flipped, batch, 1, "d", user, true));
    }

    @Test
    void malformedTokensAreRefused() {
        ImportConfirmationToken tokens = tokens("secret-one", NOW);
        for (String bad : new String[] {"nodot", ".sig", "payload.", "!!!.???", "a.b.c"}) {
            assertInvalid(() -> tokens.validate(bad, batch, 1, "d", user, true));
        }
    }

    @Test
    void missingTokenOrDigestIsRefusedAsNoConfirmation() {
        ImportConfirmationToken tokens = tokens("secret-one", NOW);
        assertThatThrownBy(() -> tokens.validate(null, batch, 1, "d", user, true))
                .isInstanceOf(ImportConfirmationInvalidException.class).hasMessageContaining("required");
        assertThatThrownBy(() -> tokens.validate(" ", batch, 1, "d", user, true))
                .isInstanceOf(ImportConfirmationInvalidException.class);
        String token = tokens.issue(batch, 1, "d", user).token();
        assertThatThrownBy(() -> tokens.validate(token, batch, 1, null, user, true))
                .isInstanceOf(ImportConfirmationInvalidException.class);
    }

    @Test
    void expiresAfterThirtyMinutesButTheRetryPathIgnoresAge() {
        String token = tokens("secret-one", NOW).issue(batch, 1, "d", user).token();
        ImportConfirmationToken justInside = tokens("secret-one", NOW.plus(ImportLimits.IMPORT_TOKEN_TTL).minusSeconds(1));
        assertThatCode(() -> justInside.validate(token, batch, 1, "d", user, true)).doesNotThrowAnyException();

        ImportConfirmationToken expired = tokens("secret-one", NOW.plus(ImportLimits.IMPORT_TOKEN_TTL));
        assertThatThrownBy(() -> expired.validate(token, batch, 1, "d", user, true))
                .isInstanceOf(ImportConfirmationInvalidException.class).hasMessageContaining("expired");
        assertThatCode(() -> expired.validate(token, batch, 1, "d", user, false)).doesNotThrowAnyException();
    }

    @Test
    void aMissingSecretFailsStartupOutsideTheDevProfile() {
        assertThatThrownBy(() -> new ImportConfirmationToken("", new MockEnvironment(), Clock.systemUTC()))
                .isInstanceOf(IllegalStateException.class).hasMessageContaining("IMPORT_TOKEN_SECRET");
        assertThatThrownBy(() -> new ImportConfirmationToken("  ", new MockEnvironment(), Clock.systemUTC()))
                .isInstanceOf(IllegalStateException.class);
        MockEnvironment dev = new MockEnvironment();
        dev.setActiveProfiles("dev");
        assertThatThrownBy(() -> new ImportConfirmationToken(null, dev, Clock.systemUTC()))
                .isInstanceOf(IllegalStateException.class).hasMessageContaining("dev profile");
    }

    private static void assertInvalid(Runnable call) {
        assertThatThrownBy(call::run).isInstanceOf(ImportConfirmationInvalidException.class);
    }
}
