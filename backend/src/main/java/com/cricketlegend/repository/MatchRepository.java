package com.cricketlegend.repository;

import com.cricketlegend.domain.Match;
import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/**
 * The first paginated repository in this feature area, per docs/standards/backend.md's pagination
 * rule — a club's match history grows every week across every season, unlike {@code
 * Section}/{@code Team}/{@code Sponsor}'s deliberately small, flat lists. See
 * docs/specs/029-league-management.md.
 *
 * <p>Per docs/specs/042-match-list-filters-and-search.md: also {@link JpaSpecificationExecutor} —
 * the first use of Spring Data JPA's {@code Specification}/Criteria API anywhere in this backend,
 * introduced so {@code search}/{@code leagueId}/{@code seasonId}/{@code sectionId}/{@code
 * upcomingOnly} can combine in any combination as one composed query (see {@link
 * MatchSpecifications}) rather than a hard-coded branch per combination. Every existing derived/
 * {@code @Query} method below is kept exactly as-is — additive, not a replacement.
 */
public interface MatchRepository extends JpaRepository<Match, UUID>, JpaSpecificationExecutor<Match> {

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

    /**
     * Every match for {@code clubId} whose {@code matchDate} falls within {@code [from, to)} —
     * naturally bounded (one calendar day/half-day), needing no pagination. Backs {@code
     * SectionAvailabilityMatchResolver}'s live "which matches does this window cover" resolution.
     * See docs/specs/063-section-availability-and-flexible-squads.md.
     */
    List<Match> findByClubIdAndMatchDateBetween(UUID clubId, Instant from, Instant to);

    /**
     * Every <em>active</em> match of {@code clubId} whose {@code matchDate} falls in {@code
     * [from, to)}. Backs {@code MatchSlots}' slot-collision window (the widest span reaching back is
     * a five-day match). See docs/specs/076-team-selection.md.
     */
    @Query("SELECT m FROM Match m WHERE m.clubId = :clubId AND m.active = true "
            + "AND m.matchDate >= :from AND m.matchDate < :to")
    List<Match> findActiveInWindow(
            @Param("clubId") UUID clubId, @Param("from") Instant from, @Param("to") Instant to);

    /**
     * Every future match for {@code clubId} where either side is a {@code Team} belonging to
     * {@code sectionId} (docs/specs/064-unified-availability-polls.md dropped the squad-mode
     * predicate — every team can be polled either way) — naturally small and bounded (one section's own
     * upcoming fixtures), needing no further limit or pagination. Backs {@code
     * SectionAvailabilityFixtureGroupResolver}'s own proposal query, the fixture-group-selection
     * revision's one genuinely new query in this area. Ordered {@code matchDate} ascending, ready
     * for the resolver's own date-adjacency clustering. See
     * docs/specs/063-section-availability-and-flexible-squads.md.
     */
    @Query("SELECT m FROM Match m WHERE m.clubId = :clubId AND m.matchDate >= :from AND ("
            + "m.homeTeamId IN (SELECT t.id FROM Team t WHERE t.sectionId = :sectionId) "
            + "OR m.awayTeamId IN (SELECT t.id FROM Team t WHERE t.sectionId = :sectionId)) "
            + "ORDER BY m.matchDate ASC")
    List<Match> findUpcomingMatchesBySection(
            @Param("clubId") UUID clubId, @Param("sectionId") UUID sectionId, @Param("from") Instant from);

    /**
     * Per docs/specs/070-league-teams.md's propagation rule: rewrites the denormalised home-side
     * name/logo on every match whose {@code homeLeagueTeamId} is {@code leagueTeamId}. A bulk JPQL
     * update bypasses {@code @PreUpdate}, so {@code updatedAt} is set here explicitly; the
     * persistence context is flushed first and cleared afterwards so no stale {@link Match}
     * survives in the session. Returns the number of rows updated.
     */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("UPDATE Match m SET m.homeTeamName = :name, m.homeTeamLogoUrl = :logoUrl, m.updatedAt = :now "
            + "WHERE m.homeLeagueTeamId = :leagueTeamId")
    int propagateLeagueTeamToHomeSide(
            @Param("leagueTeamId") UUID leagueTeamId,
            @Param("name") String name,
            @Param("logoUrl") String logoUrl,
            @Param("now") Instant now);

    /** The away-side counterpart of {@link #propagateLeagueTeamToHomeSide}. */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("UPDATE Match m SET m.awayTeamName = :name, m.awayTeamLogoUrl = :logoUrl, m.updatedAt = :now "
            + "WHERE m.awayLeagueTeamId = :leagueTeamId")
    int propagateLeagueTeamToAwaySide(
            @Param("leagueTeamId") UUID leagueTeamId,
            @Param("name") String name,
            @Param("logoUrl") String logoUrl,
            @Param("now") Instant now);

    /**
     * Per docs/specs/071-league-card-redesign.md: one grouped aggregate of a club's active matches
     * in one season per league, for {@code now} read once by the caller so played and to-go always
     * add up. Leagues with no matches are absent; matches without a league are never counted.
     */
    @Query("select m.leagueId as leagueId, count(m) as matchCount, "
            + "sum(case when m.matchDate < :now then 1 else 0 end) as playedCount, "
            + "min(m.matchDate) as firstMatchDate, max(m.matchDate) as lastMatchDate, "
            + "min(case when m.matchDate >= :now then m.matchDate end) as nextMatchDate "
            + "from Match m where m.clubId = :clubId and m.seasonId = :seasonId and m.active = true "
            + "and m.leagueId is not null group by m.leagueId")
    List<LeagueMatchSummary> summariseByLeagueForSeason(
            @Param("clubId") UUID clubId, @Param("seasonId") UUID seasonId, @Param("now") Instant now);

    /**
     * docs/specs/091-leagues-gold-standard.md: the number of active matches of each league in one season that fall
     * within {@code [weekStart, weekEnd)} - the Leagues page's "this week" figure (the same window the Matches counter
     * uses). One round trip for every league.
     */
    @Query("select m.leagueId as leagueId, count(m) as matchCount "
            + "from Match m where m.clubId = :clubId and m.seasonId = :seasonId and m.active = true "
            + "and m.leagueId is not null and m.matchDate >= :weekStart and m.matchDate < :weekEnd "
            + "group by m.leagueId")
    List<LeagueWeekMatchCount> countMatchesInWindowByLeague(
            @Param("clubId") UUID clubId,
            @Param("seasonId") UUID seasonId,
            @Param("weekStart") Instant weekStart,
            @Param("weekEnd") Instant weekEnd);

    /** Projection backing {@link #countMatchesInWindowByLeague}. */
    interface LeagueWeekMatchCount {
        UUID getLeagueId();

        long getMatchCount();
    }

    /**
     * Per docs/specs/094-club-structure-and-seasons.md: the number of active matches of the club in each of
     * {@code seasonIds}, in one round trip (seasons with no match are absent).
     */
    @Query("select m.seasonId as seasonId, count(m) as total from Match m "
            + "where m.clubId = :clubId and m.seasonId in :seasonIds and m.active = true group by m.seasonId")
    List<SeasonMatchCount> countActiveBySeasonIds(
            @Param("clubId") UUID clubId, @Param("seasonIds") List<UUID> seasonIds);

    /** Projection backing {@link #countActiveBySeasonIds}. */
    interface SeasonMatchCount {
        UUID getSeasonId();

        long getTotal();
    }

    /** Projection backing {@link #summariseByLeagueForSeason}. */
    interface LeagueMatchSummary {
        UUID getLeagueId();

        long getMatchCount();

        long getPlayedCount();

        Instant getFirstMatchDate();

        Instant getLastMatchDate();

        Instant getNextMatchDate();
    }
}
