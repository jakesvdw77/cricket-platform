package com.cricketlegend.service;

import com.cricketlegend.dto.CreateSubscriptionRequest;
import com.cricketlegend.dto.ResendWelcomeEmailResultDto;
import com.cricketlegend.dto.SubscriptionDto;
import com.cricketlegend.dto.UpdateSubscriptionRequest;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

public interface SubscriptionService {

    SubscriptionDto create(CreateSubscriptionRequest request);

    SubscriptionDto get(UUID id);

    /**
     * Backend-driven pagination, per docs/standards/backend.md. Defaults to startDate descending
     * when the caller doesn't specify a sort. An optional, case-insensitive substring
     * {@code search} against the owning Club's name narrows the results; omitted/blank returns
     * everything.
     */
    Page<SubscriptionDto> list(String search, Pageable pageable);

    SubscriptionDto update(UUID id, UpdateSubscriptionRequest request);

    SubscriptionDto cancel(UUID id);

    /**
     * docs/specs/019-resend-subscription-welcome-email.md. Resends the welcome email (017) to the
     * Subscription's current responsible Person, using its current Club/Product/dates. Only valid
     * for an ACTIVE Subscription - throws InvalidStatusTransitionException for a CANCELLED one.
     * Never lets EmailDeliveryException propagate - always returns a result DTO, success or not.
     */
    ResendWelcomeEmailResultDto resendWelcomeEmail(UUID id);
}
