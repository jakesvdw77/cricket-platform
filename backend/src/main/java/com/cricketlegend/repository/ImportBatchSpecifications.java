package com.cricketlegend.repository;

import com.cricketlegend.domain.ImportBatch;
import com.cricketlegend.domain.ImportBatchStatus;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.domain.Specification;

/** Optional filters of the import history list (docs/specs/097-import-framework.md); a null filter is ignored. */
public final class ImportBatchSpecifications {

    private ImportBatchSpecifications() {
    }

    /** Batches that are finished with: deleted, discarded or expired. Hidden from the history unless asked for. */
    private static final List<ImportBatchStatus> ENDED = List.of(ImportBatchStatus.DELETED, ImportBatchStatus.DISCARDED, ImportBatchStatus.EXPIRED);

    public static Specification<ImportBatch> history(
            UUID clubId, String type, String scopeKey, ImportBatchStatus status, boolean includeEnded) {
        Specification<ImportBatch> spec = (root, query, cb) -> cb.equal(root.get("clubId"), clubId);
        if (type != null && !type.isBlank()) {
            spec = spec.and((root, query, cb) -> cb.equal(root.get("type"), type));
        }
        if (scopeKey != null && !scopeKey.isBlank()) {
            spec = spec.and((root, query, cb) -> cb.equal(root.get("scopeKey"), scopeKey));
        }
        if (status != null) {
            spec = spec.and((root, query, cb) -> cb.equal(root.get("status"), status));
        } else if (!includeEnded) {
            spec = spec.and((root, query, cb) -> cb.not(root.get("status").in(ENDED)));
        }
        return spec;
    }
}
