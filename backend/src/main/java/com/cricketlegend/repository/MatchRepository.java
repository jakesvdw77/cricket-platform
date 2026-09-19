package com.cricketlegend.repository;

import com.cricketlegend.domain.Match;
import java.time.Instant;
import java.util.Collection;
import java.util.List;
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

    /**
     * Item 9's "Re-select from Previous Match" candidate query — see
     * docs/specs/037-match-improvements.md. Scoped to this club's own matches ({@code clubId}),
     * one team's own fixture history ({@code teamId} as either {@code homeTeamId} or {@code
     * awayTeamId}), an exact {@code seasonId} match, and an exact {@code leagueId} match
     * including {@code NULL}-to-{@code NULL} ("same League, including no League" — never a
     * broader "any League" match). Restricted to {@code active} matches whose {@code matchDate}
     * is strictly before {@code now} (the "already played" proxy — see the spec's own Non-goals,
     * no real match-result/status field exists yet), optionally excluding one match id, and
     * further restricted to matches where a {@link com.cricketlegend.domain.MatchSide} for {@code
     * teamId} already has at least one {@link com.cricketlegend.domain.MatchSidePlayer} — a side
     * whose XI was never built has nothing meaningful to copy. Ordered {@code matchDate}
     * descending (most recent first). Deliberately unpaginated — see the spec's own API Contract
     * note that this candidate set is naturally small, unlike the club-wide {@link
     * #findByClubId}.
     */
    @Query("SELECT m FROM Match m WHERE m.clubId = :clubId AND m.seasonId = :seasonId "
            + "AND (m.homeTeamId = :teamId OR m.awayTeamId = :teamId) "
            + "AND ((:leagueId IS NULL AND m.leagueId IS NULL) OR m.leagueId = :leagueId) "
            + "AND m.active = true AND m.matchDate < :now "
            + "AND (:excludeMatchId IS NULL OR m.id <> :excludeMatchId) "
            + "AND EXISTS (SELECT 1 FROM MatchSide ms WHERE ms.matchId = m.id AND ms.teamId = :teamId "
            + "AND EXISTS (SELECT 1 FROM MatchSidePlayer msp WHERE msp.matchSideId = ms.id)) "
            + "ORDER BY m.matchDate DESC")
    List<Match> findPreviousForTeamSeasonLeague(
            @Param("clubId") UUID clubId,
            @Param("teamId") UUID teamId,
            @Param("seasonId") UUID seasonId,
            @Param("leagueId") UUID leagueId,
            @Param("now") Instant now,
            @Param("excludeMatchId") UUID excludeMatchId);
}
