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
import java.util.Optional;
import java.util.UUID;
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
        return playerSectionRepository.findBySectionId(sectionId).stream()
                .map(PlayerSection::getPlayerProfileId)
                .distinct()
                .map(playerProfileRepository::findById)
                .flatMap(Optional::stream)
                .filter(PlayerProfile::isActive)
                .map(this::toRow)
                .toList();
    }

    private SectionAvailabilityResponseRowDto toRow(PlayerProfile profile) {
        Person person = personRepository
                .findById(profile.getPersonId())
                .orElseThrow(() -> new NotFoundException("Person not found: " + profile.getPersonId()));
        return new SectionAvailabilityResponseRowDto(
                profile.getId(), person.getFirstName(), person.getLastName(), profile.getJerseyNumber(), null);
    }
}
