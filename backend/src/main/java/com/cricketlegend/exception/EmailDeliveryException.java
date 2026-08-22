package com.cricketlegend.exception;

/**
 * docs/specs/017-subscription-welcome-email.md. Deliberately does NOT extend
 * NotFoundException/ConflictException/ValidationException (docs/standards/backend.md) - an
 * external-system integration failure, not a business-rule violation, the same reasoning
 * KeycloakProvisioningException (016) already established. Always caught at the call site that
 * triggers a send as a best-effort side effect - never reaches GlobalExceptionHandler.
 */
public class EmailDeliveryException extends RuntimeException {
    public EmailDeliveryException(String message, Throwable cause) {
        super(message, cause);
    }
}
