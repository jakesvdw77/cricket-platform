package com.cricketlegend.service.support;

import java.time.Instant;

/** A throttling counter after an increment: its count and when its window started. */
public record AttemptState(int count, Instant windowStartedAt) {
}
