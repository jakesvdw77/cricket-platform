package com.cricketlegend.service.impl;

import com.cricketlegend.domain.Person;
import com.cricketlegend.domain.PersonStatus;
import com.cricketlegend.dto.PersonDto;
import com.cricketlegend.mapper.PersonMapper;
import com.cricketlegend.repository.PersonRepository;
import com.cricketlegend.service.PersonService;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

/**
 * Business rules per docs/specs/014-subscription-responsible-contact.md: find-or-create resolves
 * a Person by email, case-insensitively, and never overwrites an existing match's own stored
 * fields with what was typed at the call site ("link, don't overwrite").
 */
@Service
public class PersonServiceImpl implements PersonService {

    private final PersonRepository personRepository;
    private final PersonMapper personMapper;

    public PersonServiceImpl(PersonRepository personRepository, PersonMapper personMapper) {
        this.personRepository = personRepository;
        this.personMapper = personMapper;
    }

    @Override
    public Person findOrCreatePerson(String firstName, String lastName, String email, String phone) {
        return personRepository
                .findByEmailIgnoreCase(email)
                .orElseGet(() -> personRepository.save(Person.builder()
                        .firstName(firstName)
                        .lastName(lastName)
                        .email(email)
                        .phone(phone)
                        .status(PersonStatus.ACTIVE)
                        .build()));
    }

    @Override
    public Page<PersonDto> search(String search, Pageable pageable) {
        return personRepository.search(search, withDefaultSort(pageable)).map(personMapper::toDto);
    }

    private Pageable withDefaultSort(Pageable pageable) {
        if (pageable.getSort().isSorted()) {
            return pageable;
        }
        return PageRequest.of(
                pageable.getPageNumber(), pageable.getPageSize(), Sort.by("firstName").ascending());
    }
}
