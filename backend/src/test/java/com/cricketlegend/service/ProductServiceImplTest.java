package com.cricketlegend.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

import com.cricketlegend.domain.BillingInterval;
import com.cricketlegend.domain.Product;
import com.cricketlegend.domain.ProductStatus;
import com.cricketlegend.dto.CreateProductRequest;
import com.cricketlegend.dto.ProductDto;
import com.cricketlegend.dto.UpdateProductRequest;
import com.cricketlegend.exception.DuplicateProductCodeException;
import com.cricketlegend.exception.InvalidStatusTransitionException;
import com.cricketlegend.exception.ValidationException;
import com.cricketlegend.mapper.ProductMapper;
import com.cricketlegend.repository.ProductRepository;
import com.cricketlegend.service.impl.ProductServiceImpl;
import java.math.BigDecimal;
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
 * Unit tests for ProductServiceImpl's business rules from docs/specs/008-product-catalog.md: code
 * uniqueness, isFree clearing/defaulting billing fields, the DRAFT-&gt;ACTIVE-only update
 * transition, one-way retire, and the displayOrder default sort. Per docs/standards/backend.md,
 * every @Service method carrying a business rule ships a unit test in the same change.
 */
@ExtendWith(MockitoExtension.class)
class ProductServiceImplTest {

    @Mock
    private ProductRepository productRepository;

    @Mock
    private ProductMapper productMapper;

    private ProductServiceImpl productService;

    @BeforeEach
    void setUp() {
        productService = new ProductServiceImpl(productRepository, productMapper);
    }

    private ProductDto dummyDto() {
        return new ProductDto(
                UUID.randomUUID(), "CODE", "Name", null, false, null, null, BillingInterval.MONTHLY,
                null, null, null, null, ProductStatus.DRAFT, 0, false, false, false, null, null, null);
    }

    @Test
    void createWithIsFreeTrueClearsPriceCurrencyAndResetsBillingIntervalRegardlessOfRequest() {
        CreateProductRequest request = new CreateProductRequest(
                "FREE", "Free Tier", null, true, new BigDecimal("9.99"), "USD", BillingInterval.ANNUAL,
                null, null, null, null, null, false, false, false);
        Product entity = new Product();
        when(productMapper.toEntity(request)).thenReturn(entity);
        when(productRepository.save(entity)).thenReturn(entity);
        when(productMapper.toDto(entity)).thenReturn(dummyDto());

        productService.create(request);

        assertThat(entity.isFree()).isTrue();
        assertThat(entity.getPrice()).isNull();
        assertThat(entity.getCurrency()).isNull();
        assertThat(entity.getBillingInterval()).isEqualTo(BillingInterval.MONTHLY);
    }

    @Test
    void createWithDuplicateCodeThrowsDuplicateProductCodeException() {
        CreateProductRequest request = new CreateProductRequest(
                "DUP", "Duplicate", null, true, null, null, null, null, null, null, null, null,
                false, false, false);
        when(productRepository.existsByCodeIgnoreCase("DUP")).thenReturn(true);

        assertThatThrownBy(() -> productService.create(request))
                .isInstanceOf(DuplicateProductCodeException.class);
    }

    @Test
    void createWithIsFreeFalseAndMissingPriceThrowsValidationException() {
        CreateProductRequest request = new CreateProductRequest(
                "STANDARD", "Standard", null, false, null, "USD", null, null, null, null, null, null,
                false, false, false);
        Product entity = new Product();
        when(productMapper.toEntity(request)).thenReturn(entity);

        assertThatThrownBy(() -> productService.create(request)).isInstanceOf(ValidationException.class);
    }

    @Test
    void createWithIsFreeFalseAndMissingCurrencyThrowsValidationException() {
        CreateProductRequest request = new CreateProductRequest(
                "STANDARD", "Standard", null, false, new BigDecimal("5.00"), null, null,
                null, null, null, null, null, false, false, false);
        Product entity = new Product();
        when(productMapper.toEntity(request)).thenReturn(entity);

        assertThatThrownBy(() -> productService.create(request)).isInstanceOf(ValidationException.class);
    }

    @Test
    void createWithIsFreeFalseAndOmittedBillingIntervalDefaultsToMonthly() {
        CreateProductRequest request = new CreateProductRequest(
                "STANDARD", "Standard", null, false, new BigDecimal("5.00"), "USD", null,
                null, null, null, null, null, false, false, false);
        Product entity = new Product();
        when(productMapper.toEntity(request)).thenReturn(entity);
        when(productRepository.save(entity)).thenReturn(entity);
        when(productMapper.toDto(entity)).thenReturn(dummyDto());

        productService.create(request);

        assertThat(entity.getBillingInterval()).isEqualTo(BillingInterval.MONTHLY);
        assertThat(entity.getPrice()).isEqualByComparingTo("5.00");
        assertThat(entity.getCurrency()).isEqualTo("USD");
    }

    @Test
    void updateWithDuplicateCodeExcludingSelfThrowsDuplicateProductCodeException() {
        UUID id = UUID.randomUUID();
        Product existing = existingProduct(id, "OLD", ProductStatus.DRAFT);
        when(productRepository.findById(id)).thenReturn(Optional.of(existing));
        when(productRepository.existsByCodeIgnoreCaseAndIdNot("TAKEN", id)).thenReturn(true);

        UpdateProductRequest request = new UpdateProductRequest(
                "TAKEN", "Name", null, true, null, null, null, null, null, null, null, 0, ProductStatus.DRAFT,
                false, false, false);

        assertThatThrownBy(() -> productService.update(id, request))
                .isInstanceOf(DuplicateProductCodeException.class);
    }

    @Test
    void updateWithUnchangedOwnCodeDoesNotFalsePositiveAsDuplicate() {
        UUID id = UUID.randomUUID();
        Product existing = existingProduct(id, "SAME", ProductStatus.DRAFT);
        when(productRepository.findById(id)).thenReturn(Optional.of(existing));
        when(productRepository.existsByCodeIgnoreCaseAndIdNot("SAME", id)).thenReturn(false);
        when(productRepository.save(existing)).thenReturn(existing);
        when(productMapper.toDto(existing)).thenReturn(dummyDto());

        UpdateProductRequest request = new UpdateProductRequest(
                "SAME", "Name", null, true, null, null, null, null, null, null, null, 0, ProductStatus.DRAFT,
                false, false, false);

        productService.update(id, request);

        assertThat(existing.getCode()).isEqualTo("SAME");
    }

    @Test
    void updateDraftToActiveIsAllowed() {
        UUID id = UUID.randomUUID();
        Product existing = existingProduct(id, "CODE", ProductStatus.DRAFT);
        when(productRepository.findById(id)).thenReturn(Optional.of(existing));
        when(productRepository.existsByCodeIgnoreCaseAndIdNot("CODE", id)).thenReturn(false);
        when(productRepository.save(existing)).thenReturn(existing);
        when(productMapper.toDto(existing)).thenReturn(dummyDto());

        UpdateProductRequest request = new UpdateProductRequest(
                "CODE", "Name", null, true, null, null, null, null, null, null, null, 0, ProductStatus.ACTIVE,
                false, false, false);

        productService.update(id, request);

        assertThat(existing.getStatus()).isEqualTo(ProductStatus.ACTIVE);
    }

    @Test
    void updateWithSameStatusIsANoOpAndAllowed() {
        UUID id = UUID.randomUUID();
        Product existing = existingProduct(id, "CODE", ProductStatus.ACTIVE);
        when(productRepository.findById(id)).thenReturn(Optional.of(existing));
        when(productRepository.existsByCodeIgnoreCaseAndIdNot("CODE", id)).thenReturn(false);
        when(productRepository.save(existing)).thenReturn(existing);
        when(productMapper.toDto(existing)).thenReturn(dummyDto());

        UpdateProductRequest request = new UpdateProductRequest(
                "CODE", "Name", null, true, null, null, null, null, null, null, null, 0, ProductStatus.ACTIVE,
                false, false, false);

        productService.update(id, request);

        assertThat(existing.getStatus()).isEqualTo(ProductStatus.ACTIVE);
    }

    @Test
    void updateTransitioningToRetiredThrowsInvalidStatusTransitionException() {
        UUID id = UUID.randomUUID();
        Product existing = existingProduct(id, "CODE", ProductStatus.ACTIVE);
        when(productRepository.findById(id)).thenReturn(Optional.of(existing));
        when(productRepository.existsByCodeIgnoreCaseAndIdNot("CODE", id)).thenReturn(false);

        UpdateProductRequest request = new UpdateProductRequest(
                "CODE", "Name", null, true, null, null, null, null, null, null, null, 0, ProductStatus.RETIRED,
                false, false, false);

        assertThatThrownBy(() -> productService.update(id, request))
                .isInstanceOf(InvalidStatusTransitionException.class);
    }

    @Test
    void updateOnRetiredProductThrowsInvalidStatusTransitionEvenWithStatusUnchanged() {
        UUID id = UUID.randomUUID();
        Product existing = existingProduct(id, "CODE", ProductStatus.RETIRED);
        when(productRepository.findById(id)).thenReturn(Optional.of(existing));

        UpdateProductRequest request = new UpdateProductRequest(
                "CODE", "Renamed", null, true, null, null, null, null, null, null, null, 0,
                ProductStatus.RETIRED, false, false, false);

        assertThatThrownBy(() -> productService.update(id, request))
                .isInstanceOf(InvalidStatusTransitionException.class);

        assertThat(existing.getName()).isEqualTo("Existing");
    }

    @Test
    void updateTransitioningActiveToDraftThrowsInvalidStatusTransitionException() {
        UUID id = UUID.randomUUID();
        Product existing = existingProduct(id, "CODE", ProductStatus.ACTIVE);
        when(productRepository.findById(id)).thenReturn(Optional.of(existing));
        when(productRepository.existsByCodeIgnoreCaseAndIdNot("CODE", id)).thenReturn(false);

        UpdateProductRequest request = new UpdateProductRequest(
                "CODE", "Name", null, true, null, null, null, null, null, null, null, 0, ProductStatus.DRAFT,
                false, false, false);

        assertThatThrownBy(() -> productService.update(id, request))
                .isInstanceOf(InvalidStatusTransitionException.class);
    }

    @Test
    void retireOnDraftProductTransitionsToRetired() {
        UUID id = UUID.randomUUID();
        Product existing = existingProduct(id, "CODE", ProductStatus.DRAFT);
        when(productRepository.findById(id)).thenReturn(Optional.of(existing));
        when(productRepository.save(existing)).thenReturn(existing);
        when(productMapper.toDto(existing)).thenReturn(dummyDto());

        productService.retire(id);

        assertThat(existing.getStatus()).isEqualTo(ProductStatus.RETIRED);
    }

    @Test
    void retireOnAlreadyRetiredProductThrowsInvalidStatusTransitionException() {
        UUID id = UUID.randomUUID();
        Product existing = existingProduct(id, "CODE", ProductStatus.RETIRED);
        when(productRepository.findById(id)).thenReturn(Optional.of(existing));

        assertThatThrownBy(() -> productService.retire(id))
                .isInstanceOf(InvalidStatusTransitionException.class);
    }

    @Test
    void listWithNoCallerSortDefaultsToDisplayOrderAscending() {
        Pageable requested = PageRequest.of(0, 20);
        Pageable expectedEffective = PageRequest.of(0, 20, Sort.by("displayOrder").ascending());
        when(productRepository.search(null, expectedEffective))
                .thenReturn(new PageImpl<>(List.of(new Product())));
        when(productMapper.toDto(any(Product.class))).thenReturn(dummyDto());

        Page<ProductDto> result = productService.list(null, requested);

        assertThat(result.getContent()).hasSize(1);
    }

    @Test
    void listPreservesCallerSuppliedSort() {
        Pageable requested = PageRequest.of(0, 20, Sort.by("name").ascending());
        when(productRepository.search(null, requested)).thenReturn(new PageImpl<>(List.of(new Product())));
        when(productMapper.toDto(any(Product.class))).thenReturn(dummyDto());

        Page<ProductDto> result = productService.list(null, requested);

        assertThat(result.getContent()).hasSize(1);
    }

    private Product existingProduct(UUID id, String code, ProductStatus status) {
        Product product = new Product();
        product.setId(id);
        product.setCode(code);
        product.setName("Existing");
        product.setStatus(status);
        product.setDisplayOrder(0);
        product.setBillingInterval(BillingInterval.MONTHLY);
        return product;
    }
}
