package com.cricketlegend.mapper;

import com.cricketlegend.domain.SelectionAvailability;
import com.cricketlegend.domain.SelectionRejectionReason;
import com.cricketlegend.dto.SelectionPoolEntryDto;
import com.cricketlegend.dto.SelectionRejectionDto;
import com.cricketlegend.dto.SelectionTakenDto;
import com.cricketlegend.service.support.SelectionEligibility;
import com.cricketlegend.service.support.SelectionRejection;
import com.cricketlegend.service.support.TakenBy;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

/**
 * Maps the selection rules' internal results to the pool and apply DTOs of
 * docs/specs/076-team-selection.md. The values the caller derives (the access-dependent {@code
 * canRelease}, the already-mapped taken info, the pool entry's flags) are passed as parameters and
 * mapped straight onto the DTO property of the same name.
 */
@Mapper(componentModel = "spring")
public interface SelectionMapper {

    @Mapping(target = "canRelease", source = "canRelease")
    SelectionTakenDto toTakenDto(TakenBy taken, boolean canRelease);

    @Mapping(target = "taken", source = "takenDto")
    SelectionRejectionDto toRejectionDto(SelectionRejection rejection, SelectionTakenDto takenDto);

    @Mapping(target = "jerseyNumber", source = "jerseyNumber")
    @Mapping(target = "availability", source = "availability")
    @Mapping(target = "selected", source = "selected")
    @Mapping(target = "selectable", source = "selectable")
    @Mapping(target = "reason", source = "reason")
    @Mapping(target = "reasonText", source = "reasonText")
    @Mapping(target = "taken", source = "taken")
    SelectionPoolEntryDto toEntryDto(
            SelectionEligibility.PlayerInfo player,
            Integer jerseyNumber,
            SelectionAvailability availability,
            boolean selected,
            boolean selectable,
            SelectionRejectionReason reason,
            String reasonText,
            SelectionTakenDto taken);
}
