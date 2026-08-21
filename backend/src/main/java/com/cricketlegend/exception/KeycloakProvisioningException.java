package com.cricketlegend.exception;

/**
 * Per docs/specs/016-keycloak-account-provisioning.md. Deliberately does NOT extend
 * NotFoundException/ConflictException/ValidationException (docs/standards/backend.md) — an
 * external-system integration failure, not a business-rule violation. Always caught inside
 * SubscriptionServiceImpl (judgment call #2) — never reaches GlobalExceptionHandler, never fails
 * a Subscription creation request.
 */
public class KeycloakProvisioningException extends RuntimeException {
    public KeycloakProvisioningException(String message, Throwable cause) {
        super(message, cause);
    }
}
