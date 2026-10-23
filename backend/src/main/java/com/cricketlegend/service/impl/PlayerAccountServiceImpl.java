package com.cricketlegend.service.impl;

import com.cricketlegend.config.AccessService;
import com.cricketlegend.domain.LinkGrantedVia;
import com.cricketlegend.domain.Person;
import com.cricketlegend.domain.PersonLinkStatus;
import com.cricketlegend.domain.PersonLink;
import com.cricketlegend.domain.PlayerProfile;
import com.cricketlegend.dto.PlayerAccountDto;
import com.cricketlegend.dto.PlayerLinkDto;
import com.cricketlegend.exception.ConflictException;
import com.cricketlegend.exception.NotFoundException;
import com.cricketlegend.exception.ValidationException;
import com.cricketlegend.mapper.LinkRequestMapper;
import com.cricketlegend.repository.PersonLinkRepository;
import com.cricketlegend.repository.PersonRepository;
import com.cricketlegend.repository.PlayerProfileRepository;
import com.cricketlegend.service.AgentInvitationEmailService;
import com.cricketlegend.service.PlayerAccountService;
import com.cricketlegend.service.support.LinkInvitations;
import com.cricketlegend.service.support.PlayerSectionNames;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PlayerAccountServiceImpl implements PlayerAccountService {

    private static final Logger log = LoggerFactory.getLogger(PlayerAccountServiceImpl.class);
    private static final int MAX_PAGE_SIZE = 100;
    private static final UUID NO_SECTION = new UUID(0L, 0L);

    private final PlayerProfileRepository playerProfileRepository;
    private final PersonRepository personRepository;
    private final PersonLinkRepository personLinkRepository;
    private final PlayerSectionNames playerSectionNames;
    private final LinkRequestMapper mapper;
    private final AccessService accessService;
    private final LinkInvitations linkInvitations;
    private final AgentInvitationEmailService agentInvitationEmailService;

    public PlayerAccountServiceImpl(
            PlayerProfileRepository playerProfileRepository,
            PersonRepository personRepository,
            PersonLinkRepository personLinkRepository,
            PlayerSectionNames playerSectionNames,
            LinkRequestMapper mapper,
            AccessService accessService,
            LinkInvitations linkInvitations,
            AgentInvitationEmailService agentInvitationEmailService) {
        this.linkInvitations = linkInvitations;
        this.agentInvitationEmailService = agentInvitationEmailService;
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
            return new PageImpl<>(List.of(), profiles.getPageable(), profiles.getTotalElements());
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

        List<PersonLink> links = new ArrayList<>(
                personLinkRepository.findActiveBySubjectAndClub(profile.getPersonId(), clubId));
        links.addAll(personLinkRepository.findOpenInvitationsBySubjectAndClub(profile.getPersonId(), clubId, Instant.now()));
        Map<UUID, Person> agents = agentsOf(links);
        return links.stream()
                .sorted(Comparator.comparing(PersonLink::isMain).reversed().thenComparing(PersonLink::getCreatedAt))
                .map(l -> mapper.toLinkDto(l, l.getAccountPersonId() == null ? null : agents.get(l.getAccountPersonId())))
                .toList();
    }

    @Override
    @Transactional
    public void revokeLink(Authentication authentication, UUID clubId, UUID playerId, UUID linkId, boolean confirm) {
        requireConfirm(confirm);
        PlayerProfile profile = administrablePlayer(authentication, clubId, playerId);
        PersonLink link = linkOf(profile, linkId);
        if (link.getStatus() != PersonLinkStatus.ACTIVE && link.getStatus() != PersonLinkStatus.INVITED) {
            throw new NotFoundException("Link not found: " + linkId);
        }
        UUID actorId = accessService.resolveCurrentPersonId(authentication);
        boolean wasMain = link.isMain();
        PersonLinkStatus was = link.getStatus();
        link.setStatus(PersonLinkStatus.REVOKED);
        link.setMain(false);
        link.setRevokedAt(Instant.now());
        link.setRevokedByPersonId(actorId);
        personLinkRepository.save(link);
        log.info("Link revoked by club: actor={} link={} subject={} club={} was={} wasMain={}",
                actor(authentication, actorId), link.getId(), profile.getPersonId(), clubId, was, wasMain);
    }

    @Override
    @Transactional
    public void makeMain(Authentication authentication, UUID clubId, UUID playerId, UUID linkId, Boolean confirm) {
        requireConfirm(Boolean.TRUE.equals(confirm));
        PlayerProfile profile = administrablePlayer(authentication, clubId, playerId);
        PersonLink link = linkOf(profile, linkId);
        if (link.getStatus() != PersonLinkStatus.ACTIVE) {
            throw new NotFoundException("Link not found: " + linkId);
        }
        if (link.isMain()) {
            throw new ConflictException("This agent is already the main agent.");
        }
        try {
            // the old main steps down first so the one-main partial unique index is never violated
            for (PersonLink other : personLinkRepository.findActiveBySubjectAndClub(profile.getPersonId(), clubId)) {
                if (other.isMain()) {
                    other.setMain(false);
                    personLinkRepository.saveAndFlush(other);
                }
            }
            link.setMain(true);
            personLinkRepository.saveAndFlush(link);
        } catch (DataIntegrityViolationException e) {
            throw new ConflictException("The main agent changed meanwhile. Reload and try again.");
        }
        UUID actorId = accessService.resolveCurrentPersonId(authentication);
        log.info("Main agent changed by club: actor={} link={} subject={} club={}",
                actor(authentication, actorId), link.getId(), profile.getPersonId(), clubId);
    }

    @Override
    @Transactional
    public void inviteMain(Authentication authentication, UUID clubId, UUID playerId, String email, Boolean confirm) {
        requireConfirm(Boolean.TRUE.equals(confirm));
        PlayerProfile profile = administrablePlayer(authentication, clubId, playerId);
        UUID actorId = accessService.resolveCurrentPersonId(authentication);
        PersonLink link = linkInvitations.create(
                profile.getPersonId(), clubId, email, true, LinkGrantedVia.CLUB_MANAGER, actorId, null);
        log.info("Main agent invited by club: actor={} link={} subject={} club={}",
                actor(authentication, actorId), link.getId(), profile.getPersonId(), clubId);
        agentInvitationEmailService.sendAfterCommit(link.getId());
    }

    private PlayerProfile administrablePlayer(Authentication authentication, UUID clubId, UUID playerId) {
        PlayerProfile profile = playerProfileRepository
                .findById(playerId)
                .filter(p -> p.getClubId().equals(clubId))
                .orElseThrow(() -> new NotFoundException("Player not found: " + playerId));
        Set<UUID> sections = new HashSet<>(playerSectionNames.sectionIds(List.of(playerId)).getOrDefault(playerId, Set.of()));
        accessService.assertCanAdministerAnySection(authentication, clubId, sections);
        return profile;
    }

    private PersonLink linkOf(PlayerProfile profile, UUID linkId) {
        return personLinkRepository
                .findById(linkId)
                .filter(l -> l.getSubjectPersonId().equals(profile.getPersonId()) && l.getClubId().equals(profile.getClubId()))
                .orElseThrow(() -> new NotFoundException("Link not found: " + linkId));
    }

    private static void requireConfirm(boolean confirm) {
        if (!confirm) {
            throw new ValidationException("Confirm the change before continuing.");
        }
    }

    private static String actor(Authentication authentication, UUID actorId) {
        return actorId != null ? actorId.toString() : "sub:" + authentication.getName();
    }

    private Map<UUID, Person> agentsOf(List<PersonLink> links) {
        Set<UUID> ids = links.stream()
                .map(PersonLink::getAccountPersonId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());
        Map<UUID, Person> result = new HashMap<>();
        personRepository.findAllById(ids).forEach(p -> result.put(p.getId(), p));
        return result;
    }
}
