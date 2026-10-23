package com.cricketlegend.service.impl;

import com.cricketlegend.domain.Club;
import com.cricketlegend.domain.ClubStatus;
import com.cricketlegend.domain.LinkRequest;
import com.cricketlegend.domain.LinkRequestStatus;
import com.cricketlegend.domain.Person;
import com.cricketlegend.dto.CreateLinkRequestRequest;
import com.cricketlegend.dto.LinkRequestReceivedDto;
import com.cricketlegend.dto.MyLinkRequestDto;
import com.cricketlegend.exception.ConflictException;
import com.cricketlegend.exception.InvalidStatusTransitionException;
import com.cricketlegend.exception.NotFoundException;
import com.cricketlegend.exception.ValidationException;
import com.cricketlegend.mapper.LinkRequestMapper;
import com.cricketlegend.mapper.LinkRequestMapper;
import com.cricketlegend.repository.ClubRepository;
import com.cricketlegend.repository.LinkRequestRepository;
import com.cricketlegend.repository.PersonRepository;
import com.cricketlegend.service.LinkService;
import com.cricketlegend.service.MyLinkRequestService;
import com.cricketlegend.service.support.LinkAttemptLimiter;
import com.cricketlegend.service.support.OwnMatch;
import com.cricketlegend.service.support.VerifiedEmail;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * docs/specs/119, link requests from the requester's side. A request is untrusted input waiting for a human: nothing
 * here looks the typed player up, and the reply never depends on whether the club holds one (no enumeration).
 */
@Service
public class MyLinkRequestServiceImpl implements MyLinkRequestService {

    private static final Logger log = LoggerFactory.getLogger(MyLinkRequestServiceImpl.class);
    private static final String RECEIVED = "Thanks, the club will review this";
    private static final int MAX_PENDING_PER_CLUB = 3;
    private static final LocalDate EARLIEST_DATE_OF_BIRTH = LocalDate.of(1900, 1, 1);

    private final PersonRepository personRepository;
    private final ClubRepository clubRepository;
    private final LinkRequestRepository linkRequestRepository;
    private final LinkService linkService;
    private final LinkAttemptLimiter limiter;
    private final LinkRequestMapper mapper;

    public MyLinkRequestServiceImpl(
            PersonRepository personRepository,
            ClubRepository clubRepository,
            LinkRequestRepository linkRequestRepository,
            LinkService linkService,
            LinkAttemptLimiter limiter,
            LinkRequestMapper mapper) {
        this.personRepository = personRepository;
        this.clubRepository = clubRepository;
        this.linkRequestRepository = linkRequestRepository;
        this.linkService = linkService;
        this.limiter = limiter;
        this.mapper = mapper;
    }

    @Override
    @Transactional
    public LinkRequestReceivedDto create(Authentication authentication, Jwt jwt, CreateLinkRequestRequest request) {
        String email = VerifiedEmail.require(jwt);
        Person caller = personRepository
                .findByKeycloakUserId(authentication.getName())
                .orElseThrow(() -> new ValidationException("Register before asking a club to link a player."));
        LocalDate dob = request.dateOfBirth();
        if (dob.isAfter(LocalDate.now()) || dob.isBefore(EARLIEST_DATE_OF_BIRTH)) {
            throw new ValidationException("Enter the player's real date of birth.");
        }
        Club club = clubRepository
                .findById(request.clubId())
                .filter(c -> c.getStatus() == ClubStatus.ACTIVE)
                .orElseThrow(() -> new NotFoundException("Club not found: " + request.clubId()));

        UUID targetProfileId = null;
        if (request.targetPlayerRef() != null && !request.targetPlayerRef().isBlank()) {
            OwnMatch own = linkService
                    .findOwnMatch(email, caller.getId(), request.targetPlayerRef().trim())
                    .filter(m -> m.clubId().equals(club.getId()))
                    .orElseThrow(() -> new ValidationException("That player cannot be requested."));
            targetProfileId = own.profileId();
        }

        limiter.countRequest(caller.getId()); // 10 a day (429)

        String firstName = request.firstName().trim();
        String lastName = request.lastName().trim();
        boolean repeat = linkRequestRepository
                .existsByAccountPersonIdAndClubIdAndStatusAndTypedDateOfBirthAndTypedFirstNameIgnoreCaseAndTypedLastNameIgnoreCase(
                        caller.getId(), club.getId(), LinkRequestStatus.PENDING, dob, firstName, lastName);
        if (repeat) {
            return new LinkRequestReceivedDto(RECEIVED); // already waiting: nothing new, same reply
        }
        if (linkRequestRepository.countByAccountPersonIdAndClubIdAndStatus(
                        caller.getId(), club.getId(), LinkRequestStatus.PENDING)
                >= MAX_PENDING_PER_CLUB) {
            throw new ConflictException("You already have " + MAX_PENDING_PER_CLUB
                    + " requests waiting at this club. Wait for a decision or cancel one.");
        }

        String message = request.message() == null || request.message().isBlank() ? null : request.message().trim();
        LinkRequest saved = linkRequestRepository.save(LinkRequest.builder()
                .accountPersonId(caller.getId())
                .clubId(club.getId())
                .typedFirstName(firstName)
                .typedLastName(lastName)
                .typedDateOfBirth(dob)
                .targetPlayerProfileId(targetProfileId)
                .message(message)
                .contactNumber(request.contactNumber().trim())
                .status(LinkRequestStatus.PENDING)
                .build());
        log.info("Link request created: request={} account={} club={} withTarget={}",
                saved.getId(), caller.getId(), club.getId(), targetProfileId != null);
        return new LinkRequestReceivedDto(RECEIVED);
    }

    @Override
    @Transactional(readOnly = true)
    public List<MyLinkRequestDto> list(Authentication authentication) {
        Person caller = personRepository.findByKeycloakUserId(authentication.getName()).orElse(null);
        if (caller == null) {
            return List.of();
        }
        List<LinkRequest> requests = linkRequestRepository.findByAccountPersonIdOrderByCreatedAtDesc(caller.getId());
        Map<UUID, String> clubNames = clubRepository
                .findAllById(requests.stream().map(LinkRequest::getClubId).collect(Collectors.toSet()))
                .stream()
                .collect(Collectors.toMap(Club::getId, Club::getName));
        return requests.stream()
                .map(r -> mapper.toMyDto(r, clubNames.get(r.getClubId())))
                .toList();
    }

    @Override
    @Transactional
    public void cancel(Authentication authentication, UUID requestId) {
        Person caller = personRepository
                .findByKeycloakUserId(authentication.getName())
                .orElseThrow(() -> new NotFoundException("Link request not found: " + requestId));
        LinkRequest request = linkRequestRepository
                .findById(requestId)
                .filter(r -> r.getAccountPersonId().equals(caller.getId()))
                .orElseThrow(() -> new NotFoundException("Link request not found: " + requestId));
        if (request.getStatus() != LinkRequestStatus.PENDING) {
            throw new InvalidStatusTransitionException("This request has already been decided or cancelled.");
        }
        request.setStatus(LinkRequestStatus.CANCELLED);
        linkRequestRepository.save(request);
        log.info("Link request cancelled: request={} account={} club={}", request.getId(), caller.getId(), request.getClubId());
    }
}
