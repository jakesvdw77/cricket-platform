package com.cricketlegend.service.impl;

import com.cricketlegend.domain.Person;
import com.cricketlegend.exception.KeycloakProvisioningException;
import com.cricketlegend.service.KeycloakProvisioningService;
import jakarta.ws.rs.core.Response;
import java.net.URI;
import java.util.ArrayList;
import java.util.List;
import org.keycloak.admin.client.CreatedResponseUtil;
import org.keycloak.admin.client.Keycloak;
import org.keycloak.representations.idm.ClientRepresentation;
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
    // Kept alongside the derived resetRedirectUri above — registerClubRedirectAccess needs the
    // raw scheme/host/port to build a per-slug origin, not the fixed /post-login path.
    private final String frontendBaseUrl;

    public KeycloakProvisioningServiceImpl(
            Keycloak keycloakAdminClient,
            @Value("${app.keycloak.admin.realm}") String realm,
            @Value("${app.keycloak.public-client-id}") String publicClientId,
            @Value("${app.frontend.base-url}") String frontendBaseUrl) {
        this.keycloakAdminClient = keycloakAdminClient;
        this.realm = realm;
        this.publicClientId = publicClientId;
        this.resetRedirectUri = frontendBaseUrl + "/post-login";
        this.frontendBaseUrl = frontendBaseUrl;
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
            // VERIFY_EMAIL alongside UPDATE_PASSWORD in the same link — MeServiceImpl.bridgeByEmail
            // requires the JWT's email_verified claim before binding a Person by email, so this
            // ensures a real invitee's first login already satisfies that, no extra step/email.
            keycloakAdminClient
                    .realm(realm)
                    .users()
                    .get(createdUserId)
                    .executeActionsEmail(publicClientId, resetRedirectUri, List.of("VERIFY_EMAIL", "UPDATE_PASSWORD"));
        } catch (Exception e) {
            throw new KeycloakProvisioningException(
                    "execute-actions-email failed for person " + person.getId()
                            + " (Keycloak user " + createdUserId + " was created)", e);
        }
        // The Keycloak-generated createdUserId is deliberately not persisted anywhere — see
        // Non-goals. Person.keycloakUserId is set only at first login, from the JWT's own sub.
    }

    // Guards the fetch-modify-update below — Keycloak's Admin API has no optimistic locking on a
    // ClientRepresentation PUT, so two of these racing (e.g. two clubs created/renamed close
    // together) can silently clobber each other: the second PUT, built from a representation
    // fetched before the first PUT landed, overwrites the first club's just-added entry with no
    // error or symptom beyond that one club's login redirect quietly not working. Serializing
    // within this JVM closes that within a single backend instance; it does NOT protect across
    // multiple backend replicas sharing one Keycloak client, since the lock is process-local —
    // acceptable for now given this repo's current single-instance deployment model, but revisit
    // if that ever changes. Found during standards review before this spec's PR opened.
    private final Object clientUpdateLock = new Object();

    @Override
    public void registerClubRedirectAccess(String clubSlug) {
        String origin = clubOrigin(clubSlug);
        String redirectUri = origin + "/*";

        synchronized (clientUpdateLock) {
            try {
                List<ClientRepresentation> matches =
                        keycloakAdminClient.realm(realm).clients().findByClientId(publicClientId);
                if (matches.isEmpty()) {
                    throw new KeycloakProvisioningException(
                            "No Keycloak client found for clientId " + publicClientId, null);
                }
                ClientRepresentation client = matches.get(0);

                List<String> redirectUris =
                        new ArrayList<>(client.getRedirectUris() != null ? client.getRedirectUris() : List.of());
                List<String> webOrigins =
                        new ArrayList<>(client.getWebOrigins() != null ? client.getWebOrigins() : List.of());
                boolean changed = false;
                if (!redirectUris.contains(redirectUri)) {
                    redirectUris.add(redirectUri);
                    client.setRedirectUris(redirectUris);
                    changed = true;
                }
                if (!webOrigins.contains(origin)) {
                    webOrigins.add(origin);
                    client.setWebOrigins(webOrigins);
                    changed = true;
                }

                if (changed) {
                    keycloakAdminClient.realm(realm).clients().get(client.getId()).update(client);
                }
            } catch (KeycloakProvisioningException e) {
                throw e;
            } catch (Exception e) {
                throw new KeycloakProvisioningException(
                        "Failed to register redirect access for club slug " + clubSlug, e);
            }
        }
    }

    // Builds e.g. "http://riverside.localhost:5173" from frontendBaseUrl "http://localhost:5173"
    // and slug "riverside" — the same {slug}.{rootDomain} shape ui/src/pages/view/LandingPage/
    // FindYourClubLogin.tsx's goToClubLogin already constructs client-side, just derived from the
    // backend's own app.frontend.base-url instead of a second VITE_ROOT_DOMAIN-shaped property.
    private String clubOrigin(String clubSlug) {
        URI base = URI.create(frontendBaseUrl);
        String host = clubSlug + "." + base.getHost();
        String authority = base.getPort() == -1 ? host : host + ":" + base.getPort();
        return base.getScheme() + "://" + authority;
    }
}
