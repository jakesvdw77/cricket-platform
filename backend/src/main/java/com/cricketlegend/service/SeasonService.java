package com.cricketlegend.service;

import com.cricketlegend.dto.CreateSeasonRequest;
import com.cricketlegend.dto.SeasonDto;
import com.cricketlegend.dto.UpdateSeasonRequest;
import java.util.List;
import java.util.UUID;

/** A club's own season/year/period — see docs/specs/029-league-management.md. */
public interface SeasonService {

    /** Every season for {@code clubId} (active and inactive). */
    List<SeasonDto> list(UUID clubId);

    /** Creates a season for {@code clubId}. Validates {@code startDate <= endDate}. */
    SeasonDto create(UUID clubId, CreateSeasonRequest request);

    /** Full-resource update. Same {@code startDate <= endDate} validation as {@link #create}. */
    SeasonDto update(UUID clubId, UUID seasonId, UpdateSeasonRequest request);

    /** Throws {@link com.cricketlegend.exception.InvalidStatusTransitionException} if already inactive. */
    SeasonDto deactivate(UUID clubId, UUID seasonId);

    /** Throws {@link com.cricketlegend.exception.InvalidStatusTransitionException} if already active. */
    SeasonDto reactivate(UUID clubId, UUID seasonId);
}
