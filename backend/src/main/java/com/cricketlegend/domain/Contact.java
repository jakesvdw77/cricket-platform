package com.cricketlegend.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * A generic, unscoped person contact — first name, last name, email, phone — deliberately named
 * {@code Contact}, not tied to any one embedding entity's name. Reserved for a future "Club
 * Contacts" spec, whose entries genuinely never need login (unlike {@link Person}, the
 * identity/auth anchor for anyone who has or will have system access) — see
 * docs/specs/012-club-profile.md's Rollout Notes for that follow-up. JPA embeddables don't support
 * meaningful inheritance, so the way this stays reusable across whatever eventually needs "a
 * person's name + email + phone" isn't subclassing, it's embedding this exact same class into
 * other entities via {@code @Embedded}. One class, reused as-is.
 *
 * <p>Unlike {@link Address}, these {@code @Column} names carry no baked-in prefix — {@code Contact}
 * is designed from the start to be embedded into more than one table with different column-name
 * needs, so every embedding site supplies its own prefix via {@code @AttributeOverride} rather than
 * one being baked in here.
 */
@Embeddable
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Contact {

    @Column(name = "first_name")
    private String firstName;

    @Column(name = "last_name")
    private String lastName;

    @Column(name = "email")
    private String email;

    @Column(name = "phone")
    private String phone;
}
