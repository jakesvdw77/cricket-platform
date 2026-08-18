package com.cricketlegend.repository;

import com.cricketlegend.domain.Product;
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
     * Product, unchanged from the pre-search behavior.
     */
    @Query("SELECT p FROM Product p WHERE :search IS NULL OR :search = '' "
            + "OR LOWER(p.name) LIKE LOWER(CONCAT('%', :search, '%')) "
            + "OR LOWER(p.code) LIKE LOWER(CONCAT('%', :search, '%'))")
    Page<Product> search(@Param("search") String search, Pageable pageable);
}
