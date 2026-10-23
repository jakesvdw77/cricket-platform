package com.cricketlegend.service.impl;

import com.cricketlegend.domain.AgentInviteMode;
import com.cricketlegend.domain.Club;
import com.cricketlegend.domain.LinkGrantedVia;
import com.cricketlegend.domain.Person;
import com.cricketlegend.domain.PersonLink;
import com.cricketlegend.domain.PersonLinkStatus;
import com.cricketlegend.domain.PersonStatus;
import com.cricketlegend.dto.InvitationDto;
import com.cricketlegend.dto.InviteAgentRequest;
import com.cricketlegend.exception.ConflictException;
import com.cricketlegend.exception.NotFoundException;
import com.cricketlegend.exception.ValidationException;
import com.cricketlegend.mapper.LinkRequestMapper;
import com.cricketlegend.repository.ClubRepository;
import com.cricketlegend.repository.PersonLinkRepository;
import com.cricketlegend.repository.PersonRepository;
import com.cricketlegend.service.AgentInvitationEmailService;
import com.cricketlegend.service.AgentInvitationService;
import com.cricketlegend.service.support.HeldPlayer;
import com.cricketlegend.service.support.LinkAttemptLimiter;
import com.cricketlegend.service.support.LinkInvitations;
import com.cricketlegend.service.support.MyPlayerAccess;
import com.cricketlegend.service.support.VerifiedEmail;
import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AgentInvitationServiceImpl implements AgentInvitationService {

    private static final Logger log = LoggerFactory.getLogger(AgentInvitationServiceImpl.class);

    private final MyPlayerAccess myPlayerAccess;
    private final PersonRepository personRepository;
    private final PersonLinkRepository personLinkRepository;
    private final ClubRepository clubRepository;
    private final LinkInvitations linkInvitations;
    private final LinkAttemptLimiter limiter;
    private final AgentInvitationEmailService emailService;

    public AgentInvitationServiceImpl(
            MyPlayerAccess myPlayerAccess,
            PersonRepository personRepository,
            PersonLinkRepository personLinkRepository,
            ClubRepository clubRepository,
            LinkInvitations linkInvitations,
            LinkAttemptLimiter limiter,
            AgentInvitationEmailService emailService) {
        this.myPlayerAccess = myPlayerAccess;
        this.personRepository = personRepository;
        this.personLinkRepository = personLinkRepository;
        this.clubRepository = clubRepository;
        this.linkInvitations = linkInvitations;
        this.limiter = limiter;
        this.emailService = emailService;
    }

    @Override
    @Transactional
    public void invite(Authentication authentication, Jwt jwt, String playerKey, InviteAgentRequest request) {
        String callerEmail = VerifiedEmail.require(jwt);
        HeldPlayer held = myPlayerAccess.resolve(authentication, playerKey);
        // a second agent (or a minor's own record) cannot add agents or hand over
        if (!(held.main() || (held.self() && held.canEditMedical()))) {
            log.warn("Agent invitation refused: account={} club={} reason=not-main", held.caller().getId(), held.profile().getClubId());
            throw new AccessDeniedException("Only the main agent can invite another agent.");
        }
        limiter.countInvite(held.caller().getId());
        PersonLink link = linkInvitations.create(
                held.subject().getId(),
                held.profile().getClubId(),
                request.email(),
                request.mode() == AgentInviteMode.HANDOVER,
                LinkGrantedVia.AGENT_INVITE,
                held.caller().getId(),
                callerEmail);
        log.info("Agent invited: actor={} link={} subject={} club={} mode={}",
                held.caller().getId(), link.getId(), held.subject().getId(), held.profile().getClubId(), request.mode());
        emailService.sendAfterCommit(link.getId());
    }

    @Override
    @Transactional(readOnly = true)
    public List<InvitationDto> invitations(Authentication authentication, Jwt jwt) {
        String email = VerifiedEmail.require(jwt);
        List<PersonLink> open = personLinkRepository.findOpenInvitationsForEmail(email, Instant.now());
        if (open.isEmpty()) {
            return List.of();
        }
        Map<UUID, Person> people = personRepository
                .findAllById(open.stream()
                        .flatMap(l -> java.util.stream.Stream.of(l.getSubjectPersonId(), l.getGrantedByPersonId()))
                        .filter(Objects::nonNull)
                        .collect(Collectors.toSet()))
                .stream()
                .collect(Collectors.toMap(Person::getId, p -> p));
        Map<UUID, String> clubNames = clubRepository
                .findAllById(open.stream().map(PersonLink::getClubId).collect(Collectors.toSet()))
                .stream()
                .collect(Collectors.toMap(Club::getId, Club::getName));
        return open.stream()
                .map(l -> {
                    Person sender = l.getGrantedByPersonId() == null ? null : people.get(l.getGrantedByPersonId());
                    String clubName = clubNames.get(l.getClubId());
                    return new InvitationDto(
                            l.getId(),
                            LinkRequestMapper.fullName(people.get(l.getSubjectPersonId())),
                            clubName,
                            sender == null ? clubName : LinkRequestMapper.fullName(sender),
                            l.isMakeMain(),
                            l.getExpiresAt());
                })
                .toList();
    }

    @Override
    @Transactional
    public void accept(Authentication authentication, Jwt jwt, UUID linkId) {
        Person caller = caller(authentication);
        PersonLink link = openInvitation(jwt, linkId);
        if (link.getSubjectPersonId().equals(caller.getId())) {
            throw new ValidationException("A player cannot be their own agent.");
        }
        boolean alreadyLinked = personLinkRepository
                .findFirstByAccountPersonIdAndSubjectPersonIdAndClubIdAndStatusIn(
                        caller.getId(), link.getSubjectPersonId(), link.getClubId(), List.of(PersonLinkStatus.ACTIVE))
                .isPresent();
        if (alreadyLinked) {
            throw new ConflictException("You are already an agent for this player.");
        }
        Instant now = Instant.now();
        List<PersonLink> active = personLinkRepository.findActiveBySubjectAndClub(link.getSubjectPersonId(), link.getClubId());
        PersonLink currentMain = active.stream().filter(PersonLink::isMain).findFirst().orElse(null);
        boolean becomesMain = link.isMakeMain() || currentMain == null;
        try {
            if (currentMain != null && becomesMain) {
                // the previous main steps down first, in this transaction, so the one-main index is never violated
                currentMain.setMain(false);
                personLinkRepository.saveAndFlush(currentMain);
            }
            link.setAccountPersonId(caller.getId());
            link.setStatus(PersonLinkStatus.ACTIVE);
            link.setMain(becomesMain);
            link.setMakeMain(false);
            link.setDecidedAt(now);
            personLinkRepository.saveAndFlush(link);
        } catch (DataIntegrityViolationException e) {
            throw new ConflictException("The main agent changed while you were accepting. Reload and try again.");
        }
        log.info("Invitation accepted: actor={} link={} subject={} club={} main={} steppedDown={}",
                caller.getId(), link.getId(), link.getSubjectPersonId(), link.getClubId(), becomesMain,
                currentMain != null && becomesMain ? currentMain.getId() : null);
    }

    @Override
    @Transactional
    public void decline(Authentication authentication, Jwt jwt, UUID linkId) {
        Person caller = caller(authentication);
        PersonLink link = openInvitation(jwt, linkId);
        link.setStatus(PersonLinkStatus.DECLINED);
        link.setDecidedAt(Instant.now());
        personLinkRepository.save(link);
        log.info("Invitation declined: actor={} link={} subject={} club={}",
                caller.getId(), link.getId(), link.getSubjectPersonId(), link.getClubId());
    }

    @Override
    @Transactional
    public void remove(Authentication authentication, UUID linkId) {
        Person caller = caller(authentication);
        PersonLink link = personLinkRepository.findById(linkId).orElseThrow(AgentInvitationServiceImpl::notFound);
        Instant now = Instant.now();
        if (link.getStatus() == PersonLinkStatus.INVITED && caller.getId().equals(link.getGrantedByPersonId())) {
            link.setStatus(PersonLinkStatus.REVOKED);
            link.setRevokedAt(now);
            link.setRevokedByPersonId(caller.getId());
            personLinkRepository.save(link);
            log.info("Invitation cancelled: actor={} link={} subject={} club={}",
                    caller.getId(), link.getId(), link.getSubjectPersonId(), link.getClubId());
            return;
        }
        if (link.getStatus() == PersonLinkStatus.ACTIVE && caller.getId().equals(link.getAccountPersonId())) {
            if (link.isMain()) {
                long others = personLinkRepository
                        .findActiveBySubjectAndClub(link.getSubjectPersonId(), link.getClubId()).stream()
                        .filter(l -> !l.getId().equals(link.getId()))
                        .count();
                if (others > 0) {
                    throw new ConflictException("You are the main agent. Hand over to another agent first.");
                }
            }
            link.setStatus(PersonLinkStatus.REVOKED);
            link.setMain(false);
            link.setRevokedAt(now);
            link.setRevokedByPersonId(caller.getId());
            personLinkRepository.save(link);
            log.info("Agent left: actor={} link={} subject={} club={}",
                    caller.getId(), link.getId(), link.getSubjectPersonId(), link.getClubId());
            return;
        }
        throw notFound();
    }

    private Person caller(Authentication authentication) {
        Person caller = personRepository
                .findByKeycloakUserId(authentication.getName())
                .orElseThrow(AgentInvitationServiceImpl::notFound);
        if (caller.getStatus() == PersonStatus.SUSPENDED) {
            throw new AccessDeniedException("This account is disabled.");
        }
        return caller;
    }

    /** The open, unexpired invitation for the caller's verified email, or a 404 (the same for every other case). */
    private PersonLink openInvitation(Jwt jwt, UUID linkId) {
        String email = VerifiedEmail.require(jwt);
        return personLinkRepository.findOpenInvitationsForEmail(email, Instant.now()).stream()
                .filter(l -> l.getId().equals(linkId))
                .min(Comparator.comparing(PersonLink::getCreatedAt))
                .orElseThrow(AgentInvitationServiceImpl::notFound);
    }

    private static NotFoundException notFound() {
        return new NotFoundException("Not found");
    }
}
