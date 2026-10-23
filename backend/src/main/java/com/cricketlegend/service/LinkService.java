package com.cricketlegend.service;

import com.cricketlegend.dto.ConfirmLinksRequest;
import com.cricketlegend.dto.ConfirmLinksResultDto;
import com.cricketlegend.dto.PlayerMatchesDto;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.jwt.Jwt;

/** Per docs/specs/119-login-account-journey.md, the v1 flow for agents (email match and confirm). */
public interface LinkService {

    /** Players on record under the caller's verified email, minimised and split by whether they have a main agent. */
    PlayerMatchesDto matches(Authentication authentication, Jwt jwt);

    /** Creates ACTIVE main-agent links for the confirmed players; needs {@code confirm: true} and refs from the caller's matches. */
    ConfirmLinksResultDto confirm(Authentication authentication, Jwt jwt, ConfirmLinksRequest request);
}
