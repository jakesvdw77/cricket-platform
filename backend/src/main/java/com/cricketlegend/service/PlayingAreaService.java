package com.cricketlegend.service;

import com.cricketlegend.domain.PlayingAreaCategory;
import com.cricketlegend.domain.PlayingAreaType;
import com.cricketlegend.domain.PlayingAreaVerificationStatus;
import com.cricketlegend.dto.PlayingAreaDto;
import com.cricketlegend.dto.PlayingAreaFilterOptionsDto;
import com.cricketlegend.dto.PlayingAreaRequest;
import com.cricketlegend.dto.PlayingAreaSummaryDto;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

/**
 * docs/specs/099-fields-directory.md: the club-scoped view of the platform-wide fields directory. The directory data
 * is global; {@code clubId} scopes the caller (home links, "Our fields", edit rights). Authorization is the
 * controller's {@code canAccessClub} check.
 */
public interface PlayingAreaService {

    /**
     * Searches the whole directory (not merged away, not rejected). {@code areaType} null means {@code
     * CRICKET_FIELD}. {@code verification} may be {@code UNVERIFIED} or {@code VERIFIED} only. Home fields of {@code
     * clubId} first, then by name (the {@code name} sort direction of {@code pageable} is honoured; any other sort is
     * ignored).
     */
    Page<PlayingAreaDto> list(
            UUID clubId,
            PlayingAreaType areaType,
            String q,
            List<PlayingAreaCategory> categories,
            String country,
            String province,
            String city,
            PlayingAreaVerificationStatus verification,
            boolean mine,
            Pageable pageable);

    /** Counters for the list's filters other than {@code mine} and {@code verification}. */
    PlayingAreaSummaryDto summary(
            UUID clubId,
            PlayingAreaType areaType,
            String q,
            List<PlayingAreaCategory> categories,
            String country,
            String province,
            String city);

    /** Countries, provinces and cities reachable under the other active filters. */
    PlayingAreaFilterOptionsDto filterOptions(
            UUID clubId,
            PlayingAreaType areaType,
            String q,
            List<PlayingAreaCategory> categories,
            String country,
            String province,
            String city,
            PlayingAreaVerificationStatus verification,
            boolean mine);

    /** Up to five existing fields in {@code country} whose normalised name is near {@code name}. */
    List<PlayingAreaDto> similar(UUID clubId, String name, String city, String country);

    /** One field; a merged-away id resolves to the surviving field. */
    PlayingAreaDto get(UUID clubId, UUID playingAreaId);

    /** Captures a field: forced to a cricket field, created unverified by {@code clubId}, linked home to it. */
    PlayingAreaDto create(UUID clubId, PlayingAreaRequest request);

    /** Edits a field; only while unverified and captured by {@code clubId}, else {@code FieldNotEditableException}. */
    PlayingAreaDto update(UUID clubId, UUID playingAreaId, PlayingAreaRequest request);

    /** Idempotent: links the field home for {@code clubId}. */
    PlayingAreaDto linkHome(UUID clubId, UUID playingAreaId);

    /** Idempotent: removes the club's link. Matches that reference the field are untouched. */
    void unlinkHome(UUID clubId, UUID playingAreaId);
}
