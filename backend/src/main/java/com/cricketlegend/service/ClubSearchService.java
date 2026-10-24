package com.cricketlegend.service;

import com.cricketlegend.dto.ClubOptionDto;
import com.cricketlegend.dto.ClubSummaryDto;
import java.util.List;

public interface ClubSearchService {

    /**
     * Typeahead search over ACTIVE clubs by name/slug, for the "find your club" login step.
     * A blank/null query returns no results — this is a typeahead, not a full club listing.
     */
    List<ClubSummaryDto> search(String query);

    /** Every ACTIVE club by name, for the link request club picker (docs/specs/119); id and name only. */
    List<ClubOptionDto> listActiveOptions();
}
