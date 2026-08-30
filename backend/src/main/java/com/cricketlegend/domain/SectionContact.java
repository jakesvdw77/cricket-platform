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
 * A many-to-many join between {@link Section} and docs/specs/021-club-contacts.md's existing
 * {@link ClubContact} — a dedicated join row, not a FK added to either table and not a
 * bidirectional relationship column, matching this codebase's established precedent. No {@link
 * #active} flag: unlinking is a real row delete, not a soft-delete, since a join row carries no
 * independent business meaning once removed (same category as removing a tag, not deleting a
 * record) — see docs/specs/025-club-structure.md's Data Model Changes. Unique on {@code
 * (section_id, club_contact_id)} at the DB level ({@code db/changelog/v1/017-add-section.sql}).
 * See docs/specs/025-club-structure.md.
 */
@Entity
@Table(name = "section_contact")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SectionContact {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "section_id", nullable = false)
    private UUID sectionId;

    @Column(name = "club_contact_id", nullable = false)
    private UUID clubContactId;

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
