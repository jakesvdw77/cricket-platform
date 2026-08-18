package com.cricketlegend.repository;

import com.cricketlegend.domain.Subscription;
import com.cricketlegend.domain.SubscriptionOwnerType;
import com.cricketlegend.domain.SubscriptionStatus;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface SubscriptionRepository extends JpaRepository<Subscription, UUID> {

    /**
     * Duplicate-active pre-check per docs/specs/009-subscriptions.md's validation rules — the
     * partial unique index (ux_subscription_active_owner) is the DB-level backstop, this is the
     * clean 409 the service throws before ever reaching it.
     */
    boolean existsByOwnerTypeAndOwnerIdAndStatus(
            SubscriptionOwnerType ownerType, UUID ownerId, SubscriptionStatus status);

    /**
     * Case-insensitive substring match against the owning Club's name, per
     * docs/specs/009-subscriptions.md's list search param. Subscription.ownerId is a plain UUID
     * column, not a JPA relationship (see Subscription's Javadoc), so the Club join is a
     * theta-join on that column rather than an object-graph traversal. A null or blank search
     * returns every CLUB-owned Subscription, unchanged from the pre-search behavior.
     */
    @Query("SELECT s FROM Subscription s JOIN Club c ON s.ownerId = c.id WHERE s.ownerType = 'CLUB' "
            + "AND (:search IS NULL OR :search = '' OR LOWER(c.name) LIKE LOWER(CONCAT('%', :search, '%')))")
    Page<Subscription> search(@Param("search") String search, Pageable pageable);
}
