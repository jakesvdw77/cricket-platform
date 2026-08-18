package com.cricketlegend.repository;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.cricketlegend.AbstractIntegrationTest;
import com.cricketlegend.domain.BillingInterval;
import com.cricketlegend.domain.Club;
import com.cricketlegend.domain.ClubStatus;
import com.cricketlegend.domain.Product;
import com.cricketlegend.domain.ProductStatus;
import com.cricketlegend.domain.Subscription;
import com.cricketlegend.domain.SubscriptionOwnerType;
import com.cricketlegend.domain.SubscriptionStatus;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.transaction.annotation.Transactional;

/**
 * Integration tests for SubscriptionRepository — per docs/standards/backend.md, every custom
 * repository query ships a Testcontainers-backed integration test. Also proves
 * 004-add-subscription.sql applies cleanly alongside 003-add-product.sql (implicit via context
 * boot) and that ux_subscription_active_owner (the partial unique index backing
 * DuplicateActiveSubscriptionException's DB-level defense-in-depth per
 * docs/specs/009-subscriptions.md) actually rejects a second concurrent ACTIVE row for the same
 * owner. Each test runs in its own rolled-back transaction for isolation, since all tests share
 * one Testcontainers Postgres instance for the whole class.
 */
@SpringBootTest
@Import(AbstractIntegrationTest.class)
@Transactional
class SubscriptionRepositoryTest {

    @Autowired
    private SubscriptionRepository subscriptionRepository;

    @Autowired
    private ClubRepository clubRepository;

    @Autowired
    private ProductRepository productRepository;

    @PersistenceContext
    private EntityManager entityManager;

    @Test
    void partialUniqueIndexRejectsASecondActiveSubscriptionForTheSameOwner() {
        Club club = clubRepository.save(newClub("Riverside CC", "riverside-cc"));
        Product product = productRepository.save(newProduct("CLUB_STANDARD"));

        subscriptionRepository.saveAndFlush(newSubscription(club.getId(), product.getId(), SubscriptionStatus.ACTIVE));

        Subscription second = newSubscription(club.getId(), product.getId(), SubscriptionStatus.ACTIVE);

        // saveAndFlush (a repository proxy method, unlike a raw EntityManager.flush()) goes
        // through Spring's PersistenceExceptionTranslationPostProcessor, so the driver-level
        // constraint violation surfaces as the portable DataIntegrityViolationException here.
        assertThatThrownBy(() -> subscriptionRepository.saveAndFlush(second))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void partialUniqueIndexAllowsASecondCancelledSubscriptionForTheSameOwner() {
        Club club = clubRepository.save(newClub("Riverside CC", "riverside-cc"));
        Product product = productRepository.save(newProduct("CLUB_STANDARD"));

        subscriptionRepository.save(newSubscription(club.getId(), product.getId(), SubscriptionStatus.CANCELLED));
        entityManager.flush();

        // A CANCELLED row doesn't participate in the partial index (WHERE status = 'ACTIVE'), so
        // a brand-new ACTIVE row for the same owner is allowed alongside it.
        Subscription active = newSubscription(club.getId(), product.getId(), SubscriptionStatus.ACTIVE);
        Subscription saved = subscriptionRepository.save(active);
        entityManager.flush();

        assertThat(saved.getId()).isNotNull();
        assertThat(subscriptionRepository.findAll()).hasSize(2);
    }

    @Test
    void existsByOwnerTypeAndOwnerIdAndStatusOnlyMatchesTheGivenStatus() {
        Club club = clubRepository.save(newClub("Riverside CC", "riverside-cc"));
        Product product = productRepository.save(newProduct("CLUB_STANDARD"));
        subscriptionRepository.save(newSubscription(club.getId(), product.getId(), SubscriptionStatus.ACTIVE));

        assertThat(subscriptionRepository.existsByOwnerTypeAndOwnerIdAndStatus(
                SubscriptionOwnerType.CLUB, club.getId(), SubscriptionStatus.ACTIVE))
                .isTrue();
        assertThat(subscriptionRepository.existsByOwnerTypeAndOwnerIdAndStatus(
                SubscriptionOwnerType.CLUB, club.getId(), SubscriptionStatus.CANCELLED))
                .isFalse();
        assertThat(subscriptionRepository.existsByOwnerTypeAndOwnerIdAndStatus(
                SubscriptionOwnerType.CLUB, UUID.randomUUID(), SubscriptionStatus.ACTIVE))
                .isFalse();
    }

    @Test
    void searchMatchesTheOwningClubsNameCaseInsensitivelyViaTheJoin() {
        Club riverside = clubRepository.save(newClub("Riverside CC", "riverside-cc"));
        Club oakwood = clubRepository.save(newClub("Oakwood Cricket Club", "oakwood-cc"));
        Product product = productRepository.save(newProduct("CLUB_STANDARD"));
        subscriptionRepository.save(newSubscription(riverside.getId(), product.getId(), SubscriptionStatus.ACTIVE));
        subscriptionRepository.save(newSubscription(oakwood.getId(), product.getId(), SubscriptionStatus.ACTIVE));

        Pageable pageable = PageRequest.of(0, 20);

        Page<Subscription> byLowercaseSubstring = subscriptionRepository.search("riverside", pageable);
        assertThat(byLowercaseSubstring.getContent()).hasSize(1);
        assertThat(byLowercaseSubstring.getContent().get(0).getOwnerId()).isEqualTo(riverside.getId());

        Page<Subscription> byUppercaseSubstring = subscriptionRepository.search("OAKWOOD", pageable);
        assertThat(byUppercaseSubstring.getContent()).hasSize(1);
        assertThat(byUppercaseSubstring.getContent().get(0).getOwnerId()).isEqualTo(oakwood.getId());

        assertThat(subscriptionRepository.search("no-such-club", pageable).getContent()).isEmpty();
    }

    @Test
    void searchWithNullOrBlankReturnsEveryClubOwnedSubscription() {
        Club club = clubRepository.save(newClub("Riverside CC", "riverside-cc"));
        Product product = productRepository.save(newProduct("CLUB_STANDARD"));
        subscriptionRepository.save(newSubscription(club.getId(), product.getId(), SubscriptionStatus.ACTIVE));

        Pageable pageable = PageRequest.of(0, 20);

        assertThat(subscriptionRepository.search(null, pageable).getContent()).hasSize(1);
        assertThat(subscriptionRepository.search("", pageable).getContent()).hasSize(1);
    }

    private Club newClub(String name, String slug) {
        Club club = new Club();
        club.setName(name);
        club.setSlug(slug);
        club.setStatus(ClubStatus.ACTIVE);
        return club;
    }

    private Product newProduct(String code) {
        Product product = new Product();
        product.setCode(code);
        product.setName(code);
        product.setFree(true);
        product.setBillingInterval(BillingInterval.MONTHLY);
        product.setStatus(ProductStatus.ACTIVE);
        product.setDisplayOrder(0);
        return product;
    }

    private Subscription newSubscription(UUID ownerId, UUID productId, SubscriptionStatus status) {
        Subscription subscription = new Subscription();
        subscription.setOwnerType(SubscriptionOwnerType.CLUB);
        subscription.setOwnerId(ownerId);
        subscription.setProductId(productId);
        subscription.setStatus(status);
        return subscription;
    }
}
