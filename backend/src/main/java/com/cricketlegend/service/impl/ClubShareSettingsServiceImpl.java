package com.cricketlegend.service.impl;

import com.cricketlegend.domain.ClubProfile;
import com.cricketlegend.dto.ShareSettingsDto;
import com.cricketlegend.exception.NotFoundException;
import com.cricketlegend.exception.ValidationException;
import com.cricketlegend.repository.ClubProfileRepository;
import com.cricketlegend.repository.ClubRepository;
import com.cricketlegend.service.ClubShareSettingsService;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.UUID;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * docs/specs/114-share-result.md and docs/specs/122-league-sharing.md: the settings live on {@code club_profile} but
 * are written only here, never by the profile form, so a profile save cannot reset them and this save cannot touch
 * the profile's other columns.
 */
@Service
public class ClubShareSettingsServiceImpl implements ClubShareSettingsService {

    /** Content type to the format codes it supports; the single place these are validated. */
    private static final Map<String, Set<String>> FORMATS = Map.of(
            "RESULT", Set.of("PDF", "IMAGE", "TV", "WHATSAPP", "FACEBOOK"),
            "LEAGUE", Set.of("PDF", "POSTER", "CALENDAR", "WHATSAPP", "FACEBOOK"));

    private static final ObjectMapper JSON = new ObjectMapper();
    private static final TypeReference<Map<String, List<String>>> MAP_TYPE = new TypeReference<>() {};

    private final ClubRepository clubRepository;
    private final ClubProfileRepository clubProfileRepository;

    public ClubShareSettingsServiceImpl(ClubRepository clubRepository, ClubProfileRepository clubProfileRepository) {
        this.clubRepository = clubRepository;
        this.clubProfileRepository = clubProfileRepository;
    }

    @Override
    @Transactional(readOnly = true)
    public ShareSettingsDto get(UUID clubId) {
        requireClub(clubId);
        return clubProfileRepository.findById(clubId).map(this::toDto).orElseGet(() -> new ShareSettingsDto(false, Map.of()));
    }

    @Override
    @Transactional
    public ShareSettingsDto put(UUID clubId, ShareSettingsDto settings, boolean canAdminister) {
        requireClub(clubId);
        ClubProfile profile = clubProfileRepository.findById(clubId).orElseGet(() -> {
            ClubProfile created = new ClubProfile();
            created.setClubId(clubId);
            return created;
        });
        if (settings.disabledFormats() != null) {
            Map<String, List<String>> normalised = validateAndNormalise(settings.disabledFormats());
            if (!normalised.equals(read(profile.getShareDisabledFormats()))) {
                if (!canAdminister) {
                    throw new AccessDeniedException("Only a club administrator can change the enabled share formats");
                }
                profile.setShareDisabledFormats(write(normalised));
            }
        }
        profile.setShareInitialsOnly(settings.initialsOnlyDefault());
        return toDto(clubProfileRepository.save(profile));
    }

    private ShareSettingsDto toDto(ClubProfile profile) {
        return new ShareSettingsDto(profile.isShareInitialsOnly(), read(profile.getShareDisabledFormats()));
    }

    private Map<String, List<String>> validateAndNormalise(Map<String, List<String>> requested) {
        Map<String, List<String>> result = new TreeMap<>();
        for (Map.Entry<String, List<String>> entry : requested.entrySet()) {
            Set<String> supported = FORMATS.get(entry.getKey());
            if (supported == null) {
                throw new ValidationException("Unknown share content type: " + entry.getKey());
            }
            List<String> codes = entry.getValue() == null ? List.of() : entry.getValue();
            for (String code : codes) {
                if (!supported.contains(code)) {
                    throw new ValidationException("Unknown " + entry.getKey() + " share format: " + code);
                }
            }
            List<String> distinct = new ArrayList<>(new java.util.TreeSet<>(codes));
            if (distinct.size() >= supported.size()) {
                throw new ValidationException("At least one share format must stay enabled for " + entry.getKey());
            }
            if (!distinct.isEmpty()) {
                result.put(entry.getKey(), distinct);
            }
        }
        return result;
    }

    private Map<String, List<String>> read(String json) {
        if (json == null || json.isBlank()) {
            return new TreeMap<>();
        }
        try {
            return new TreeMap<>(JSON.readValue(json, MAP_TYPE));
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Stored share_disabled_formats is not valid JSON", e);
        }
    }

    private String write(Map<String, List<String>> map) {
        try {
            return JSON.writeValueAsString(new LinkedHashMap<>(map));
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Could not serialise share formats", e);
        }
    }

    private void requireClub(UUID clubId) {
        if (!clubRepository.existsById(clubId)) {
            throw new NotFoundException("Club not found: " + clubId);
        }
    }
}
