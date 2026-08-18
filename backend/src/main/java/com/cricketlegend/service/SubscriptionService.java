package com.cricketlegend.service;

import com.cricketlegend.dto.CreateSubscriptionRequest;
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
}
