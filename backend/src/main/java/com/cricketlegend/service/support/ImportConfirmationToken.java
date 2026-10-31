package com.cricketlegend.service.support;

import com.cricketlegend.exception.ImportConfirmationInvalidException;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.time.Clock;
import java.time.Instant;
import java.util.Base64;
import java.util.UUID;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;
import org.springframework.stereotype.Component;

/**
 * The import confirmation token (docs/specs/097-import-framework.md, principle 1):
 * {@code base64url(payload).base64url(HMAC-SHA256(payload))} with payload
 * {@code batchId|revision|digest|userId|issuedAtEpochSeconds}. Bound to the exact reviewed data (the digest), the
 * decisions revision and the issuing user, valid for {@link ImportLimits#IMPORT_TOKEN_TTL}, compared in constant time.
 * The pattern is {@link PublicAvailabilityToken}'s, deliberately not generalised from it.
 *
 * <p>The secret is {@code app.imports.token-secret}, supplied by environment and never committed. Unlike the public
 * availability token there is no random fallback: outside the {@code dev} profile, a missing or blank secret fails
 * startup. The secret is never logged.
 */
@Component
public class ImportConfirmationToken {

    /** An issued token and when it was issued. */
    public record Issued(String token, Instant issuedAt) {
    }

    private static final String HMAC = "HmacSHA256";
    private static final Base64.Encoder ENCODER = Base64.getUrlEncoder().withoutPadding();
    private static final Base64.Decoder DECODER = Base64.getUrlDecoder();
    private static final String INVALID = "This confirmation is no longer valid. Review the import and confirm again.";

    private final byte[] secret;
    private final Clock clock;

    public ImportConfirmationToken(
            @Value("${app.imports.token-secret:}") String configuredSecret, Environment environment, Clock clock) {
        this.clock = clock;
        if (configuredSecret == null || configuredSecret.isBlank()) {
            String hint = environment.acceptsProfiles(Profiles.of("dev"))
                    ? "the dev profile should supply a default"
                    : "set it from the environment (IMPORT_TOKEN_SECRET)";
            throw new IllegalStateException("app.imports.token-secret is missing or blank: " + hint);
        }
        this.secret = configuredSecret.getBytes(StandardCharsets.UTF_8);
    }

    public Issued issue(UUID batchId, int revision, String digest, UUID userId) {
        Instant issuedAt = clock.instant();
        String payload = payload(batchId, revision, digest, userId, issuedAt.getEpochSecond());
        String token = ENCODER.encodeToString(payload.getBytes(StandardCharsets.UTF_8))
                + "." + ENCODER.encodeToString(sign(payload));
        return new Issued(token, issuedAt);
    }

    /**
     * Throws {@link ImportConfirmationInvalidException} unless the token is genuine, issued to {@code userId} for exactly
     * this batch, revision and digest, and (when {@code enforceExpiry}) younger than the token lifetime. The already
     * committed retry path passes {@code false}: the same token proves the same confirmation even after it has aged.
     */
    public void validate(
            String token, UUID batchId, int revision, String digest, UUID userId, boolean enforceExpiry) {
        if (token == null || token.isBlank() || digest == null) {
            throw new ImportConfirmationInvalidException("A confirmation is required before anything is imported.");
        }
        int dot = token.indexOf('.');
        if (dot <= 0 || dot == token.length() - 1) {
            throw new ImportConfirmationInvalidException(INVALID);
        }
        String payload;
        byte[] signature;
        try {
            payload = new String(DECODER.decode(token.substring(0, dot)), StandardCharsets.UTF_8);
            signature = DECODER.decode(token.substring(dot + 1));
        } catch (IllegalArgumentException ex) {
            throw new ImportConfirmationInvalidException(INVALID);
        }
        if (!MessageDigest.isEqual(sign(payload), signature)) {
            throw new ImportConfirmationInvalidException(INVALID);
        }
        String[] parts = payload.split("\\|", -1);
        if (parts.length != 5) {
            throw new ImportConfirmationInvalidException(INVALID);
        }
        long issuedAt;
        try {
            issuedAt = Long.parseLong(parts[4]);
        } catch (NumberFormatException ex) {
            throw new ImportConfirmationInvalidException(INVALID);
        }
        boolean sameSubject = parts[0].equals(batchId.toString())
                && parts[1].equals(Integer.toString(revision))
                && parts[2].equals(digest)
                && parts[3].equals(userId.toString());
        if (!sameSubject) {
            throw new ImportConfirmationInvalidException(INVALID);
        }
        if (enforceExpiry && clock.instant().getEpochSecond() >= issuedAt + ImportLimits.IMPORT_TOKEN_TTL.toSeconds()) {
            throw new ImportConfirmationInvalidException("This confirmation has expired. Review the import and confirm again.");
        }
    }

    private static String payload(UUID batchId, int revision, String digest, UUID userId, long issuedAtEpochSeconds) {
        return batchId + "|" + revision + "|" + digest + "|" + userId + "|" + issuedAtEpochSeconds;
    }

    private byte[] sign(String payload) {
        try {
            Mac mac = Mac.getInstance(HMAC);
            mac.init(new SecretKeySpec(secret, HMAC));
            return mac.doFinal(payload.getBytes(StandardCharsets.UTF_8));
        } catch (GeneralSecurityException ex) {
            throw new IllegalStateException("HMAC-SHA256 is unavailable", ex);
        }
    }
}
