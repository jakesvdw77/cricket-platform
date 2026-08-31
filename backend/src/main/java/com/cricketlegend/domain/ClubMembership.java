package com.cricketlegend.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import java.time.LocalDate;
import java.util.UUID;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * docs/specs/001-tenancy-identity-model.md's original "which club is this person currently with"
 * shape, unmodified, built for the first time by docs/specs/028-players.md. {@link #validTo}
 * {@code null} means currently active ({@code 001} ADR-01) — at most one such row per {@link
 * #personId} at a time, enforced by the partial unique index {@code ux_club_membership_active}
 * ({@code db/changelog/v1/020-add-player.sql}), not only in application code.
 *
 * <p>No dedicated service/controller (see the spec's Non-goals — no standalone {@code
 * /manage/club-memberships} surface) — used directly via {@link
 * com.cricketlegend.repository.ClubMembershipRepository} inside {@code PlayerServiceImpl}, the
 * same "repository with no dedicated service, used internally by another entity's service"
 * precedent {@code SectionContactRepository} already set inside {@code SectionServiceImpl}. A row
 * is created once, at player creation, and its {@link #validTo} is toggled open/closed by {@code
 * PlayerServiceImpl.deactivate}/{@code reactivate} — never a second row for the same person, since
 * player creation never reuses an existing {@link Person} (see the spec's Non-goals on person
 * deduplication). See docs/specs/028-players.md.
 */
@Entity
@Table(name = "club_membership")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ClubMembership {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "person_id", nullable = false)
    private UUID personId;

    @Column(name = "club_id", nullable = false)
    private UUID clubId;

    @Column(name = "valid_from", nullable = false)
    private LocalDate validFrom;

    @Column(name = "valid_to")
    private LocalDate validTo;

    @PrePersist
    void prePersist() {
        if (validFrom == null) {
            validFrom = LocalDate.now();
        }
    }
}
