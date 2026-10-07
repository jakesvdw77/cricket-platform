package com.cricketlegend.service.support;

import com.cricketlegend.exception.InvalidPublicTokenException;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.UUID;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Stateless proof that a player passed the public verify step (docs/specs/077): {@code
 * base64url(payload).base64url(HMAC-SHA256(payload))} where payload is {@code
 * kind|id|playerId|expiryEpochSeconds}. Valid for 30 minutes, bound to one poll and one player,
 * compared in constant time. The secret comes from {@code
 * cricketlegend.public-availability.token-secret}; when unset a random per-process secret is used
 * (tokens then stop working on restart or across instances) and a warning is logged, so startup
 * never fails. Production MUST set the property.
 */
@Component
public class PublicAvailabilityToken {

    public static final Duration VALIDITY = Duration.ofMinutes(30);

    /** An issued token and its expiry. */
    public record Issued(String token, Instant expiresAt) {
    }

    private static final Logger log = LoggerFactory.getLogger(PublicAvailabilityToken.class);
    private static final String HMAC = "HmacSHA256";
    private static final Base64.Encoder ENCODER = Base64.getUrlEncoder().withoutPadding();
    private static final Base64.Decoder DECODER = Base64.getUrlDecoder();

    private final byte[] secret;
    private final Clock clock;

    public PublicAvailabilityToken(
            @Value("${cricketlegend.public-availability.token-secret:}") String configuredSecret, Clock clock) {
        this.clock = clock;
        if (configuredSecret == null || configuredSecret.isBlank()) {
            log.warn("cricketlegend.public-availability.token-secret is not set: using a random per-process "
                    + "secret, public availability tokens will not survive a restart. Set it in production.");
            byte[] random = new byte[32];
            new SecureRandom().nextBytes(random);
            this.secret = random;
        } else {
            this.secret = configuredSecret.getBytes(StandardCharsets.UTF_8);
        }
    }

    public Issued issue(PublicPollKind kind, UUID pollId, UUID playerId) {
        Instant expiresAt = clock.instant().plus(VALIDITY);
        String payload = payload(kind, pollId, playerId, expiresAt.getEpochSecond());
        String token = ENCODER.encodeToString(payload.getBytes(StandardCharsets.UTF_8))
                + "." + ENCODER.encodeToString(sign(payload));
        return new Issued(token, expiresAt);
    }

    /** Throws {@link InvalidPublicTokenException} unless the token is genuine, unexpired and for exactly this scope. */
    public void validate(String token, PublicPollKind kind, UUID pollId, UUID playerId) {
        if (token == null || token.isBlank()) {
            throw new InvalidPublicTokenException("A verification token is required");
        }
        int dot = token.indexOf('.');
        if (dot <= 0 || dot == token.length() - 1) {
            throw new InvalidPublicTokenException("Invalid verification token");
        }
        String payload;
        byte[] signature;
        try {
            payload = new String(DECODER.decode(token.substring(0, dot)), StandardCharsets.UTF_8);
            signature = DECODER.decode(token.substring(dot + 1));
        } catch (IllegalArgumentException ex) {
            throw new InvalidPublicTokenException("Invalid verification token");
        }
        if (!MessageDigest.isEqual(sign(payload), signature)) {
            throw new InvalidPublicTokenException("Invalid verification token");
        }
        String[] parts = payload.split("\\|", -1);
        if (parts.length != 4) {
            throw new InvalidPublicTokenException("Invalid verification token");
        }
        long expiry;
        try {
            expiry = Long.parseLong(parts[3]);
        } catch (NumberFormatException ex) {
            throw new InvalidPublicTokenException("Invalid verification token");
        }
        if (clock.instant().getEpochSecond() >= expiry) {
            throw new InvalidPublicTokenException("The verification has expired");
        }
        boolean sameScope = parts[0].equals(kind.name())
                && parts[1].equals(pollId.toString())
                && parts[2].equals(playerId.toString());
        if (!sameScope) {
            throw new InvalidPublicTokenException("Invalid verification token");
        }
    }

    private static String payload(PublicPollKind kind, UUID pollId, UUID playerId, long expiryEpochSeconds) {
        return kind.name() + "|" + pollId + "|" + playerId + "|" + expiryEpochSeconds;
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
