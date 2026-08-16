package com.cricketlegend.service;

import com.cricketlegend.dto.ClubSummaryDto;
import java.util.List;

public interface ClubSearchService {

    /**
     * Typeahead search over ACTIVE clubs by name/slug, for the "find your club" login step.
     * A blank/null query returns no results — this is a typeahead, not a full club listing.
     */
    List<ClubSummaryDto> search(String query);
}
