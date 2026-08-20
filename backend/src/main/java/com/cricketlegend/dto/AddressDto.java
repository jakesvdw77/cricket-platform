package com.cricketlegend.dto;

/**
 * The generic, unscoped six-field address shape — mirrors {@link com.cricketlegend.domain.Address}
 * on the DTO side. Used both as {@link ClubProfileDto}'s read shape and, reused directly, as
 * {@link UpdateClubProfileRequest}'s nested address shape (none of its fields are ever required,
 * so no separate request-address type is needed). A future {@code ClubContactDto}/
 * {@code SponsorDto} reuses this record directly rather than getting its own copy — see
 * docs/specs/012-club-profile.md.
 */
public record AddressDto(
        String number,
        String street,
        String city,
        String provinceState,
        String country,
        String postalCode) {
}
