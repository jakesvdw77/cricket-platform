package com.cricketlegend.mapper;

import com.cricketlegend.domain.Person;
import com.cricketlegend.domain.PlayerProfile;
import com.cricketlegend.dto.PlayerDto;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Component;

/**
 * Composes a {@link PlayerDto} from three sources — {@link Person} (identity fields), {@link
 * PlayerProfile} (everything else), and the caller-supplied {@code sectionIds} — a plain
 * hand-written compose method rather than forcing MapStruct across three inputs, mirroring {@code
 * TeamContactServiceImpl.list}'s own manual-compose precedent (per
 * docs/plans/028-players.md). See docs/specs/028-players.md.
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
                profile.getCreatedAt(),
                profile.getUpdatedAt(),
                profile.getUpdatedBy());
    }
}
