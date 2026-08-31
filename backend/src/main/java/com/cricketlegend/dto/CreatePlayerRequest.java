package com.cricketlegend.dto;

import com.cricketlegend.domain.BattingStance;
import com.cricketlegend.domain.BowlingArm;
import com.cricketlegend.domain.BowlingType;
import com.cricketlegend.domain.Gender;
import jakarta.validation.constraints.NotBlank;
import java.time.LocalDate;

/**
 * POST /api/v1/manage/clubs/{clubId}/players payload. Deliberately has no {@code sectionIds} —
 * tagging happens via the separate link/unlink endpoints, after the player exists, matching every
 * prior join in this codebase (no "create-and-tag" special endpoint). Creates a brand-new {@link
 * com.cricketlegend.domain.Person} ({@code status = ACTIVE}, {@code email = null}) — never {@code
 * PersonServiceImpl.findOrCreatePerson} (see docs/specs/028-players.md's Data Model Changes for
 * why). See docs/specs/028-players.md.
 */
public record CreatePlayerRequest(
        @NotBlank String firstName,
        @NotBlank String lastName,
        LocalDate dateOfBirth,
        Gender gender,
        String photoUrl,
        String clubMembershipNumber,
        String medicalAidProvider,
        String medicalAidMemberNumber,
        String phone,
        String email,
        String altContactName,
        String altContactPhone,
        BattingStance battingStance,
        BowlingArm bowlingArm,
        BowlingType bowlingType,
        boolean isWicketKeeper) {
}
