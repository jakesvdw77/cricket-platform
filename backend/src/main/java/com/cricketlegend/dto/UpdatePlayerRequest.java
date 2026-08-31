package com.cricketlegend.dto;

import com.cricketlegend.domain.BattingStance;
import com.cricketlegend.domain.BowlingArm;
import com.cricketlegend.domain.BowlingType;
import com.cricketlegend.domain.Gender;
import jakarta.validation.constraints.NotBlank;
import java.time.LocalDate;

/**
 * PUT /api/v1/manage/clubs/{clubId}/players/{playerId} payload. Same body shape as {@link
 * CreatePlayerRequest} minus nothing extra — writes through directly onto the linked {@link
 * com.cricketlegend.domain.Person} (identity fields) and {@link
 * com.cricketlegend.domain.PlayerProfile} (everything else) in one transaction. Unlike {@code
 * findOrCreatePerson}'s "link, don't overwrite" rule, this is an unambiguous, already-linked
 * edit — no overwrite-protection guard (deliberate, see docs/specs/028-players.md's API Contract
 * Architecture note). See docs/specs/028-players.md.
 */
public record UpdatePlayerRequest(
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
