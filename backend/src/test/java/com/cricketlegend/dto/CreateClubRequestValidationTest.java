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
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

/**
 * Unit tests for CreateClubRequest's bean validation annotations — per
 * docs/specs/010-minimal-club-creation.md's API Contract and docs/plans/010-minimal-club-creation.md
 * Flag #1. name is @NotBlank; slug is @NotBlank, @Pattern (lowercase alphanumeric segments joined
 * by single hyphens — no leading/trailing/doubled hyphens), and @Size(min=3, max=63). The ADR-04
 * reserved-word blocklist and slug uniqueness are business rules enforced in ClubServiceImpl
 * instead (see ClubServiceImplTest), not bean validation, so they're out of scope here. Plain
 * jakarta.validation, no Spring context — fast, pure unit tier per docs/standards/testing.md.
 */
class CreateClubRequestValidationTest {

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
        CreateClubRequest request = new CreateClubRequest("Riverside CC", "riverside-cc");

        assertThat(validator.validate(request)).isEmpty();
    }

    @Test
    void blankNameProducesViolation() {
        CreateClubRequest request = new CreateClubRequest("", "riverside-cc");

        Set<ConstraintViolation<CreateClubRequest>> violations = validator.validate(request);

        assertThat(violations).extracting(v -> v.getPropertyPath().toString()).contains("name");
    }

    @Test
    void blankSlugProducesViolation() {
        CreateClubRequest request = new CreateClubRequest("Riverside CC", "");

        Set<ConstraintViolation<CreateClubRequest>> violations = validator.validate(request);

        assertThat(violations).extracting(v -> v.getPropertyPath().toString()).contains("slug");
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "Riverside-CC", // uppercase
            "riverside cc", // spaces
            "-riverside-cc", // leading hyphen
            "riverside-cc-", // trailing hyphen
            "riverside--cc", // consecutive hyphens
            "riverside_cc", // underscore instead of hyphen
    })
    void malformedSlugProducesViolation(String slug) {
        CreateClubRequest request = new CreateClubRequest("Riverside CC", slug);

        Set<ConstraintViolation<CreateClubRequest>> violations = validator.validate(request);

        assertThat(violations).extracting(v -> v.getPropertyPath().toString()).contains("slug");
    }

    @Test
    void slugShorterThanThreeCharsProducesViolation() {
        CreateClubRequest request = new CreateClubRequest("AB Club", "ab");

        Set<ConstraintViolation<CreateClubRequest>> violations = validator.validate(request);

        assertThat(violations).extracting(v -> v.getPropertyPath().toString()).contains("slug");
    }

    @Test
    void slugAtExactlyThreeCharsIsValid() {
        CreateClubRequest request = new CreateClubRequest("ABC Club", "abc");

        assertThat(validator.validate(request)).isEmpty();
    }

    @Test
    void slugLongerThan63CharsProducesViolation() {
        String tooLong = "a".repeat(64);
        CreateClubRequest request = new CreateClubRequest("Long Club", tooLong);

        Set<ConstraintViolation<CreateClubRequest>> violations = validator.validate(request);

        assertThat(violations).extracting(v -> v.getPropertyPath().toString()).contains("slug");
    }

    @Test
    void slugAtExactly63CharsIsValid() {
        String exact = "a".repeat(63);
        CreateClubRequest request = new CreateClubRequest("Long Club", exact);

        assertThat(validator.validate(request)).isEmpty();
    }
}
