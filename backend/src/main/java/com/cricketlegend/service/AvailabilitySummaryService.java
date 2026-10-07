package com.cricketlegend.service;

import com.cricketlegend.dto.AvailabilitySummaryDto;
import java.util.UUID;
import org.springframework.security.core.Authentication;

/** The availability counters of docs/specs/081-plain-page-header-and-counters.md, scoped to the caller's sections. */
public interface AvailabilitySummaryService {

    /** Counters over the open polls of {@code clubId} the caller can see. Never includes another club's data. */
    AvailabilitySummaryDto summary(Authentication authentication, UUID clubId);
}
