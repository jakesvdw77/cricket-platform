package com.cricketlegend.repository;

import com.cricketlegend.domain.Person;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface PersonRepository extends JpaRepository<Person, UUID> {

    /**
     * The lookup {@code PersonService.findOrCreatePerson} relies on — backed by the
     * case-insensitive {@code ux_person_email_lower} unique index, per
     * docs/specs/014-subscription-responsible-contact.md.
     */
    Optional<Person> findByEmailIgnoreCase(String email);

    /**
     * Case-insensitive substring match against first name, last name, or email, for
     * {@code GET /api/v1/platform/persons} (backs {@code PersonPicker}'s search). Mirrors
     * {@link ClubRepository#search}'s exact shape. A null or blank search returns every Person.
     */
    @Query("select p from Person p where (:search IS NULL OR :search = '' "
            + "or lower(p.firstName) like lower(concat('%', :search, '%')) "
            + "or lower(p.lastName) like lower(concat('%', :search, '%')) "
            + "or lower(p.email) like lower(concat('%', :search, '%')))")
    Page<Person> search(@Param("search") String search, Pageable pageable);
}
