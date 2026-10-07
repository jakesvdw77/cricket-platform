package com.cricketlegend.service.impl;

import com.cricketlegend.domain.Person;
import com.cricketlegend.domain.PlayerProfile;
import com.cricketlegend.domain.PlayerSection;
import com.cricketlegend.dto.SectionAvailabilityResponseRowDto;
import com.cricketlegend.exception.NotFoundException;
import com.cricketlegend.repository.PersonRepository;
import com.cricketlegend.repository.PlayerProfileRepository;
import com.cricketlegend.repository.PlayerSectionRepository;
import com.cricketlegend.service.SectionAvailabilityAudienceResolver;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** See {@link SectionAvailabilityAudienceResolver} and docs/specs/063-section-availability-and-flexible-squads.md. */
@Service
public class SectionAvailabilityAudienceResolverImpl implements SectionAvailabilityAudienceResolver {

    private final PlayerSectionRepository playerSectionRepository;
    private final PlayerProfileRepository playerProfileRepository;
    private final PersonRepository personRepository;

    public SectionAvailabilityAudienceResolverImpl(
            PlayerSectionRepository playerSectionRepository,
            PlayerProfileRepository playerProfileRepository,
            PersonRepository personRepository) {
        this.playerSectionRepository = playerSectionRepository;
        this.playerProfileRepository = playerProfileRepository;
        this.personRepository = personRepository;
    }

    @Override
    @Transactional(readOnly = true)
    public List<SectionAvailabilityResponseRowDto> resolveAudience(UUID sectionId) {
        List<UUID> profileIds = playerSectionRepository.findBySectionId(sectionId).stream()
                .map(PlayerSection::getPlayerProfileId)
                .distinct()
                .toList();
        if (profileIds.isEmpty()) {
            return List.of();
        }
        // Two batch lookups regardless of audience size; the section's own order is kept.
        Map<UUID, PlayerProfile> profiles = playerProfileRepository.findAllById(profileIds).stream()
                .collect(Collectors.toMap(PlayerProfile::getId, Function.identity()));
        Map<UUID, Person> persons = personRepository
                .findAllById(profiles.values().stream().map(PlayerProfile::getPersonId).collect(Collectors.toSet()))
                .stream()
                .collect(Collectors.toMap(Person::getId, Function.identity()));
        return profileIds.stream()
                .map(profiles::get)
                .filter(profile -> profile != null && profile.isActive())
                .map(profile -> toRow(profile, persons))
                .toList();
    }

    private SectionAvailabilityResponseRowDto toRow(PlayerProfile profile, Map<UUID, Person> persons) {
        Person person = persons.get(profile.getPersonId());
        if (person == null) {
            throw new NotFoundException("Person not found: " + profile.getPersonId());
        }
        return new SectionAvailabilityResponseRowDto(
                profile.getId(), person.getFirstName(), person.getLastName(), profile.getJerseyNumber(), null);
    }
}
