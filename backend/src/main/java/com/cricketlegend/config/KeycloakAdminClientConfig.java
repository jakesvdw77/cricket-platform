package com.cricketlegend.config;

import org.keycloak.OAuth2Constants;
import org.keycloak.admin.client.Keycloak;
import org.keycloak.admin.client.KeycloakBuilder;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Service-account-authenticated Keycloak Admin API client, per
 * docs/specs/016-keycloak-account-provisioning.md. Authenticates as the confidential
 * platform-provisioning client (client_credentials grant) — never the public SPA client browsers
 * use to log in.
 */
@Configuration
public class KeycloakAdminClientConfig {

    @Bean
    Keycloak keycloakAdminClient(
            @Value("${app.keycloak.admin.server-url}") String serverUrl,
            @Value("${app.keycloak.admin.realm}") String realm,
            @Value("${app.keycloak.admin.client-id}") String clientId,
            @Value("${app.keycloak.admin.client-secret}") String clientSecret) {
        return KeycloakBuilder.builder()
                .serverUrl(serverUrl)
                .realm(realm)
                .grantType(OAuth2Constants.CLIENT_CREDENTIALS)
                .clientId(clientId)
                .clientSecret(clientSecret)
                .build();
    }
}
