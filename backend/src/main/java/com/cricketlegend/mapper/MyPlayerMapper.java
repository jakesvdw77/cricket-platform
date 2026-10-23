package com.cricketlegend.mapper;

import com.cricketlegend.domain.Person;
import com.cricketlegend.dto.MyPlayerAgentDto;
import com.cricketlegend.dto.MyPlayerDto;
import com.cricketlegend.dto.MyPlayerSummaryDto;
import com.cricketlegend.service.support.HeldPlayer;
import com.cricketlegend.service.support.MaskedEmail;
import java.util.List;
import org.springframework.stereotype.Component;

/** Composes the My players DTOs from a {@link HeldPlayer} and the lookups the service batches (docs/specs/119). Never maps a date of birth. */
@Component
public class MyPlayerMapper {

    public MyPlayerSummaryDto toSummary(HeldPlayer held, String clubName, String groupLabel) {
        return new MyPlayerSummaryDto(
                held.key(),
                held.subject().getFirstName(),
                held.subject().getLastName(),
                held.profile().getPhotoUrl(),
                held.profile().getClubId(),
                clubName,
                groupLabel,
                held.self(),
                held.main());
    }

    public MyPlayerDto toDto(
            HeldPlayer held,
            String clubName,
            String groupLabel,
            List<String> sectionNames,
            List<String> teamNames,
            int agentCount,
            List<MyPlayerAgentDto> agents) {
        var profile = held.profile();
        return new MyPlayerDto(
                held.key(),
                held.subject().getFirstName(),
                held.subject().getLastName(),
                profile.getPhotoUrl(),
                profile.getClubId(),
                clubName,
                groupLabel,
                sectionNames,
                teamNames,
                profile.getJerseyNumber(),
                held.self(),
                held.main(),
                held.canEditMedical(),
                profile.getPhone(),
                profile.getEmail(),
                profile.getAltContactName(),
                profile.getAltContactPhone(),
                profile.getBattingStance(),
                profile.getBowlingArm(),
                profile.getBowlingType(),
                profile.isWicketKeeper(),
                profile.getMedicalAidProvider(),
                profile.getMedicalAidMemberNumber(),
                agentCount,
                agents);
    }

    public MyPlayerAgentDto toAgent(Person agent, boolean main) {
        String first = agent.getFirstName() == null ? "" : agent.getFirstName().trim();
        String last = agent.getLastName() == null ? "" : agent.getLastName().trim();
        return new MyPlayerAgentDto((first + " " + last).trim(), MaskedEmail.mask(agent.getEmail()), main);
    }
}
