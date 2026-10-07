package com.cricketlegend.repository;

import com.cricketlegend.domain.PublicAvailabilityAttempt;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

/** See docs/specs/077-public-availability-form-verification.md. */
public interface PublicAvailabilityAttemptRepository extends JpaRepository<PublicAvailabilityAttempt, String> {

    /** The counter after an atomic increment. */
    interface Counter {
        int getFailedCount();

        long getWindowStartedAtEpoch();
    }

    /**
     * Atomically adds one to the key's counter in a single statement (no read-modify-write, so
     * concurrent calls cannot undercount). A counter whose window started at or before {@code
     * cutoffEpoch} restarts at one with a fresh window. When the new count reaches {@code max} the
     * key is locked until {@code lockUntilEpoch}. All times are epoch seconds.
     */
    @Transactional
    @Modifying
    @Query(value = """
            INSERT INTO public_availability_attempt (scope_key, failed_count, window_started_at, locked_until)
            VALUES (:key, 1, to_timestamp(:nowEpoch), CASE WHEN 1 >= :max THEN to_timestamp(:lockUntilEpoch) END)
            ON CONFLICT (scope_key) DO UPDATE SET
                failed_count = CASE WHEN public_availability_attempt.window_started_at <= to_timestamp(:cutoffEpoch)
                                    THEN 1 ELSE public_availability_attempt.failed_count + 1 END,
                window_started_at = CASE WHEN public_availability_attempt.window_started_at <= to_timestamp(:cutoffEpoch)
                                    THEN to_timestamp(:nowEpoch) ELSE public_availability_attempt.window_started_at END,
                locked_until = CASE
                    WHEN (CASE WHEN public_availability_attempt.window_started_at <= to_timestamp(:cutoffEpoch)
                               THEN 1 ELSE public_availability_attempt.failed_count + 1 END) >= :max
                    THEN to_timestamp(:lockUntilEpoch)
                    ELSE NULL END
            """, nativeQuery = true)
    int increment(
            @Param("key") String key,
            @Param("nowEpoch") long nowEpoch,
            @Param("cutoffEpoch") long cutoffEpoch,
            @Param("max") int max,
            @Param("lockUntilEpoch") long lockUntilEpoch);

    /** Reads a counter back (after {@link #increment}, inside the same transaction). */
    @Query(value = """
            SELECT failed_count AS failedCount,
                   CAST(EXTRACT(EPOCH FROM window_started_at) AS BIGINT) AS windowStartedAtEpoch
            FROM public_availability_attempt WHERE scope_key = :key
            """, nativeQuery = true)
    Counter readCounter(@Param("key") String key);

    @Transactional
    @Modifying
    @Query("delete from PublicAvailabilityAttempt a where a.scopeKey = :key")
    int deleteByKey(@Param("key") String key);
}
