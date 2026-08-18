package com.cricketlegend.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.cricketlegend.domain.Club;
import com.cricketlegend.domain.ClubStatus;
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
import com.cricketlegend.service.impl.SubscriptionServiceImpl;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;

/**
 * Unit tests for SubscriptionServiceImpl's business rules from
 * docs/specs/009-subscriptions.md: ownerType is CLUB-only, missing Club/Product 404s, a
 * non-ACTIVE Product is rejected on both create and update, at most one ACTIVE Subscription per
 * owner, update mutates the existing row in place (including its startDate-null-means-unchanged
 * vs endDate-always-set-as-is distinction — see SubscriptionServiceImpl.update()'s own comment),
 * cancel is a one-way ACTIVE-&gt;CANCELLED transition, and list defaults sort to startDate
 * descending when unsorted. Per docs/standards/backend.md, every @Service method carrying a
 * business rule ships a unit test in the same change.
 */
@ExtendWith(MockitoExtension.class)
class SubscriptionServiceImplTest {

    @Mock
    private SubscriptionRepository subscriptionRepository;

    @Mock
    private ClubRepository clubRepository;

    @Mock
    private ProductRepository productRepository;

    @Mock
    private SubscriptionMapper subscriptionMapper;

    @Mock
    private ClubMapper clubMapper;

    @Mock
    private ProductMapper productMapper;

    private SubscriptionServiceImpl subscriptionService;

    @BeforeEach
    void setUp() {
        subscriptionService = new SubscriptionServiceImpl(
                subscriptionRepository, clubRepository, productRepository, subscriptionMapper, clubMapper,
                productMapper);
    }

    private Club activeClub(UUID id) {
        Club club = new Club();
        club.setId(id);
        club.setName("Riverside CC");
        club.setSlug("riverside-cc");
        club.setStatus(ClubStatus.ACTIVE);
        return club;
    }

    private Product product(UUID id, ProductStatus status) {
        Product product = new Product();
        product.setId(id);
        product.setCode("CLUB_STANDARD");
        product.setName("Club Standard");
        product.setStatus(status);
        return product;
    }

    private Subscription subscription(UUID id, UUID ownerId, UUID productId, SubscriptionStatus status) {
        Subscription subscription = new Subscription();
        subscription.setId(id);
        subscription.setOwnerType(SubscriptionOwnerType.CLUB);
        subscription.setOwnerId(ownerId);
        subscription.setProductId(productId);
        subscription.setStatus(status);
        subscription.setStartDate(LocalDate.of(2026, 1, 1));
        return subscription;
    }

    private SubscriptionDto dummyDto() {
        return new SubscriptionDto(
                UUID.randomUUID(), SubscriptionOwnerType.CLUB, UUID.randomUUID(), null, null,
                SubscriptionStatus.ACTIVE, LocalDate.now(), null, null, null, null);
    }

    @Test
    void createWithOwnerTypeOtherThanClubThrowsValidationException() {
        CreateSubscriptionRequest request =
                new CreateSubscriptionRequest(SubscriptionOwnerType.SECTION, UUID.randomUUID(), UUID.randomUUID(),
                        null, null);

        assertThatThrownBy(() -> subscriptionService.create(request)).isInstanceOf(ValidationException.class);

        verify(clubRepository, never()).findById(any());
        verify(subscriptionRepository, never()).save(any());
    }

    @Test
    void createWithMissingClubThrowsNotFoundException() {
        UUID ownerId = UUID.randomUUID();
        CreateSubscriptionRequest request =
                new CreateSubscriptionRequest(SubscriptionOwnerType.CLUB, ownerId, UUID.randomUUID(), null, null);
        when(clubRepository.findById(ownerId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> subscriptionService.create(request)).isInstanceOf(NotFoundException.class);

        verify(subscriptionRepository, never()).save(any());
    }

    @Test
    void createAgainstNonActiveProductThrowsProductNotActiveException() {
        UUID ownerId = UUID.randomUUID();
        UUID productId = UUID.randomUUID();
        CreateSubscriptionRequest request =
                new CreateSubscriptionRequest(SubscriptionOwnerType.CLUB, ownerId, productId, null, null);
        when(clubRepository.findById(ownerId)).thenReturn(Optional.of(activeClub(ownerId)));
        when(productRepository.findById(productId)).thenReturn(Optional.of(product(productId, ProductStatus.DRAFT)));

        assertThatThrownBy(() -> subscriptionService.create(request)).isInstanceOf(ProductNotActiveException.class);

        verify(subscriptionRepository, never()).save(any());
    }

    @Test
    void createWithExistingActiveSubscriptionForSameOwnerThrowsDuplicateActiveSubscriptionException() {
        UUID ownerId = UUID.randomUUID();
        UUID productId = UUID.randomUUID();
        CreateSubscriptionRequest request =
                new CreateSubscriptionRequest(SubscriptionOwnerType.CLUB, ownerId, productId, null, null);
        when(clubRepository.findById(ownerId)).thenReturn(Optional.of(activeClub(ownerId)));
        when(productRepository.findById(productId))
                .thenReturn(Optional.of(product(productId, ProductStatus.ACTIVE)));
        when(subscriptionRepository.existsByOwnerTypeAndOwnerIdAndStatus(
                SubscriptionOwnerType.CLUB, ownerId, SubscriptionStatus.ACTIVE))
                .thenReturn(true);

        assertThatThrownBy(() -> subscriptionService.create(request))
                .isInstanceOf(DuplicateActiveSubscriptionException.class);

        verify(subscriptionRepository, never()).save(any());
    }

    @Test
    void createWithNoExistingActiveSubscriptionSavesAndReturnsDto() {
        UUID ownerId = UUID.randomUUID();
        UUID productId = UUID.randomUUID();
        CreateSubscriptionRequest request =
                new CreateSubscriptionRequest(SubscriptionOwnerType.CLUB, ownerId, productId, null, null);
        Club club = activeClub(ownerId);
        Product product = product(productId, ProductStatus.ACTIVE);
        Subscription entity = subscription(UUID.randomUUID(), ownerId, productId, SubscriptionStatus.ACTIVE);

        when(clubRepository.findById(ownerId)).thenReturn(Optional.of(club));
        when(productRepository.findById(productId)).thenReturn(Optional.of(product));
        when(subscriptionRepository.existsByOwnerTypeAndOwnerIdAndStatus(
                SubscriptionOwnerType.CLUB, ownerId, SubscriptionStatus.ACTIVE))
                .thenReturn(false);
        when(subscriptionMapper.toEntity(request)).thenReturn(entity);
        when(subscriptionRepository.save(entity)).thenReturn(entity);
        when(clubMapper.toSummaryDto(club)).thenReturn(new ClubSummaryDto(ownerId, "Riverside CC", "riverside-cc"));
        when(productMapper.toSummaryDto(product)).thenReturn(new ProductSummaryDto(productId, "Club Standard", "CLUB_STANDARD"));
        when(subscriptionMapper.toDto(any(), any(), any())).thenReturn(dummyDto());

        SubscriptionDto result = subscriptionService.create(request);

        assertThat(result).isNotNull();
        verify(subscriptionRepository).save(entity);
    }

    @Test
    void updateChangesProductIdOnTheExistingRowRatherThanCreatingOne() {
        UUID id = UUID.randomUUID();
        UUID ownerId = UUID.randomUUID();
        UUID oldProductId = UUID.randomUUID();
        UUID newProductId = UUID.randomUUID();
        Subscription existing = subscription(id, ownerId, oldProductId, SubscriptionStatus.ACTIVE);
        Club club = activeClub(ownerId);
        Product newProduct = product(newProductId, ProductStatus.ACTIVE);

        when(subscriptionRepository.findById(id)).thenReturn(Optional.of(existing));
        when(productRepository.findById(newProductId)).thenReturn(Optional.of(newProduct));
        when(subscriptionRepository.save(existing)).thenReturn(existing);
        when(clubRepository.findById(ownerId)).thenReturn(Optional.of(club));
        when(clubMapper.toSummaryDto(club)).thenReturn(new ClubSummaryDto(ownerId, "Riverside CC", "riverside-cc"));
        when(productMapper.toSummaryDto(newProduct))
                .thenReturn(new ProductSummaryDto(newProductId, "Club Standard", "CLUB_STANDARD"));
        when(subscriptionMapper.toDto(any(), any(), any())).thenReturn(dummyDto());

        UpdateSubscriptionRequest request = new UpdateSubscriptionRequest(newProductId, null, null);

        subscriptionService.update(id, request);

        assertThat(existing.getId()).isEqualTo(id);
        assertThat(existing.getProductId()).isEqualTo(newProductId);
        verify(subscriptionRepository).save(existing);
    }

    @Test
    void updateAgainstNonActiveProductThrowsProductNotActiveException() {
        UUID id = UUID.randomUUID();
        UUID ownerId = UUID.randomUUID();
        UUID productId = UUID.randomUUID();
        UUID newProductId = UUID.randomUUID();
        Subscription existing = subscription(id, ownerId, productId, SubscriptionStatus.ACTIVE);

        when(subscriptionRepository.findById(id)).thenReturn(Optional.of(existing));
        when(productRepository.findById(newProductId))
                .thenReturn(Optional.of(product(newProductId, ProductStatus.RETIRED)));

        UpdateSubscriptionRequest request = new UpdateSubscriptionRequest(newProductId, null, null);

        assertThatThrownBy(() -> subscriptionService.update(id, request))
                .isInstanceOf(ProductNotActiveException.class);

        verify(subscriptionRepository, never()).save(any());
        assertThat(existing.getProductId()).isEqualTo(productId);
    }

    @Test
    void updateOnMissingSubscriptionThrowsNotFoundException() {
        UUID id = UUID.randomUUID();
        when(subscriptionRepository.findById(id)).thenReturn(Optional.empty());

        UpdateSubscriptionRequest request = new UpdateSubscriptionRequest(UUID.randomUUID(), null, null);

        assertThatThrownBy(() -> subscriptionService.update(id, request)).isInstanceOf(NotFoundException.class);
    }

    @Test
    void updateWithNullStartDateLeavesTheExistingStartDateUnchanged() {
        UUID id = UUID.randomUUID();
        UUID ownerId = UUID.randomUUID();
        UUID productId = UUID.randomUUID();
        Subscription existing = subscription(id, ownerId, productId, SubscriptionStatus.ACTIVE);
        LocalDate originalStartDate = existing.getStartDate();
        Club club = activeClub(ownerId);
        Product product = product(productId, ProductStatus.ACTIVE);

        when(subscriptionRepository.findById(id)).thenReturn(Optional.of(existing));
        when(productRepository.findById(productId)).thenReturn(Optional.of(product));
        when(subscriptionRepository.save(existing)).thenReturn(existing);
        when(clubRepository.findById(ownerId)).thenReturn(Optional.of(club));
        when(clubMapper.toSummaryDto(club)).thenReturn(new ClubSummaryDto(ownerId, "Riverside CC", "riverside-cc"));
        when(productMapper.toSummaryDto(product))
                .thenReturn(new ProductSummaryDto(productId, "Club Standard", "CLUB_STANDARD"));
        when(subscriptionMapper.toDto(any(), any(), any())).thenReturn(dummyDto());

        // startDate omitted (null) — per SubscriptionServiceImpl.update()'s comment, a NOT NULL
        // DB column can't be nulled out, so a null request value means "leave unchanged".
        UpdateSubscriptionRequest request = new UpdateSubscriptionRequest(productId, null, LocalDate.of(2027, 6, 1));

        subscriptionService.update(id, request);

        assertThat(existing.getStartDate()).isEqualTo(originalStartDate);
        // endDate has no such constraint — always set as-is, including to a real value here.
        assertThat(existing.getEndDate()).isEqualTo(LocalDate.of(2027, 6, 1));
    }

    @Test
    void updateWithNullEndDateClearsAnyExistingEndDateBackToOngoing() {
        UUID id = UUID.randomUUID();
        UUID ownerId = UUID.randomUUID();
        UUID productId = UUID.randomUUID();
        Subscription existing = subscription(id, ownerId, productId, SubscriptionStatus.ACTIVE);
        existing.setEndDate(LocalDate.of(2026, 12, 31));
        Club club = activeClub(ownerId);
        Product product = product(productId, ProductStatus.ACTIVE);

        when(subscriptionRepository.findById(id)).thenReturn(Optional.of(existing));
        when(productRepository.findById(productId)).thenReturn(Optional.of(product));
        when(subscriptionRepository.save(existing)).thenReturn(existing);
        when(clubRepository.findById(ownerId)).thenReturn(Optional.of(club));
        when(clubMapper.toSummaryDto(club)).thenReturn(new ClubSummaryDto(ownerId, "Riverside CC", "riverside-cc"));
        when(productMapper.toSummaryDto(product))
                .thenReturn(new ProductSummaryDto(productId, "Club Standard", "CLUB_STANDARD"));
        when(subscriptionMapper.toDto(any(), any(), any())).thenReturn(dummyDto());

        // endDate explicitly null in the request: unlike startDate, this IS applied (null means
        // "ongoing", a meaningful value for the nullable column) — see the service's own comment.
        UpdateSubscriptionRequest request = new UpdateSubscriptionRequest(productId, LocalDate.of(2026, 2, 1), null);

        subscriptionService.update(id, request);

        assertThat(existing.getStartDate()).isEqualTo(LocalDate.of(2026, 2, 1));
        assertThat(existing.getEndDate()).isNull();
    }

    @Test
    void cancelOnActiveSubscriptionTransitionsToCancelled() {
        UUID id = UUID.randomUUID();
        UUID ownerId = UUID.randomUUID();
        UUID productId = UUID.randomUUID();
        Subscription existing = subscription(id, ownerId, productId, SubscriptionStatus.ACTIVE);
        Club club = activeClub(ownerId);
        Product product = product(productId, ProductStatus.ACTIVE);

        when(subscriptionRepository.findById(id)).thenReturn(Optional.of(existing));
        when(subscriptionRepository.save(existing)).thenReturn(existing);
        when(clubRepository.findById(ownerId)).thenReturn(Optional.of(club));
        when(productRepository.findById(productId)).thenReturn(Optional.of(product));
        when(clubMapper.toSummaryDto(club)).thenReturn(new ClubSummaryDto(ownerId, "Riverside CC", "riverside-cc"));
        when(productMapper.toSummaryDto(product))
                .thenReturn(new ProductSummaryDto(productId, "Club Standard", "CLUB_STANDARD"));
        when(subscriptionMapper.toDto(any(), any(), any())).thenReturn(dummyDto());

        subscriptionService.cancel(id);

        assertThat(existing.getStatus()).isEqualTo(SubscriptionStatus.CANCELLED);
    }

    @Test
    void cancelOnAlreadyCancelledSubscriptionThrowsInvalidStatusTransitionException() {
        UUID id = UUID.randomUUID();
        Subscription existing =
                subscription(id, UUID.randomUUID(), UUID.randomUUID(), SubscriptionStatus.CANCELLED);
        when(subscriptionRepository.findById(id)).thenReturn(Optional.of(existing));

        assertThatThrownBy(() -> subscriptionService.cancel(id))
                .isInstanceOf(InvalidStatusTransitionException.class);

        verify(subscriptionRepository, never()).save(any());
    }

    @Test
    void listWithNoCallerSortDefaultsToStartDateDescending() {
        Pageable requested = PageRequest.of(0, 20);
        Pageable expectedEffective = PageRequest.of(0, 20, Sort.by("startDate").descending());
        Page<Subscription> emptyPage = new PageImpl<>(List.of());
        when(subscriptionRepository.search(null, expectedEffective)).thenReturn(emptyPage);

        Page<SubscriptionDto> result = subscriptionService.list(null, requested);

        assertThat(result.getContent()).isEmpty();
        verify(subscriptionRepository).search(null, expectedEffective);
    }

    @Test
    void listPreservesCallerSuppliedSort() {
        Pageable requested = PageRequest.of(0, 20, Sort.by("startDate").ascending());
        Page<Subscription> emptyPage = new PageImpl<>(List.of());
        when(subscriptionRepository.search(null, requested)).thenReturn(emptyPage);

        subscriptionService.list(null, requested);

        verify(subscriptionRepository).search(null, requested);
    }

    @Test
    void getWithMissingSubscriptionThrowsNotFoundException() {
        UUID id = UUID.randomUUID();
        when(subscriptionRepository.findById(id)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> subscriptionService.get(id)).isInstanceOf(NotFoundException.class);
    }
}
