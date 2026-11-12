package com.cricketlegend.repository;

import com.cricketlegend.domain.MatchAvailabilityPoll;
import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/** See docs/specs/032-match-availability-polls.md, docs/specs/034-availability-polls-dashboard.md. */
public interface MatchAvailabilityPollRepository extends JpaRepository<MatchAvailabilityPoll, UUID> {

    Optional<MatchAvailabilityPoll> findByMatchIdAndTeamId(UUID matchId, UUID teamId);

    boolean existsByMatchIdAndTeamId(UUID matchId, UUID teamId);

    List<MatchAvailabilityPoll> findByMatchId(UUID matchId);

    /**
     * Every currently-open poll whose owning {@code Match.clubId} equals {@code clubId} — backs
     * the {@code GET /availability-polls/open} dashboard endpoint. A plain JPQL subquery against
     * {@code Match}'s own {@code clubId}, matching this codebase's existing flat-FK style ({@code
     * MatchAvailabilityPoll} stores {@code matchId}/{@code teamId} as raw UUIDs, no mapped {@code
     * @ManyToOne}). See docs/specs/034-availability-polls-dashboard.md's API Contract, JPQL reused
     * verbatim.
     */
    @Query("SELECT p FROM MatchAvailabilityPoll p WHERE p.open = true "
            + "AND p.matchId IN (SELECT m.id FROM Match m WHERE m.clubId = :clubId)")
    List<MatchAvailabilityPoll> findOpenByMatchClubId(@Param("clubId") UUID clubId);

    /**
     * Every closed poll whose owning {@code Match.clubId} equals {@code clubId}, most recent match
     * date first — backs {@code GET /availability-polls/closed}. Unbounded here; the service caps
     * the (section-filtered) result at the 50 most recent.
     */
    @Query("SELECT p FROM MatchAvailabilityPoll p, Match m WHERE p.open = false AND m.id = p.matchId "
            + "AND m.clubId = :clubId ORDER BY m.matchDate DESC")
    List<MatchAvailabilityPoll> findClosedByMatchClubId(@Param("clubId") UUID clubId);

    /**
     * Open polls whose autoclose time has passed — backs the scheduled auto-close job
     * (docs/specs/064-unified-availability-polls.md).
     */
    @Query("SELECT p FROM MatchAvailabilityPoll p WHERE p.open = true AND p.autoClose = true "
            + "AND p.scheduledCloseAt IS NOT NULL AND p.scheduledCloseAt <= :now")
    List<MatchAvailabilityPoll> findDueForAutoClose(@Param("now") Instant now);

    /** Batch lookup for the player availability grid (docs/specs/068-player-availability-grid.md). */
    List<MatchAvailabilityPoll> findByMatchIdIn(Collection<UUID> matchIds);

    /** docs/specs/109-delete-empty-match.md: which of these matches have at least one row here (one query for a page). */
    @Query("select distinct p.matchId from MatchAvailabilityPoll p where p.matchId in :matchIds")
    List<UUID> findMatchIdsWithPollByMatchIdIn(@Param("matchIds") Collection<UUID> matchIds);

    /**
     * The open polls whose own squad (the poll team's squad for the match's season) holds this player: exactly the
     * rule {@code AvailabilityPollSquadResolver} applies for the public form (docs/specs/077), as one query for
     * docs/specs/119 My players.
     */
    @Query("SELECT p FROM MatchAvailabilityPoll p, Match m WHERE p.open = true AND m.id = p.matchId "
            + "AND EXISTS (SELECT 1 FROM TeamSquadMember s WHERE s.teamId = p.teamId AND s.seasonId = m.seasonId "
            + "AND s.playerProfileId = :playerProfileId) ORDER BY m.matchDate")
    List<MatchAvailabilityPoll> findOpenForPlayer(@Param("playerProfileId") UUID playerProfileId);

    /**
     * The polls (open or closed) of the club's active matches whose own squad holds this player, the rule of {@link
     * #findOpenForPlayer}: closed ones updated (closed) since {@code since}, newest closed first. Backs the Hub Closed
     * Polls pill. A closed poll's {@code updatedAt} is when it closed.
     */
    @Query("SELECT p FROM MatchAvailabilityPoll p, Match m WHERE p.open = false AND m.id = p.matchId "
            + "AND m.clubId = :clubId AND m.active = true AND p.updatedAt >= :since "
            + "AND EXISTS (SELECT 1 FROM TeamSquadMember s WHERE s.teamId = p.teamId AND s.seasonId = m.seasonId "
            + "AND s.playerProfileId = :playerProfileId) ORDER BY p.updatedAt DESC")
    List<MatchAvailabilityPoll> findClosedSinceForPlayer(
            @Param("playerProfileId") UUID playerProfileId, @Param("clubId") UUID clubId, @Param("since") Instant since);

    /** Every poll (open or closed) of this season's active matches whose squad holds the player; backs Hub My Responses. */
    @Query("SELECT p FROM MatchAvailabilityPoll p, Match m WHERE m.id = p.matchId AND m.clubId = :clubId "
            + "AND m.active = true AND m.seasonId = :seasonId "
            + "AND EXISTS (SELECT 1 FROM TeamSquadMember s WHERE s.teamId = p.teamId AND s.seasonId = m.seasonId "
            + "AND s.playerProfileId = :playerProfileId) ORDER BY m.matchDate DESC")
    List<MatchAvailabilityPoll> findAllForPlayerInSeason(
            @Param("playerProfileId") UUID playerProfileId, @Param("clubId") UUID clubId, @Param("seasonId") UUID seasonId);

    /** The seasons in which the player has any poll (same membership rule as {@link #findAllForPlayerInSeason}). */
    @Query("SELECT DISTINCT m.seasonId FROM MatchAvailabilityPoll p, Match m WHERE m.id = p.matchId "
            + "AND m.clubId = :clubId AND m.active = true "
            + "AND EXISTS (SELECT 1 FROM TeamSquadMember s WHERE s.teamId = p.teamId AND s.seasonId = m.seasonId "
            + "AND s.playerProfileId = :playerProfileId)")
    List<UUID> findSeasonIdsForPlayer(@Param("playerProfileId") UUID playerProfileId, @Param("clubId") UUID clubId);

    /**
     * docs/specs/147 "Always there": every closed poll of the club's active matches whose own squad (the poll team's squad for
     * the match's season, the rule of {@link #findOpenForPlayer}) holds this player, with the player's answer ({@code status}
     * null when unanswered). One statement; the Season, League and Team scope is applied by the calculator.
     */
    @Query("SELECT m.id AS matchId, m.seasonId AS seasonId, m.leagueId AS leagueId, p.teamId AS teamId, "
            + "a.status AS status FROM MatchAvailabilityPoll p JOIN Match m ON m.id = p.matchId "
            + "LEFT JOIN PlayerAvailability a ON a.pollId = p.id AND a.playerProfileId = :playerProfileId "
            + "WHERE m.clubId = :clubId AND m.active = true AND p.open = false "
            + "AND EXISTS (SELECT 1 FROM TeamSquadMember s WHERE s.teamId = p.teamId AND s.seasonId = m.seasonId "
            + "AND s.playerProfileId = :playerProfileId)")
    List<PlayerPollFactView> findPollFactsForPlayer(
            @Param("clubId") UUID clubId, @Param("playerProfileId") UUID playerProfileId);

    /**
     * docs/specs/147 Team stats "Squad": for each closed poll of this team among these matches, how many players answered
     * with {@code status} (pass AVAILABLE). One statement; the matches come from the team's counted, flagged results.
     */
    @Query("SELECT p.matchId AS matchId, (SELECT COUNT(a) FROM PlayerAvailability a WHERE a.pollId = p.id "
            + "AND a.status = :status) AS answered FROM MatchAvailabilityPoll p "
            + "WHERE p.teamId = :teamId AND p.open = false AND p.matchId IN :matchIds")
    List<TeamPollAnswerCountView> countAnswersForTeamPolls(
            @Param("teamId") UUID teamId,
            @Param("matchIds") Collection<UUID> matchIds,
            @Param("status") com.cricketlegend.domain.AvailabilityStatus status);

    /** One closed poll of a team and how many players gave the asked answer. */
    interface TeamPollAnswerCountView {
        UUID getMatchId();

        Long getAnswered();
    }

    /** One poll the player was asked and the answer given (null when none). */
    interface PlayerPollFactView {
        UUID getMatchId();

        UUID getSeasonId();

        UUID getLeagueId();

        UUID getTeamId();

        com.cricketlegend.domain.AvailabilityStatus getStatus();
    }
}
