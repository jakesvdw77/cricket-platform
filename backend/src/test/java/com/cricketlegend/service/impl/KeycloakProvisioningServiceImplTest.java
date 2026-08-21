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
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.keycloak.admin.client.Keycloak;
import org.keycloak.admin.client.resource.ClientResource;
import org.keycloak.admin.client.resource.ClientsResource;
import org.keycloak.admin.client.resource.RealmResource;
import org.keycloak.admin.client.resource.UserResource;
import org.keycloak.admin.client.resource.UsersResource;
import org.keycloak.representations.idm.ClientRepresentation;
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
    private ClientsResource clientsResource;
    private ClientResource clientResource;

    private KeycloakProvisioningServiceImpl service;

    @BeforeEach
    void setUp() {
        keycloakAdminClient = mock(Keycloak.class);
        realmResource = mock(RealmResource.class);
        usersResource = mock(UsersResource.class);
        userResource = mock(UserResource.class);
        clientsResource = mock(ClientsResource.class);
        clientResource = mock(ClientResource.class);

        when(keycloakAdminClient.realm(REALM)).thenReturn(realmResource);
        when(realmResource.users()).thenReturn(usersResource);
        when(realmResource.clients()).thenReturn(clientsResource);

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

    private ClientRepresentation clientRepresentation(List<String> redirectUris, List<String> webOrigins) {
        ClientRepresentation client = new ClientRepresentation();
        client.setId("internal-client-id");
        client.setClientId(PUBLIC_CLIENT_ID);
        client.setRedirectUris(new ArrayList<>(redirectUris));
        client.setWebOrigins(new ArrayList<>(webOrigins));
        return client;
    }

    @Test
    void registerClubRedirectAccessAddsTheNewSlugsRedirectUriAndWebOriginAlongsideWhatAlreadyExists() {
        ClientRepresentation client = clientRepresentation(
                List.of("http://localhost:5173/*"), List.of("http://localhost:5173"));
        when(clientsResource.findByClientId(PUBLIC_CLIENT_ID)).thenReturn(List.of(client));
        when(clientsResource.get("internal-client-id")).thenReturn(clientResource);

        service.registerClubRedirectAccess("riverside");

        var captor = org.mockito.ArgumentCaptor.forClass(ClientRepresentation.class);
        verify(clientResource).update(captor.capture());
        ClientRepresentation updated = captor.getValue();
        assertThat(updated.getRedirectUris())
                .containsExactlyInAnyOrder("http://localhost:5173/*", "http://riverside.localhost:5173/*");
        assertThat(updated.getWebOrigins())
                .containsExactlyInAnyOrder("http://localhost:5173", "http://riverside.localhost:5173");
    }

    @Test
    void registerClubRedirectAccessIsIdempotentAndSkipsTheUpdateCallWhenAlreadyRegistered() {
        ClientRepresentation client = clientRepresentation(
                List.of("http://riverside.localhost:5173/*"), List.of("http://riverside.localhost:5173"));
        when(clientsResource.findByClientId(PUBLIC_CLIENT_ID)).thenReturn(List.of(client));

        service.registerClubRedirectAccess("riverside");

        verify(clientsResource, never()).get(any());
    }

    @Test
    void registerClubRedirectAccessThrowsWhenNoClientMatchesThePublicClientId() {
        when(clientsResource.findByClientId(PUBLIC_CLIENT_ID)).thenReturn(List.of());

        assertThatThrownBy(() -> service.registerClubRedirectAccess("riverside"))
                .isInstanceOf(KeycloakProvisioningException.class);
    }

    @Test
    void registerClubRedirectAccessWrapsAnyThrownExceptionInKeycloakProvisioningException() {
        RuntimeException underlying = new RuntimeException("Keycloak is unreachable");
        when(clientsResource.findByClientId(PUBLIC_CLIENT_ID)).thenThrow(underlying);

        assertThatThrownBy(() -> service.registerClubRedirectAccess("riverside"))
                .isInstanceOf(KeycloakProvisioningException.class)
                .hasCause(underlying);
    }
}
