package com.cricketlegend.service;

import com.cricketlegend.domain.Person;
import com.cricketlegend.dto.PersonDto;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

/**
 * docs/specs/014-subscription-responsible-contact.md's find-or-create primitive — the same
 * "don't create a second Person for an email that already has one" guarantee
 * docs/specs/003-club-onboarding.md's Invitation will need, built here first as a reusable
 * service rather than a Subscription-specific special case.
 */
public interface PersonService {

    /**
     * Links to the existing {@link Person} matching {@code email} case-insensitively if one
     * exists — that row is returned exactly as stored, {@code firstName}/{@code lastName}/
     * {@code phone} passed here are discarded, never applied ("link, don't overwrite"). Otherwise
     * creates and returns a new {@link Person} from the given fields. Unconditionally safe to
     * call from a write path — never call this from a read path, it would silently create a
     * Person instead of 404ing on a bad id.
     */
    Person findOrCreatePerson(String firstName, String lastName, String email, String phone);

    /**
     * Backend-driven pagination, per docs/standards/backend.md. Backs
     * {@code GET /api/v1/platform/persons} (search, for {@code PersonPicker}). An optional,
     * case-insensitive substring {@code search} against first name, last name, or email narrows
     * the results; omitted/blank returns every Person.
     */
    Page<PersonDto> search(String search, Pageable pageable);
}
