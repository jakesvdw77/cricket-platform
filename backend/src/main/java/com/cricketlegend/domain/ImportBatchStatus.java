package com.cricketlegend.domain;

/** The lifecycle of an import batch (spec 097). */
public enum ImportBatchStatus {
    PREVIEW, COMMITTED, DISCARDED, EXPIRED, DELETED
}
