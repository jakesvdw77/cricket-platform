package com.cricketlegend.service.impl;

import com.cricketlegend.domain.Club;
import com.cricketlegend.domain.LinkAttemptKind;
import com.cricketlegend.domain.LinkGrantedVia;
import com.cricketlegend.domain.Person;
import com.cricketlegend.domain.PersonLink;
import com.cricketlegend.domain.PersonLinkStatus;
import com.cricketlegend.domain.PlayerProfile;
import com.cricketlegend.dto.ConfirmLinksRequest;
import com.cricketlegend.dto.ConfirmLinksResultDto;
import com.cricketlegend.dto.PlayerMatchesDto;
import com.cricketlegend.exception.ConflictException;
import com.cricketlegend.exception.ValidationException;
import com.cricketlegend.mapper.LinkMapper;
import com.cricketlegend.repository.ClubRepository;
import com.cricketlegend.repository.PersonLinkRepository;
import com.cricketlegend.repository.PersonRepository;
import com.cricketlegend.repository.PlayerProfileRepository;
import com.cricketlegend.service.LinkService;
import com.cricketlegend.service.support.MatchCandidate;
import com.cricketlegend.service.support.PlayerGroupLabels;
import com.cricketlegend.service.support.LinkAttemptLimiter;
import com.cricketlegend.service.support.MatchedPlayer;
import com.cricketlegend.service.support.OwnMatch;
import com.cricketlegend.service.support.VerifiedEmail;
import java.time.Instant;
import java.time.LocalDate;
import java.time.Period;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The email match and confirm step of docs/specs/119. Nothing here ever returns a full date of birth: a match carries
 * the birth year and a server-computed adult flag only (Decision 28).
 */
@Service
public class LinkServiceImpl implements LinkService {

    private static final Logger log = LoggerFactory.getLogger(LinkServiceImpl.class);
    private static final UUID NO_PERSON = new UUID(0L, 0L);
    private static final int ADULT_AGE = 18;

    private final PersonRepository personRepository;
    private final PlayerProfileRepository playerProfileRepository;
    private final PersonLinkRepository personLinkRepository;
    private final ClubRepository clubRepository;
    private final LinkMapper linkMapper;
    private final LinkAttemptLimiter limiter;
    private final PlayerGroupLabels groupLabels;

    public LinkServiceImpl(
            PersonRepository personRepository,
            PlayerProfileRepository playerProfileRepository,
            PersonLinkRepository personLinkRepository,
            ClubRepository clubRepository,
            LinkMapper linkMapper,
            LinkAttemptLimiter limiter,
            PlayerGroupLabels groupLabels) {
        this.personRepository = personRepository;
        this.playerProfileRepository = playerProfileRepository;
        this.personLinkRepository = personLinkRepository;
        this.clubRepository = clubRepository;
        this.linkMapper = linkMapper;
        this.limiter = limiter;
        this.groupLabels = groupLabels;
    }

    @Override
    @Transactional(readOnly = true)
    public PlayerMatchesDto matches(Authentication authentication, Jwt jwt) {
        String email = VerifiedEmail.require(jwt);
        Person caller = personRepository.findByKeycloakUserId(authentication.getName()).orElse(null);
        List<MatchCandidate> candidates = candidates(email, caller);
        return new PlayerMatchesDto(
                linkMapper.toDtos(candidates.stream().filter(c -> !c.hasMainAgent()).map(MatchCandidate::view).toList()),
                linkMapper.toWithMainAgentDtos(
                        candidates.stream().filter(MatchCandidate::hasMainAgent).map(MatchCandidate::view).toList()));
    }

    @Override
    @Transactional
    public ConfirmLinksResultDto confirm(Authentication authentication, Jwt jwt, ConfirmLinksRequest request) {
        String email = VerifiedEmail.require(jwt);
        if (!Boolean.TRUE.equals(request.confirm())) {
            throw new ValidationException("Confirm the players before continuing.");
        }
        Person caller = personRepository
                .findByKeycloakUserId(authentication.getName())
                .orElseThrow(() -> new ValidationException("Register before confirming players."));
        limiter.assertNotLocked(caller.getId(), LinkAttemptKind.CONFIRM);

        // Only the caller's own matches that have no main agent can be confirmed. A reference to anything else (a
        // player with a main agent, someone else's player, a made-up id) gets the same answer, so nothing is revealed.
        Map<String, MatchCandidate> available = candidates(email, caller).stream()
                .filter(c -> !c.hasMainAgent())
                .collect(Collectors.toMap(c -> c.view().ref(), c -> c, (a, b) -> a));
        Set<String> refs = new HashSet<>(request.playerRefs());
        if (!available.keySet().containsAll(refs)) {
            // counted in its own transaction so this refusal's rollback does not erase it; the fifth in an hour locks
            limiter.recordFailedConfirm(caller.getId());
            log.warn("Link confirm refused: account={} reason=not-own-matches", caller.getId());
            throw new ValidationException("One or more of these players cannot be confirmed.");
        }

        Instant now = Instant.now();
        List<MatchedPlayer> linked = new java.util.ArrayList<>();
        for (String ref : refs) {
            MatchCandidate candidate = available.get(ref);
            PlayerProfile profile = candidate.profile();
            try {
                personLinkRepository.saveAndFlush(PersonLink.builder()
                        .accountPersonId(caller.getId())
                        .subjectPersonId(profile.getPersonId())
                        .clubId(profile.getClubId())
                        .status(PersonLinkStatus.ACTIVE)
                        .main(true)
                        .grantedVia(LinkGrantedVia.EMAIL_MATCH)
                        .decidedAt(now)
                        .build());
            } catch (DataIntegrityViolationException e) {
                // someone else became main agent between the lookup and the insert (partial unique index)
                throw new ConflictException("One or more of these players already has a main agent.");
            }
            linked.add(candidate.view());
            log.info("Link created: account={} subject={} club={} via=EMAIL_MATCH main=true",
                    caller.getId(), profile.getPersonId(), profile.getClubId());
        }
        linked.sort(Comparator.comparing(MatchedPlayer::firstName));
        return new ConfirmLinksResultDto(linkMapper.toDtos(linked));
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<OwnMatch> findOwnMatch(String verifiedEmail, UUID callerPersonId, String ref) {
        Person caller = personRepository.findById(callerPersonId).orElse(null);
        return candidates(verifiedEmail, caller).stream()
                .filter(c -> c.view().ref().equals(ref))
                .findFirst()
                .map(c -> new OwnMatch(c.profile().getId(), c.profile().getClubId()));
    }

    private List<MatchCandidate> candidates(String email, Person caller) {
        UUID callerId = caller == null ? NO_PERSON : caller.getId();
        List<PlayerProfile> profiles = playerProfileRepository.findMatchesByEmail(email, callerId);
        if (profiles.isEmpty()) {
            return List.of();
        }
        Set<UUID> subjectIds = profiles.stream().map(PlayerProfile::getPersonId).collect(Collectors.toSet());

        // already held by the caller: hidden
        Set<String> held = caller == null
                ? Set.of()
                : personLinkRepository
                        .findByAccountAndSubjects(callerId, PersonLinkStatus.ACTIVE, subjectIds)
                        .stream()
                        .map(l -> key(l.getSubjectPersonId(), l.getClubId()))
                        .collect(Collectors.toSet());

        Map<UUID, Person> persons = personRepository.findAllById(subjectIds).stream()
                .collect(Collectors.toMap(Person::getId, p -> p));

        List<PersonLink> mains = personLinkRepository.findActiveMains(subjectIds);
        Map<UUID, Person> mainAccounts = personRepository
                .findAllById(mains.stream().map(PersonLink::getAccountPersonId).filter(java.util.Objects::nonNull).toList())
                .stream()
                .collect(Collectors.toMap(Person::getId, p -> p));
        Map<String, PersonLink> mainByKey = mains.stream()
                .collect(Collectors.toMap(l -> key(l.getSubjectPersonId(), l.getClubId()), l -> l, (a, b) -> a));

        List<PlayerProfile> shown = profiles.stream()
                .filter(p -> !held.contains(key(p.getPersonId(), p.getClubId())))
                .toList();
        Map<UUID, String> clubNames = clubRepository
                .findAllById(shown.stream().map(PlayerProfile::getClubId).collect(Collectors.toSet()))
                .stream()
                .collect(Collectors.toMap(Club::getId, Club::getName));
        Map<UUID, String> groups = groupLabels.groupLabels(shown);

        LocalDate today = LocalDate.now();
        return shown.stream()
                .map(profile -> {
                    Person subject = persons.get(profile.getPersonId());
                    PersonLink main = mainByKey.get(key(profile.getPersonId(), profile.getClubId()));
                    String mainEmail = main == null || main.getAccountPersonId() == null
                            ? null
                            : mainAccounts.containsKey(main.getAccountPersonId())
                                    ? mainAccounts.get(main.getAccountPersonId()).getEmail()
                                    : null;
                    LocalDate dob = subject.getDateOfBirth();
                    String last = subject.getLastName() == null ? "" : subject.getLastName().trim();
                    MatchedPlayer view = new MatchedPlayer(
                            profile.getId().toString(),
                            profile.getClubId(),
                            subject.getFirstName(),
                            last.isEmpty() ? "" : last.substring(0, last.offsetByCodePoints(0, 1)).toUpperCase(),
                            clubNames.get(profile.getClubId()),
                            groups.get(profile.getId()),
                            dob == null ? null : dob.getYear(),
                            dob != null && Period.between(dob, today).getYears() >= ADULT_AGE,
                            mainEmail);
                    return new MatchCandidate(profile, main != null, view);
                })
                .sorted(Comparator.comparing((MatchCandidate c) -> String.valueOf(c.view().clubName()))
                        .thenComparing(c -> c.view().firstName()))
                .toList();
    }

    private static String key(UUID subjectPersonId, UUID clubId) {
        return subjectPersonId + "|" + clubId;
    }
}
