package com.cricketlegend.service.impl;

import com.cricketlegend.domain.BillingInterval;
import com.cricketlegend.domain.Product;
import com.cricketlegend.domain.ProductStatus;
import com.cricketlegend.dto.CreateProductRequest;
import com.cricketlegend.dto.ProductDto;
import com.cricketlegend.dto.UpdateProductRequest;
import com.cricketlegend.exception.DuplicateProductCodeException;
import com.cricketlegend.exception.InvalidStatusTransitionException;
import com.cricketlegend.exception.NotFoundException;
import com.cricketlegend.exception.ValidationException;
import com.cricketlegend.mapper.ProductMapper;
import com.cricketlegend.repository.ProductRepository;
import com.cricketlegend.service.ProductService;
import java.math.BigDecimal;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

/**
 * Business rules per docs/specs/008-product-catalog.md: code uniqueness (case-insensitive),
 * isFree clears billing fields server-side, non-free requires price/currency and defaults
 * billingInterval to MONTHLY, and a one-way DRAFT -> ACTIVE -> RETIRED lifecycle (no reversal, no
 * hard delete).
 */
@Service
public class ProductServiceImpl implements ProductService {

    private final ProductRepository productRepository;
    private final ProductMapper productMapper;

    public ProductServiceImpl(ProductRepository productRepository, ProductMapper productMapper) {
        this.productRepository = productRepository;
        this.productMapper = productMapper;
    }

    @Override
    public ProductDto create(CreateProductRequest request) {
        if (productRepository.existsByCodeIgnoreCase(request.code())) {
            throw new DuplicateProductCodeException("Product code already in use: " + request.code());
        }

        Product product = productMapper.toEntity(request);
        applyBillingFields(
                product, request.isFree(), request.price(), request.currency(), request.billingInterval());

        return productMapper.toDto(productRepository.save(product));
    }

    @Override
    public ProductDto get(UUID id) {
        return productMapper.toDto(findOrThrow(id));
    }

    @Override
    public Page<ProductDto> list(String search, ProductStatus status, Pageable pageable) {
        Pageable effectivePageable = withDefaultSort(pageable);
        return productRepository.search(search, status, effectivePageable).map(productMapper::toDto);
    }

    private Pageable withDefaultSort(Pageable pageable) {
        if (pageable.getSort().isSorted()) {
            return pageable;
        }
        return PageRequest.of(
                pageable.getPageNumber(), pageable.getPageSize(), Sort.by("displayOrder").ascending());
    }

    @Override
    public ProductDto update(UUID id, UpdateProductRequest request) {
        Product product = findOrThrow(id);

        if (product.getStatus() == ProductStatus.RETIRED) {
            throw new InvalidStatusTransitionException("Cannot update a retired product: " + id);
        }

        if (productRepository.existsByCodeIgnoreCaseAndIdNot(request.code(), id)) {
            throw new DuplicateProductCodeException("Product code already in use: " + request.code());
        }

        ProductStatus current = product.getStatus();
        ProductStatus target = request.status();
        boolean noOp = current == target;
        boolean draftToActive = current == ProductStatus.DRAFT && target == ProductStatus.ACTIVE;
        if (!noOp && !draftToActive) {
            throw new InvalidStatusTransitionException(
                    "Cannot transition product from " + current + " to " + target + " via update");
        }

        product.setCode(request.code());
        product.setName(request.name());
        product.setDescription(request.description());
        product.setMaxPeriodMonths(request.maxPeriodMonths());
        product.setMaxSections(request.maxSections());
        product.setMaxTeams(request.maxTeams());
        product.setMaxPlayers(request.maxPlayers());
        product.setDisplayOrder(request.displayOrder());
        product.setShowAds(request.showAds());
        product.setAllowSubdomain(request.allowSubdomain());
        product.setAllowWhitelisting(request.allowWhitelisting());
        product.setStatus(target);
        applyBillingFields(
                product, request.isFree(), request.price(), request.currency(), request.billingInterval());

        return productMapper.toDto(productRepository.save(product));
    }

    @Override
    public ProductDto retire(UUID id) {
        Product product = findOrThrow(id);
        if (product.getStatus() == ProductStatus.RETIRED) {
            throw new InvalidStatusTransitionException("Product is already retired: " + id);
        }
        product.setStatus(ProductStatus.RETIRED);
        return productMapper.toDto(productRepository.save(product));
    }

    private Product findOrThrow(UUID id) {
        return productRepository
                .findById(id)
                .orElseThrow(() -> new NotFoundException("Product not found: " + id));
    }

    /**
     * When isFree, clears price/currency server-side (both nullable columns) regardless of what
     * the request sent, and resets billingInterval to its schema default (MONTHLY) since that
     * column is NOT NULL and has no "cleared"/null state. Otherwise requires price+currency and
     * defaults billingInterval to MONTHLY when omitted.
     */
    private void applyBillingFields(
            Product product,
            boolean isFree,
            BigDecimal price,
            String currency,
            BillingInterval billingInterval) {
        product.setFree(isFree);
        if (isFree) {
            product.setPrice(null);
            product.setCurrency(null);
            product.setBillingInterval(BillingInterval.MONTHLY);
            return;
        }

        if (price == null || currency == null) {
            throw new ValidationException("price and currency are required when isFree is false");
        }
        product.setPrice(price);
        product.setCurrency(currency);
        product.setBillingInterval(billingInterval == null ? BillingInterval.MONTHLY : billingInterval);
    }
}
