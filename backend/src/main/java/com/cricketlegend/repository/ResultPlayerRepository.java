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

    List<ResultPlayer> findByMatchResultIdIn(Collection<UUID> matchResultIds);

    /**
     * Distinct guest names the club has used (most recently used first, with a count), for the name field's
     * suggestions. A guest is a row with no linked profile; the optional {@code teamId} limits to results where that
     * team was the home or away side ({@code anyTeam} false; otherwise {@code teamId} is ignored), and {@code q} is a
     * case-insensitive contains filter (pass an empty string for none).
     */
    @Query(value = """
            select rp.displayName as displayName, count(rp) as uses, max(rp.createdAt) as lastUsed
            from ResultPlayer rp, MatchResult r, Match m
            where rp.matchResultId = r.id and r.matchId = m.id and r.clubId = :clubId
              and rp.playerProfileId is null and rp.displayName is not null
              and (:anyTeam = true or m.homeTeamId = :teamId or m.awayTeamId = :teamId)
              and lower(rp.displayName) like lower(concat('%', :q, '%'))
            group by rp.displayName
            order by max(rp.createdAt) desc, rp.displayName asc
            """,
            countQuery = """
            select count(distinct rp.displayName)
            from ResultPlayer rp, MatchResult r, Match m
            where rp.matchResultId = r.id and r.matchId = m.id and r.clubId = :clubId
              and rp.playerProfileId is null and rp.displayName is not null
              and (:anyTeam = true or m.homeTeamId = :teamId or m.awayTeamId = :teamId)
              and lower(rp.displayName) like lower(concat('%', :q, '%'))
            """)
    Page<GuestNameView> findGuestNames(
            @Param("clubId") UUID clubId,
            @Param("anyTeam") boolean anyTeam,
            @Param("teamId") UUID teamId, @Param("q") String q, Pageable pageable);
}
