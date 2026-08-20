package com.cricketlegend.service;

import com.cricketlegend.dto.ClubProfileDto;
import com.cricketlegend.dto.UpdateClubProfileRequest;
import java.util.UUID;

/**
 * platform_admin-only Club profile get/upsert (organisation type, logo, banner, address, email,
 * phone, website) — 1:1 with {@code Club}, no hard delete. See docs/specs/012-club-profile.md.
 */
public interface ClubProfileService {

    /**
     * Fetches the profile for {@code clubId}. Returns a default-shaped {@link ClubProfileDto}
     * (every field {@code null} except {@code clubId}) rather than throwing when the club exists
     * but has no profile row yet — a brand-new {@code Club} never has one until first saved here.
     * Throws {@link com.cricketlegend.exception.NotFoundException} only when the {@code Club}
     * itself doesn't exist.
     */
    ClubProfileDto get(UUID clubId);

    /**
     * Upserts the profile for {@code clubId} — creates the row on first save, updates in place
     * thereafter. A full-resource replace: a field omitted/{@code null} in {@code request} nulls
     * out a previously-saved value. Throws {@link com.cricketlegend.exception.NotFoundException}
     * when the {@code Club} itself doesn't exist.
     */
    ClubProfileDto upsert(UUID clubId, UpdateClubProfileRequest request);
}
