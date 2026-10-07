package com.cricketlegend.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Throttling counter for the public availability form, keyed by a {@code scope_key} string
 * ({@code name:...} or {@code ip:...}). Counters are changed through atomic upserts in {@code
 * PublicAvailabilityAttemptRepository}, never by read-modify-write on this entity. See
 * docs/specs/077-public-availability-form-verification.md.
 */
@Entity
@Table(name = "public_availability_attempt")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PublicAvailabilityAttempt {

    @Id
    @Column(name = "scope_key", nullable = false)
    private String scopeKey;

    @Column(name = "failed_count", nullable = false)
    private int failedCount;

    @Column(name = "window_started_at", nullable = false)
    private Instant windowStartedAt;

    @Column(name = "locked_until")
    private Instant lockedUntil;
}
