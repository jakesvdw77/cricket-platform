package com.cricketlegend.service.impl;

import com.cricketlegend.config.AccessService;
import com.cricketlegend.domain.Person;
import com.cricketlegend.domain.PersonLink;
import com.cricketlegend.domain.PlayerProfile;
import com.cricketlegend.dto.PlayerAccountDto;
import com.cricketlegend.dto.PlayerLinkDto;
import com.cricketlegend.exception.NotFoundException;
import com.cricketlegend.exception.ValidationException;
import com.cricketlegend.mapper.LinkRequestMapper;
import com.cricketlegend.repository.PersonLinkRepository;
import com.cricketlegend.repository.PersonRepository;
import com.cricketlegend.repository.PlayerProfileRepository;
import com.cricketlegend.service.PlayerAccountService;
import com.cricketlegend.service.support.PlayerSectionNames;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PlayerAccountServiceImpl implements PlayerAccountService {

    private static final int MAX_PAGE_SIZE = 100;
    private static final UUID NO_SECTION = new UUID(0L, 0L);

    private final PlayerProfileRepository playerProfileRepository;
    private final PersonRepository personRepository;
    private final PersonLinkRepository personLinkRepository;
    private final PlayerSectionNames playerSectionNames;
    private final LinkRequestMapper mapper;
    private final AccessService accessService;

    public PlayerAccountServiceImpl(
            PlayerProfileRepository playerProfileRepository,
            PersonRepository personRepository,
            PersonLinkRepository personLinkRepository,
            PlayerSectionNames playerSectionNames,
            LinkRequestMapper mapper,
            AccessService accessService) {
        this.playerProfileRepository = playerProfileRepository;
        this.personRepository = personRepository;
        this.personLinkRepository = personLinkRepository;
        this.playerSectionNames = playerSectionNames;
        this.mapper = mapper;
        this.accessService = accessService;
    }

    @Override
    @Transactional(readOnly = true)
    public Page<PlayerAccountDto> list(
            Authentication authentication,
            UUID clubId,
            UUID sectionId,
            boolean noMainAgent,
            String search,
            int page,
            int size) {
        if (page < 0 || size < 1 || size > MAX_PAGE_SIZE) {
            throw new ValidationException("page must be 0 or more and size between 1 and " + MAX_PAGE_SIZE);
        }
        // the caller's own sections (unrestricted when empty), narrowed to a chosen section's closure
        Optional<Set<UUID>> accessible = accessService.accessibleSectionIds(authentication, clubId);
        Set<UUID> scope = null;
        if (accessible.isPresent()) {
            scope = accessible.get();
        }
        if (sectionId != null) {
            accessService.assertCanAdministerSection(authentication, clubId, sectionId);
            Set<UUID> closure = accessService.sectionAndDescendantIds(clubId, sectionId);
            scope = scope == null
                    ? closure
                    : closure.stream().filter(scope::contains).collect(Collectors.toCollection(HashSet::new));
        }
        boolean restrict = scope != null;
        Set<UUID> sectionIds = scope == null || scope.isEmpty() ? Set.of(NO_SECTION) : scope;

        String trimmed = search == null ? "" : search.trim().toLowerCase(Locale.ROOT);
        String pattern = "%" + trimmed + "%";

        Page<PlayerProfile> profiles = playerProfileRepository.searchForAccounts(
                clubId, restrict, sectionIds, noMainAgent, pattern, PageRequest.of(page, size));
        if (profiles.isEmpty()) {
            return profiles.map(p -> null);
        }
        Set<UUID> personIds = profiles.stream().map(PlayerProfile::getPersonId).collect(Collectors.toSet());
        Map<UUID, Person> persons = personRepository.findAllById(personIds).stream()
                .collect(Collectors.toMap(Person::getId, p -> p));
        Map<UUID, List<PersonLink>> linksBySubject = personLinkRepository
                .findActiveBySubjectsAndClub(personIds, clubId).stream()
                .collect(Collectors.groupingBy(PersonLink::getSubjectPersonId));
        Map<UUID, Person> agents = agentsOf(linksBySubject.values().stream().flatMap(List::stream).toList());
        Map<UUID, Set<UUID>> sections = playerSectionNames.sectionIds(
                profiles.stream().map(PlayerProfile::getId).toList());
        Map<UUID, String> sectionNames = playerSectionNames.firstNames(sections);

        return profiles.map(profile -> {
            List<PersonLink> links = linksBySubject.getOrDefault(profile.getPersonId(), List.of());
            PersonLink main = links.stream().filter(PersonLink::isMain).findFirst().orElse(null);
            Person mainAgent = main == null || main.getAccountPersonId() == null
                    ? null
                    : agents.get(main.getAccountPersonId());
            return mapper.toAccountDto(
                    persons.get(profile.getPersonId()),
                    profile.getId(),
                    sectionNames.get(profile.getId()),
                    mainAgent,
                    links.size() - (main == null ? 0 : 1));
        });
    }

    @Override
    @Transactional(readOnly = true)
    public List<PlayerLinkDto> links(Authentication authentication, UUID clubId, UUID playerId) {
        PlayerProfile profile = playerProfileRepository
                .findById(playerId)
                .filter(p -> p.getClubId().equals(clubId))
                .orElseThrow(() -> new NotFoundException("Player not found: " + playerId));
        Set<UUID> sections = new HashSet<>(playerSectionNames.sectionIds(List.of(playerId)).getOrDefault(playerId, Set.of()));
        accessService.assertCanAdministerAnySection(authentication, clubId, sections);

        List<PersonLink> links = personLinkRepository.findActiveBySubjectAndClub(profile.getPersonId(), clubId);
        Map<UUID, Person> agents = agentsOf(links);
        return links.stream()
                .sorted(Comparator.comparing(PersonLink::isMain).reversed().thenComparing(PersonLink::getCreatedAt))
                .map(l -> mapper.toLinkDto(l, l.getAccountPersonId() == null ? null : agents.get(l.getAccountPersonId())))
                .toList();
    }

    private Map<UUID, Person> agentsOf(List<PersonLink> links) {
        Set<UUID> ids = links.stream()
                .map(PersonLink::getAccountPersonId)
                .filter(java.util.Objects::nonNull)
                .collect(Collectors.toSet());
        Map<UUID, Person> result = new HashMap<>();
        personRepository.findAllById(ids).forEach(p -> result.put(p.getId(), p));
        return result;
    }
}
