package com.cricketlegend.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Embedded;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * A named contact person for a club (name, role, email, phone, optional photo, one flagged
 * primary) — many-to-one with {@link Club}, matching {@link ClubProfile}'s existing convention of
 * a plain {@code UUID} FK column with no JPA relationship navigation. Embeds the reusable {@link
 * Contact} for the name/email/phone fields, per {@code Contact}'s own Javadoc intent. "Disable,
 * never delete" — see {@link #active}. See docs/specs/021-club-contacts.md.
 *
 * <p>Primary-contact enforcement (at most one active primary per club) is handled in the service
 * layer (auto-unset, not reject) and backstopped at the DB level by a partial unique index
 * ({@code ux_club_contact_primary}) — see the migration
 * {@code db/changelog/v1/013-add-club-contact.sql}.
 */
@Entity
@Table(name = "club_contact")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ClubContact {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "club_id", nullable = false)
    private UUID clubId;

    @Embedded
    private Contact contact;

    @Column(nullable = false)
    private String role;

    @Column(name = "is_primary", nullable = false)
    private boolean isPrimary;

    @Column(nullable = false)
    private boolean active;

    @Column(name = "photo_url")
    private String photoUrl;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Column(name = "updated_by")
    private UUID updatedBy;

    @PrePersist
    void prePersist() {
        Instant now = Instant.now();
        if (createdAt == null) {
            createdAt = now;
        }
        if (updatedAt == null) {
            updatedAt = now;
        }
    }

    @PreUpdate
    void preUpdate() {
        updatedAt = Instant.now();
    }
}
