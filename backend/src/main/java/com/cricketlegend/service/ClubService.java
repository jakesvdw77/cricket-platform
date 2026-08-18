package com.cricketlegend.service;

import com.cricketlegend.dto.ClubDto;
import com.cricketlegend.dto.CreateClubRequest;
import com.cricketlegend.dto.UpdateClubRequest;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

/**
 * platform_admin-only Club CRUD (create/list/get/update/suspend/reactivate), separate from
 * {@link ClubSearchService}'s public typeahead. See docs/specs/010-minimal-club-creation.md.
 */
public interface ClubService {

    ClubDto create(CreateClubRequest request);

    ClubDto get(UUID id);

    /**
     * Backend-driven pagination, per docs/standards/backend.md. Defaults to name ascending when
     * the caller doesn't specify a sort. An optional, case-insensitive substring {@code search}
     * against name or slug narrows the results; omitted/blank returns every Club regardless of
     * status.
     */
    Page<ClubDto> list(String search, Pageable pageable);

    ClubDto update(UUID id, UpdateClubRequest request);

    ClubDto suspend(UUID id);

    ClubDto reactivate(UUID id);
}
