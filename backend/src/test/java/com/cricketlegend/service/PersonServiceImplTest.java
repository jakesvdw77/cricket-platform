package com.cricketlegend.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.cricketlegend.domain.Person;
import com.cricketlegend.dto.PersonDto;
import com.cricketlegend.mapper.PersonMapper;
import com.cricketlegend.repository.PersonRepository;
import com.cricketlegend.service.impl.PersonServiceImpl;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;

/**
 * Unit tests for PersonServiceImpl's business rules from
 * docs/specs/014-subscription-responsible-contact.md: findOrCreatePerson creates when no email
 * match exists, and "link, don't overwrite" — an existing case-insensitive email match is
 * returned exactly as stored, never patched with the caller's (discarded) typed values. Also
 * covers search's default-sort behavior, mirroring ClubServiceImplTest's own
 * listWithNoCallerSortDefaultsToNameAscending/listPreservesCallerSuppliedSort pair for
 * ClubServiceImpl.list(). Per docs/standards/backend.md, every @Service method carrying a
 * business rule ships a unit test in the same change.
 */
@ExtendWith(MockitoExtension.class)
class PersonServiceImplTest {

    @Mock
    private PersonRepository personRepository;

    @Mock
    private PersonMapper personMapper;

    private PersonServiceImpl personService;

    @BeforeEach
    void setUp() {
        personService = new PersonServiceImpl(personRepository, personMapper);
    }

    @Test
    void findOrCreatePersonWithNoExistingEmailMatchCreatesANewPerson() {
        when(personRepository.findByEmailIgnoreCase("jane.doe@example.com")).thenReturn(Optional.empty());
        ArgumentCaptor<Person> captor = ArgumentCaptor.forClass(Person.class);
        when(personRepository.save(captor.capture())).thenAnswer(invocation -> {
            Person saved = captor.getValue();
            saved.setId(UUID.randomUUID());
            return saved;
        });

        Person result = personService.findOrCreatePerson("Jane", "Doe", "jane.doe@example.com", "+27821234567");

        assertThat(result.getId()).isNotNull();
        assertThat(captor.getValue().getFirstName()).isEqualTo("Jane");
        assertThat(captor.getValue().getLastName()).isEqualTo("Doe");
        assertThat(captor.getValue().getEmail()).isEqualTo("jane.doe@example.com");
        assertThat(captor.getValue().getPhone()).isEqualTo("+27821234567");
    }

    @Test
    void findOrCreatePersonWithACaseInsensitiveEmailMatchReturnsTheExistingPersonUnchangedNeverOverwritingItsFields() {
        // The stored Person's own fields — "Jaco"/"van der Walt"/the original phone — are what
        // findOrCreatePerson must return, even though the caller here types a different name and
        // phone for the same (differently-cased) email. "Link, don't overwrite" per the spec's
        // Data Model Changes.
        Person stored = new Person();
        stored.setId(UUID.randomUUID());
        stored.setFirstName("Jaco");
        stored.setLastName("van der Walt");
        stored.setEmail("jaco@example.com");
        stored.setPhone("+27821110000");
        when(personRepository.findByEmailIgnoreCase("Jaco@Example.com")).thenReturn(Optional.of(stored));

        Person result = personService.findOrCreatePerson(
                "Jacob", "Vanderwalt", "Jaco@Example.com", "+27829999999");

        assertThat(result).isSameAs(stored);
        assertThat(result.getFirstName()).isEqualTo("Jaco");
        assertThat(result.getLastName()).isEqualTo("van der Walt");
        assertThat(result.getEmail()).isEqualTo("jaco@example.com");
        assertThat(result.getPhone()).isEqualTo("+27821110000");
        verify(personRepository, never()).save(any());
    }

    @Test
    void searchWithNoCallerSortDefaultsToFirstNameAscending() {
        Pageable requested = PageRequest.of(0, 20);
        Pageable expectedEffective = PageRequest.of(0, 20, Sort.by("firstName").ascending());
        Person person = new Person();
        person.setId(UUID.randomUUID());
        when(personRepository.search(null, expectedEffective)).thenReturn(new PageImpl<>(List.of(person)));
        when(personMapper.toDto(person))
                .thenReturn(new PersonDto(person.getId(), "Jane", "Doe", "jane.doe@example.com", null));

        Page<PersonDto> result = personService.search(null, requested);

        assertThat(result.getContent()).hasSize(1);
        verify(personRepository).search(null, expectedEffective);
    }

    @Test
    void searchPreservesCallerSuppliedSort() {
        Pageable requested = PageRequest.of(0, 20, Sort.by("email").descending());
        when(personRepository.search("jane", requested)).thenReturn(new PageImpl<>(List.of()));

        Page<PersonDto> result = personService.search("jane", requested);

        assertThat(result.getContent()).isEmpty();
        verify(personRepository).search("jane", requested);
    }
}
