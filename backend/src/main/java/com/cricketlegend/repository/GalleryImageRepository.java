package com.cricketlegend.repository;

import com.cricketlegend.domain.GalleryImage;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/**
 * docs/specs/157-photo-gallery.md. Every list is a page (a real LIMIT and OFFSET), newest first. An optional filter is
 * switched off with its {@code no...} flag and a placeholder id, which keeps the query to one fixed statement.
 */
public interface GalleryImageRepository extends JpaRepository<GalleryImage, UUID> {

    String FILTERS = """
            FROM GalleryImage g
            WHERE g.clubId = :clubId AND g.status = 'PUBLISHED'
              AND (:noLeague = true OR EXISTS (SELECT 1 FROM GalleryImageTag t
                   WHERE t.imageId = g.id AND t.tagType = 'LEAGUE' AND t.tagId = :leagueId))
              AND (:noTeam = true OR EXISTS (SELECT 1 FROM GalleryImageTag t
                   WHERE t.imageId = g.id AND t.tagType = 'TEAM' AND t.tagId = :teamId))
              AND (:noPlayer = true OR EXISTS (SELECT 1 FROM GalleryImageTag t
                   WHERE t.imageId = g.id AND t.tagType = 'PLAYER' AND t.tagId = :playerId))
              AND (:noText = true OR LOWER(g.caption) LIKE :pattern OR EXISTS (SELECT 1 FROM GalleryImageTag t
                   WHERE t.imageId = g.id AND (
                        (t.tagType = 'LEAGUE' AND EXISTS (SELECT 1 FROM League l
                             WHERE l.id = t.tagId AND LOWER(l.name) LIKE :pattern))
                     OR (t.tagType = 'TEAM' AND EXISTS (SELECT 1 FROM Team tm
                             WHERE tm.id = t.tagId AND LOWER(tm.name) LIKE :pattern))
                     OR (t.tagType = 'PLAYER' AND EXISTS (SELECT 1 FROM PlayerProfile pp, Person p
                             WHERE pp.id = t.tagId AND p.id = pp.personId
                               AND LOWER(CONCAT(p.firstName, ' ', p.lastName)) LIKE :pattern)))))
            """;

    @Query(value = "SELECT g " + FILTERS + " ORDER BY g.uploadedAt DESC, g.id DESC", countQuery = "SELECT COUNT(g) " + FILTERS)
    Page<GalleryImage> search(
            @Param("clubId") UUID clubId,
            @Param("noLeague") boolean noLeague,
            @Param("leagueId") UUID leagueId,
            @Param("noTeam") boolean noTeam,
            @Param("teamId") UUID teamId,
            @Param("noPlayer") boolean noPlayer,
            @Param("playerId") UUID playerId,
            @Param("noText") boolean noText,
            @Param("pattern") String pattern,
            Pageable pageable);

    List<GalleryImage> findByClubIdAndStatusOrderByUploadedAtDescIdDesc(UUID clubId, String status, Pageable pageable);

    /** The (type, id) pairs of every tag on a published photo of the club: type is a String, id a UUID. */
    @Query("SELECT DISTINCT t.tagType, t.tagId FROM GalleryImageTag t, GalleryImage g "
            + "WHERE t.imageId = g.id AND g.clubId = :clubId AND g.status = 'PUBLISHED'")
    List<Object[]> tagsInUse(@Param("clubId") UUID clubId);

    long countByUploadedByPersonIdAndUploadedAtAfter(UUID uploadedByPersonId, Instant after);
}
