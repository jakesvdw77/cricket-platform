package com.cricketlegend.service;

import com.cricketlegend.dto.ManagerOverviewDto;
import java.util.UUID;
import org.springframework.security.core.Authentication;

/**
 * The manager overview dashboard of docs/specs/079-manager-shell-and-overview.md: week counts, key
 * figures, upcoming matches, open polls and quick-action rights, all scoped to the sections the
 * caller administers. Every kind of data is loaded in one batched query, never per row.
 */
public interface ManagerOverviewService {

    /** The overview of {@code clubId} for the caller. Never includes another club's data. */
    ManagerOverviewDto overview(Authentication authentication, UUID clubId);
}
