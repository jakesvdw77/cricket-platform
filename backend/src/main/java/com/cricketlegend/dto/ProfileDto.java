package com.cricketlegend.dto;

import com.cricketlegend.domain.ProfileKind;
import java.util.UUID;

/**
 * One chooser card (docs/specs/119, Decision 29). At most one {@code MY_PLAYERS}, one {@code MANAGER} per club and
 * {@code PLATFORM_ADMIN} when it applies. {@code subtitle} is the small line (the first player and a count, or a
 * section manager's sections); the club fields are set for a manager card; {@code landing} is the path to open;
 * {@code pendingCount} is waiting invitations (My players) or link requests waiting (manager).
 */
public record ProfileDto(
        ProfileKind kind,
        String title,
        String subtitle,
        UUID clubId,
        String clubName,
        String clubSlug,
        String landing,
        int pendingCount) {}
