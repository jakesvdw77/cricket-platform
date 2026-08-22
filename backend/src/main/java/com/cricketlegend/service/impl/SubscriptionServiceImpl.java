package com.cricketlegend.service.impl;

import com.cricketlegend.domain.Club;
import com.cricketlegend.domain.Person;
import com.cricketlegend.domain.Product;
import com.cricketlegend.domain.ProductStatus;
import com.cricketlegend.domain.RoleAssignment;
import com.cricketlegend.domain.RoleAssignmentRole;
import com.cricketlegend.domain.ScopeType;
import com.cricketlegend.domain.Subscription;
import com.cricketlegend.domain.SubscriptionOwnerType;
import com.cricketlegend.domain.SubscriptionStatus;
import com.cricketlegend.dto.ClubSummaryDto;
import com.cricketlegend.dto.CreateSubscriptionRequest;
import com.cricketlegend.dto.PersonDto;
import com.cricketlegend.dto.ProductSummaryDto;
import com.cricketlegend.dto.SubscriptionDto;
import com.cricketlegend.dto.UpdateSubscriptionRequest;
import com.cricketlegend.exception.DuplicateActiveSubscriptionException;
import com.cricketlegend.exception.EmailDeliveryException;
import com.cricketlegend.exception.InvalidStatusTransitionException;
import com.cricketlegend.exception.KeycloakProvisioningException;
import com.cricketlegend.exception.NotFoundException;
import com.cricketlegend.exception.ProductNotActiveException;
import com.cricketlegend.exception.ValidationException;
import com.cricketlegend.mapper.ClubMapper;
import com.cricketlegend.mapper.PersonMapper;
import com.cricketlegend.mapper.ProductMapper;
import com.cricketlegend.mapper.SubscriptionMapper;
import com.cricketlegend.repository.ClubRepository;
import com.cricketlegend.repository.PersonRepository;
import com.cricketlegend.repository.ProductRepository;
import com.cricketlegend.repository.RoleAssignmentRepository;
import com.cricketlegend.repository.SubscriptionRepository;
import com.cricketlegend.service.KeycloakProvisioningService;
import com.cricketlegend.service.PersonService;
import com.cricketlegend.service.SubscriptionService;
import com.cricketlegend.service.SubscriptionWelcomeEmailService;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

/**
 * Business rules per docs/specs/009-subscriptions.md: ownerType is CLUB-only (SECTION doesn't
 * exist in code yet), productId must reference an ACTIVE Product on both create and update, at
 * most one ACTIVE Subscription per owner (DB partial-unique-index-backed, pre-checked here for a
 * clean 409), update mutates the existing row rather than creating a new one, and cancel is a
 * one-way ACTIVE -> CANCELLED transition.
 */
@Service
public class SubscriptionServiceImpl implements SubscriptionService {

    private static final Logger log = LoggerFactory.getLogger(SubscriptionServiceImpl.class);

    private final SubscriptionRepository subscriptionRepository;
    private final ClubRepository clubRepository;
    private final ProductRepository productRepository;
    private final PersonRepository personRepository;
    private final PersonService personService;
    private final SubscriptionMapper subscriptionMapper;
    private final ClubMapper clubMapper;
    private final ProductMapper productMapper;
    private final PersonMapper personMapper;
    private final RoleAssignmentRepository roleAssignmentRepository;
    private final KeycloakProvisioningService keycloakProvisioningService;
    private final SubscriptionWelcomeEmailService subscriptionWelcomeEmailService;

    public SubscriptionServiceImpl(
            SubscriptionRepository subscriptionRepository,
            ClubRepository clubRepository,
            ProductRepository productRepository,
            PersonRepository personRepository,
            PersonService personService,
            SubscriptionMapper subscriptionMapper,
            ClubMapper clubMapper,
            ProductMapper productMapper,
            PersonMapper personMapper,
            RoleAssignmentRepository roleAssignmentRepository,
            KeycloakProvisioningService keycloakProvisioningService,
            SubscriptionWelcomeEmailService subscriptionWelcomeEmailService) {
        this.subscriptionRepository = subscriptionRepository;
        this.clubRepository = clubRepository;
        this.productRepository = productRepository;
        this.personRepository = personRepository;
        this.personService = personService;
        this.subscriptionMapper = subscriptionMapper;
        this.clubMapper = clubMapper;
        this.productMapper = productMapper;
        this.personMapper = personMapper;
        this.roleAssignmentRepository = roleAssignmentRepository;
        this.keycloakProvisioningService = keycloakProvisioningService;
        this.subscriptionWelcomeEmailService = subscriptionWelcomeEmailService;
    }

    @Override
    public SubscriptionDto create(CreateSubscriptionRequest request) {
        if (request.ownerType() != SubscriptionOwnerType.CLUB) {
            throw new ValidationException("ownerType must be CLUB: " + request.ownerType());
        }

        Club club = findClubOrThrow(request.ownerId());
        Product product = findActiveProductOrThrow(request.productId());

        if (subscriptionRepository.existsByOwnerTypeAndOwnerIdAndStatus(
                SubscriptionOwnerType.CLUB, request.ownerId(), SubscriptionStatus.ACTIVE)) {
            throw new DuplicateActiveSubscriptionException(
                    "Club already has an active subscription: " + request.ownerId());
        }

        Person responsiblePerson = personService.findOrCreatePerson(
                request.responsiblePerson().firstName(),
                request.responsiblePerson().lastName(),
                request.responsiblePerson().email(),
                request.responsiblePerson().phone());

        Subscription subscription = subscriptionMapper.toEntity(request);
        subscription.setResponsiblePersonId(responsiblePerson.getId());
        subscription = subscriptionRepository.save(subscription);

        grantClubAdminAccess(responsiblePerson, subscription.getOwnerId());
        provisionKeycloakAccountIfNeeded(responsiblePerson, subscription);
        sendWelcomeEmailBestEffort(responsiblePerson, subscription, club, product);

        return toDto(subscription, club, product, responsiblePerson);
    }

    private void grantClubAdminAccess(Person person, UUID clubId) {
        boolean alreadyGranted = roleAssignmentRepository.existsByPersonIdAndRoleAndScopeTypeAndScopeId(
                person.getId(), RoleAssignmentRole.CLUB_ADMIN, ScopeType.CLUB, clubId);
        if (!alreadyGranted) {
            roleAssignmentRepository.save(RoleAssignment.builder()
                    .personId(person.getId())
                    .role(RoleAssignmentRole.CLUB_ADMIN)
                    .scopeType(ScopeType.CLUB)
                    .scopeId(clubId)
                    .build());
        }
    }

    private void provisionKeycloakAccountIfNeeded(Person person, Subscription subscription) {
        if (person.getKeycloakUserId() != null || person.getKeycloakProvisionedAt() != null) {
            return; // already has, or already sent, an account — see judgment call #4 / Data Model Changes
        }
        try {
            keycloakProvisioningService.provisionAccount(person);
            person.setKeycloakProvisionedAt(Instant.now());
            personRepository.save(person);
        } catch (KeycloakProvisioningException e) {
            // Judgment call #2 — never fails Subscription creation over this. Subscription and its
            // RoleAssignment grant are already durably saved above; keycloakProvisionedAt stays null,
            // the one honest "not yet provisioned" signal for a future retry mechanism (not built).
            log.error(
                    "Keycloak provisioning failed for person {} (subscription {}, club {}): {}",
                    person.getId(), subscription.getId(), subscription.getOwnerId(), e.getMessage(), e);
        }
    }

    private void sendWelcomeEmailBestEffort(Person person, Subscription subscription, Club club, Product product) {
        // Fires on every create() call, unlike provisionKeycloakAccountIfNeeded's one-time guard -
        // this email's content (product, dates, club) is specific to THIS Subscription. A person
        // responsible for a second Club's Subscription gets a second, differently-scoped welcome
        // email, not silently none - see judgment call #2.
        try {
            subscriptionWelcomeEmailService.sendWelcomeEmail(person, subscription, club, product);
        } catch (EmailDeliveryException e) {
            // Same best-effort posture 016 already established for Keycloak provisioning (judgment
            // call #2 there) - an SMTP outage never fails Subscription creation. No retry mechanism,
            // no admin-visible "email failed" indicator - logged only, same accepted gap (see
            // judgment call #3 / Non-goals / Rollout Notes).
            log.error(
                    "Welcome email failed to send for person {} (subscription {}, club {}): {}",
                    person.getId(), subscription.getId(), subscription.getOwnerId(), e.getMessage(), e);
        }
    }

    @Override
    public SubscriptionDto get(UUID id) {
        Subscription subscription = findOrThrow(id);
        Club club = findClubOrThrow(subscription.getOwnerId());
        Product product = findProductOrThrow(subscription.getProductId());
        Person responsiblePerson = findPersonOrThrow(subscription.getResponsiblePersonId());
        return toDto(subscription, club, product, responsiblePerson);
    }

    @Override
    public Page<SubscriptionDto> list(String search, Pageable pageable) {
        Page<Subscription> page = isSortedByClubName(pageable)
                // Ordering is baked into this query's JPQL (see its Javadoc) — pass an unsorted
                // Pageable so Spring Data doesn't also try to translate "club.name" against
                // Subscription's own attributes, which would fail (it isn't a JPA relationship).
                ? subscriptionRepository.searchOrderByClubNameAsc(
                        search, PageRequest.of(pageable.getPageNumber(), pageable.getPageSize()))
                : subscriptionRepository.search(search, withDefaultSort(pageable));
        return mapToDtoPage(page);
    }

    private boolean isSortedByClubName(Pageable pageable) {
        return pageable.getSort().stream().anyMatch(order -> "club.name".equalsIgnoreCase(order.getProperty()));
    }

    private Page<SubscriptionDto> mapToDtoPage(Page<Subscription> page) {
        List<Subscription> subscriptions = page.getContent();

        Map<UUID, Club> clubsById =
                clubRepository
                        .findAllById(subscriptions.stream().map(Subscription::getOwnerId).distinct().toList())
                        .stream()
                        .collect(Collectors.toMap(Club::getId, Function.identity()));
        Map<UUID, Product> productsById =
                productRepository
                        .findAllById(subscriptions.stream().map(Subscription::getProductId).distinct().toList())
                        .stream()
                        .collect(Collectors.toMap(Product::getId, Function.identity()));
        Map<UUID, Person> personsById =
                personRepository
                        .findAllById(
                                subscriptions.stream().map(Subscription::getResponsiblePersonId).distinct().toList())
                        .stream()
                        .collect(Collectors.toMap(Person::getId, Function.identity()));

        return page.map(subscription -> toDto(
                subscription,
                clubsById.get(subscription.getOwnerId()),
                productsById.get(subscription.getProductId()),
                personsById.get(subscription.getResponsiblePersonId())));
    }

    private Pageable withDefaultSort(Pageable pageable) {
        if (pageable.getSort().isSorted()) {
            return pageable;
        }
        return PageRequest.of(
                pageable.getPageNumber(), pageable.getPageSize(), Sort.by("startDate").descending());
    }

    @Override
    public SubscriptionDto update(UUID id, UpdateSubscriptionRequest request) {
        Subscription subscription = findOrThrow(id);
        if (subscription.getStatus() == SubscriptionStatus.CANCELLED) {
            throw new InvalidStatusTransitionException("Cannot update a cancelled subscription: " + id);
        }
        // The ACTIVE check only applies to an actual product *change* — per the spec, "you can't
        // move a Club onto a non-active product," not "you can't touch a subscription whose
        // current product has since been retired." Re-validating an unchanged productId would
        // permanently block editing dates on any subscription after its product is retired.
        boolean productUnchanged = request.productId().equals(subscription.getProductId());
        Product product = productUnchanged
                ? findProductOrThrow(request.productId())
                : findActiveProductOrThrow(request.productId());

        subscription.setProductId(request.productId());
        // startDate is NOT NULL at the DB level; a null request value means "leave unchanged"
        // rather than nulling out a required column. endDate has no such constraint — null there
        // is a meaningful "ongoing, no fixed end" value, so it's always set as-is.
        if (request.startDate() != null) {
            subscription.setStartDate(request.startDate());
        }
        subscription.setEndDate(request.endDate());
        subscription = subscriptionRepository.save(subscription);

        Club club = findClubOrThrow(subscription.getOwnerId());
        Person responsiblePerson = findPersonOrThrow(subscription.getResponsiblePersonId());
        return toDto(subscription, club, product, responsiblePerson);
    }

    @Override
    public SubscriptionDto cancel(UUID id) {
        Subscription subscription = findOrThrow(id);
        if (subscription.getStatus() == SubscriptionStatus.CANCELLED) {
            throw new InvalidStatusTransitionException("Subscription is already cancelled: " + id);
        }
        subscription.setStatus(SubscriptionStatus.CANCELLED);
        subscription = subscriptionRepository.save(subscription);

        Club club = findClubOrThrow(subscription.getOwnerId());
        Product product = findProductOrThrow(subscription.getProductId());
        Person responsiblePerson = findPersonOrThrow(subscription.getResponsiblePersonId());
        return toDto(subscription, club, product, responsiblePerson);
    }

    private SubscriptionDto toDto(Subscription subscription, Club club, Product product, Person responsiblePerson) {
        ClubSummaryDto clubSummary = club == null ? null : clubMapper.toSummaryDto(club);
        ProductSummaryDto productSummary = product == null ? null : productMapper.toSummaryDto(product);
        PersonDto personDto = responsiblePerson == null ? null : personMapper.toDto(responsiblePerson);
        return subscriptionMapper.toDto(subscription, clubSummary, productSummary, personDto);
    }

    private Subscription findOrThrow(UUID id) {
        return subscriptionRepository
                .findById(id)
                .orElseThrow(() -> new NotFoundException("Subscription not found: " + id));
    }

    private Club findClubOrThrow(UUID id) {
        return clubRepository.findById(id).orElseThrow(() -> new NotFoundException("Club not found: " + id));
    }

    private Product findProductOrThrow(UUID id) {
        return productRepository
                .findById(id)
                .orElseThrow(() -> new NotFoundException("Product not found: " + id));
    }

    private Person findPersonOrThrow(UUID id) {
        return personRepository.findById(id).orElseThrow(() -> new NotFoundException("Person not found: " + id));
    }

    private Product findActiveProductOrThrow(UUID id) {
        Product product = findProductOrThrow(id);
        if (product.getStatus() != ProductStatus.ACTIVE) {
            throw new ProductNotActiveException("Product is not active: " + id);
        }
        return product;
    }
}
