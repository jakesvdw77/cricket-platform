package com.cricketlegend.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
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
 * One shared, public-facing availability ask — the actual admin-facing and public-facing unit a
 * club admin or a player interacts with directly. Per this spec's second Part A revision (the
 * fixture-group selection revision, see docs/specs/063-section-availability-and-flexible-squads.md's
 * Data Model Changes Part A "Revision note"): a round is no longer scoped to a single {@code
 * (section, date)} pair with a fixed {@code MORNING}/{@code AFTERNOON} pair of windows — it now
 * owns exactly however many {@link SectionAvailabilityWindow}s its admin-selected matches actually
 * need, one per distinct bracket among them. {@link #description} is editable free text, defaulting
 * at creation time to a generated label built from the selected matches' own date range and section
 * name, shown everywhere the round is referenced. {@link #firstMatchDate}/{@link #lastMatchDate}
 * are denormalized min/max of the selected matches' own dates, computed once at creation, never
 * re-derived. {@link #autoClose}/{@link #scheduledCloseAt} are inert data in this pass — nothing
 * reads {@link #scheduledCloseAt} yet to actually close a round, that's deferred to a future Spring
 * Batch job spec (see Non-goals). {@link #clubId} is denormalized from {@code section.clubId}, same
 * precedent as every other section-scoped entity in this feature area. {@link #open} cascades to
 * every owned window's own {@code open} flag — there's no independent per-bracket open/close in
 * this pass. No uniqueness constraint on this table at all — a round's own identity is just its id,
 * the constraint that actually prevents overlap lives on {@link SectionAvailabilityWindow}.
 */
@Entity
@Table(name = "section_availability_round")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SectionAvailabilityRound {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "club_id", nullable = false)
    private UUID clubId;

    @Column(name = "section_id", nullable = false)
    private UUID sectionId;

    @Column(nullable = false)
    private String description;

    @Column(name = "first_match_date", nullable = false)
    private LocalDate firstMatchDate;

    @Column(name = "last_match_date", nullable = false)
    private LocalDate lastMatchDate;

    @Column(name = "auto_close", nullable = false)
    private boolean autoClose;

    @Column(name = "scheduled_close_at")
    private Instant scheduledCloseAt;

    @Column(nullable = false)
    private boolean open;

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
