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
import java.math.BigDecimal;
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
                "  Irene Oval ", PlayingAreaCategory.CLUB, PlayingAreaOwnerType.CLUB, " Irene CC ", address, mapUrl, "  gate B ",
                null, null, null, null, null);
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

    private static PlayingAreaRequest located(
            BigDecimal lat, BigDecimal lng, BigDecimal accessLat, BigDecimal accessLng, String note) {
        return new PlayingAreaRequest(
                "Irene Oval", PlayingAreaCategory.CLUB, PlayingAreaOwnerType.CLUB, "Irene CC",
                address("1 Main Rd", "Pretoria", "ZA"), null, null, lat, lng, accessLat, accessLng, note);
    }

    private static BigDecimal bd(String value) {
        return new BigDecimal(value);
    }

    @Test
    void coordinatesAndAccessPointAreStoredRoundedToSixDecimalsWithATrimmedNote() {
        PlayingArea area = new PlayingArea();

        writer().apply(area, located(bd("-25.8812345"), bd("28.2"), bd("-25.88"), bd("28.21"), "  Gate 2 off Main Rd "));

        assertThat(area.getLatitude()).isEqualByComparingTo("-25.881235");
        assertThat(area.getLongitude()).isEqualByComparingTo("28.2");
        assertThat(area.getAccessLatitude()).isEqualByComparingTo("-25.88");
        assertThat(area.getAccessLongitude()).isEqualByComparingTo("28.21");
        assertThat(area.getAccessNote()).isEqualTo("Gate 2 off Main Rd");
    }

    @Test
    void boundaryValuesAreAccepted() {
        PlayingArea area = new PlayingArea();

        writer().apply(area, located(bd("90"), bd("180"), bd("-90"), bd("-180"), null));

        assertThat(area.getLatitude()).isEqualByComparingTo("90");
        assertThat(area.getLongitude()).isEqualByComparingTo("180");
        assertThat(area.getAccessLatitude()).isEqualByComparingTo("-90");
        assertThat(area.getAccessLongitude()).isEqualByComparingTo("-180");
    }

    @Test
    void editingWithNoCoordinatesClearsThem() {
        PlayingArea area = new PlayingArea();
        area.setLatitude(bd("1"));
        area.setLongitude(bd("2"));
        area.setAccessLatitude(bd("1"));
        area.setAccessLongitude(bd("2"));
        area.setAccessNote("x");

        writer().apply(area, located(null, null, null, null, null));

        assertThat(area.getLatitude()).isNull();
        assertThat(area.getLongitude()).isNull();
        assertThat(area.getAccessLatitude()).isNull();
        assertThat(area.getAccessLongitude()).isNull();
        assertThat(area.getAccessNote()).isNull();
    }

    @Test
    void outOfRangeCoordinatesAreRefused() {
        assertThatThrownBy(() -> writer().apply(new PlayingArea(), located(bd("90.000001"), bd("0"), null, null, null)))
                .isInstanceOf(ValidationException.class).hasMessageContaining("latitude");
        assertThatThrownBy(() -> writer().apply(new PlayingArea(), located(bd("0"), bd("-180.1"), null, null, null)))
                .isInstanceOf(ValidationException.class).hasMessageContaining("longitude");
        assertThatThrownBy(() -> writer().apply(new PlayingArea(), located(null, null, bd("-91"), bd("0"), null)))
                .isInstanceOf(ValidationException.class).hasMessageContaining("accessLatitude");
        assertThatThrownBy(() -> writer().apply(new PlayingArea(), located(null, null, bd("0"), bd("181"), null)))
                .isInstanceOf(ValidationException.class).hasMessageContaining("accessLongitude");
    }

    @Test
    void aPairNeedsBothValues() {
        assertThatThrownBy(() -> writer().apply(new PlayingArea(), located(bd("1"), null, null, null, null)))
                .isInstanceOf(ValidationException.class).hasMessageContaining("together");
        assertThatThrownBy(() -> writer().apply(new PlayingArea(), located(null, bd("1"), null, null, null)))
                .isInstanceOf(ValidationException.class);
        assertThatThrownBy(() -> writer().apply(new PlayingArea(), located(null, null, null, bd("1"), null)))
                .isInstanceOf(ValidationException.class);
    }

    @Test
    void anAccessNoteNeedsAnAccessPoint() {
        assertThatThrownBy(() -> writer().apply(new PlayingArea(), located(bd("1"), bd("1"), null, null, "Gate 2")))
                .isInstanceOf(ValidationException.class).hasMessageContaining("accessNote");
    }

    @Test
    void anAccessNoteOver200CharactersIsRefused() {
        assertThatThrownBy(() -> writer().apply(
                        new PlayingArea(), located(null, null, bd("1"), bd("1"), "x".repeat(201))))
                .isInstanceOf(ValidationException.class).hasMessageContaining("accessNote");
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
