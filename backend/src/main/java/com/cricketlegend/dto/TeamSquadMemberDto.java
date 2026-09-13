package com.cricketlegend.dto;

import com.cricketlegend.domain.BattingStance;
import com.cricketlegend.domain.BowlingArm;
import com.cricketlegend.domain.BowlingType;
import com.cricketlegend.domain.Gender;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/**
 * Flat read shape of a {@code Team}'s squad member for a given {@code Season} — every field
 * {@link PlayerDto} already carries, composed from that same {@link PlayerDto} (see {@code
 * PlayerMapper.toSquadMemberDto}), plus {@code id} (the {@code TeamSquadMember} row's own id, not
 * {@code PlayerProfile.id} — callers needing the player's id use {@code playerProfileId}/{@code
 * personId}) and {@code squadJerseyNumber} (this squad membership's own jersey number,
 * independent of {@code jerseyNumber}, the player's standing number carried over from {@link
 * PlayerDto}). Replaces {@code PlayerDto} as {@code TeamSquadService.list}/{@code add}'s return
 * type. See docs/specs/031-jersey-numbers.md's API Contract section.
 */
public record TeamSquadMemberDto(
        UUID id,
        UUID playerProfileId,
        UUID personId,
        UUID clubId,
        String firstName,
        String lastName,
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
        boolean isWicketKeeper,
        boolean active,
        List<UUID> sectionIds,
        Integer jerseyNumber,
        Integer squadJerseyNumber) {
}
