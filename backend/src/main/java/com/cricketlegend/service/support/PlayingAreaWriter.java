package com.cricketlegend.service.support;

import com.cricketlegend.domain.Address;
import com.cricketlegend.domain.PlayingArea;
import com.cricketlegend.domain.PlayingAreaType;
import com.cricketlegend.dto.PlayingAreaRequest;
import com.cricketlegend.exception.DuplicateFieldException;
import com.cricketlegend.exception.ValidationException;
import com.cricketlegend.mapper.PlayingAreaMapper;
import com.cricketlegend.repository.PlayingAreaRepository;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.net.URI;
import java.net.URISyntaxException;
import java.util.Locale;
import java.util.Set;
import org.springframework.stereotype.Component;

/**
 * docs/specs/099-fields-directory.md: the one place a {@link PlayingAreaRequest} is validated and applied to a {@link
 * PlayingArea}, shared by the club-scoped capture/edit and the platform edit so the rules cannot drift. Forces {@code
 * area_type = CRICKET_FIELD}, trims text, requires city/country, checks the country is an ISO 3166-1 alpha-2
 * code, accepts only an https {@code mapUrl}, and refuses a second field with the same identity (name and city ignoring
 * case, country) with {@link DuplicateFieldException}.
 */
@Component
public class PlayingAreaWriter {

    private static final int COORDINATE_SCALE = 6;
    private static final BigDecimal MAX_LATITUDE = BigDecimal.valueOf(90);
    private static final BigDecimal MAX_LONGITUDE = BigDecimal.valueOf(180);
    private static final Set<String> ISO_COUNTRIES = Set.of(Locale.getISOCountries());

    private final PlayingAreaRepository playingAreaRepository;
    private final PlayingAreaMapper playingAreaMapper;

    public PlayingAreaWriter(PlayingAreaRepository playingAreaRepository, PlayingAreaMapper playingAreaMapper) {
        this.playingAreaRepository = playingAreaRepository;
        this.playingAreaMapper = playingAreaMapper;
    }

    /** Validates {@code request} and copies it onto {@code target} (a new or existing row); does not save. */
    public void apply(PlayingArea target, PlayingAreaRequest request) {
        String name = requireText(request.name(), "name", 200);
        String ownerName = requireText(request.ownerName(), "ownerName", 200);
        Address address = normaliseAddress(playingAreaMapper.toAddress(request.address()));
        String mapUrl = validateMapUrl(request.mapUrl());
        String notes = optionalText(request.locationNotes(), "locationNotes", 500);

        BigDecimal[] position = coordinatePair(request.latitude(), request.longitude(), "latitude", "longitude");
        BigDecimal[] access =
                coordinatePair(request.accessLatitude(), request.accessLongitude(), "accessLatitude", "accessLongitude");
        String accessNote = optionalText(request.accessNote(), "accessNote", 200);
        if (accessNote != null && access == null) {
            throw new ValidationException("accessNote needs an access point (accessLatitude and accessLongitude)");
        }

        playingAreaRepository
                .findByIdentity(PlayingAreaType.CRICKET_FIELD, name, address.getCity(), address.getCountry())
                .stream()
                .filter(existing -> !existing.getId().equals(target.getId()))
                .findFirst()
                .ifPresent(existing -> {
                    throw new DuplicateFieldException(
                            "A field named \"" + existing.getName() + "\" already exists in " + address.getCity(),
                            existing.getId());
                });

        target.setAreaType(PlayingAreaType.CRICKET_FIELD);
        target.setName(name);
        target.setCategory(request.category());
        target.setOwnerType(request.ownerType());
        target.setOwnerName(ownerName);
        target.setAddress(address);
        target.setMapUrl(mapUrl);
        target.setLocationNotes(notes);
        target.setLatitude(position == null ? null : position[0]);
        target.setLongitude(position == null ? null : position[1]);
        target.setAccessLatitude(access == null ? null : access[0]);
        target.setAccessLongitude(access == null ? null : access[1]);
        target.setAccessNote(accessNote);
    }

    /**
     * docs/specs/133: both or neither, latitude in -90..90 and longitude in -180..180 (boundaries allowed), rounded to
     * the column's six decimals. Returns null when neither is set.
     */
    private static BigDecimal[] coordinatePair(BigDecimal lat, BigDecimal lng, String latField, String lngField) {
        if (lat == null && lng == null) {
            return null;
        }
        if (lat == null || lng == null) {
            throw new ValidationException(latField + " and " + lngField + " must be given together");
        }
        BigDecimal roundedLat = lat.setScale(COORDINATE_SCALE, RoundingMode.HALF_UP);
        BigDecimal roundedLng = lng.setScale(COORDINATE_SCALE, RoundingMode.HALF_UP);
        if (roundedLat.abs().compareTo(MAX_LATITUDE) > 0) {
            throw new ValidationException(latField + " must be between -90 and 90");
        }
        if (roundedLng.abs().compareTo(MAX_LONGITUDE) > 0) {
            throw new ValidationException(lngField + " must be between -180 and 180");
        }
        return new BigDecimal[] {roundedLat, roundedLng};
    }

    /**
     * The comparison form used by "did you mean": lowercase with everything except letters and digits removed.
     * Mirrors the database-side expression in {@code PlayingAreaSpecifications.similarName}.
     */
    public static String normaliseName(String name) {
        return name == null ? "" : name.toLowerCase().replaceAll("[^\\p{L}\\p{N}]", "");
    }

    private Address normaliseAddress(Address raw) {
        if (raw == null) {
            throw new ValidationException("address is required");
        }
        String street = optionalText(raw.getStreet(), "address.street", 255);
        String city = requireText(raw.getCity(), "address.city", 255);
        String country = requireText(raw.getCountry(), "address.country", 2).toUpperCase(Locale.ROOT);
        if (!ISO_COUNTRIES.contains(country)) {
            throw new ValidationException("address.country must be an ISO 3166-1 alpha-2 country code");
        }
        return Address.builder()
                .number(optionalText(raw.getNumber(), "address.number", 255))
                .street(street)
                .city(city)
                .provinceState(optionalText(raw.getProvinceState(), "address.provinceState", 255))
                .country(country)
                .postalCode(optionalText(raw.getPostalCode(), "address.postalCode", 255))
                .build();
    }

    private static String requireText(String value, String field, int max) {
        String text = optionalText(value, field, max);
        if (text == null) {
            throw new ValidationException(field + " is required");
        }
        return text;
    }

    private static String optionalText(String value, String field, int max) {
        if (value == null || value.isBlank()) {
            return null;
        }
        String trimmed = value.trim();
        if (trimmed.length() > max) {
            throw new ValidationException(field + " must be at most " + max + " characters");
        }
        return trimmed;
    }

    /** Blank is null; otherwise a parseable https URL with a host (keeps {@code javascript:} and {@code data:} out). */
    private static String validateMapUrl(String value) {
        String trimmed = optionalText(value, "mapUrl", 500);
        if (trimmed == null) {
            return null;
        }
        try {
            URI uri = new URI(trimmed);
            if (!"https".equalsIgnoreCase(uri.getScheme()) || uri.getHost() == null || uri.getHost().isBlank()) {
                throw new ValidationException("mapUrl must be an https URL");
            }
        } catch (URISyntaxException e) {
            throw new ValidationException("mapUrl must be an https URL");
        }
        return trimmed;
    }
}
