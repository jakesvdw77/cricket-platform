package com.cricketlegend.repository;

import com.cricketlegend.domain.GalleryImageTag;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/** docs/specs/157-photo-gallery.md. */
public interface GalleryImageTagRepository extends JpaRepository<GalleryImageTag, UUID> {

    List<GalleryImageTag> findByImageIdIn(Collection<UUID> imageIds);
}
