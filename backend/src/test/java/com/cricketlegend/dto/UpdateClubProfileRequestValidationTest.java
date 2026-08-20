package com.cricketlegend.dto;

import static org.assertj.core.api.Assertions.assertThat;

import com.cricketlegend.domain.ClubProfileType;
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
 * Unit tests for UpdateClubProfileRequest's bean validation annotations — per
 * docs/specs/012-club-profile.md's API Contract: email/website get DTO-layer format validation
 * ({@code @Email}/URL-pattern), every field is otherwise optional/nullable so a full-replace
 * upsert can omit any of them. Plain jakarta.validation, no Spring context — fast, pure unit tier
 * per docs/standards/testing.md.
 */
class UpdateClubProfileRequestValidationTest {

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
        UpdateClubProfileRequest request = new UpdateClubProfileRequest(
                ClubProfileType.CLUB, "logo.png", "banner.png",
                new AddressDto("1", "Main St", "Riverside", "Gauteng", "South Africa", "0001"),
                "club@example.com", "0123456789", "https://example.com");

        assertThat(validator.validate(request)).isEmpty();
    }

    @Test
    void everyFieldNullHasNoViolationsSinceNothingIsRequired() {
        UpdateClubProfileRequest request = new UpdateClubProfileRequest(
                null, null, null, null, null, null, null);

        assertThat(validator.validate(request)).isEmpty();
    }

    @ParameterizedTest
    @ValueSource(strings = {"not-an-email", "missing-at-sign.com", "@no-local-part.com"})
    void malformedEmailProducesViolation(String email) {
        UpdateClubProfileRequest request = new UpdateClubProfileRequest(
                null, null, null, null, email, null, null);

        Set<ConstraintViolation<UpdateClubProfileRequest>> violations = validator.validate(request);

        assertThat(violations).extracting(v -> v.getPropertyPath().toString()).contains("email");
    }

    @ParameterizedTest
    @ValueSource(strings = {"not-a-url", "ftp missing protocol", "www.example.com"})
    void malformedWebsiteProducesViolation(String website) {
        UpdateClubProfileRequest request = new UpdateClubProfileRequest(
                null, null, null, null, null, null, website);

        Set<ConstraintViolation<UpdateClubProfileRequest>> violations = validator.validate(request);

        assertThat(violations).extracting(v -> v.getPropertyPath().toString()).contains("website");
    }

    @ParameterizedTest
    @ValueSource(strings = {"http://example.com", "https://example.com/path?query=1"})
    void wellFormedWebsiteHasNoViolations(String website) {
        UpdateClubProfileRequest request = new UpdateClubProfileRequest(
                null, null, null, null, null, null, website);

        assertThat(validator.validate(request)).isEmpty();
    }
}
