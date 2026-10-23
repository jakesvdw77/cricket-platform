package com.cricketlegend.service;

import com.cricketlegend.dto.MeAccessDto;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.jwt.Jwt;

/** Per docs/specs/016-keycloak-account-provisioning.md. */
public interface MeService {

    MeAccessDto activateAndResolveAccess(Authentication authentication, Jwt jwt);

    /** docs/specs/119: creates the self-registered Person for a verified-email login (idempotent) and returns the same access info. */
    MeAccessDto register(Authentication authentication, Jwt jwt);
}
