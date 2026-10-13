package com.cricketlegend.service.support;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

import com.cricketlegend.domain.PlayingArea;
import com.cricketlegend.domain.PlayingAreaCategory;
import com.cricketlegend.domain.PlayingAreaOwnerType;
import com.cricketlegend.domain.PlayingAreaType;
import com.cricketlegend.dto.AddressDto;
import com.cricketlegend.dto.PlayingAreaRequest;
import com.cricketlegend.exception.DuplicateFieldException;
import com.cricketlegend.exception.ValidationException;
import com.cricketlegend.mapper.PlayingAreaMapperImpl;
import com.cricketlegend.repository.PlayingAreaRepository;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

/**
 * Unit tests for the shared validation in {@link PlayingAreaWriter} (docs/specs/099-fields-directory.md Test Plan):
 * area type forced to CRICKET_FIELD, https-only map URL, city and country required (street optional), ISO country
 * code, duplicate identity refused.
 */
@ExtendWith(MockitoExtension.class)
class PlayingAreaWriterTest {

    @Mock
    private PlayingAreaRepository playingAreaRepository;

    private PlayingAreaWriter writer() {
        return new PlayingAreaWriter(playingAreaRepository, new PlayingAreaMapperImpl());
    }

    private static AddressDto address(String street, String city, String country) {
        return new AddressDto(null, street, city, "Gauteng", country, null);
    }

    private static PlayingAreaRequest request(AddressDto address, String mapUrl) {
        return new PlayingAreaRequest(
                "  Irene Oval ", PlayingAreaCategory.CLUB, PlayingAreaOwnerType.CLUB, " Irene CC ", address, mapUrl, "  gate B ");
    }

    @Test
    void applyForcesCricketFieldTrimsTextAndUppercasesCountry() {
        PlayingArea area = new PlayingArea();

        writer().apply(area, request(address(" 1 Main Rd ", " Pretoria ", "za"), " https://maps.example.com/x "));

        assertThat(area.getAreaType()).isEqualTo(PlayingAreaType.CRICKET_FIELD);
        assertThat(area.getName()).isEqualTo("Irene Oval");
        assertThat(area.getOwnerName()).isEqualTo("Irene CC");
        assertThat(area.getAddress().getStreet()).isEqualTo("1 Main Rd");
        assertThat(area.getAddress().getCity()).isEqualTo("Pretoria");
        assertThat(area.getAddress().getCountry()).isEqualTo("ZA");
        assertThat(area.getMapUrl()).isEqualTo("https://maps.example.com/x");
        assertThat(area.getLocationNotes()).isEqualTo("gate B");
    }

    @Test
    void streetIsOptional() {
        PlayingArea area = new PlayingArea();

        writer().apply(area, request(address(null, "Pretoria", "ZA"), null));

        assertThat(area.getAddress().getStreet()).isNull();
        assertThat(area.getMapUrl()).isNull();
    }

    @Test
    void blankMapUrlBecomesNull() {
        PlayingArea area = new PlayingArea();

        writer().apply(area, request(address(null, "Pretoria", "ZA"), "   "));

        assertThat(area.getMapUrl()).isNull();
    }

    @ParameterizedTest
    @ValueSource(strings = {"javascript:alert(1)", "data:text/html,<b>x</b>", "http://maps.example.com/x", "ftp://x.example.com", "not a url", "https://"})
    void nonHttpsMapUrlIsRefused(String url) {
        assertThatThrownBy(() -> writer().apply(new PlayingArea(), request(address(null, "Pretoria", "ZA"), url)))
                .isInstanceOf(ValidationException.class)
                .hasMessageContaining("mapUrl");
    }

    @Test
    void cityIsRequired() {
        assertThatThrownBy(() -> writer().apply(new PlayingArea(), request(address("Main", "  ", "ZA"), null)))
                .isInstanceOf(ValidationException.class)
                .hasMessageContaining("address.city");
    }

    @Test
    void countryIsRequired() {
        assertThatThrownBy(() -> writer().apply(new PlayingArea(), request(address("Main", "Pretoria", null), null)))
                .isInstanceOf(ValidationException.class)
                .hasMessageContaining("address.country");
    }

    @Test
    void addressIsRequired() {
        assertThatThrownBy(() -> writer().apply(new PlayingArea(), request(null, null)))
                .isInstanceOf(ValidationException.class)
                .hasMessageContaining("address");
    }

    @ParameterizedTest
    @ValueSource(strings = {"XX", "ZZ", "ZAF", "Z"})
    void countryMustBeAnIsoAlpha2Code(String country) {
        assertThatThrownBy(() -> writer().apply(new PlayingArea(), request(address(null, "Pretoria", country), null)))
                .isInstanceOf(ValidationException.class);
    }

    @Test
    void anotherFieldWithTheSameIdentityIsRefusedWithTheExistingId() {
        UUID existingId = UUID.randomUUID();
        PlayingArea existing = PlayingArea.builder().id(existingId).name("Irene Oval").build();
        when(playingAreaRepository.findByIdentity(any(), any(), any(), any())).thenReturn(List.of(existing));

        assertThatThrownBy(() -> writer().apply(new PlayingArea(), request(address(null, "Pretoria", "ZA"), null)))
                .isInstanceOfSatisfying(DuplicateFieldException.class,
                        ex -> assertThat(ex.getExistingPlayingAreaId()).isEqualTo(existingId));
    }

    @Test
    void editingAFieldDoesNotConflictWithItself() {
        UUID id = UUID.randomUUID();
        PlayingArea self = PlayingArea.builder().id(id).name("Irene Oval").build();
        when(playingAreaRepository.findByIdentity(any(), any(), any(), any())).thenReturn(List.of(self));

        writer().apply(self, request(address(null, "Pretoria", "ZA"), null));

        assertThat(self.getName()).isEqualTo("Irene Oval");
    }

    @Test
    void normaliseNameStripsEverythingExceptLettersAndDigits() {
        assertThat(PlayingAreaWriter.normaliseName("St. Andrew's  Oval #2")).isEqualTo("standrewsoval2");
        assertThat(PlayingAreaWriter.normaliseName(null)).isEmpty();
    }
}
