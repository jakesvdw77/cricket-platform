package com.cricketlegend.service.support;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.cricketlegend.exception.EmailNotVerifiedException;
import java.time.Instant;
import org.junit.jupiter.api.Test;
import org.springframework.security.oauth2.jwt.Jwt;

/** The one place the email_verified claim is enforced for spec 119: an unverified email is refused everywhere. */
class VerifiedEmailTest {

    private static Jwt jwt(String email, Object verified) {
        Jwt.Builder builder = Jwt.withTokenValue("t")
                .header("alg", "none")
                .issuedAt(Instant.now())
                .expiresAt(Instant.now().plusSeconds(60))
                .subject("sub-1");
        if (email != null) {
            builder.claim("email", email);
        }
        if (verified != null) {
            builder.claim("email_verified", verified);
        }
        return builder.build();
    }

    @Test
    void returnsTheTrimmedEmailWhenVerified() {
        assertThat(VerifiedEmail.require(jwt("  Parent@Example.com ", true))).isEqualTo("Parent@Example.com");
    }

    @Test
    void refusesAnUnverifiedMissingOrBlankEmail() {
        assertThatThrownBy(() -> VerifiedEmail.require(jwt("p@example.com", false)))
                .isInstanceOf(EmailNotVerifiedException.class);
        assertThatThrownBy(() -> VerifiedEmail.require(jwt("p@example.com", null)))
                .isInstanceOf(EmailNotVerifiedException.class);
        assertThatThrownBy(() -> VerifiedEmail.require(jwt(null, true))).isInstanceOf(EmailNotVerifiedException.class);
        assertThatThrownBy(() -> VerifiedEmail.require(jwt("   ", true))).isInstanceOf(EmailNotVerifiedException.class);
        assertThatThrownBy(() -> VerifiedEmail.require(null)).isInstanceOf(EmailNotVerifiedException.class);
    }

    @Test
    void aStringClaimIsConvertedByTheJwtLibraryAndAnythingNotTrueIsUnverified() {
        assertThat(VerifiedEmail.require(jwt("p@example.com", "true"))).isEqualTo("p@example.com");
        assertThatThrownBy(() -> VerifiedEmail.require(jwt("p@example.com", "no")))
                .isInstanceOf(EmailNotVerifiedException.class);
    }
}
