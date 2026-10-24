package com.cricketlegend.mapper;

import com.cricketlegend.domain.LinkRequest;
import com.cricketlegend.domain.Person;
import com.cricketlegend.domain.PersonLink;
import com.cricketlegend.dto.LinkRequestDto;
import com.cricketlegend.dto.MyLinkRequestDto;
import com.cricketlegend.dto.PlayerAccountDto;
import com.cricketlegend.dto.PlayerLinkDto;
import com.cricketlegend.dto.SuggestedPlayerDto;
import com.cricketlegend.service.support.LinkRequestSuggester.Suggestion;
import com.cricketlegend.service.support.MaskedEmail;
import java.time.LocalDate;
import java.time.Period;
import org.springframework.stereotype.Component;

/**
 * Composes the link request and player account DTOs of docs/specs/119, each from several sources (the request or link,
 * the people involved and looked-up names), a plain compose component like {@link PlayerMapper} rather than forcing
 * MapStruct across many inputs. Emails leave here masked or, for the requester on the manager's queue, in full by design.
 */
@Component
public class LinkRequestMapper {

    public MyLinkRequestDto toMyDto(LinkRequest request, String clubName) {
        return new MyLinkRequestDto(
                request.getId(),
                clubName,
                request.getTypedFirstName() + " " + request.getTypedLastName(),
                request.getStatus(),
                request.getDecisionNote(),
                request.getCreatedAt(),
                request.getDecidedAt());
    }

    public LinkRequestDto toDto(LinkRequest request, Person requester, SuggestedPlayerDto suggestion, LocalDate today) {
        return new LinkRequestDto(
                request.getId(),
                fullName(requester),
                requester == null ? null : requester.getEmail(),
                request.getTypedFirstName(),
                request.getTypedLastName(),
                request.getTypedDateOfBirth(),
                Period.between(request.getTypedDateOfBirth(), today).getYears(),
                request.getMessage(),
                request.getContactNumber(),
                request.getCreatedAt(),
                request.getTargetPlayerProfileId(),
                suggestion);
    }

    public SuggestedPlayerDto toSuggestedDto(
            Suggestion suggestion, String sectionName, boolean hasMainAgent, String mainAgentName) {
        return new SuggestedPlayerDto(
                suggestion.profile().getId(),
                suggestion.person().getFirstName(),
                suggestion.person().getLastName(),
                suggestion.person().getDateOfBirth(),
                suggestion.exactMatch(),
                sectionName,
                hasMainAgent,
                mainAgentName);
    }

    public PlayerAccountDto toAccountDto(
            Person player,
            java.util.UUID playerProfileId,
            String sectionName,
            Person mainAgent,
            int otherAgentCount) {
        return new PlayerAccountDto(
                playerProfileId,
                player.getFirstName(),
                player.getLastName(),
                sectionName,
                mainAgent == null ? null : fullName(mainAgent),
                mainAgent == null ? null : MaskedEmail.mask(mainAgent.getEmail()),
                otherAgentCount);
    }

    public PlayerLinkDto toLinkDto(PersonLink link, Person agent) {
        String masked = MaskedEmail.mask(agent == null ? link.getInvitedEmail() : agent.getEmail());
        return new PlayerLinkDto(
                link.getId(),
                agent == null ? masked : fullName(agent),
                masked,
                link.isMain(),
                link.getGrantedVia(),
                link.getDecidedAt() != null ? link.getDecidedAt() : link.getCreatedAt(),
                link.getStatus());
    }

    public static String fullName(Person person) {
        if (person == null) {
            return null;
        }
        String last = person.getLastName() == null ? "" : person.getLastName();
        return (person.getFirstName() + " " + last).trim();
    }
}
