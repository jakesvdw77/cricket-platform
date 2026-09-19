package com.cricketlegend.repository;

import com.cricketlegend.domain.Match;
import java.time.Instant;
import java.util.Collection;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/**
 * The first paginated repository in this feature area, per docs/standards/backend.md's pagination
 * rule — a club's match history grows every week across every season, unlike {@code
 * Section}/{@code Team}/{@code Sponsor}'s deliberately small, flat lists. See
 * docs/specs/029-league-management.md.
 */
public interface MatchRepository extends JpaRepository<Match, UUID> {

    Page<Match> findByClubId(UUID clubId, Pageable pageable);

    /**
     * The section-filtered counterpart to {@link #findByClubId} — used for a caller whose access
     * is narrowed to one or more {@code Section}s (a {@code SECTION}-scope {@code CLUB_ADMIN}, or
     * any caller supplying an explicit {@code sectionId} filter). {@code Match} stores home/away
     * as plain {@code UUID} columns (029, no {@code @ManyToOne}), so this is a JPQL subquery join
     * against {@code Team} by field value, not a navigated association — matching this codebase's
     * existing flat-FK style exactly. See docs/specs/035-section-scoped-access.md's Data Model
     * Changes, JPQL reused verbatim.
     */
    @Query("SELECT m FROM Match m WHERE m.clubId = :clubId AND ("
            + "m.homeTeamId IN (SELECT t.id FROM Team t WHERE t.sectionId IN :sectionIds) "
            + "OR m.awayTeamId IN (SELECT t.id FROM Team t WHERE t.sectionId IN :sectionIds))")
    Page<Match> findByClubIdAndSectionIdIn(
            @Param("clubId") UUID clubId, @Param("sectionIds") Collection<UUID> sectionIds, Pageable pageable);

    /**
     * The "upcoming only" counterpart to {@link #findByClubId} — see
     * docs/specs/037-match-improvements.md. {@code startOfToday} is the caller-computed start of
     * the current local day ({@code ZoneId.systemDefault()}); a match dated earlier today is
     * still included since {@code matchDate} is compared, not the calendar date alone.
     */
    Page<Match> findByClubIdAndMatchDateGreaterThanEqual(UUID clubId, Instant startOfToday, Pageable pageable);

    /**
     * The "upcoming only" counterpart to {@link #findByClubIdAndSectionIdIn} — same JPQL shape,
     * with the added {@code matchDate >= :startOfToday} condition. See
     * docs/specs/037-match-improvements.md.
     */
    @Query("SELECT m FROM Match m WHERE m.clubId = :clubId AND m.matchDate >= :startOfToday AND ("
            + "m.homeTeamId IN (SELECT t.id FROM Team t WHERE t.sectionId IN :sectionIds) "
            + "OR m.awayTeamId IN (SELECT t.id FROM Team t WHERE t.sectionId IN :sectionIds))")
    Page<Match> findByClubIdAndSectionIdInAndMatchDateGreaterThanEqual(
            @Param("clubId") UUID clubId,
            @Param("sectionIds") Collection<UUID> sectionIds,
            @Param("startOfToday") Instant startOfToday,
            Pageable pageable);
}
