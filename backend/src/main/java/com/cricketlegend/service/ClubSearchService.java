package com.cricketlegend.service;

import com.cricketlegend.dto.ClubOptionDto;
import com.cricketlegend.dto.ClubSummaryDto;
import java.util.List;
import java.util.Optional;

public interface ClubSearchService {

    /**
     * Typeahead search over ACTIVE clubs by name/slug, for the "find your club" login step.
     * A query under 2 characters after trimming returns no results, and at most 20 clubs are returned,
     * ordered by name — this is a typeahead, not a full club listing (docs/specs/149).
     */
    List<ClubSummaryDto> search(String query);

    /**
     * The ACTIVE club with this slug (case-insensitive), for the public by-slug lookup (docs/specs/149).
     * A malformed, unknown or non-ACTIVE slug is empty, indistinguishably.
     */
    Optional<ClubSummaryDto> findActiveBySlug(String slug);

    /** Every ACTIVE club by name, for the link request club picker (docs/specs/119); id and name only. */
    List<ClubOptionDto> listActiveOptions();
}
