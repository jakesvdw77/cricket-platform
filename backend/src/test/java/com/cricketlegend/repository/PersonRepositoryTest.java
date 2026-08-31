package com.cricketlegend.repository;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.cricketlegend.AbstractIntegrationTest;
import com.cricketlegend.domain.Person;
import com.cricketlegend.domain.PersonStatus;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.UUID;
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
 * (implicit via context boot): first_name/last_name are NOT NULL at the DB level (email is no
 * longer NOT NULL as of docs/specs/028-players.md's 020-add-player.sql, since a player-only
 * Person genuinely has no login and so no email), and ux_person_email_lower rejects a second row
 * differing from an existing one only by email casing — the invariant
 * PersonServiceImpl.findOrCreatePerson relies on for "link, don't overwrite". Each test runs in
 * its own rolled-back transaction for isolation, since all tests share one Testcontainers
 * Postgres instance for the whole class.
 */
@SpringBootTest
@Import(AbstractIntegrationTest.class)
@Transactional
class PersonRepositoryTest {

    @Autowired
    private PersonRepository personRepository;

    @PersistenceContext
    private EntityManager entityManager;

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
    void nullEmailIsAllowedAtTheDbLevel() {
        // docs/specs/028-players.md drops email's NOT NULL constraint — a player-only Person
        // (most players, especially juniors) never has a login and so genuinely has no email,
        // unlike 014's one existing use case (a Subscription's responsible party) that always
        // needs one to log in.
        Person person = person("Jane", "Doe", null, null);

        Person saved = personRepository.saveAndFlush(person);

        assertThat(personRepository.findById(saved.getId()).orElseThrow().getEmail()).isNull();
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
    void findByKeycloakUserIdFindsTheMatchingPersonAndReturnsEmptyForAnUnknownId() {
        // The lookup AccessService.canAdministerClub's RoleAssignment branch depends on
        // (docs/specs/015-person-status-and-role-assignment.md) — a derived query method that
        // compiles regardless of whether it actually matches the right column, so it needs its own
        // real-Postgres proof per docs/standards/backend.md, not just the Mockito stub coverage
        // AccessServiceTest already has.
        Person person = person("Jaco", "van der Walt", "jaco@example.com", null);
        person.setKeycloakUserId("11111111-1111-1111-1111-111111111111");
        Person saved = personRepository.save(person);

        assertThat(personRepository.findByKeycloakUserId("11111111-1111-1111-1111-111111111111"))
                .contains(saved);
        assertThat(personRepository.findByKeycloakUserId("22222222-2222-2222-2222-222222222222")).isEmpty();
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

    @Test
    void personSavedWithNoExplicitStatusIsBackfilledToActiveByPrePersistAndTheColumnsOwnNotNullDefault() {
        // 010-add-person-status.sql adds `status` as `NOT NULL DEFAULT 'ACTIVE'` — a single,
        // metadata-only column add that backfills every existing row to ACTIVE with no separate
        // UPDATE step. This context boots against the full migration chain (001-011) from an empty
        // schema, so there's no pre-010 data to observe the backfill against directly here (see
        // PersonSubscriptionMigrationBackfillTest's com.cricketlegend.migration package for that
        // seed-before-migration style, used for 009's backfill). What's verifiable in this
        // Spring-context style of test is the column's own default actually taking effect for any
        // row saved without an explicit status — proving no NULL ever lands in this column, whether
        // via JPA's own @PrePersist default or (if that were ever bypassed) the column's own default.
        Person person = person("Jane", "Doe", "jane.doe@example.com", null);
        assertThat(person.getStatus()).isNull(); // not set by the builder — @PrePersist must default it

        Person saved = personRepository.save(person);
        entityManager.flush();
        entityManager.clear();

        Person reloaded = personRepository.findById(saved.getId()).orElseThrow();
        assertThat(reloaded.getStatus()).isEqualTo(PersonStatus.ACTIVE);
    }

    @Test
    void keycloakProvisionedAtDefaultsToNullForAFreshlySavedPersonThatNeverSetsIt() {
        // Proves 012-add-person-keycloak-provisioned-at.sql applied cleanly on top of 001-011
        // (implicit via context boot) and that the new column has no NOT NULL/default — a Person
        // saved without ever touching keycloakProvisionedAt (the everyday case for every existing
        // Person until docs/specs/016-keycloak-account-provisioning.md's first login) round-trips
        // as NULL, not backfilled to some other value.
        Person person = person("Jane", "Doe", "jane.doe@example.com", null);
        assertThat(person.getKeycloakProvisionedAt()).isNull();

        Person saved = personRepository.save(person);
        entityManager.flush();
        entityManager.clear();

        Person reloaded = personRepository.findById(saved.getId()).orElseThrow();
        assertThat(reloaded.getKeycloakProvisionedAt()).isNull();
    }

    @Test
    void keycloakProvisionedAtRoundTripsWhenExplicitlySet() {
        Person person = person("Jane", "Doe", "jane.doe@example.com", null);
        Instant provisionedAt = Instant.now().truncatedTo(ChronoUnit.MICROS);
        person.setKeycloakProvisionedAt(provisionedAt);

        Person saved = personRepository.save(person);
        entityManager.flush();
        entityManager.clear();

        Person reloaded = personRepository.findById(saved.getId()).orElseThrow();
        assertThat(reloaded.getKeycloakProvisionedAt()).isEqualTo(provisionedAt);
    }

    @Test
    void nullStatusIsRejectedAtTheDbLevelEvenBypassingPrePersist() {
        // Proves status's NOT NULL constraint is a real, enforced DB-level invariant, not merely an
        // artifact of @PrePersist always filling it in — a native insert bypasses the entity
        // lifecycle callback entirely.
        UUID id = UUID.randomUUID();

        assertThatThrownBy(() -> {
            entityManager
                    .createNativeQuery("insert into person (id, first_name, last_name, email, status) "
                            + "values (:id, 'Jane', 'Doe', 'jane.doe@example.com', null)")
                    .setParameter("id", id)
                    .executeUpdate();
            entityManager.flush();
        }).isInstanceOf(RuntimeException.class);
    }
}
