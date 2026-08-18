package com.cricketlegend.repository;

import static org.assertj.core.api.Assertions.assertThat;

import com.cricketlegend.AbstractIntegrationTest;
import com.cricketlegend.domain.BillingInterval;
import com.cricketlegend.domain.Product;
import com.cricketlegend.domain.ProductStatus;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.transaction.annotation.Transactional;

/**
 * Integration test for ProductRepository's custom queries — per docs/standards/backend.md, every
 * custom repository query ships a Testcontainers-backed integration test. Also proves
 * 003-add-product.sql applies cleanly (implicit via context boot). Each test runs in its own
 * rolled-back transaction for isolation, since all tests share one Testcontainers Postgres
 * instance for the whole class.
 */
@SpringBootTest
@Import(AbstractIntegrationTest.class)
@Transactional
class ProductRepositoryTest {

    @Autowired
    private ProductRepository productRepository;

    @Test
    void existsByCodeIgnoreCaseMatchesRegardlessOfCase() {
        productRepository.save(newProduct("CLUB_STANDARD", ProductStatus.DRAFT, 0));

        assertThat(productRepository.existsByCodeIgnoreCase("club_standard")).isTrue();
        assertThat(productRepository.existsByCodeIgnoreCase("CLUB_STANDARD")).isTrue();
        assertThat(productRepository.existsByCodeIgnoreCase("Club_Standard")).isTrue();
        assertThat(productRepository.existsByCodeIgnoreCase("CLUB_PRO")).isFalse();
    }

    @Test
    void existsByCodeIgnoreCaseAndIdNotExcludesTheGivenIdButMatchesOtherwise() {
        Product saved = productRepository.save(newProduct("CLUB_STANDARD", ProductStatus.DRAFT, 0));
        UUID otherId = UUID.randomUUID();

        assertThat(productRepository.existsByCodeIgnoreCaseAndIdNot("club_standard", saved.getId())).isFalse();
        assertThat(productRepository.existsByCodeIgnoreCaseAndIdNot("club_standard", otherId)).isTrue();
    }

    @Test
    void showAdsAllowSubdomainAllowWhitelistingDefaultToFalseWhenOmittedOnPersist() {
        // Per docs/specs/008-product-catalog.md's Test Plan, showAds/allowSubdomain/
        // allowWhitelisting must each default to false when omitted on create. That defaulting is
        // Product's @PrePersist hook's job (see Product.prePersist()), not ProductServiceImpl's —
        // ProductServiceImplTest's mocked-repository style never actually invokes JPA lifecycle
        // callbacks, so it can only prove the service passes a null through untouched. Only a real
        // persist (Testcontainers Postgres, here) exercises @PrePersist and proves the false
        // default itself. newProduct() below deliberately leaves all three fields unset (null).
        Product product = newProduct("NO_TOGGLES_SET", ProductStatus.DRAFT, 0);
        assertThat(product.getShowAds()).isNull();
        assertThat(product.getAllowSubdomain()).isNull();
        assertThat(product.getAllowWhitelisting()).isNull();

        Product saved = productRepository.save(product);

        assertThat(saved.getShowAds()).isFalse();
        assertThat(saved.getAllowSubdomain()).isFalse();
        assertThat(saved.getAllowWhitelisting()).isFalse();
    }

    @Test
    void findAllOrdersByDisplayOrderAscendingWhenRequested() {
        productRepository.save(newProduct("THIRD", ProductStatus.DRAFT, 3));
        productRepository.save(newProduct("FIRST", ProductStatus.DRAFT, 1));
        productRepository.save(newProduct("SECOND", ProductStatus.DRAFT, 2));

        Pageable pageable = PageRequest.of(0, 20, Sort.by("displayOrder").ascending());
        Page<Product> result = productRepository.findAll(pageable);

        assertThat(result.getContent()).extracting(Product::getCode).containsExactly("FIRST", "SECOND", "THIRD");
        assertThat(result.getTotalElements()).isEqualTo(3);
    }

    private Product newProduct(String code, ProductStatus status, int displayOrder) {
        Product product = new Product();
        product.setCode(code);
        product.setName(code);
        product.setFree(true);
        product.setBillingInterval(BillingInterval.MONTHLY);
        product.setStatus(status);
        product.setDisplayOrder(displayOrder);
        return product;
    }
}
