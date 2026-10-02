package com.cricketlegend.dto;

import com.cricketlegend.domain.BattingStance;
import com.cricketlegend.domain.BowlingArm;
import com.cricketlegend.domain.BowlingType;
import com.cricketlegend.domain.Gender;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/**
 * Flat read shape of a {@code MatchSquadMember} row — the per-fixture analogue of {@link
 * TeamSquadMemberDto} for a group-poll-covered match, deliberately mirroring its field set exactly
 * (docs/specs/031-jersey-numbers.md's flat, player-plus-squad-context shape) rather than inventing
 * a third one, so {@code PlayingXiBuilder} needs zero changes to consume either. {@code id} is the
 * {@code MatchSquadMember} row's own id. {@code isCaptain} is always {@code false} — {@code
 * MatchSquadMember} carries no captaincy concept at all; captaincy for every side stays on {@code MatchSide.captainPlayerId} alone. See
 * docs/specs/063-section-availability-and-flexible-squads.md.
 */
public record MatchSquadMemberDto(
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
        Integer squadJerseyNumber,
        boolean isCaptain) {
}
