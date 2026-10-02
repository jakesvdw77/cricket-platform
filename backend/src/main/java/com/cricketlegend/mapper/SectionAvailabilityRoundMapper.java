package com.cricketlegend.mapper;

import com.cricketlegend.domain.SectionAvailabilityRound;
import com.cricketlegend.dto.SectionAvailabilityRoundBracketDto;
import com.cricketlegend.dto.SectionAvailabilityRoundDto;
import java.time.Instant;
import java.util.List;
import org.mapstruct.Mapper;

/**
 * {@code id}/{@code sectionId}/{@code description}/{@code firstMatchDate}/{@code lastMatchDate}/
 * {@code autoClose}/{@code scheduledCloseAt}/{@code open} all exist with matching names on {@link
 * SectionAvailabilityRound}, inferred by MapStruct across the {@code round} parameter; {@code
 * sectionName} and {@code brackets} are matched by name directly to their identically-named target
 * fields — mirrors {@code SectionAvailabilityWindowMapper}'s own multi-parameter-compose
 * precedent. See docs/specs/063-section-availability-and-flexible-squads.md.
 */
@Mapper(componentModel = "spring")
public interface SectionAvailabilityRoundMapper {

    SectionAvailabilityRoundDto toDto(
            SectionAvailabilityRound round, String sectionName,
            Instant firstMatchKickoff,
            List<SectionAvailabilityRoundBracketDto> brackets);
}
