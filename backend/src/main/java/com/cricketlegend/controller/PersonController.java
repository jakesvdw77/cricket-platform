package com.cricketlegend.controller;

import com.cricketlegend.dto.PersonDto;
import com.cricketlegend.service.PersonService;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * docs/specs/014-subscription-responsible-contact.md: search-only, backing
 * {@code PersonPicker}'s on-focus/debounced search. No {@code POST}/{@code PUT}/{@code DELETE} —
 * Person creation only ever happens implicitly, through {@code PersonService.findOrCreatePerson}
 * as part of {@code POST /subscriptions}. Authorization for /api/v1/platform/** is enforced by
 * {@link com.cricketlegend.config.SecurityConfig}'s URL-based platform_admin check.
 */
@RestController
public class PersonController {

    private final PersonService personService;

    public PersonController(PersonService personService) {
        this.personService = personService;
    }

    @GetMapping("/api/v1/platform/persons")
    public ResponseEntity<Page<PersonDto>> list(
            @RequestParam(required = false) String search, Pageable pageable) {
        return ResponseEntity.ok(personService.search(search, pageable));
    }
}
