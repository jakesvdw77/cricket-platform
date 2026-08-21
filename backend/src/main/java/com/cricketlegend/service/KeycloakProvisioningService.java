package com.cricketlegend.service;

import com.cricketlegend.domain.Person;

/**
 * Per docs/specs/016-keycloak-account-provisioning.md. Caller is responsible for the
 * "don't call this twice for the same Person" guard (Person.keycloakUserId /
 * keycloakProvisionedAt) — this method always attempts to create a new Keycloak user.
 */
public interface KeycloakProvisioningService {

    /** @throws com.cricketlegend.exception.KeycloakProvisioningException if either Admin API call fails */
    void provisionAccount(Person person);

    /**
     * Ensures the platform's public SPA client trusts {@code clubSlug}'s own subdomain as a
     * valid OIDC redirect URI and CORS web origin. Keycloak's matching for both settings doesn't
     * support a wildcard embedded in the hostname — confirmed empirically against the deployed
     * version, not just theorized (see docs/specs/002-realm-subdomain-auth.md's ADR-03, which
     * flagged this as unverified) — so an explicit per-club entry, registered at club
     * creation/rename, is the real fallback that spec already named, not an optional refinement.
     * Idempotent: safe to call for a slug that's already registered.
     *
     * @throws com.cricketlegend.exception.KeycloakProvisioningException if the Admin API call fails
     */
    void registerClubRedirectAccess(String clubSlug);
}
