package com.cricketlegend.dto;

import static org.assertj.core.api.Assertions.assertThat;

import com.cricketlegend.domain.SubscriptionOwnerType;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import jakarta.validation.ValidatorFactory;
import java.time.LocalDate;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

/**
 * Unit tests for CreateSubscriptionRequest's bean validation annotations — per
 * docs/specs/009-subscriptions.md's Data Model table. ownerType is validated to be CLUB (not
 * merely non-null) in SubscriptionServiceImpl instead — see SubscriptionServiceImplTest — so this
 * test only exercises the annotations actually on the record (@NotNull on
 * ownerType/ownerId/productId; startDate/endDate are un-annotated, optional). Plain
 * jakarta.validation, no Spring context — fast, pure unit tier per docs/standards/testing.md.
 */
class CreateSubscriptionRequestValidationTest {

    private static ValidatorFactory validatorFactory;
    private static Validator validator;

    @BeforeAll
    static void setUpValidator() {
        validatorFactory = Validation.buildDefaultValidatorFactory();
        validator = validatorFactory.getValidator();
    }

    @AfterAll
    static void closeValidatorFactory() {
        validatorFactory.close();
    }

    private CreateSubscriptionRequest fullyValidRequest() {
        return new CreateSubscriptionRequest(
                SubscriptionOwnerType.CLUB, UUID.randomUUID(), UUID.randomUUID(), LocalDate.now(),
                LocalDate.now().plusYears(1));
    }

    @Test
    void fullyValidRequestHasNoViolations() {
        Set<ConstraintViolation<CreateSubscriptionRequest>> violations = validator.validate(fullyValidRequest());

        assertThat(violations).isEmpty();
    }

    @Test
    void validRequestWithOnlyRequiredFieldsHasNoViolations() {
        CreateSubscriptionRequest request =
                new CreateSubscriptionRequest(SubscriptionOwnerType.CLUB, UUID.randomUUID(), UUID.randomUUID(), null,
                        null);

        Set<ConstraintViolation<CreateSubscriptionRequest>> violations = validator.validate(request);

        assertThat(violations).isEmpty();
    }

    @Test
    void missingOwnerTypeProducesViolation() {
        CreateSubscriptionRequest request =
                new CreateSubscriptionRequest(null, UUID.randomUUID(), UUID.randomUUID(), null, null);

        Set<ConstraintViolation<CreateSubscriptionRequest>> violations = validator.validate(request);

        assertThat(violations).extracting(v -> v.getPropertyPath().toString()).contains("ownerType");
    }

    @Test
    void missingOwnerIdProducesViolation() {
        CreateSubscriptionRequest request =
                new CreateSubscriptionRequest(SubscriptionOwnerType.CLUB, null, UUID.randomUUID(), null, null);

        Set<ConstraintViolation<CreateSubscriptionRequest>> violations = validator.validate(request);

        assertThat(violations).extracting(v -> v.getPropertyPath().toString()).contains("ownerId");
    }

    @Test
    void missingProductIdProducesViolation() {
        CreateSubscriptionRequest request =
                new CreateSubscriptionRequest(SubscriptionOwnerType.CLUB, UUID.randomUUID(), null, null, null);

        Set<ConstraintViolation<CreateSubscriptionRequest>> violations = validator.validate(request);

        assertThat(violations).extracting(v -> v.getPropertyPath().toString()).contains("productId");
    }

    @Test
    void ownerTypeSectionPassesBeanValidationEvenThoughTheServiceLayerRejectsIt() {
        // SECTION is a recognized enum value at the DTO/bean-validation level (forward-compat,
        // see SubscriptionOwnerType's Javadoc) — its rejection is a service-layer business rule
        // (SubscriptionServiceImplTest), not something @NotNull or any other bean-validation
        // annotation on this record enforces.
        CreateSubscriptionRequest request = new CreateSubscriptionRequest(
                SubscriptionOwnerType.SECTION, UUID.randomUUID(), UUID.randomUUID(), null, null);

        Set<ConstraintViolation<CreateSubscriptionRequest>> violations = validator.validate(request);

        assertThat(violations).isEmpty();
    }
}
