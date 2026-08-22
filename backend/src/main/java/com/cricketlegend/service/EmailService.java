package com.cricketlegend.service;

/**
 * Generic outbound transactional email transport - docs/specs/017-subscription-welcome-email.md.
 * Deliberately carries no knowledge of any specific email's content or subject copy - a caller
 * (SubscriptionWelcomeEmailService below, or a future OTP/invite email service) builds its own
 * HTML body (via the shared email/base-layout.html Thymeleaf fragment) and hands it here to
 * actually send. The reusable primitive future email-sending features should reuse rather than
 * standing up a second SMTP client, the same way KeycloakProvisioningService (016) is the
 * reusable primitive for future Keycloak account operations.
 */
public interface EmailService {
    /** @throws com.cricketlegend.exception.EmailDeliveryException if the underlying SMTP send fails */
    void send(String toAddress, String toName, String subject, String htmlBody);
}
