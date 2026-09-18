package com.cricketlegend.service.impl;

import com.cricketlegend.domain.Person;
import com.cricketlegend.domain.PlayerProfile;
import com.cricketlegend.domain.TeamSquadMember;
import com.cricketlegend.dto.PlayerAvailabilityRowDto;
import com.cricketlegend.exception.NotFoundException;
import com.cricketlegend.repository.PersonRepository;
import com.cricketlegend.repository.PlayerProfileRepository;
import com.cricketlegend.repository.TeamSquadMemberRepository;
import com.cricketlegend.service.AvailabilityPollSquadResolver;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** See {@link AvailabilityPollSquadResolver} and docs/specs/032-match-availability-polls.md. */
@Service
public class AvailabilityPollSquadResolverImpl implements AvailabilityPollSquadResolver {

    private final TeamSquadMemberRepository teamSquadMemberRepository;
    private final PlayerProfileRepository playerProfileRepository;
    private final PersonRepository personRepository;

    public AvailabilityPollSquadResolverImpl(
            TeamSquadMemberRepository teamSquadMemberRepository,
            PlayerProfileRepository playerProfileRepository,
            PersonRepository personRepository) {
        this.teamSquadMemberRepository = teamSquadMemberRepository;
        this.playerProfileRepository = playerProfileRepository;
        this.personRepository = personRepository;
    }

    @Override
    @Transactional(readOnly = true)
    public List<PlayerAvailabilityRowDto> resolveSquadRows(UUID teamId, UUID seasonId) {
        return teamSquadMemberRepository.findByTeamIdAndSeasonId(teamId, seasonId).stream()
                .map(this::toRow)
                .toList();
    }

    private PlayerAvailabilityRowDto toRow(TeamSquadMember member) {
        PlayerProfile profile = playerProfileRepository
                .findById(member.getPlayerProfileId())
                .orElseThrow(() -> new NotFoundException("Player not found: " + member.getPlayerProfileId()));
        Person person = personRepository
                .findById(profile.getPersonId())
                .orElseThrow(() -> new NotFoundException("Person not found: " + profile.getPersonId()));
        return new PlayerAvailabilityRowDto(
                member.getPlayerProfileId(),
                person.getFirstName(),
                person.getLastName(),
                member.getJerseyNumber(),
                null);
    }
}
