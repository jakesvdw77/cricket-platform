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
 * docs/specs/099-fields-directory.md: a club's link to a {@link PlayingArea}. {@link #home} means the club manages or
 * regularly plays at the field whether or not it owns it. Unique per {@code (clubId, playingAreaId)}; several clubs
 * may share a home field. The link is only the "Our fields" shortlist: matches reference the field directly.
 */
@Entity
@Table(name = "club_playing_area")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ClubPlayingArea {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "club_id", nullable = false)
    private UUID clubId;

    @Column(name = "playing_area_id", nullable = false)
    private UUID playingAreaId;

    @Column(name = "is_home", nullable = false)
    private boolean home;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @PrePersist
    void prePersist() {
        if (createdAt == null) {
            createdAt = Instant.now();
        }
    }
}
