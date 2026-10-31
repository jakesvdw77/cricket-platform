package com.cricketlegend.service.impl;

import com.cricketlegend.domain.ImportBatchStatus;
import com.cricketlegend.repository.ImportBatchRepository;
import com.cricketlegend.service.ImportExpiryService;
import com.cricketlegend.service.support.ImportLimits;
import java.time.Instant;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Plain {@code @Scheduled} fixed-delay job (default every 15 minutes, {@code app.imports.expiry.fixed-delay} as an
 * ISO-8601 duration), gated by {@code app.imports.expiry.enabled} (checked per tick, so the bean always exists and
 * {@link #runExpiry} stays directly callable from tests), following {@code AvailabilityAutoCloseServiceImpl}.
 * Logs counts only.
 */
@Service
public class ImportExpiryServiceImpl implements ImportExpiryService {

    private static final Logger log = LoggerFactory.getLogger(ImportExpiryServiceImpl.class);

    private final ImportBatchRepository batches;
    private final boolean enabled;

    public ImportExpiryServiceImpl(
            ImportBatchRepository batches, @Value("${app.imports.expiry.enabled:true}") boolean enabled) {
        this.batches = batches;
        this.enabled = enabled;
    }

    @Scheduled(fixedDelayString = "${app.imports.expiry.fixed-delay:PT15M}")
    public void runScheduled() {
        if (!enabled) {
            return;
        }
        try {
            runExpiry(Instant.now());
        } catch (RuntimeException e) {
            // A failed run must not cancel the schedule; the next tick retries.
            log.error("Import expiry run failed", e);
        }
    }

    @Override
    @Transactional
    public int runExpiry(Instant now) {
        int expired = batches.expirePreviews(now);
        int retired = batches.retirePayloads(
                List.of(ImportBatchStatus.COMMITTED, ImportBatchStatus.DELETED),
                now.minus(ImportLimits.IMPORT_PAYLOAD_RETENTION));
        int removed = batches.deleteNeverCommitted(
                List.of(ImportBatchStatus.EXPIRED, ImportBatchStatus.DISCARDED),
                now.minus(ImportLimits.IMPORT_BATCH_RETENTION));
        if (expired + retired + removed > 0) {
            log.info("Import expiry: expired {} preview(s), retired {} payload(s), removed {} old batch(es)",
                    expired, retired, removed);
        } else {
            log.debug("Import expiry: nothing due");
        }
        return expired + retired + removed;
    }
}
