package com.cricketlegend.mapper;

import com.cricketlegend.domain.Subscription;
import com.cricketlegend.dto.ClubSummaryDto;
import com.cricketlegend.dto.CreateSubscriptionRequest;
import com.cricketlegend.dto.ProductSummaryDto;
import com.cricketlegend.dto.SubscriptionDto;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

/**
 * toDto takes the Subscription plus its already-resolved Club/Product summaries (assembled by
 * SubscriptionServiceImpl via ClubRepository/ProductRepository — Subscription itself only holds
 * plain ownerId/productId UUID columns, no JPA relationship, see Subscription's Javadoc) as
 * separate source parameters. Verified against the generated SubscriptionMapperImpl: MapStruct
 * maps the `club`/`product` parameters straight to the matching-named `club`/`product` target
 * fields (by parameter name, since ClubSummaryDto/ProductSummaryDto aren't Subscription
 * properties), and maps every other SubscriptionDto field from the `subscription` parameter by
 * property name with one exception — `id` exists on all three source parameters
 * (Subscription.id, ClubSummaryDto.id, ProductSummaryDto.id), which MapStruct refuses to resolve
 * automatically ("Several possible source properties for target property 'id'", a real compiler
 * error, not a hypothetical one) and needs the explicit @Mapping below pointing at
 * `subscription.id`. No other target field is ambiguous across the three sources.
 */
@Mapper(componentModel = "spring")
public interface SubscriptionMapper {

    @Mapping(target = "id", ignore = true)
    @Mapping(target = "status", ignore = true)
    @Mapping(target = "createdAt", ignore = true)
    @Mapping(target = "updatedAt", ignore = true)
    @Mapping(target = "updatedBy", ignore = true)
    Subscription toEntity(CreateSubscriptionRequest request);

    @Mapping(target = "id", source = "subscription.id")
    SubscriptionDto toDto(Subscription subscription, ClubSummaryDto club, ProductSummaryDto product);
}
