package com.cricketlegend.mapper;

import com.cricketlegend.domain.MatchAvailabilityPoll;
import com.cricketlegend.dto.MatchAvailabilityPollDto;
import org.mapstruct.Mapper;

/**
 * {@code id}/{@code teamId}/{@code open} all exist with matching names on {@link
 * MatchAvailabilityPoll}, inferred by MapStruct across the {@code poll} parameter; the four
 * {@code long} count parameters are matched by name directly to their identically-named target
 * fields. The richer {@code MatchAvailabilityPollResponsesDto}/{@code PublicAvailabilityPollDto}
 * shapes are composed by plain record construction in the service layer instead, mirroring {@code
 * MatchSideServiceImpl.toDto}'s existing precedent — see docs/specs/032-match-availability-polls.md.
 */
@Mapper(componentModel = "spring")
public interface MatchAvailabilityPollMapper {

    MatchAvailabilityPollDto toDto(
            MatchAvailabilityPoll poll,
            long availableCount,
            long unavailableCount,
            long unsureCount,
            long noResponseCount);
}
