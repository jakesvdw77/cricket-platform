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
import java.util.UUID;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Club-scoped player data beyond bare identity, per docs/specs/028-players.md — basic info
 * (photo, club membership number, medical aid), the player's own contact info ({@link #phone}/
 * {@link #email}/{@link #altContactName}/{@link #altContactPhone}, entirely separate from {@link
 * Person#getPhone()}/{@link Person#getEmail()}, which stay reserved for a login-capable identity),
 * and cricket-specific info ({@link #battingStance}/{@link #bowlingArm}/{@link #bowlingType}/
 * {@link #wicketKeeper}, every one independently optional). Carries its own {@link #clubId}
 * directly (not derived via {@link ClubMembership}), same {@code Team.clubId} precedent — queries
 * without joining {@code club_membership}. Unique on {@code (person_id, club_id)} — one {@code
 * PlayerProfile} per person per club (a transfer to a different club is a different {@code
 * club_id}, so a new row, not a conflict — see the spec's Non-goals on concurrent multi-club
 * membership). "Disable, never delete" — see {@link #active}; deactivating also closes the
 * linked {@link ClubMembership} in the same transaction (see {@code PlayerServiceImpl}). See
 * docs/specs/028-players.md.
 */
@Entity
@Table(name = "player_profile")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PlayerProfile {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "person_id", nullable = false)
    private UUID personId;

    @Column(name = "club_id", nullable = false)
    private UUID clubId;

    @Column(name = "photo_url")
    private String photoUrl;

    @Column(name = "club_membership_number")
    private String clubMembershipNumber;

    @Column(name = "medical_aid_provider")
    private String medicalAidProvider;

    @Column(name = "medical_aid_member_number")
    private String medicalAidMemberNumber;

    @Column(name = "phone")
    private String phone;

    @Column(name = "email")
    private String email;

    @Column(name = "alt_contact_name")
    private String altContactName;

    @Column(name = "alt_contact_phone")
    private String altContactPhone;

    @Enumerated(EnumType.STRING)
    @Column(name = "batting_stance")
    private BattingStance battingStance;

    @Enumerated(EnumType.STRING)
    @Column(name = "bowling_arm")
    private BowlingArm bowlingArm;

    @Enumerated(EnumType.STRING)
    @Column(name = "bowling_type")
    private BowlingType bowlingType;

    @Column(name = "is_wicket_keeper", nullable = false)
    private boolean wicketKeeper;

    @Column(nullable = false)
    private boolean active;

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
