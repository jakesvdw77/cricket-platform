package com.cricketlegend.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Embedded;
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
 * docs/specs/099-fields-directory.md: a platform-wide playing area (a cricket field today; the UI only ever says
 * "field"). Deliberately has no {@code club_id}: it is shared knowledge. Who captured it is {@link #createdByClubId};
 * who uses it is {@link ClubPlayingArea}. {@link #groundId} is reserved for step 2 (grounds) and never written or read
 * here. {@link #mergedIntoId} is set when an admin merges this row into another; such a row is hidden and its matches
 * and links have moved.
 */
@Entity
@Table(name = "playing_area")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PlayingArea {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Enumerated(EnumType.STRING)
    @Column(name = "area_type", nullable = false)
    private PlayingAreaType areaType;

    @Column(nullable = false)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private PlayingAreaCategory category;

    @Enumerated(EnumType.STRING)
    @Column(name = "owner_type", nullable = false)
    private PlayingAreaOwnerType ownerType;

    @Column(name = "owner_name", nullable = false)
    private String ownerName;

    @Embedded
    private Address address;

    @Column(name = "map_url")
    private String mapUrl;

    @Column(name = "location_notes")
    private String locationNotes;

    @Enumerated(EnumType.STRING)
    @Column(name = "verification_status", nullable = false)
    private PlayingAreaVerificationStatus verificationStatus;

    @Column(name = "verified_at")
    private Instant verifiedAt;

    /** The Keycloak subject of the verifying platform admin (who may have no Person row). */
    @Column(name = "verified_by_subject")
    private String verifiedBySubject;

    @Column(name = "rejection_reason")
    private String rejectionReason;

    @Column(name = "created_by_club_id")
    private UUID createdByClubId;

    /** Reserved for step 2; always null in this spec. */
    @Column(name = "ground_id")
    private UUID groundId;

    @Column(name = "merged_into_id")
    private UUID mergedIntoId;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

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
