package com.cricketlegend.dto;

import com.cricketlegend.domain.BattingStance;
import com.cricketlegend.domain.BowlingArm;
import com.cricketlegend.domain.BowlingType;
import java.util.List;
import java.util.UUID;

/**
 * One player as their linked account (or the player) sees them (docs/specs/119, Decision 6). Read-only: name, club,
 * group and team labels, jersey number. Maintainable: the contact, cricket and medical aid fields. {@code
 * canEditMedical} is true for the main agent and the adult player, false for other agents. {@code agents} lists
 * the other agents (name and masked email) for the main agent only; everyone else gets an empty list and the
 * {@code agentCount}, which counts every active agent including the caller. No date of birth, squads, selections,
 * results, statistics, club notes or anyone else's contact details.
 */
public record MyPlayerDto(
        String key,
        String firstName,
        String lastName,
        String photoUrl,
        UUID clubId,
        String clubName,
        String groupLabel,
        List<String> sectionNames,
        List<String> teamNames,
        Integer jerseyNumber,
        boolean self,
        boolean main,
        boolean canEditMedical,
        String phone,
        String email,
        String altContactName,
        String altContactPhone,
        BattingStance battingStance,
        BowlingArm bowlingArm,
        BowlingType bowlingType,
        boolean isWicketKeeper,
        String medicalAidProvider,
        String medicalAidMemberNumber,
        int agentCount,
        List<MyPlayerAgentDto> agents) {
}
