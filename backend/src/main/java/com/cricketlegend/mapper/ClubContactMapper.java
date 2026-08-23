package com.cricketlegend.mapper;

import com.cricketlegend.domain.ClubContact;
import com.cricketlegend.dto.ClubContactDto;
import com.cricketlegend.dto.CreateClubContactRequest;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

/**
 * Note: {@code ClubContact.isPrimary} is a primitive {@code boolean} field whose name already
 * starts with "is" — same quirk documented on {@code ProductMapper} for {@code Product.isFree}.
 * Lombok's generated getter is the plain {@code isPrimary()} (verified against the compiled
 * {@code ClubContact.class} — {@code isPrimary()}/{@code setPrimary(boolean)}), whose inferred
 * JavaBean *read* property is {@code "primary"}, not {@code "isPrimary"} — {@code toDto} below
 * needs an explicit {@code @Mapping} for it (target {@code isPrimary} on the DTO record, source
 * {@code primary}). MapStruct's generated {@code toEntity} instead targets {@code ClubContact}'s
 * Lombok {@code @Builder}, whose builder-setter methods use the field's literal name ({@code
 * isPrimary(boolean)}, not the read-side-stripped {@code primary(boolean)}) — so the ignore
 * mapping on {@code toEntity} uses {@code "isPrimary"}, not {@code "primary"} (verified against
 * the generated {@code ClubContactMapperImpl}). {@code contact}/{@code role}/{@code photoUrl} all
 * exist with matching names on both sides and the nested {@code Contact <-> ContactDto} leg is
 * inferred by MapStruct automatically (identical field names on both sides, no separate mapper
 * needed).
 */
@Mapper(componentModel = "spring")
public interface ClubContactMapper {

    @Mapping(target = "isPrimary", source = "primary")
    ClubContactDto toDto(ClubContact entity);

    @Mapping(target = "id", ignore = true)
    @Mapping(target = "clubId", ignore = true)
    @Mapping(target = "isPrimary", ignore = true)
    @Mapping(target = "active", ignore = true)
    @Mapping(target = "createdAt", ignore = true)
    @Mapping(target = "updatedAt", ignore = true)
    @Mapping(target = "updatedBy", ignore = true)
    ClubContact toEntity(CreateClubContactRequest request);
}
