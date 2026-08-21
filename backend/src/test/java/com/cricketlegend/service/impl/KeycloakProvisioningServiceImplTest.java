package com.cricketlegend.service.impl;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.cricketlegend.domain.Person;
import com.cricketlegend.exception.KeycloakProvisioningException;
import jakarta.ws.rs.core.Response;
import java.net.URI;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.keycloak.admin.client.Keycloak;
import org.keycloak.admin.client.resource.RealmResource;
import org.keycloak.admin.client.resource.UserResource;
import org.keycloak.admin.client.resource.UsersResource;
import org.keycloak.representations.idm.UserRepresentation;

/**
 * Plain JUnit 5 + Mockito, no Spring context — per docs/specs/016-keycloak-account-provisioning.md's
 * Test Plan ("KeycloakProvisioningServiceImplTest (new, mocked Keycloak admin client)"). Mocks the
 * fluent {@code Keycloak.realm(realm).users()...} chain KeycloakProvisioningServiceImpl actually
 * calls, rather than standing up a real Keycloak server. Package placement follows
 * docs/plans/016-keycloak-account-provisioning.md's Flag #5 (com.cricketlegend.service.impl,
 * matching AdminIdentityServiceImplTest's newer convention).
 */
class KeycloakProvisioningServiceImplTest {

    private static final String REALM = "cricketlegend";
    private static final String PUBLIC_CLIENT_ID = "cricketlegend";
    private static final String FRONTEND_BASE_URL = "http://localhost:5173";
    private static final String EXPECTED_RESET_REDIRECT_URI = FRONTEND_BASE_URL + "/post-login";

    private Keycloak keycloakAdminClient;
    private RealmResource realmResource;
    private UsersResource usersResource;
    private UserResource userResource;

    private KeycloakProvisioningServiceImpl service;

    @BeforeEach
    void setUp() {
        keycloakAdminClient = mock(Keycloak.class);
        realmResource = mock(RealmResource.class);
        usersResource = mock(UsersResource.class);
        userResource = mock(UserResource.class);

        when(keycloakAdminClient.realm(REALM)).thenReturn(realmResource);
        when(realmResource.users()).thenReturn(usersResource);

        service = new KeycloakProvisioningServiceImpl(
                keycloakAdminClient, REALM, PUBLIC_CLIENT_ID, FRONTEND_BASE_URL);
    }

    private Person person() {
        Person person = new Person();
        person.setId(UUID.randomUUID());
        person.setFirstName("Jane");
        person.setLastName("Doe");
        person.setEmail("jane.doe@example.com");
        return person;
    }

    private Response createdResponse(String createdUserId) {
        Response response = mock(Response.class);
        when(response.getStatus()).thenReturn(201);
        when(response.getStatusInfo()).thenReturn(Response.Status.CREATED);
        when(response.getLocation())
                .thenReturn(URI.create("http://auth.localhost:8180/admin/realms/cricketlegend/users/" + createdUserId));
        return response;
    }

    @Test
    void provisionAccountBuildsUserRepresentationWithEnabledUnverifiedEmailAndCopiedNameFields() {
        Person person = person();
        String createdUserId = UUID.randomUUID().toString();
        Response response = createdResponse(createdUserId);
        when(usersResource.create(any(UserRepresentation.class))).thenReturn(response);
        when(usersResource.get(createdUserId)).thenReturn(userResource);

        service.provisionAccount(person);

        var userCaptor = org.mockito.ArgumentCaptor.forClass(UserRepresentation.class);
        verify(usersResource).create(userCaptor.capture());
        UserRepresentation created = userCaptor.getValue();
        assertThat(created.isEnabled()).isTrue();
        assertThat(created.isEmailVerified()).isFalse();
        assertThat(created.getUsername()).isEqualTo(person.getEmail());
        assertThat(created.getEmail()).isEqualTo(person.getEmail());
        assertThat(created.getFirstName()).isEqualTo(person.getFirstName());
        assertThat(created.getLastName()).isEqualTo(person.getLastName());
    }

    @Test
    void provisionAccountCallsExecuteActionsEmailWithUpdatePasswordAndConfiguredClientAndRedirectUri() {
        Person person = person();
        String createdUserId = UUID.randomUUID().toString();
        Response response = createdResponse(createdUserId);
        when(usersResource.create(any(UserRepresentation.class))).thenReturn(response);
        when(usersResource.get(createdUserId)).thenReturn(userResource);

        service.provisionAccount(person);

        verify(userResource)
                .executeActionsEmail(
                        eq(PUBLIC_CLIENT_ID), eq(EXPECTED_RESET_REDIRECT_URI), eq(List.of("UPDATE_PASSWORD")));
    }

    @Test
    void nonCreatedResponseFromUserCreateThrowsKeycloakProvisioningException() {
        Person person = person();
        Response response = mock(Response.class);
        when(response.getStatus()).thenReturn(409);
        when(usersResource.create(any(UserRepresentation.class))).thenReturn(response);

        assertThatThrownBy(() -> service.provisionAccount(person))
                .isInstanceOf(KeycloakProvisioningException.class);

        verify(usersResource, never()).get(any());
    }

    @Test
    void anExceptionThrownFromUserCreateIsWrappedInKeycloakProvisioningException() {
        Person person = person();
        RuntimeException underlying = new RuntimeException("Keycloak is unreachable");
        when(usersResource.create(any(UserRepresentation.class))).thenThrow(underlying);

        assertThatThrownBy(() -> service.provisionAccount(person))
                .isInstanceOf(KeycloakProvisioningException.class)
                .hasCause(underlying);
    }

    @Test
    void anExceptionThrownFromExecuteActionsEmailIsWrappedInKeycloakProvisioningException() {
        Person person = person();
        String createdUserId = UUID.randomUUID().toString();
        Response response = createdResponse(createdUserId);
        when(usersResource.create(any(UserRepresentation.class))).thenReturn(response);
        when(usersResource.get(createdUserId)).thenReturn(userResource);
        RuntimeException underlying = new RuntimeException("execute-actions-email failed");
        org.mockito.Mockito.doThrow(underlying)
                .when(userResource)
                .executeActionsEmail(any(), any(), any());

        assertThatThrownBy(() -> service.provisionAccount(person))
                .isInstanceOf(KeycloakProvisioningException.class)
                .hasCause(underlying);
    }
}
