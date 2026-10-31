package com.cricketlegend.repository;

import com.cricketlegend.domain.ImportBatchEntity;
import com.cricketlegend.domain.ImportEntityAction;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/** docs/specs/097-import-framework.md: the entities a committed batch created or updated. */
public interface ImportBatchEntityRepository extends JpaRepository<ImportBatchEntity, UUID> {

    List<ImportBatchEntity> findByBatchIdOrderByCreatedAtAsc(UUID batchId);

    List<ImportBatchEntity> findByBatchIdAndAction(UUID batchId, ImportEntityAction action);

    long countByBatchId(UUID batchId);

    /** Which entities of a type any batch has touched (for "was this record imported?"). */
    List<ImportBatchEntity> findByEntityTypeAndEntityIdIn(String entityType, Collection<UUID> entityIds);
}
