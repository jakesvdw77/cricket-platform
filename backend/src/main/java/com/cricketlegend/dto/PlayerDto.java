package com.cricketlegend.dto;

import com.cricketlegend.domain.BattingStance;
import com.cricketlegend.domain.BowlingArm;
import com.cricketlegend.domain.BowlingType;
import com.cricketlegend.domain.Gender;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/**
 * Flat read shape of a Player, composed from {@link com.cricketlegend.domain.Person} (identity
 * fields) + {@link com.cricketlegend.domain.PlayerProfile} (everything else) + {@code
 * sectionIds} (bare ids of every {@link com.cricketlegend.domain.Section} this player is tagged
 * to — the frontend joins names client-side against its own already-fetched section list, same
 * pattern {@code TeamDirectory.tsx} already uses). A club admin never thinks of the underlying
 * {@code Person}/{@code PlayerProfile} split as two records — one form, one save. {@code id} is
 * the {@code PlayerProfile}'s own id (the natural "player id" for this resource), with {@code
 * personId} carried alongside it for completeness. See docs/specs/028-players.md.
 */
public record PlayerDto(
        UUID id,
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
        Instant createdAt,
        Instant updatedAt,
        UUID updatedBy) {
}
