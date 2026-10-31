package com.cricketlegend.repository;

import com.cricketlegend.domain.ImportBatch;
import java.util.UUID;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;

/**
 * The scope race guard of docs/specs/097-import-framework.md: a Postgres advisory <em>transaction</em> lock keyed on
 * {@code clubId|type|scopeKey}, taken by commit and delete so two imports into the same scope serialise (the second then
 * re-validates against what the first wrote). Same shape as {@link SelectionLockRepository}; released at commit or
 * rollback and only meaningful inside a transaction.
 */
public interface ImportLockRepository extends Repository<ImportBatch, UUID> {

    @Query(value = "SELECT 1 FROM (SELECT pg_advisory_xact_lock(hashtext(CAST(:lockKey AS text)))) AS locked",
            nativeQuery = true)
    int lockScope(@Param("lockKey") String lockKey);
}
