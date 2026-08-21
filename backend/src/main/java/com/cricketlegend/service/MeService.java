package com.cricketlegend.service;

import com.cricketlegend.dto.MeAccessDto;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.jwt.Jwt;

/** Per docs/specs/016-keycloak-account-provisioning.md. */
public interface MeService {

    MeAccessDto activateAndResolveAccess(Authentication authentication, Jwt jwt);
}
