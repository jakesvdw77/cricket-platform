package com.cricketlegend.repository;

import com.cricketlegend.domain.FieldingEntry;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/** docs/specs/101-match-results-our-side-scorecard.md: our side's FieldingEntry rows, per innings. */
public interface FieldingEntryRepository extends JpaRepository<FieldingEntry, UUID> {

    List<FieldingEntry> findByMatchInningsIdIn(Collection<UUID> matchInningsIds);

    /** Replacing a scorecard deletes the entries first and flushes at once (the replace re-inserts them); no clear, so the result and innings stay managed. */
    @Modifying(flushAutomatically = true)
    @Query("delete from FieldingEntry e where e.matchInningsId in :inningsIds")
    void deleteByMatchInningsIdIn(@Param("inningsIds") Collection<UUID> inningsIds);
}
