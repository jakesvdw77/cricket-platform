package com.cricketlegend.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * A many-to-many join between {@link Team} and docs/specs/021-club-contacts.md's existing {@link
 * ClubContact} — mirrors {@link SectionContact}'s exact shape (a dedicated join row, plain {@code
 * UUID} FK columns, no JPA relationship navigation, no active flag since unlinking is a real row
 * delete) with one deliberate addition: {@link #role},
 * free text, because the same {@code ClubContact} can hold a different role on different teams
 * (e.g. Coach for the 1st XI, Manager for the 2nds) in a way that isn't true of a {@code
 * ClubContact}'s own club-wide {@code role} field. Unique on {@code (team_id, club_contact_id)} at
 * the DB level ({@code db/changelog/v1/019-add-team-profile.sql}). See
 * docs/specs/027-team-profile.md.
 */
@Entity
@Table(name = "team_contact")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TeamContact {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "team_id", nullable = false)
    private UUID teamId;

    @Column(name = "club_contact_id", nullable = false)
    private UUID clubContactId;

    @Column(nullable = false)
    private String role;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "created_by")
    private UUID createdBy;

    @PrePersist
    void prePersist() {
        if (createdAt == null) {
            createdAt = Instant.now();
        }
    }
}
