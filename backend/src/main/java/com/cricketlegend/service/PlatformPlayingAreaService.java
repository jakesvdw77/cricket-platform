package com.cricketlegend.service;

import com.cricketlegend.domain.PlayingAreaCategory;
import com.cricketlegend.domain.PlayingAreaVerificationStatus;
import com.cricketlegend.dto.PlatformPlayingAreaDto;
import com.cricketlegend.dto.PlatformPlayingAreaSummaryDto;
import com.cricketlegend.dto.PlayingAreaRequest;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

/**
 * docs/specs/099-fields-directory.md: platform-admin moderation of the fields directory. Reachable only under {@code
 * /api/v1/platform/**}, which {@code SecurityConfig} gates to {@code platform_admin}.
 */
public interface PlatformPlayingAreaService {

    /** The moderation list (merged-away rows excluded); default order is oldest first. */
    Page<PlatformPlayingAreaDto> list(
            PlayingAreaVerificationStatus verification,
            String q,
            List<PlayingAreaCategory> categories,
            String country,
            Pageable pageable);

    PlatformPlayingAreaSummaryDto summary();

    /** Full detail: linked clubs, match count, creator club and possible duplicates. Does not follow a merge. */
    PlatformPlayingAreaDto get(UUID playingAreaId);

    /** Edits any field in any state except merged away; editing a verified field keeps it verified. */
    PlatformPlayingAreaDto update(UUID playingAreaId, PlayingAreaRequest request);

    /**
     * {@code UNVERIFIED -> VERIFIED}, stamping the time and {@code verifiedBySubject}; idempotent on a verified field;
     * {@code InvalidStatusTransitionException} from {@code REJECTED} (reopen first).
     */
    PlatformPlayingAreaDto verify(UUID playingAreaId, String verifiedBySubject);

    /** {@code UNVERIFIED -> REJECTED} with a required reason. */
    PlatformPlayingAreaDto reject(UUID playingAreaId, String reason);

    /** {@code REJECTED -> UNVERIFIED}. */
    PlatformPlayingAreaDto reopen(UUID playingAreaId);

    /**
     * Merges {@code playingAreaId} into {@code targetPlayingAreaId} in one transaction: matches repointed (venue text
     * copied from the target), club links moved and de-duplicated, the source marked merged. Returns the surviving
     * target.
     */
    PlatformPlayingAreaDto merge(UUID playingAreaId, UUID targetPlayingAreaId);
}
