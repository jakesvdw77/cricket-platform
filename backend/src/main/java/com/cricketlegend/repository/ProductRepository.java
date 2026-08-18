package com.cricketlegend.repository;

import com.cricketlegend.domain.Product;
import com.cricketlegend.domain.ProductStatus;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ProductRepository extends JpaRepository<Product, UUID> {

    boolean existsByCodeIgnoreCase(String code);

    boolean existsByCodeIgnoreCaseAndIdNot(String code, UUID id);

    /**
     * Case-insensitive substring match against name or code, per
     * docs/specs/008-product-catalog.md's list search param. A null or blank search returns every
     * Product, unchanged from the pre-search behavior. An optional {@code status} filter was
     * added in docs/specs/009-subscriptions.md so the Subscription form's Product picker can
     * request ACTIVE products only; a null status returns Products in any status, unchanged from
     * the pre-filter behavior.
     */
    @Query("SELECT p FROM Product p WHERE (:search IS NULL OR :search = '' "
            + "OR LOWER(p.name) LIKE LOWER(CONCAT('%', :search, '%')) "
            + "OR LOWER(p.code) LIKE LOWER(CONCAT('%', :search, '%'))) "
            + "AND (:status IS NULL OR p.status = :status)")
    Page<Product> search(
            @Param("search") String search, @Param("status") ProductStatus status, Pageable pageable);
}
