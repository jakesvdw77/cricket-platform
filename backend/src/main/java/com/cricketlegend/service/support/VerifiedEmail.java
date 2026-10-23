package com.cricketlegend.service.support;

import com.cricketlegend.exception.EmailNotVerifiedException;
import org.springframework.security.oauth2.jwt.Jwt;

/** Reads the verified login email from a token; the one place the {@code email_verified} claim is enforced for 119. */
public final class VerifiedEmail {

    private VerifiedEmail() {}

    /** The token's email, or {@link EmailNotVerifiedException} when it is missing or {@code email_verified} is not true. */
    public static String require(Jwt jwt) {
        String email = jwt == null ? null : jwt.getClaimAsString("email");
        boolean verified = jwt != null && Boolean.TRUE.equals(jwt.getClaimAsBoolean("email_verified"));
        if (email == null || email.isBlank() || !verified) {
            throw new EmailNotVerifiedException();
        }
        return email.trim();
    }
}
