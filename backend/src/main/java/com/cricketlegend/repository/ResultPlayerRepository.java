package com.cricketlegend.repository;

import com.cricketlegend.domain.ResultPlayer;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/** docs/specs/101-match-results-our-side-scorecard.md: who played for our side(s) in a result. */
public interface ResultPlayerRepository extends JpaRepository<ResultPlayer, UUID> {

    List<ResultPlayer> findByMatchResultIdOrderByCreatedAtAscIdAsc(UUID matchResultId);

    boolean existsByMatchResultId(UUID matchResultId);

    /** Whether the result has an opposition ({@code true}) or an ours ({@code false}) player. */
    boolean existsByMatchResultIdAndOpposition(UUID matchResultId, boolean opposition);

    List<ResultPlayer> findByMatchResultIdIn(Collection<UUID> matchResultIds);

    /**
     * Distinct guest names the club has used (most recently used first, with a count), for the name field's
     * suggestions. A guest is a row with no linked profile; the optional {@code teamId} limits to results where that
     * team was the home or away side ({@code anyTeam} false; otherwise {@code teamId} is ignored), and {@code q} is a
     * case-insensitive contains filter (pass an empty string for none). When {@code restricted} (a section-scoped caller),
     * only fixtures where one of our teams is in {@code sectionTeamIds} (never empty: pass a sentinel) are read.
     */
    @Query(value = """
            select rp.displayName as displayName, count(rp) as uses, max(rp.createdAt) as lastUsed
            from ResultPlayer rp, MatchResult r, Match m
            where rp.matchResultId = r.id and r.matchId = m.id and r.clubId = :clubId
              and rp.playerProfileId is null and rp.opposition = false and rp.displayName is not null
              and (:anyTeam = true or m.homeTeamId = :teamId or m.awayTeamId = :teamId)
              and (:restricted = false or m.homeTeamId in :sectionTeamIds or m.awayTeamId in :sectionTeamIds)
              and lower(rp.displayName) like lower(concat('%', :q, '%'))
            group by rp.displayName
            order by max(rp.createdAt) desc, rp.displayName asc
            """,
            countQuery = """
            select count(distinct rp.displayName)
            from ResultPlayer rp, MatchResult r, Match m
            where rp.matchResultId = r.id and r.matchId = m.id and r.clubId = :clubId
              and rp.playerProfileId is null and rp.opposition = false and rp.displayName is not null
              and (:anyTeam = true or m.homeTeamId = :teamId or m.awayTeamId = :teamId)
              and (:restricted = false or m.homeTeamId in :sectionTeamIds or m.awayTeamId in :sectionTeamIds)
              and lower(rp.displayName) like lower(concat('%', :q, '%'))
            """)
    Page<GuestNameView> findGuestNames(
            @Param("clubId") UUID clubId,
            @Param("anyTeam") boolean anyTeam,
            @Param("teamId") UUID teamId,
            @Param("restricted") boolean restricted,
            @Param("sectionTeamIds") Collection<UUID> sectionTeamIds,
            @Param("q") String q,
            Pageable pageable);

    /**
     * Suggestions only: the distinct names (case-insensitive, most recently used first, with a count and the latest
     * fixture date) of earlier opposition players of this club against the same opposition. The opposition is the
     * league team when {@code byLeagueTeam} (the side's league team id equals {@code leagueTeamId}), else the side's
     * team name equal to {@code oppositionName} (already lower-cased and trimmed). The optional {@code teamId} limits
     * to fixtures of our team ({@code anyTeam} false); {@code excluded} (lower-cased, never empty: pass a blank
     * sentinel) drops names already on the current list; {@code q} is a case-insensitive contains filter. Scoped to
     * the club through the result; no identity is implied and nothing is read from another club.
     */
    @Query(value = """
            select min(rp.displayName) as displayName, count(rp) as uses, max(m.matchDate) as lastMatchDate
            from ResultPlayer rp, MatchResult r, Match m
            where rp.matchResultId = r.id and r.matchId = m.id and r.clubId = :clubId
              and rp.opposition = true and rp.displayName is not null
              and (:anyTeam = true or m.homeTeamId = :teamId or m.awayTeamId = :teamId)
              and (:restricted = false or m.homeTeamId in :sectionTeamIds or m.awayTeamId in :sectionTeamIds)
              and ((:byLeagueTeam = true and (
                        (rp.side = com.cricketlegend.domain.ResultSide.HOME and m.homeLeagueTeamId = :leagueTeamId)
                     or (rp.side = com.cricketlegend.domain.ResultSide.AWAY and m.awayLeagueTeamId = :leagueTeamId)))
                or (:byLeagueTeam = false and (
                        (rp.side = com.cricketlegend.domain.ResultSide.HOME
                            and lower(trim(m.homeTeamName)) = :oppositionName)
                     or (rp.side = com.cricketlegend.domain.ResultSide.AWAY
                            and lower(trim(m.awayTeamName)) = :oppositionName))))
              and lower(rp.displayName) not in :excluded
              and lower(rp.displayName) like lower(concat('%', :q, '%'))
            group by lower(rp.displayName)
            order by max(m.matchDate) desc, min(rp.displayName) asc
            """,
            countQuery = """
            select count(distinct lower(rp.displayName))
            from ResultPlayer rp, MatchResult r, Match m
            where rp.matchResultId = r.id and r.matchId = m.id and r.clubId = :clubId
              and rp.opposition = true and rp.displayName is not null
              and (:anyTeam = true or m.homeTeamId = :teamId or m.awayTeamId = :teamId)
              and (:restricted = false or m.homeTeamId in :sectionTeamIds or m.awayTeamId in :sectionTeamIds)
              and ((:byLeagueTeam = true and (
                        (rp.side = com.cricketlegend.domain.ResultSide.HOME and m.homeLeagueTeamId = :leagueTeamId)
                     or (rp.side = com.cricketlegend.domain.ResultSide.AWAY and m.awayLeagueTeamId = :leagueTeamId)))
                or (:byLeagueTeam = false and (
                        (rp.side = com.cricketlegend.domain.ResultSide.HOME
                            and lower(trim(m.homeTeamName)) = :oppositionName)
                     or (rp.side = com.cricketlegend.domain.ResultSide.AWAY
                            and lower(trim(m.awayTeamName)) = :oppositionName))))
              and lower(rp.displayName) not in :excluded
              and lower(rp.displayName) like lower(concat('%', :q, '%'))
            """)
    Page<OppositionNameView> findOppositionNames(
            @Param("clubId") UUID clubId,
            @Param("anyTeam") boolean anyTeam,
            @Param("teamId") UUID teamId,
            @Param("restricted") boolean restricted,
            @Param("sectionTeamIds") Collection<UUID> sectionTeamIds,
            @Param("byLeagueTeam") boolean byLeagueTeam,
            @Param("leagueTeamId") UUID leagueTeamId,
            @Param("oppositionName") String oppositionName,
            @Param("excluded") Collection<String> excluded,
            @Param("q") String q,
            Pageable pageable);
}
