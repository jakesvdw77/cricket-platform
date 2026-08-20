package com.cricketlegend.repository;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.cricketlegend.AbstractIntegrationTest;
import com.cricketlegend.domain.Person;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.transaction.annotation.Transactional;

/**
 * Integration tests for PersonRepository — per docs/standards/backend.md, every custom repository
 * query ships a Testcontainers-backed integration test. Also proves
 * 008-restructure-person-identity.sql applied cleanly on top of 001's original person table
 * (implicit via context boot): first_name/last_name/email are NOT NULL at the DB level, and
 * ux_person_email_lower rejects a second row differing from an existing one only by email casing
 * — the invariant PersonServiceImpl.findOrCreatePerson relies on for "link, don't overwrite". Each
 * test runs in its own rolled-back transaction for isolation, since all tests share one
 * Testcontainers Postgres instance for the whole class.
 */
@SpringBootTest
@Import(AbstractIntegrationTest.class)
@Transactional
class PersonRepositoryTest {

    @Autowired
    private PersonRepository personRepository;

    private Person person(String firstName, String lastName, String email, String phone) {
        return Person.builder().firstName(firstName).lastName(lastName).email(email).phone(phone).build();
    }

    @Test
    void nullFirstNameIsRejectedAtTheDbLevel() {
        Person person = person(null, "Doe", "jane.doe@example.com", null);

        assertThatThrownBy(() -> personRepository.saveAndFlush(person))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void nullLastNameIsRejectedAtTheDbLevel() {
        Person person = person("Jane", null, "jane.doe@example.com", null);

        assertThatThrownBy(() -> personRepository.saveAndFlush(person))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void nullEmailIsRejectedAtTheDbLevel() {
        Person person = person("Jane", "Doe", null, null);

        assertThatThrownBy(() -> personRepository.saveAndFlush(person))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void uxPersonEmailLowerRejectsACaseDifferingEmailCollisionAtTheDbLevel() {
        personRepository.saveAndFlush(person("Jaco", "van der Walt", "Jaco@Example.com", null));

        Person collision = person("Someone", "Else", "jaco@example.com", null);

        assertThatThrownBy(() -> personRepository.saveAndFlush(collision))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void findByEmailIgnoreCaseFindsAMatchRegardlessOfCase() {
        Person saved = personRepository.save(person("Jaco", "van der Walt", "jaco@example.com", "+27821234567"));

        assertThat(personRepository.findByEmailIgnoreCase("jaco@example.com")).contains(saved);
        assertThat(personRepository.findByEmailIgnoreCase("JACO@EXAMPLE.COM")).contains(saved);
        assertThat(personRepository.findByEmailIgnoreCase("Jaco@Example.com")).contains(saved);
        assertThat(personRepository.findByEmailIgnoreCase("nobody@example.com")).isEmpty();
    }

    @Test
    void searchMatchesByPartialFirstNameLastNameOrEmailCaseInsensitively() {
        personRepository.save(person("Jane", "Doe", "jane.doe@example.com", null));
        personRepository.save(person("John", "Smith", "john.smith@example.com", null));
        personRepository.save(person("Priya", "Naidoo", "priya@other-domain.co.za", null));

        Pageable pageable = PageRequest.of(0, 20);

        Page<Person> byFirstName = personRepository.search("JANE", pageable);
        assertThat(byFirstName.getContent()).extracting(Person::getEmail).containsExactly("jane.doe@example.com");

        Page<Person> byLastName = personRepository.search("smith", pageable);
        assertThat(byLastName.getContent()).extracting(Person::getEmail).containsExactly("john.smith@example.com");

        Page<Person> byEmail = personRepository.search("other-domain", pageable);
        assertThat(byEmail.getContent()).extracting(Person::getEmail).containsExactly("priya@other-domain.co.za");

        assertThat(personRepository.search("no-such-person", pageable).getContent()).isEmpty();
    }

    @Test
    void searchWithNullOrBlankReturnsEveryPerson() {
        personRepository.save(person("Jane", "Doe", "jane.doe@example.com", null));
        personRepository.save(person("John", "Smith", "john.smith@example.com", null));

        Pageable pageable = PageRequest.of(0, 20);

        assertThat(personRepository.search(null, pageable).getContent()).hasSize(2);
        assertThat(personRepository.search("", pageable).getContent()).hasSize(2);
    }
}
