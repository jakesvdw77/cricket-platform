package com.cricketlegend.controller;

import com.cricketlegend.domain.ProductStatus;
import com.cricketlegend.dto.CreateProductRequest;
import com.cricketlegend.dto.ProductDto;
import com.cricketlegend.dto.UpdateProductRequest;
import com.cricketlegend.service.ProductService;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * docs/specs/008-product-catalog.md: platform_admin-only Product catalogue CRUD (create, get,
 * paginated list, update, one-way retire — no hard delete). Authorization for
 * /api/v1/platform/** is enforced by {@link com.cricketlegend.config.SecurityConfig}'s
 * URL-based platform_admin check.
 */
@RestController
public class ProductController {

    private final ProductService productService;

    public ProductController(ProductService productService) {
        this.productService = productService;
    }

    @GetMapping("/api/v1/platform/products")
    public ResponseEntity<Page<ProductDto>> list(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) ProductStatus status,
            Pageable pageable) {
        return ResponseEntity.ok(productService.list(search, status, pageable));
    }

    @GetMapping("/api/v1/platform/products/{id}")
    public ResponseEntity<ProductDto> get(@PathVariable UUID id) {
        return ResponseEntity.ok(productService.get(id));
    }

    @PostMapping("/api/v1/platform/products")
    @ApiResponse(responseCode = "201", description = "Product created")
    public ResponseEntity<ProductDto> create(@Valid @RequestBody CreateProductRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(productService.create(request));
    }

    @PutMapping("/api/v1/platform/products/{id}")
    public ResponseEntity<ProductDto> update(
            @PathVariable UUID id, @Valid @RequestBody UpdateProductRequest request) {
        return ResponseEntity.ok(productService.update(id, request));
    }

    @PostMapping("/api/v1/platform/products/{id}/retire")
    public ResponseEntity<ProductDto> retire(@PathVariable UUID id) {
        return ResponseEntity.ok(productService.retire(id));
    }
}
