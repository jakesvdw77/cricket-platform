package com.cricketlegend.mapper;

import com.cricketlegend.domain.SponsorContact;
import com.cricketlegend.dto.CreateSponsorContactRequest;
import com.cricketlegend.dto.SponsorContactDto;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

/**
 * Note: {@code SponsorContact.isPrimary} is a primitive {@code boolean} field whose name already
 * starts with "is" — same quirk documented on {@code ClubContactMapper} for {@code
 * ClubContact.isPrimary}. Lombok's generated getter is the plain {@code isPrimary()}, whose
 * inferred JavaBean *read* property is {@code "primary"}, not {@code "isPrimary"} — {@code toDto}
 * below needs an explicit {@code @Mapping} for it (target {@code isPrimary} on the DTO record,
 * source {@code primary}). MapStruct's generated {@code toEntity} instead targets {@code
 * SponsorContact}'s Lombok {@code @Builder}, whose builder-setter methods use the field's literal
 * name ({@code isPrimary(boolean)}, not the read-side-stripped {@code primary(boolean)}) — so the
 * ignore mapping on {@code toEntity} uses {@code "isPrimary"}, not {@code "primary"}. {@code
 * contact}/{@code role} exist with matching names on both sides and the nested {@code Contact <->
 * ContactDto} leg is inferred by MapStruct automatically (identical field names on both sides, no
 * separate mapper needed). See docs/specs/024-sponsor-contacts.md.
 */
@Mapper(componentModel = "spring")
public interface SponsorContactMapper {

    @Mapping(target = "isPrimary", source = "primary")
    SponsorContactDto toDto(SponsorContact entity);

    @Mapping(target = "id", ignore = true)
    @Mapping(target = "sponsorId", ignore = true)
    @Mapping(target = "isPrimary", ignore = true)
    @Mapping(target = "active", ignore = true)
    @Mapping(target = "createdAt", ignore = true)
    @Mapping(target = "updatedAt", ignore = true)
    @Mapping(target = "updatedBy", ignore = true)
    SponsorContact toEntity(CreateSponsorContactRequest request);
}
