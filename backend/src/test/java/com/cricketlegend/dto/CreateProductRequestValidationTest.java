package com.cricketlegend.dto;

import static org.assertj.core.api.Assertions.assertThat;

import com.cricketlegend.domain.BillingInterval;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import jakarta.validation.ValidatorFactory;
import java.math.BigDecimal;
import java.util.Set;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

/**
 * Unit tests for CreateProductRequest's bean validation annotations — per
 * docs/specs/008-product-catalog.md's Data Model table. price/currency/billingInterval are
 * deliberately un-annotated here (their requiredness is conditional on isFree, enforced in
 * ProductServiceImpl instead — see ProductServiceImplTest), so this test only exercises the
 * annotations actually on the record. Plain jakarta.validation, no Spring context — fast, pure
 * unit tier per docs/standards/testing.md.
 */
class CreateProductRequestValidationTest {

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

    private CreateProductRequest fullyValidRequest() {
        return new CreateProductRequest(
                "CLUB_STANDARD", "Club Standard", "The standard tier.", false,
                new BigDecimal("49.99"), "USD", BillingInterval.MONTHLY, 12, 5, 10, 200, 1,
                false, false, false);
    }

    @Test
    void fullyValidRequestHasNoViolations() {
        Set<ConstraintViolation<CreateProductRequest>> violations = validator.validate(fullyValidRequest());

        assertThat(violations).isEmpty();
    }

    @Test
    void validRequestWithOnlyRequiredFieldsHasNoViolations() {
        CreateProductRequest request = new CreateProductRequest(
                "FREE", "Free", null, true, null, null, null, null, null, null, null, null,
                false, false, false);

        Set<ConstraintViolation<CreateProductRequest>> violations = validator.validate(request);

        assertThat(violations).isEmpty();
    }

    @Test
    void blankCodeProducesViolation() {
        CreateProductRequest request = new CreateProductRequest(
                "", "Free", null, true, null, null, null, null, null, null, null, null,
                false, false, false);

        Set<ConstraintViolation<CreateProductRequest>> violations = validator.validate(request);

        assertThat(violations).extracting(v -> v.getPropertyPath().toString()).contains("code");
    }

    @Test
    void missingNameProducesViolation() {
        CreateProductRequest request = new CreateProductRequest(
                "FREE", null, null, true, null, null, null, null, null, null, null, null,
                false, false, false);

        Set<ConstraintViolation<CreateProductRequest>> violations = validator.validate(request);

        assertThat(violations).extracting(v -> v.getPropertyPath().toString()).contains("name");
    }

    @Test
    void missingIsFreeProducesViolation() {
        CreateProductRequest request = new CreateProductRequest(
                "FREE", "Free", null, null, null, null, null, null, null, null, null, null,
                false, false, false);

        Set<ConstraintViolation<CreateProductRequest>> violations = validator.validate(request);

        assertThat(violations).extracting(v -> v.getPropertyPath().toString()).contains("isFree");
    }

    @Test
    void zeroOrNegativeMaxSectionsProducesViolation() {
        CreateProductRequest zero = new CreateProductRequest(
                "FREE", "Free", null, true, null, null, null, null, 0, null, null, null,
                false, false, false);
        CreateProductRequest negative = new CreateProductRequest(
                "FREE", "Free", null, true, null, null, null, null, -1, null, null, null,
                false, false, false);

        assertThat(validator.validate(zero)).extracting(v -> v.getPropertyPath().toString()).contains("maxSections");
        assertThat(validator.validate(negative))
                .extracting(v -> v.getPropertyPath().toString())
                .contains("maxSections");
    }

    @Test
    void negativeDisplayOrderProducesViolation() {
        CreateProductRequest request = new CreateProductRequest(
                "FREE", "Free", null, true, null, null, null, null, null, null, null, -1,
                false, false, false);

        Set<ConstraintViolation<CreateProductRequest>> violations = validator.validate(request);

        assertThat(violations).extracting(v -> v.getPropertyPath().toString()).contains("displayOrder");
    }

    @Test
    void zeroDisplayOrderIsValid() {
        CreateProductRequest request = new CreateProductRequest(
                "FREE", "Free", null, true, null, null, null, null, null, null, null, 0,
                false, false, false);

        Set<ConstraintViolation<CreateProductRequest>> violations = validator.validate(request);

        assertThat(violations).isEmpty();
    }

    @Test
    void omittedShowAdsAllowSubdomainAllowWhitelistingAreValid() {
        CreateProductRequest request = new CreateProductRequest(
                "FREE", "Free", null, true, null, null, null, null, null, null, null, null,
                null, null, null);

        Set<ConstraintViolation<CreateProductRequest>> violations = validator.validate(request);

        assertThat(violations).isEmpty();
    }
}
