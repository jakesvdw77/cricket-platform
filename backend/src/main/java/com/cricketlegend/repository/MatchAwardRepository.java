package com.cricketlegend.repository;

import com.cricketlegend.domain.MatchAward;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/** docs/specs/101-match-results-our-side-scorecard.md: player of the match awards of a result. */
public interface MatchAwardRepository extends JpaRepository<MatchAward, UUID> {

    List<MatchAward> findByMatchResultId(UUID matchResultId);

    List<MatchAward> findByMatchResultIdIn(Collection<UUID> matchResultIds);

    @Modifying(flushAutomatically = true)
    @Query("delete from MatchAward a where a.matchResultId = :matchResultId")
    void deleteByMatchResultId(@Param("matchResultId") UUID matchResultId);
}
