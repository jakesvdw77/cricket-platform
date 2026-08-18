package com.cricketlegend.service;

import com.cricketlegend.dto.CreateProductRequest;
import com.cricketlegend.dto.ProductDto;
import com.cricketlegend.dto.UpdateProductRequest;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

public interface ProductService {

    ProductDto create(CreateProductRequest request);

    ProductDto get(UUID id);

    /**
     * Backend-driven pagination, per docs/standards/backend.md. Defaults to displayOrder
     * ascending when the caller doesn't specify a sort. An optional, case-insensitive substring
     * {@code search} against name or code narrows the results; omitted/blank returns everything.
     */
    Page<ProductDto> list(String search, Pageable pageable);

    ProductDto update(UUID id, UpdateProductRequest request);

    ProductDto retire(UUID id);
}
