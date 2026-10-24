package com.cricketlegend.repository;

import com.cricketlegend.domain.LinkAttempt;
import com.cricketlegend.domain.LinkAttemptKind;
import java.util.Optional;
import java.util.UUID;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/** Touched only by the link services (docs/specs/119); first used in slice 3B. */
public interface LinkAttemptRepository extends JpaRepository<LinkAttempt, UUID> {

    Optional<LinkAttempt> findByAccountPersonIdAndKind(UUID accountPersonId, LinkAttemptKind kind);

    /** Creates the (account, kind) row if it is missing; a concurrent insert of the same key is a no-op, never an error. */
    @Modifying
    @Query(value = """
            insert into link_attempt (id, account_person_id, kind, count, window_started_at)
            values (gen_random_uuid(), :accountPersonId, :kind, 0, :now)
            on conflict (account_person_id, kind) do nothing
            """, nativeQuery = true)
    int insertIfAbsent(
            @Param("accountPersonId") UUID accountPersonId, @Param("kind") String kind, @Param("now") java.time.Instant now);

    /** The row, locked for the rest of the transaction, so concurrent counters take turns and cannot overshoot. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select a from LinkAttempt a where a.accountPersonId = :accountPersonId and a.kind = :kind")
    Optional<LinkAttempt> findForUpdate(
            @Param("accountPersonId") UUID accountPersonId, @Param("kind") LinkAttemptKind kind);
}
