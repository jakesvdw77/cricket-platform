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
 * A window's matches, made an explicit, stored selection rather than a live time-based scan — the
 * one genuine behavioural change this spec's fixture-group-selection revision makes to {@link
 * SectionAvailabilityWindow} itself. Rows are created once, atomically, when a round is opened
 * ({@code SectionAvailabilityRoundServiceImpl#create}) — there's no endpoint to add or remove a row
 * afterward (see Non-goals: a round's match set is fixed once created). Bare join, mirrors {@link
 * PlayerSection}'s exact shape. Unique on {@link #matchId} — a given match belongs to at most one
 * window, ever, the DB-level backstop for "a match already covered by another poll can't be
 * selected into a second one." See docs/specs/063-section-availability-and-flexible-squads.md.
 */
@Entity
@Table(name = "section_availability_window_match")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SectionAvailabilityWindowMatch {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "window_id", nullable = false)
    private UUID windowId;

    @Column(name = "match_id", nullable = false)
    private UUID matchId;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @PrePersist
    void prePersist() {
        if (createdAt == null) {
            createdAt = Instant.now();
        }
    }
}
