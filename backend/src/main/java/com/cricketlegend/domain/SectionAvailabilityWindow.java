package com.cricketlegend.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
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
 * One section-scoped availability ask per {@code (section, date, day-part)} — mirrors {@link
 * MatchAvailabilityPoll}'s own Open/Closed lifecycle shape exactly ({@link #open}, deliberately NOT
 * this codebase's usual "disable, never delete" Active/Inactive flag), scoped to a {@link Section}
 * + bracket instead of a {@link Match} + {@code Team} side. {@link #clubId} is denormalized from
 * {@code section.clubId} (same {@code PlayerProfile.clubId} precedent, docs/specs/028-players.md —
 * list/query without joining {@link Section}). Unique on {@code (section_id, window_date,
 * day_part)}, at most one window per section per bracket.
 *
 * <p>Per this spec's round-model revision: {@link #roundId} is this window's owning {@link
 * SectionAvailabilityRound} — a window is created by, and only by, opening a round (always both
 * {@code MORNING}/{@code AFTERNOON} windows together), never directly. {@link #open} is kept in
 * lockstep with the owning round's own {@code open} flag (opening/closing a round cascades to
 * both windows), there's no independent per-bracket open/close in this pass. Everything else about
 * this entity is completely unchanged from its original design. See
 * docs/specs/063-section-availability-and-flexible-squads.md.
 */
@Entity
@Table(name = "section_availability_window")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SectionAvailabilityWindow {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "club_id", nullable = false)
    private UUID clubId;

    @Column(name = "section_id", nullable = false)
    private UUID sectionId;

    @Column(name = "round_id", nullable = false)
    private UUID roundId;

    @Column(name = "window_date", nullable = false)
    private LocalDate windowDate;

    @Enumerated(EnumType.STRING)
    @Column(name = "day_part", nullable = false)
    private DayPart dayPart;

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
