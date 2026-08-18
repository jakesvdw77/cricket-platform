package com.cricketlegend.mapper;

import com.cricketlegend.domain.Product;
import com.cricketlegend.dto.CreateProductRequest;
import com.cricketlegend.dto.ProductDto;
import com.cricketlegend.dto.ProductSummaryDto;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

/**
 * Note: Product.isFree is a boolean field, so its JavaBean getter/setter pair is
 * isFree()/setFree(boolean) — the bean property name MapStruct infers from that pair for
 * *reads* is "free", not "isFree" (toDto below needs an explicit @Mapping for it). Writes via
 * Product's Lombok @Builder use the field's literal name ("isFree"), which already matches
 * CreateProductRequest.isFree()'s record-component name, so toEntity needs no explicit mapping
 * for it.
 *
 * <p>showAds/allowSubdomain/allowWhitelisting do NOT hit this quirk: Lombok only rewrites a
 * boolean getter to drop a leading "is" when the field name itself already starts with "is"
 * (isFree's case). None of these three field names do, so Product generates the plain
 * getShowAds()/setShowAds(Boolean) shape (they're boxed Boolean, not primitive boolean - see
 * the Javadoc on those fields in Product), and MapStruct's inferred property name ("showAds")
 * matches the field name and the DTO/request component names exactly on both sides - verified
 * against the generated ProductMapperImpl, no explicit @Mapping needed for any of the three.
 */
@Mapper(componentModel = "spring")
public interface ProductMapper {

    @Mapping(target = "id", ignore = true)
    @Mapping(target = "status", ignore = true)
    @Mapping(target = "createdAt", ignore = true)
    @Mapping(target = "updatedAt", ignore = true)
    @Mapping(target = "updatedBy", ignore = true)
    Product toEntity(CreateProductRequest request);

    @Mapping(target = "isFree", source = "free")
    ProductDto toDto(Product product);

    // id/name/code all exist with matching names on both sides — MapStruct maps all three by
    // convention, no explicit @Mapping needed (this method doesn't touch isFree, so the
    // free/isFree bean-naming quirk documented above doesn't apply here).
    ProductSummaryDto toSummaryDto(Product product);
}
