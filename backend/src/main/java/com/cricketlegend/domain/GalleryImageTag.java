package com.cricketlegend.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.util.UUID;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * A photo's tag to one league, team or player (docs/specs/157-photo-gallery.md). The type is a plain string
 * ({@link #LEAGUE}, {@link #TEAM}, {@link #PLAYER}); the rows are removed with the photo by the database ({@code ON DELETE CASCADE}).
 */
@Entity
@Table(name = "gallery_image_tag")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class GalleryImageTag {

    public static final String LEAGUE = "LEAGUE";
    public static final String TEAM = "TEAM";
    public static final String PLAYER = "PLAYER";

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "image_id", nullable = false)
    private UUID imageId;

    @Column(name = "tag_type", nullable = false)
    private String tagType;

    @Column(name = "tag_id", nullable = false)
    private UUID tagId;
}
