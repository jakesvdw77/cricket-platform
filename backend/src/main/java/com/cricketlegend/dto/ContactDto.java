package com.cricketlegend.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

/**
 * The generic, unscoped four-field contact shape — mirrors {@link com.cricketlegend.domain.Contact}
 * on the DTO side. Currently unused — reserved for a future "Club Contacts" spec, whose entries
 * genuinely never need login (unlike {@link PersonDto}, the read shape for the identity/auth
 * anchor {@link com.cricketlegend.domain.Person} backs) — see docs/specs/012-club-profile.md's
 * Rollout Notes for that follow-up. A future {@code ClubContactDto} reuses this record directly
 * rather than getting its own copy.
 *
 * <p>Unlike {@link AddressDto} (no validation annotations at all — every address field is
 * genuinely optional free text), {@code ContactDto} carries {@code @NotBlank}/{@code @Email}
 * directly on its own fields: a {@code Contact} present at all but half-blank is nonsensical in
 * every context this shape is used in, so "complete or absent" is baked onto the reusable type
 * itself rather than re-declared at every call site.
 */
public record ContactDto(
        @NotBlank String firstName,
        @NotBlank String lastName,
        @NotBlank @Email String email,
        @NotBlank String phone) {
}
