package com.cricketlegend.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * A generic, unscoped postal address — deliberately named {@code Address}, not
 * {@code ClubAddress}, per docs/specs/012-club-profile.md: JPA embeddables don't support
 * meaningful inheritance, so the way this stays reusable by the future Club Contacts and
 * Sponsors specs isn't subclassing, it's embedding this exact same class into their own entities
 * too ({@code @Embedded private Address address;}, with {@code @AttributeOverride} only if a
 * future entity's table can't use the {@code address_*} column-name convention below). One
 * class, reused as-is — not duplicated per entity.
 *
 * <p>Every field is nullable — an owning entity with no address entered yet is valid.
 */
@Embeddable
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Address {

    @Column(name = "address_number")
    private String number;

    @Column(name = "address_street")
    private String street;

    @Column(name = "address_city")
    private String city;

    @Column(name = "address_province_state")
    private String provinceState;

    @Column(name = "address_country")
    private String country;

    @Column(name = "address_postal_code")
    private String postalCode;
}
