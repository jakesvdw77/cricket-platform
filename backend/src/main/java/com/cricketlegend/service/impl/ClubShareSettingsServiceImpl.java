package com.cricketlegend.service.impl;

import com.cricketlegend.domain.ClubProfile;
import com.cricketlegend.dto.ShareSettingsDto;
import com.cricketlegend.exception.NotFoundException;
import com.cricketlegend.repository.ClubProfileRepository;
import com.cricketlegend.repository.ClubRepository;
import com.cricketlegend.service.ClubShareSettingsService;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * docs/specs/114-share-result.md: the flag lives on {@code club_profile} but is written only here, never by the
 * profile form, so a profile save cannot reset it and this save cannot touch the profile's other columns.
 */
@Service
public class ClubShareSettingsServiceImpl implements ClubShareSettingsService {

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
        return new ShareSettingsDto(clubProfileRepository
                .findById(clubId)
                .map(ClubProfile::isShareInitialsOnly)
                .orElse(false));
    }

    @Override
    @Transactional
    public ShareSettingsDto put(UUID clubId, ShareSettingsDto settings) {
        requireClub(clubId);
        ClubProfile profile = clubProfileRepository.findById(clubId).orElseGet(() -> {
            ClubProfile created = new ClubProfile();
            created.setClubId(clubId);
            return created;
        });
        profile.setShareInitialsOnly(settings.initialsOnlyDefault());
        return new ShareSettingsDto(clubProfileRepository.save(profile).isShareInitialsOnly());
    }

    private void requireClub(UUID clubId) {
        if (!clubRepository.existsById(clubId)) {
            throw new NotFoundException("Club not found: " + clubId);
        }
    }
}
