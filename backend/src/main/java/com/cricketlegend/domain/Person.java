package com.cricketlegend.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * A real identity shape — grown from the minimal prerequisite stub docs/specs/004-landing-page.md
 * originally needed (bare {@code id}/{@code keycloak_user_id}/{@code full_name}) into
 * {@code firstName}/{@code lastName}/{@code email}/{@code phone?} by
 * docs/specs/014-subscription-responsible-contact.md, the same incremental-growth pattern
 * {@link Club} followed across specs `010`/`011`/`012`. Still NOT the full identity entity from
 * docs/specs/001-tenancy-identity-model.md (no ClubMembership/RoleAssignment relations yet) — this
 * is the identity/auth anchor a future login (self-serve signup, docs/roadmap.md) resolves
 * against, one row per human, forever.
 *
 * <p>docs/specs/028-players.md grows this with {@link #dateOfBirth}/{@link #gender} — {@code 001}'s
 * own reserved-but-unbuilt fields, now given their first real consumer (a player's own basic
 * info) — and loosens {@link #email} to nullable: a player-only {@code Person} (most players,
 * especially juniors) never has a login and so genuinely has no email, unlike the one existing
 * use case ({@code 014}'s Subscription responsible party) that required it {@code NOT NULL}. The
 * {@code ux_person_email_lower} unique index needs no change — Postgres treats {@code NULL} as
 * distinct from any other value, so any number of {@code Person} rows can share a {@code NULL}
 * email without colliding.
 */
@Entity
@Table(name = "person")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Person {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "first_name", nullable = false)
    private String firstName;

    @Column(name = "last_name", nullable = false)
    private String lastName;

    @Column(name = "email")
    private String email;

    @Column(name = "phone")
    private String phone;

    @Column(name = "date_of_birth")
    private LocalDate dateOfBirth;

    @Enumerated(EnumType.STRING)
    private Gender gender;

    @Column(name = "keycloak_user_id", unique = true)
    private String keycloakUserId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private PersonStatus status;

    @Column(name = "keycloak_provisioned_at")
    private Instant keycloakProvisionedAt;

    @PrePersist
    void prePersist() {
        if (status == null) {
            status = PersonStatus.ACTIVE;
        }
    }
}
