package com.cricketlegend.repository;

import com.cricketlegend.domain.ImportBatch;
import com.cricketlegend.domain.ImportBatchStatus;
import jakarta.persistence.LockModeType;
import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

/**
 * docs/specs/097-import-framework.md. Every lookup is club-scoped so a batch of another club reads as missing. History
 * paging goes through {@link JpaSpecificationExecutor} with {@link ImportBatchSpecifications}.
 */
public interface ImportBatchRepository extends JpaRepository<ImportBatch, UUID>, JpaSpecificationExecutor<ImportBatch> {

    Optional<ImportBatch> findByIdAndClubId(UUID id, UUID clubId);

    /** Row lock for commit, discard and delete: a second request on the same batch waits, then sees the new state. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select b from ImportBatch b where b.id = :id and b.clubId = :clubId")
    Optional<ImportBatch> findByIdAndClubIdForUpdate(@Param("id") UUID id, @Param("clubId") UUID clubId);

    long countByClubIdAndCreatedByAndStatus(UUID clubId, UUID createdBy, ImportBatchStatus status);

    long countByClubIdAndStatus(UUID clubId, ImportBatchStatus status);

    /** Previews created since {@code since}, whatever became of them (the hourly rate limit). */
    long countByClubIdAndCreatedAtAfter(UUID clubId, Instant since);

    /**
     * The newest committed batch of the same scope whose file or normalised rows hash matches (the whole-file
     * re-import warning). Deleted batches are excluded by the status filter.
     */
    @Query("select b from ImportBatch b where b.clubId = :clubId and b.type = :type and b.scopeKey = :scopeKey "
            + "and b.status = com.cricketlegend.domain.ImportBatchStatus.COMMITTED "
            + "and (b.fileSha256 = :fileSha or b.rowsSha256 = :rowsSha) order by b.committedAt desc")
    List<ImportBatch> findEarlierCommitted(
            @Param("clubId") UUID clubId,
            @Param("type") String type,
            @Param("scopeKey") String scopeKey,
            @Param("fileSha") String fileSha,
            @Param("rowsSha") String rowsSha,
            Pageable pageable);

    /** Marks previews past their expiry as expired and drops their payload; returns the number changed. */
    @Transactional
    @Modifying
    @Query("update ImportBatch b set b.status = com.cricketlegend.domain.ImportBatchStatus.EXPIRED, b.payload = null, "
            + "b.confirmationDigest = null, b.version = b.version + 1 "
            + "where b.status = com.cricketlegend.domain.ImportBatchStatus.PREVIEW and b.expiresAt < :now")
    int expirePreviews(@Param("now") Instant now);

    /** Nulls the payload of committed (or deleted) batches whose commit is older than {@code cutoff}. */
    @Transactional
    @Modifying
    @Query("update ImportBatch b set b.payload = null, b.version = b.version + 1 "
            + "where b.status in :statuses and b.payload is not null and b.committedAt < :cutoff")
    int retirePayloads(@Param("statuses") Collection<ImportBatchStatus> statuses, @Param("cutoff") Instant cutoff);

    /** Removes the metadata of batches that never committed (nothing references them) once retention has passed. */
    @Transactional
    @Modifying
    @Query("delete from ImportBatch b where b.status in :statuses and b.createdAt < :cutoff")
    int deleteNeverCommitted(@Param("statuses") Collection<ImportBatchStatus> statuses, @Param("cutoff") Instant cutoff);
}
