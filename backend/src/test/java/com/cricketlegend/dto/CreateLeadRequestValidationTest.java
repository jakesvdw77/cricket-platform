package com.cricketlegend.dto;

import static org.assertj.core.api.Assertions.assertThat;

import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import jakarta.validation.ValidatorFactory;
import java.util.Set;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

/**
 * Unit tests for CreateLeadRequest's bean validation annotations — per
 * docs/specs/004-landing-page.md's Test Plan ("lead form field validation: required fields, email
 * format"). Plain jakarta.validation, no Spring context — fast, pure unit tier per
 * docs/standards/testing.md.
 */
class CreateLeadRequestValidationTest {

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

    @Test
    void fullyValidRequestHasNoViolations() {
        CreateLeadRequest request = new CreateLeadRequest(
                "Ada Lovelace", "ada@example.com", "Riverside CC", "0400 000 000", "Interested in onboarding.");

        Set<ConstraintViolation<CreateLeadRequest>> violations = validator.validate(request);

        assertThat(violations).isEmpty();
    }

    @Test
    void validRequestWithOnlyRequiredFieldsHasNoViolations() {
        CreateLeadRequest request = new CreateLeadRequest("Ada Lovelace", "ada@example.com", "Riverside CC", null, null);

        Set<ConstraintViolation<CreateLeadRequest>> violations = validator.validate(request);

        assertThat(violations).isEmpty();
    }

    @Test
    void blankNameProducesViolation() {
        CreateLeadRequest request = new CreateLeadRequest("", "ada@example.com", "Riverside CC", null, null);

        Set<ConstraintViolation<CreateLeadRequest>> violations = validator.validate(request);

        assertThat(violations).extracting(v -> v.getPropertyPath().toString()).contains("name");
    }

    @Test
    void missingNameProducesViolation() {
        CreateLeadRequest request = new CreateLeadRequest(null, "ada@example.com", "Riverside CC", null, null);

        Set<ConstraintViolation<CreateLeadRequest>> violations = validator.validate(request);

        assertThat(violations).extracting(v -> v.getPropertyPath().toString()).contains("name");
    }

    @Test
    void missingEmailProducesViolation() {
        CreateLeadRequest request = new CreateLeadRequest("Ada Lovelace", null, "Riverside CC", null, null);

        Set<ConstraintViolation<CreateLeadRequest>> violations = validator.validate(request);

        assertThat(violations).extracting(v -> v.getPropertyPath().toString()).contains("email");
    }

    @Test
    void malformedEmailProducesViolation() {
        CreateLeadRequest request = new CreateLeadRequest("Ada Lovelace", "not-an-email", "Riverside CC", null, null);

        Set<ConstraintViolation<CreateLeadRequest>> violations = validator.validate(request);

        assertThat(violations).extracting(v -> v.getPropertyPath().toString()).contains("email");
    }

    @Test
    void missingClubNameProducesViolation() {
        CreateLeadRequest request = new CreateLeadRequest("Ada Lovelace", "ada@example.com", "", null, null);

        Set<ConstraintViolation<CreateLeadRequest>> violations = validator.validate(request);

        assertThat(violations).extracting(v -> v.getPropertyPath().toString()).contains("clubName");
    }
}
