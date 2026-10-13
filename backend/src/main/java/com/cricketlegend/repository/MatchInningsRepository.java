package com.cricketlegend.repository;

import com.cricketlegend.domain.MatchInnings;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/** docs/specs/100-match-results-core.md: innings totals of a result, in sequence order. */
public interface MatchInningsRepository extends JpaRepository<MatchInnings, UUID> {

    List<MatchInnings> findByMatchResultIdOrderBySequence(UUID matchResultId);

    List<MatchInnings> findByMatchResultIdInOrderBySequence(Collection<UUID> matchResultIds);

    /**
     * Replacing a draft's innings deletes first and flushes at once, so the re-inserted rows cannot hit the
     * {@code (match_result_id, sequence)} unique constraint (Hibernate would otherwise flush inserts before deletes).
     */
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("delete from MatchInnings i where i.matchResultId = :matchResultId")
    void deleteByMatchResultId(@Param("matchResultId") UUID matchResultId);
}
