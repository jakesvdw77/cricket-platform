package com.cricketlegend.repository;

import com.cricketlegend.domain.MatchSidePlayer;
import java.util.UUID;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;

/**
 * The race guard of docs/specs/076-team-selection.md section 9: a Postgres advisory <em>transaction</em>
 * lock per player. Every write path that adds a player takes it (in ascending id order) before the
 * slot check, so a second transaction selecting the same player waits for the first to commit, then
 * sees its row and fails with a clean 409. Released automatically at commit or rollback; only
 * meaningful inside a transaction.
 */
public interface SelectionLockRepository extends Repository<MatchSidePlayer, UUID> {

    @Query(value = "SELECT 1 FROM (SELECT pg_advisory_xact_lock(hashtext(CAST(:playerProfileId AS text)))) AS locked",
            nativeQuery = true)
    int lockPlayer(@Param("playerProfileId") UUID playerProfileId);
}
