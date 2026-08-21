package com.cricketlegend.service.impl;

import com.cricketlegend.domain.Person;
import com.cricketlegend.exception.KeycloakProvisioningException;
import com.cricketlegend.service.KeycloakProvisioningService;
import jakarta.ws.rs.core.Response;
import java.util.List;
import org.keycloak.admin.client.CreatedResponseUtil;
import org.keycloak.admin.client.Keycloak;
import org.keycloak.representations.idm.UserRepresentation;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/**
 * Per docs/specs/016-keycloak-account-provisioning.md. Constructor injection only
 * (docs/standards/backend.md, ArchUnit-enforced) — no field injection.
 */
@Service
public class KeycloakProvisioningServiceImpl implements KeycloakProvisioningService {

    private final Keycloak keycloakAdminClient;
    private final String realm;
    private final String publicClientId;
    private final String resetRedirectUri;

    public KeycloakProvisioningServiceImpl(
            Keycloak keycloakAdminClient,
            @Value("${app.keycloak.admin.realm}") String realm,
            @Value("${app.keycloak.public-client-id}") String publicClientId,
            @Value("${app.frontend.base-url}") String frontendBaseUrl) {
        this.keycloakAdminClient = keycloakAdminClient;
        this.realm = realm;
        this.publicClientId = publicClientId;
        this.resetRedirectUri = frontendBaseUrl + "/post-login";
    }

    @Override
    public void provisionAccount(Person person) {
        UserRepresentation user = new UserRepresentation();
        user.setEnabled(true);
        // Keycloak's admin REST API requires a non-blank username unless the realm has
        // "Email as username" (registrationEmailAsUsername) turned on — nothing in this repo's
        // setup enables that, so it can't be relied on. Setting it explicitly here works
        // regardless of that realm toggle, and matches the email-based identity this spec
        // already uses everywhere else (bridge-by-email in MeServiceImpl, findOrCreatePerson).
        user.setUsername(person.getEmail());
        user.setEmail(person.getEmail());
        user.setFirstName(person.getFirstName());
        user.setLastName(person.getLastName());
        user.setEmailVerified(false);

        String createdUserId;
        try (Response response = keycloakAdminClient.realm(realm).users().create(user)) {
            if (response.getStatus() != 201) {
                throw new KeycloakProvisioningException(
                        "Keycloak user creation failed for person " + person.getId()
                                + ": HTTP " + response.getStatus(), null);
            }
            createdUserId = CreatedResponseUtil.getCreatedId(response);
        } catch (KeycloakProvisioningException e) {
            throw e;
        } catch (Exception e) {
            throw new KeycloakProvisioningException(
                    "Keycloak user creation failed for person " + person.getId(), e);
        }

        try {
            keycloakAdminClient
                    .realm(realm)
                    .users()
                    .get(createdUserId)
                    .executeActionsEmail(publicClientId, resetRedirectUri, List.of("UPDATE_PASSWORD"));
        } catch (Exception e) {
            throw new KeycloakProvisioningException(
                    "execute-actions-email failed for person " + person.getId()
                            + " (Keycloak user " + createdUserId + " was created)", e);
        }
        // The Keycloak-generated createdUserId is deliberately not persisted anywhere — see
        // Non-goals. Person.keycloakUserId is set only at first login, from the JWT's own sub.
    }
}
