package com.cricketlegend.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * One photo of a club's gallery (docs/specs/157-photo-gallery.md): a medium and a thumbnail file under {@code /media}, who
 * added it and when, and an optional caption. A plain club id column, like the other club-owned records. {@link #status}
 * is the hook for approval rules later; only {@link #PUBLISHED} photos are listed.
 */
@Entity
@Table(name = "gallery_image")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class GalleryImage {

    public static final String PUBLISHED = "PUBLISHED";

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "club_id", nullable = false)
    private UUID clubId;

    @Column(name = "uploaded_by_person_id", nullable = false)
    private UUID uploadedByPersonId;

    @Column(name = "uploaded_at", nullable = false)
    private Instant uploadedAt;

    private String caption;

    @Column(name = "medium_url", nullable = false)
    private String mediumUrl;

    @Column(name = "thumb_url", nullable = false)
    private String thumbUrl;

    @Column(nullable = false)
    private String status;
}
