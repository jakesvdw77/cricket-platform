package com.cricketlegend.dto;

import com.cricketlegend.domain.BattingStance;
import com.cricketlegend.domain.BowlingArm;
import com.cricketlegend.domain.BowlingType;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * PUT /api/v1/me/players/{key} body (docs/specs/119): the whitelist and nothing else. Name, date of birth, gender,
 * sections, jersey number, active, verification status and the membership number are not here, so they cannot be set.
 * A full replace of the contact and cricket fields (a blank text clears it). The two medical aid fields are applied
 * only for the main agent or the adult player; for any other agent a value that differs from the stored one is
 * refused with 403 and a null leaves the stored value untouched.
 */
public record UpdateMyPlayerRequest(
        @Size(max = 500) String photoUrl,
        @Size(max = 50) String phone,
        @Email @Size(max = 255) String email,
        @Size(max = 200) String altContactName,
        @Size(max = 50) String altContactPhone,
        BattingStance battingStance,
        BowlingArm bowlingArm,
        BowlingType bowlingType,
        @NotNull Boolean isWicketKeeper,
        @Size(max = 200) String medicalAidProvider,
        @Size(max = 100) String medicalAidMemberNumber) {
}
