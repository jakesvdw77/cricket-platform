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
}
