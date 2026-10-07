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
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
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
        List<TeamSquadMember> members = teamSquadMemberRepository.findByTeamIdAndSeasonId(teamId, seasonId);
        if (members.isEmpty()) {
            return List.of();
        }
        // Two batch lookups regardless of squad size (no per-member queries).
        Map<UUID, PlayerProfile> profiles = playerProfileRepository
                .findAllById(members.stream().map(TeamSquadMember::getPlayerProfileId).collect(Collectors.toSet()))
                .stream()
                .collect(Collectors.toMap(PlayerProfile::getId, Function.identity()));
        Map<UUID, Person> persons = personRepository
                .findAllById(profiles.values().stream().map(PlayerProfile::getPersonId).collect(Collectors.toSet()))
                .stream()
                .collect(Collectors.toMap(Person::getId, Function.identity()));
        return members.stream().map(member -> toRow(member, profiles, persons)).toList();
    }

    private PlayerAvailabilityRowDto toRow(
            TeamSquadMember member, Map<UUID, PlayerProfile> profiles, Map<UUID, Person> persons) {
        PlayerProfile profile = profiles.get(member.getPlayerProfileId());
        if (profile == null) {
            throw new NotFoundException("Player not found: " + member.getPlayerProfileId());
        }
        Person person = persons.get(profile.getPersonId());
        if (person == null) {
            throw new NotFoundException("Person not found: " + profile.getPersonId());
        }
        return new PlayerAvailabilityRowDto(
                member.getPlayerProfileId(),
                person.getFirstName(),
                person.getLastName(),
                member.getJerseyNumber(),
                null);
    }
}
