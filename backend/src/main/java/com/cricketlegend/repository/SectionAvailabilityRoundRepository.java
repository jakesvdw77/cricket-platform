package com.cricketlegend.repository;

import com.cricketlegend.domain.SectionAvailabilityRound;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/**
 * Small, bounded, unpaginated — same {@code TeamServiceImpl.listByClub}-style in-memory-filter
 * precedent as {@code SectionAvailabilityWindowRepository}'s own identical shape. Per the
 * fixture-group-selection revision, a round no longer carries a {@code roundDate}, so {@code
 * existsBySectionIdAndRoundDate}/{@code findBySectionIdAndRoundDate} are no longer meaningful and
 * have been dropped — a round's own identity is just its id (see Data Model Changes, "no
 * uniqueness constraint on this table at all"). See
 * docs/specs/063-section-availability-and-flexible-squads.md.
 */
public interface SectionAvailabilityRoundRepository extends JpaRepository<SectionAvailabilityRound, UUID> {

    List<SectionAvailabilityRound> findByClubId(UUID clubId);

    /** The club's open group polls — one query for the manager overview (docs/specs/079). */
    List<SectionAvailabilityRound> findByClubIdAndOpenTrue(UUID clubId);

    /**
     * Open rounds whose autoclose time has passed — backs the scheduled auto-close job
     * (docs/specs/064-unified-availability-polls.md).
     */
    @Query("SELECT r FROM SectionAvailabilityRound r WHERE r.open = true AND r.autoClose = true "
            + "AND r.scheduledCloseAt IS NOT NULL AND r.scheduledCloseAt <= :now")
    List<SectionAvailabilityRound> findDueForAutoClose(@Param("now") Instant now);

    /**
     * The open rounds whose section the player is tagged to: the audience rule {@code
     * SectionAvailabilityAudienceResolver} applies for the public form (docs/specs/077), as one query for
     * docs/specs/119 My players. The caller has already required an active player.
     */
    @Query("SELECT r FROM SectionAvailabilityRound r WHERE r.open = true AND EXISTS "
            + "(SELECT 1 FROM PlayerSection ps WHERE ps.sectionId = r.sectionId "
            + "AND ps.playerProfileId = :playerProfileId) ORDER BY r.firstMatchDate")
    List<SectionAvailabilityRound> findOpenForPlayer(@Param("playerProfileId") UUID playerProfileId);

    /** Closed rounds of the player's sections (the {@link #findOpenForPlayer} rule) closed since {@code since}, newest closed first. */
    @Query("SELECT r FROM SectionAvailabilityRound r WHERE r.open = false AND r.clubId = :clubId "
            + "AND r.updatedAt >= :since AND EXISTS (SELECT 1 FROM PlayerSection ps WHERE ps.sectionId = r.sectionId "
            + "AND ps.playerProfileId = :playerProfileId) ORDER BY r.updatedAt DESC")
    List<SectionAvailabilityRound> findClosedSinceForPlayer(
            @Param("playerProfileId") UUID playerProfileId, @Param("clubId") UUID clubId, @Param("since") Instant since);

    /** Every round (open or closed) of the player's sections whose first match date is in {@code [from, to]}. */
    @Query("SELECT r FROM SectionAvailabilityRound r WHERE r.clubId = :clubId AND r.firstMatchDate >= :from "
            + "AND r.firstMatchDate <= :to AND EXISTS (SELECT 1 FROM PlayerSection ps WHERE ps.sectionId = r.sectionId "
            + "AND ps.playerProfileId = :playerProfileId) ORDER BY r.firstMatchDate DESC")
    List<SectionAvailabilityRound> findForPlayerBetween(
            @Param("playerProfileId") UUID playerProfileId,
            @Param("clubId") UUID clubId,
            @Param("from") LocalDate from,
            @Param("to") LocalDate to);

    /** The first match dates of every round of the player's sections, to find the seasons that hold a group poll. */
    @Query("SELECT r.firstMatchDate FROM SectionAvailabilityRound r WHERE r.clubId = :clubId AND EXISTS "
            + "(SELECT 1 FROM PlayerSection ps WHERE ps.sectionId = r.sectionId AND ps.playerProfileId = :playerProfileId)")
    List<LocalDate> findFirstMatchDatesForPlayer(
            @Param("playerProfileId") UUID playerProfileId, @Param("clubId") UUID clubId);
}
