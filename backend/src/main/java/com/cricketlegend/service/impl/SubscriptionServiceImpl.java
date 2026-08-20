package com.cricketlegend.service.impl;

import com.cricketlegend.domain.Club;
import com.cricketlegend.domain.Product;
import com.cricketlegend.domain.ProductStatus;
import com.cricketlegend.domain.Subscription;
import com.cricketlegend.domain.SubscriptionOwnerType;
import com.cricketlegend.domain.SubscriptionStatus;
import com.cricketlegend.dto.ClubSummaryDto;
import com.cricketlegend.dto.CreateSubscriptionRequest;
import com.cricketlegend.dto.ProductSummaryDto;
import com.cricketlegend.dto.SubscriptionDto;
import com.cricketlegend.dto.UpdateSubscriptionRequest;
import com.cricketlegend.exception.DuplicateActiveSubscriptionException;
import com.cricketlegend.exception.InvalidStatusTransitionException;
import com.cricketlegend.exception.NotFoundException;
import com.cricketlegend.exception.ProductNotActiveException;
import com.cricketlegend.exception.ValidationException;
import com.cricketlegend.mapper.ClubMapper;
import com.cricketlegend.mapper.ProductMapper;
import com.cricketlegend.mapper.SubscriptionMapper;
import com.cricketlegend.repository.ClubRepository;
import com.cricketlegend.repository.ProductRepository;
import com.cricketlegend.repository.SubscriptionRepository;
import com.cricketlegend.service.SubscriptionService;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
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

    private final SubscriptionRepository subscriptionRepository;
    private final ClubRepository clubRepository;
    private final ProductRepository productRepository;
    private final SubscriptionMapper subscriptionMapper;
    private final ClubMapper clubMapper;
    private final ProductMapper productMapper;

    public SubscriptionServiceImpl(
            SubscriptionRepository subscriptionRepository,
            ClubRepository clubRepository,
            ProductRepository productRepository,
            SubscriptionMapper subscriptionMapper,
            ClubMapper clubMapper,
            ProductMapper productMapper) {
        this.subscriptionRepository = subscriptionRepository;
        this.clubRepository = clubRepository;
        this.productRepository = productRepository;
        this.subscriptionMapper = subscriptionMapper;
        this.clubMapper = clubMapper;
        this.productMapper = productMapper;
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

        Subscription subscription = subscriptionRepository.save(subscriptionMapper.toEntity(request));
        return toDto(subscription, club, product);
    }

    @Override
    public SubscriptionDto get(UUID id) {
        Subscription subscription = findOrThrow(id);
        Club club = findClubOrThrow(subscription.getOwnerId());
        Product product = findProductOrThrow(subscription.getProductId());
        return toDto(subscription, club, product);
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

        return page.map(subscription -> toDto(
                subscription,
                clubsById.get(subscription.getOwnerId()),
                productsById.get(subscription.getProductId())));
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
        // Unconditional, matching 012's ClubProfileServiceImpl.upsert() full-resource-replace
        // posture applied to this one field — a null request.responsibleContact() clears a
        // previously-set contact, it doesn't leave it untouched.
        subscription.setResponsibleContact(subscriptionMapper.toContact(request.responsibleContact()));
        subscription = subscriptionRepository.save(subscription);

        Club club = findClubOrThrow(subscription.getOwnerId());
        return toDto(subscription, club, product);
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
        return toDto(subscription, club, product);
    }

    private SubscriptionDto toDto(Subscription subscription, Club club, Product product) {
        ClubSummaryDto clubSummary = club == null ? null : clubMapper.toSummaryDto(club);
        ProductSummaryDto productSummary = product == null ? null : productMapper.toSummaryDto(product);
        return subscriptionMapper.toDto(subscription, clubSummary, productSummary);
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

    private Product findActiveProductOrThrow(UUID id) {
        Product product = findProductOrThrow(id);
        if (product.getStatus() != ProductStatus.ACTIVE) {
            throw new ProductNotActiveException("Product is not active: " + id);
        }
        return product;
    }
}
