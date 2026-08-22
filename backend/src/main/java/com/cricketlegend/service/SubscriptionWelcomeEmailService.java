package com.cricketlegend.service;

import com.cricketlegend.domain.Club;
import com.cricketlegend.domain.Person;
import com.cricketlegend.domain.Product;
import com.cricketlegend.domain.Subscription;

/**
 * docs/specs/017-subscription-welcome-email.md. Composes the welcome email's subject/HTML body
 * (via the shared email/base-layout.html Thymeleaf fragment) and sends it through EmailService.
 * One method, one email - a future welcome-adjacent email (e.g. a renewal reminder) gets its own
 * method here, or its own service, not a growing parameter list on this one.
 */
public interface SubscriptionWelcomeEmailService {
    /**
     * @throws com.cricketlegend.exception.EmailDeliveryException if rendering the template or
     *     the underlying {@code EmailService.send(...)} call fails — the caller's best-effort
     *     posture (docs/specs/017-subscription-welcome-email.md judgment call #3) relies on every
     *     failure mode in this method surfacing as this one exception type, not just the send
     *     step; a bug found during test-writer's own pass confirmed a template rendering failure
     *     would otherwise escape uncaught.
     */
    void sendWelcomeEmail(Person responsiblePerson, Subscription subscription, Club club, Product product);
}
