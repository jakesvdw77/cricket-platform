package com.cricketlegend.mapper;

import com.cricketlegend.domain.Contact;
import com.cricketlegend.domain.Subscription;
import com.cricketlegend.dto.ClubSummaryDto;
import com.cricketlegend.dto.ContactDto;
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

    /**
     * Explicit conversion for {@link com.cricketlegend.service.impl.SubscriptionServiceImpl#update}
     * — that method doesn't go through a MapStruct {@code toEntity} call at all, it mutates the
     * retrieved entity's fields directly with manual setters, so it needs this method to set
     * {@code responsibleContact} the same "full replace" way. A {@code null} {@code dto} produces
     * a {@code null} {@link Contact} (MapStruct's default for a null source), which is exactly the
     * "omitting it clears any previously-set contact" behavior
     * docs/specs/014-subscription-responsible-contact.md requires.
     */
    Contact toContact(ContactDto dto);
}
