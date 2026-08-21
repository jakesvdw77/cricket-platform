package com.cricketlegend.mapper;

import com.cricketlegend.domain.Person;
import com.cricketlegend.dto.PersonDto;
import org.mapstruct.Mapper;

@Mapper(componentModel = "spring")
public interface PersonMapper {

    // id/firstName/lastName/email/phone all exist with matching names on both sides — MapStruct
    // maps all five by convention, no explicit @Mapping needed.
    PersonDto toDto(Person person);
}
