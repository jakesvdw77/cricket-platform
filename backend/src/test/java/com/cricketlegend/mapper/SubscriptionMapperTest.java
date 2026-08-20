package com.cricketlegend.mapper;

import static org.assertj.core.api.Assertions.assertThat;

import com.cricketlegend.domain.Contact;
import com.cricketlegend.domain.Subscription;
import com.cricketlegend.domain.SubscriptionOwnerType;
import com.cricketlegend.domain.SubscriptionStatus;
import com.cricketlegend.dto.ClubSummaryDto;
import com.cricketlegend.dto.ContactDto;
import com.cricketlegend.dto.CreateSubscriptionRequest;
import com.cricketlegend.dto.ProductSummaryDto;
import com.cricketlegend.dto.SubscriptionDto;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mapstruct.factory.Mappers;

/**
 * Unit tests against the real generated {@code SubscriptionMapperImpl} (not a Mockito mock) —
 * per docs/plans/014-subscription-responsible-contact.md's Flag #2, confirming a {@code null}
 * {@link ContactDto}/{@link Contact} really does round-trip to {@code null} rather than assuming
 * MapStruct's default null-handling. Plain object graph, no Spring context — fast, pure unit tier
 * per docs/standards/testing.md.
 */
class SubscriptionMapperTest {

    private final SubscriptionMapper mapper = Mappers.getMapper(SubscriptionMapper.class);

    @Test
    void toContactWithNullDtoReturnsNull() {
        assertThat(mapper.toContact(null)).isNull();
    }

    @Test
    void toContactWithACompleteDtoMapsEveryField() {
        ContactDto dto = new ContactDto("Jane", "Doe", "jane.doe@example.com", "+27821234567");

        Contact contact = mapper.toContact(dto);

        assertThat(contact.getFirstName()).isEqualTo("Jane");
        assertThat(contact.getLastName()).isEqualTo("Doe");
        assertThat(contact.getEmail()).isEqualTo("jane.doe@example.com");
        assertThat(contact.getPhone()).isEqualTo("+27821234567");
    }

    @Test
    void toEntityCarriesResponsibleContactThroughAutomaticNestedMapping() {
        ContactDto dto = new ContactDto("Jane", "Doe", "jane.doe@example.com", "+27821234567");
        CreateSubscriptionRequest request = new CreateSubscriptionRequest(
                SubscriptionOwnerType.CLUB, UUID.randomUUID(), UUID.randomUUID(), null, null, dto);

        Subscription entity = mapper.toEntity(request);

        assertThat(entity.getResponsibleContact()).isNotNull();
        assertThat(entity.getResponsibleContact().getFirstName()).isEqualTo("Jane");
        assertThat(entity.getResponsibleContact().getEmail()).isEqualTo("jane.doe@example.com");
    }

    @Test
    void toDtoOnALegacySubscriptionWithNoResponsibleContactMapsWithoutThrowingAndLeavesItNull() {
        // A Subscription created before docs/specs/014-subscription-responsible-contact.md shipped
        // has responsibleContact == null at the entity level — toDto must map it to a null
        // ContactDto, not throw, per the spec's own Acceptance Criteria.
        Subscription subscription = new Subscription();
        subscription.setId(UUID.randomUUID());
        subscription.setOwnerType(SubscriptionOwnerType.CLUB);
        subscription.setOwnerId(UUID.randomUUID());
        subscription.setProductId(UUID.randomUUID());
        subscription.setStatus(SubscriptionStatus.ACTIVE);
        subscription.setStartDate(LocalDate.of(2025, 1, 1));
        subscription.setResponsibleContact(null);

        ClubSummaryDto club = new ClubSummaryDto(subscription.getOwnerId(), "Riverside CC", "riverside-cc");
        ProductSummaryDto product =
                new ProductSummaryDto(subscription.getProductId(), "Club Standard", "CLUB_STANDARD");

        SubscriptionDto dto = mapper.toDto(subscription, club, product);

        assertThat(dto.responsibleContact()).isNull();
    }
}
