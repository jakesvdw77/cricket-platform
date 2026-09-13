package com.cricketlegend.mapper;

import com.cricketlegend.domain.Person;
import com.cricketlegend.domain.PlayerProfile;
import com.cricketlegend.domain.TeamSquadMember;
import com.cricketlegend.dto.PlayerDto;
import com.cricketlegend.dto.TeamSquadMemberDto;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Component;

/**
 * Composes a {@link PlayerDto} from three sources — {@link Person} (identity fields), {@link
 * PlayerProfile} (everything else), and the caller-supplied {@code sectionIds} — a plain
 * hand-written compose method rather than forcing MapStruct across three inputs, mirroring {@code
 * TeamContactServiceImpl.list}'s own manual-compose precedent (per
 * docs/plans/028-players.md). See docs/specs/028-players.md. Also composes {@link
 * TeamSquadMemberDto} ({@link #toSquadMemberDto}) by building on top of {@link #toDto}, per
 * docs/specs/031-jersey-numbers.md, so the person/profile field-mapping logic stays in exactly one
 * place.
 */
@Component
public class PlayerMapper {

    public PlayerDto toDto(Person person, PlayerProfile profile, List<UUID> sectionIds) {
        return new PlayerDto(
                profile.getId(),
                person.getId(),
                profile.getClubId(),
                person.getFirstName(),
                person.getLastName(),
                person.getDateOfBirth(),
                person.getGender(),
                profile.getPhotoUrl(),
                profile.getClubMembershipNumber(),
                profile.getMedicalAidProvider(),
                profile.getMedicalAidMemberNumber(),
                profile.getPhone(),
                profile.getEmail(),
                profile.getAltContactName(),
                profile.getAltContactPhone(),
                profile.getBattingStance(),
                profile.getBowlingArm(),
                profile.getBowlingType(),
                profile.isWicketKeeper(),
                profile.isActive(),
                sectionIds,
                profile.getJerseyNumber(),
                profile.getCreatedAt(),
                profile.getUpdatedAt(),
                profile.getUpdatedBy());
    }

    public TeamSquadMemberDto toSquadMemberDto(
            Person person, PlayerProfile profile, TeamSquadMember member, List<UUID> sectionIds) {
        PlayerDto player = toDto(person, profile, sectionIds);
        return new TeamSquadMemberDto(
                member.getId(),
                player.id(),
                player.personId(),
                player.clubId(),
                player.firstName(),
                player.lastName(),
                player.dateOfBirth(),
                player.gender(),
                player.photoUrl(),
                player.clubMembershipNumber(),
                player.medicalAidProvider(),
                player.medicalAidMemberNumber(),
                player.phone(),
                player.email(),
                player.altContactName(),
                player.altContactPhone(),
                player.battingStance(),
                player.bowlingArm(),
                player.bowlingType(),
                player.isWicketKeeper(),
                player.active(),
                player.sectionIds(),
                player.jerseyNumber(),
                member.getJerseyNumber());
    }
}
