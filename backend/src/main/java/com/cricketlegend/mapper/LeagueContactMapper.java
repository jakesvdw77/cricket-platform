package com.cricketlegend.mapper;

import com.cricketlegend.domain.LeagueContact;
import com.cricketlegend.dto.CreateLeagueContactRequest;
import com.cricketlegend.dto.LeagueContactDto;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

/**
 * Note: {@code LeagueContact.isPrimary} is a primitive {@code boolean} field whose name already
 * starts with "is" — same quirk documented on {@code SponsorContactMapper} for {@code
 * SponsorContact.isPrimary}. Lombok's generated getter is the plain {@code isPrimary()}, whose
 * inferred JavaBean *read* property is {@code "primary"}, not {@code "isPrimary"} — {@code toDto}
 * below needs an explicit {@code @Mapping} for it (target {@code isPrimary} on the DTO record,
 * source {@code primary}). MapStruct's generated {@code toEntity} instead targets {@code
 * LeagueContact}'s Lombok {@code @Builder}, whose builder-setter methods use the field's literal
 * name ({@code isPrimary(boolean)}, not the read-side-stripped {@code primary(boolean)}) — so the
 * ignore mapping on {@code toEntity} uses {@code "isPrimary"}, not {@code "primary"}. {@code
 * contact}/{@code role} exist with matching names on both sides and the nested {@code Contact <->
 * ContactDto} leg is inferred by MapStruct automatically (identical field names on both sides, no
 * separate mapper needed). See docs/specs/054-league-contacts.md.
 */
@Mapper(componentModel = "spring")
public interface LeagueContactMapper {

    @Mapping(target = "isPrimary", source = "primary")
    LeagueContactDto toDto(LeagueContact entity);

    @Mapping(target = "id", ignore = true)
    @Mapping(target = "leagueId", ignore = true)
    @Mapping(target = "isPrimary", ignore = true)
    @Mapping(target = "active", ignore = true)
    @Mapping(target = "createdAt", ignore = true)
    @Mapping(target = "updatedAt", ignore = true)
    @Mapping(target = "updatedBy", ignore = true)
    LeagueContact toEntity(CreateLeagueContactRequest request);
}
