package com.cricketlegend.service.support;

import com.cricketlegend.repository.ImportBatchRepository;
import java.util.UUID;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Stores {@code last_error} on a batch after a commit rolled back (docs/specs/097-import-framework.md, "All or
 * nothing"): the batch stays {@code PREVIEW} with the reason. It is written only after the commit's own transaction has
 * rolled back (which also releases the batch row lock the commit held), in a new transaction of its own. The message is
 * plain English from a business exception or a generic line, never row values.
 */
@Component
public class ImportBatchFailureRecorder {

    private static final int MAX_LENGTH = 1_000;

    private final ImportBatchRepository batches;
    private final TransactionTemplate newTransaction;

    public ImportBatchFailureRecorder(ImportBatchRepository batches, PlatformTransactionManager transactionManager) {
        this.batches = batches;
        this.newTransaction = new TransactionTemplate(transactionManager);
        this.newTransaction.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
    }

    /** Records {@code message} once the current transaction has rolled back (immediately when there is none). */
    public void recordAfterRollback(UUID batchId, String message) {
        if (!TransactionSynchronizationManager.isSynchronizationActive()) {
            write(batchId, message);
            return;
        }
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCompletion(int status) {
                if (status == STATUS_ROLLED_BACK) {
                    write(batchId, message);
                }
            }
        });
    }

    private void write(UUID batchId, String message) {
        newTransaction.executeWithoutResult(status -> batches.findById(batchId).ifPresent(batch -> {
            String text = message == null ? "The import could not be completed." : message;
            batch.setLastError(text.length() > MAX_LENGTH ? text.substring(0, MAX_LENGTH) : text);
            batches.save(batch);
        }));
    }
}
