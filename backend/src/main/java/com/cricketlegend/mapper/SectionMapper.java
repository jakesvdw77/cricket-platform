package com.cricketlegend.mapper;

import com.cricketlegend.domain.Section;
import com.cricketlegend.dto.CreateSectionRequest;
import com.cricketlegend.dto.SectionDto;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

/**
 * {@code name}/{@code minAge}/{@code maxAge}/{@code gender}/{@code parentSectionId} all exist
 * with matching names on both {@link Section} and {@link CreateSectionRequest}, inferred by
 * MapStruct automatically. See docs/specs/025-club-structure.md.
 */
@Mapper(componentModel = "spring")
public interface SectionMapper {

    SectionDto toDto(Section entity);

    @Mapping(target = "id", ignore = true)
    @Mapping(target = "clubId", ignore = true)
    @Mapping(target = "active", ignore = true)
    @Mapping(target = "createdAt", ignore = true)
    @Mapping(target = "updatedAt", ignore = true)
    @Mapping(target = "updatedBy", ignore = true)
    Section toEntity(CreateSectionRequest request);
}
