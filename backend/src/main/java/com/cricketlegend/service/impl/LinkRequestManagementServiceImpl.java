package com.cricketlegend.service.impl;

import com.cricketlegend.config.AccessService;
import com.cricketlegend.domain.LinkGrantedVia;
import com.cricketlegend.domain.LinkRequest;
import com.cricketlegend.domain.LinkRequestStatus;
import com.cricketlegend.domain.MainAgentMode;
import com.cricketlegend.domain.Person;
import com.cricketlegend.domain.PersonLink;
import com.cricketlegend.domain.PersonLinkStatus;
import com.cricketlegend.domain.PlayerProfile;
import com.cricketlegend.dto.ApproveLinkRequestRequest;
import com.cricketlegend.dto.CreatePlayerRequest;
import com.cricketlegend.dto.DeclineLinkRequestRequest;
import com.cricketlegend.dto.LinkRequestDto;
import com.cricketlegend.dto.LinkRequestSummaryDto;
import com.cricketlegend.dto.NewLinkedPlayerRequest;
import com.cricketlegend.dto.PlayerDto;
import com.cricketlegend.dto.SuggestedPlayerDto;
import com.cricketlegend.exception.ConflictException;
import com.cricketlegend.exception.InvalidStatusTransitionException;
import com.cricketlegend.exception.NotFoundException;
import com.cricketlegend.exception.ValidationException;
import com.cricketlegend.mapper.LinkRequestMapper;
import com.cricketlegend.repository.LinkRequestRepository;
import com.cricketlegend.repository.PersonLinkRepository;
import com.cricketlegend.repository.PersonRepository;
import com.cricketlegend.repository.PlayerProfileRepository;
import com.cricketlegend.service.LinkRequestManagementService;
import com.cricketlegend.service.LinkRequestOutcomeEmailService;
import com.cricketlegend.service.PlayerSectionService;
import com.cricketlegend.service.PlayerService;
import com.cricketlegend.service.support.LinkRequestSuggester;
import com.cricketlegend.service.support.LinkRequestSuggester.Suggestion;
import com.cricketlegend.service.support.PlayerSectionNames;
import com.cricketlegend.service.support.VisibleLinkRequests;
import java.time.Instant;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class LinkRequestManagementServiceImpl implements LinkRequestManagementService {

    private static final Logger log = LoggerFactory.getLogger(LinkRequestManagementServiceImpl.class);

    private final LinkRequestRepository linkRequestRepository;
    private final PersonRepository personRepository;
    private final PlayerProfileRepository playerProfileRepository;
    private final PersonLinkRepository personLinkRepository;
    private final PlayerService playerService;
    private final PlayerSectionService playerSectionService;
    private final PlayerSectionNames playerSectionNames;
    private final LinkRequestSuggester suggester;
    private final LinkRequestMapper mapper;
    private final LinkRequestOutcomeEmailService outcomeEmailService;
    private final AccessService accessService;

    public LinkRequestManagementServiceImpl(
            LinkRequestRepository linkRequestRepository,
            PersonRepository personRepository,
            PlayerProfileRepository playerProfileRepository,
            PersonLinkRepository personLinkRepository,
            PlayerService playerService,
            PlayerSectionService playerSectionService,
            PlayerSectionNames playerSectionNames,
            LinkRequestSuggester suggester,
            LinkRequestMapper mapper,
            LinkRequestOutcomeEmailService outcomeEmailService,
            AccessService accessService) {
        this.linkRequestRepository = linkRequestRepository;
        this.personRepository = personRepository;
        this.playerProfileRepository = playerProfileRepository;
        this.personLinkRepository = personLinkRepository;
        this.playerService = playerService;
        this.playerSectionService = playerSectionService;
        this.playerSectionNames = playerSectionNames;
        this.suggester = suggester;
        this.mapper = mapper;
        this.outcomeEmailService = outcomeEmailService;
        this.accessService = accessService;
    }

    @Override
    @Transactional(readOnly = true)
    public List<LinkRequestDto> list(Authentication authentication, UUID clubId) {
        VisibleLinkRequests visible = visible(authentication, clubId);
        if (visible.requests().isEmpty()) {
            return List.of();
        }
        Map<UUID, Person> requesters = personRepository
                .findAllById(visible.requests().stream().map(LinkRequest::getAccountPersonId).collect(Collectors.toSet()))
                .stream()
                .collect(Collectors.toMap(Person::getId, p -> p));
        Map<UUID, SuggestedPlayerDto> suggested = suggestedDtos(clubId, visible.suggestions().values());
        LocalDate today = LocalDate.now();
        return visible.requests().stream()
                .map(r -> {
                    Suggestion suggestion = visible.suggestions().get(r.getId());
                    return mapper.toDto(
                            r,
                            requesters.get(r.getAccountPersonId()),
                            suggestion == null ? null : suggested.get(suggestion.profile().getId()),
                            today);
                })
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public LinkRequestSummaryDto summary(Authentication authentication, UUID clubId) {
        return new LinkRequestSummaryDto(visible(authentication, clubId).requests().size());
    }

    @Override
    @Transactional
    public void approve(Authentication authentication, UUID clubId, UUID requestId, ApproveLinkRequestRequest body) {
        if (!Boolean.TRUE.equals(body.confirm())) {
            throw new ValidationException("Confirm the approval before continuing.");
        }
        if ((body.playerId() == null) == (body.newPlayer() == null)) {
            throw new ValidationException("Choose an existing player or enter a new player, not both and not neither.");
        }
        LinkRequest request = requireDecidable(authentication, clubId, requestId);
        UUID actorId = accessService.resolveCurrentPersonId(authentication);

        UUID subjectPersonId = body.playerId() != null
                ? existingPlayerPerson(authentication, clubId, body.playerId())
                : createPlayerPerson(authentication, clubId, body.newPlayer());
        UUID requesterId = request.getAccountPersonId();
        if (subjectPersonId.equals(requesterId)) {
            throw new ValidationException("The requester's own player record cannot be linked to themselves.");
        }

        Instant now = Instant.now();
        boolean main = grantLink(requesterId, subjectPersonId, clubId, body.mainAgentMode(), actorId, now);

        request.setStatus(LinkRequestStatus.APPROVED);
        request.setResolvedSubjectPersonId(subjectPersonId);
        request.setDecidedByPersonId(actorId);
        request.setDecidedAt(now);
        request.setDecisionNote(null);
        linkRequestRepository.save(request);
        log.info("Link request decided: actor={} request={} account={} subject={} club={} outcome=APPROVED via=CLUB_APPROVAL main={}",
                actor(authentication, actorId), request.getId(), requesterId, subjectPersonId, clubId, main);
        outcomeEmailService.sendAfterCommit(request.getId());
    }

    @Override
    @Transactional
    public void decline(Authentication authentication, UUID clubId, UUID requestId, DeclineLinkRequestRequest body) {
        LinkRequest request = requireDecidable(authentication, clubId, requestId);
        UUID actorId = accessService.resolveCurrentPersonId(authentication);
        String note = body == null || body.note() == null || body.note().isBlank() ? null : body.note().trim();

        request.setStatus(LinkRequestStatus.DECLINED);
        request.setDecidedByPersonId(actorId);
        request.setDecidedAt(Instant.now());
        request.setDecisionNote(note);
        linkRequestRepository.save(request);
        log.info("Link request decided: actor={} request={} account={} club={} outcome=DECLINED withNote={}",
                actor(authentication, actorId), request.getId(), request.getAccountPersonId(), clubId, note != null);
        outcomeEmailService.sendAfterCommit(request.getId());
    }

    /** The PENDING request of this club the caller may decide: 404 if unknown, 409 if decided, 403 if outside their sections. */
    private LinkRequest requireDecidable(Authentication authentication, UUID clubId, UUID requestId) {
        LinkRequest request = linkRequestRepository
                .findByIdAndClubId(requestId, clubId)
                .orElseThrow(() -> new NotFoundException("Link request not found: " + requestId));
        if (request.getStatus() != LinkRequestStatus.PENDING) {
            throw new InvalidStatusTransitionException("This request has already been decided or cancelled.");
        }
        Optional<Set<UUID>> accessible = accessService.accessibleSectionIds(authentication, clubId);
        if (accessible.isPresent()
                && !suggester.suggest(clubId, List.of(request), accessible).containsKey(request.getId())) {
            throw new AccessDeniedException("Not authorized to decide this link request");
        }
        return request;
    }

    private UUID existingPlayerPerson(Authentication authentication, UUID clubId, UUID playerId) {
        PlayerProfile profile = playerProfileRepository
                .findById(playerId)
                .filter(p -> p.getClubId().equals(clubId))
                .orElseThrow(() -> new NotFoundException("Player not found: " + playerId));
        Set<UUID> sections = playerSectionNames.sectionIds(List.of(playerId)).getOrDefault(playerId, Set.of());
        accessService.assertCanAdministerAnySection(authentication, clubId, sections);
        if (!profile.isActive()) {
            throw new ValidationException("This player is not active.");
        }
        return profile.getPersonId();
    }

    private UUID createPlayerPerson(Authentication authentication, UUID clubId, NewLinkedPlayerRequest np) {
        if (np.sectionId() != null) {
            accessService.assertCanAdministerSection(authentication, clubId, np.sectionId());
        } else {
            // an untagged player is administerable only club-wide
            accessService.assertCanAdministerAnySection(authentication, clubId, Set.of());
        }
        PlayerDto created = playerService.create(clubId, new CreatePlayerRequest(
                np.firstName().trim(), np.lastName().trim(), np.dateOfBirth(), null, null, null, null, null, null,
                null, null, null, null, null, null, false, null));
        if (np.sectionId() != null) {
            playerSectionService.link(clubId, created.id(), np.sectionId());
        }
        return created.personId();
    }

    /** Writes the CLUB_APPROVAL link; returns whether the requester is now the main agent. */
    private boolean grantLink(
            UUID requesterId, UUID subjectPersonId, UUID clubId, MainAgentMode mode, UUID actorId, Instant now) {
        List<PersonLink> active = personLinkRepository.findActiveBySubjectAndClub(subjectPersonId, clubId);
        PersonLink currentMain = active.stream().filter(PersonLink::isMain).findFirst().orElse(null);
        boolean becomesMain = currentMain == null || mode == MainAgentMode.MAKE_MAIN;
        PersonLink own = personLinkRepository
                .findFirstByAccountPersonIdAndSubjectPersonIdAndClubIdAndStatusIn(
                        requesterId, subjectPersonId, clubId, List.of(PersonLinkStatus.ACTIVE, PersonLinkStatus.INVITED))
                .orElse(null);
        if (own != null && own.getStatus() == PersonLinkStatus.ACTIVE && (own.isMain() || !becomesMain)) {
            throw new ConflictException("This account is already an agent for this player.");
        }
        try {
            if (currentMain != null && becomesMain) {
                // step the old main down first so the one-main partial unique index is never violated
                currentMain.setMain(false);
                personLinkRepository.saveAndFlush(currentMain);
            }
            PersonLink link = own != null
                    ? own
                    : PersonLink.builder()
                            .accountPersonId(requesterId)
                            .subjectPersonId(subjectPersonId)
                            .clubId(clubId)
                            .build();
            if (own == null || own.getStatus() == PersonLinkStatus.INVITED) {
                link.setGrantedVia(LinkGrantedVia.CLUB_APPROVAL);
                link.setGrantedByPersonId(actorId);
                link.setDecidedAt(now);
            }
            link.setStatus(PersonLinkStatus.ACTIVE);
            link.setMain(becomesMain);
            link.setMakeMain(false);
            personLinkRepository.saveAndFlush(link);
        } catch (DataIntegrityViolationException e) {
            throw new ConflictException("The main agent changed while you were deciding. Reload and try again.");
        }
        return becomesMain;
    }

    private VisibleLinkRequests visible(Authentication authentication, UUID clubId) {
        Optional<Set<UUID>> accessible = accessService.accessibleSectionIds(authentication, clubId);
        List<LinkRequest> pending =
                linkRequestRepository.findByClubIdAndStatusOrderByCreatedAtAsc(clubId, LinkRequestStatus.PENDING);
        Map<UUID, Suggestion> suggestions = suggester.suggest(clubId, pending, accessible);
        List<LinkRequest> shown = accessible.isEmpty()
                ? pending
                : pending.stream().filter(r -> suggestions.containsKey(r.getId())).toList();
        return new VisibleLinkRequests(shown, suggestions);
    }

    /** The suggested players as DTOs keyed by profile id, with main agent state from one links query. */
    private Map<UUID, SuggestedPlayerDto> suggestedDtos(UUID clubId, java.util.Collection<Suggestion> suggestions) {
        Map<UUID, SuggestedPlayerDto> result = new HashMap<>();
        if (suggestions.isEmpty()) {
            return result;
        }
        Set<UUID> subjectIds = suggestions.stream().map(s -> s.person().getId()).collect(Collectors.toSet());
        Map<UUID, PersonLink> mainBySubject = personLinkRepository.findActiveBySubjectsAndClub(subjectIds, clubId).stream()
                .filter(PersonLink::isMain)
                .collect(Collectors.toMap(PersonLink::getSubjectPersonId, l -> l, (a, b) -> a));
        Map<UUID, Person> mainAccounts = personRepository
                .findAllById(mainBySubject.values().stream()
                        .map(PersonLink::getAccountPersonId)
                        .filter(java.util.Objects::nonNull)
                        .collect(Collectors.toSet()))
                .stream()
                .collect(Collectors.toMap(Person::getId, p -> p));
        Map<UUID, Set<UUID>> sectionIds = new HashMap<>();
        suggestions.forEach(s -> sectionIds.put(s.profile().getId(), s.sectionIds()));
        Map<UUID, String> sectionNames = playerSectionNames.firstNames(sectionIds);
        for (Suggestion s : suggestions) {
            PersonLink main = mainBySubject.get(s.person().getId());
            Person mainAccount = main == null || main.getAccountPersonId() == null
                    ? null
                    : mainAccounts.get(main.getAccountPersonId());
            result.put(s.profile().getId(), mapper.toSuggestedDto(
                    s,
                    sectionNames.get(s.profile().getId()),
                    main != null,
                    mainAccount == null ? null : LinkRequestMapper.fullName(mainAccount)));
        }
        return result;
    }

    private static String actor(Authentication authentication, UUID actorId) {
        return actorId != null ? actorId.toString() : "sub:" + authentication.getName();
    }
}
