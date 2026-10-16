package com.cricketlegend.service.support;

import java.util.UUID;

/** A registered player a written name can be matched to: an id and the name as the system holds it. */
public record NameCandidate(UUID id, String firstName, String lastName) {

    public NameCandidate {
        firstName = firstName == null ? "" : firstName;
        lastName = lastName == null ? "" : lastName;
    }

    /** First name, a space, then surname; the form tier 1 compares. */
    public String fullName() {
        return (firstName + " " + lastName).trim();
    }
}
