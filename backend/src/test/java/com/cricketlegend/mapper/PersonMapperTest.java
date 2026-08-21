package com.cricketlegend.mapper;

import static org.assertj.core.api.Assertions.assertThat;

import com.cricketlegend.domain.Person;
import com.cricketlegend.dto.PersonDto;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mapstruct.factory.Mappers;

/**
 * Unit test against the real generated {@code PersonMapperImpl} (not a Mockito mock) — replaces
 * the deleted {@code SubscriptionMapperTest} (its 4 tests all exercised {@code toContact}/
 * {@code responsibleContact}-specific behavior that no longer exists, per
 * docs/plans/014-subscription-responsible-contact.md's Flag 10). Plain object graph, no Spring
 * context — fast, pure unit tier per docs/standards/testing.md.
 */
class PersonMapperTest {

    private final PersonMapper mapper = Mappers.getMapper(PersonMapper.class);

    @Test
    void toDtoMapsAllFiveFields() {
        Person person = new Person();
        person.setId(UUID.randomUUID());
        person.setFirstName("Jane");
        person.setLastName("Doe");
        person.setEmail("jane.doe@example.com");
        person.setPhone("+27821234567");

        PersonDto dto = mapper.toDto(person);

        assertThat(dto.id()).isEqualTo(person.getId());
        assertThat(dto.firstName()).isEqualTo("Jane");
        assertThat(dto.lastName()).isEqualTo("Doe");
        assertThat(dto.email()).isEqualTo("jane.doe@example.com");
        assertThat(dto.phone()).isEqualTo("+27821234567");
    }

    @Test
    void toDtoWithANullPhoneMapsItThrough() {
        Person person = new Person();
        person.setId(UUID.randomUUID());
        person.setFirstName("Jane");
        person.setLastName("Doe");
        person.setEmail("jane.doe@example.com");
        person.setPhone(null);

        PersonDto dto = mapper.toDto(person);

        assertThat(dto.phone()).isNull();
    }
}
