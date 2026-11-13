package com.cricketlegend.service.impl;

import com.cricketlegend.domain.ClubProfile;
import com.cricketlegend.dto.ClubHubSettingsDto;
import com.cricketlegend.exception.NotFoundException;
import com.cricketlegend.exception.ValidationException;
import com.cricketlegend.repository.ClubProfileRepository;
import com.cricketlegend.repository.ClubRepository;
import com.cricketlegend.service.ClubHubSettingsService;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * docs/specs/148-player-hub-club-info.md: the switches live on {@code club_profile} but are written only here, never by
 * the profile form, so a profile save cannot reset them and this save cannot touch the profile's other columns.
 */
@Service
public class ClubHubSettingsServiceImpl implements ClubHubSettingsService {

    private final ClubRepository clubRepository;
    private final ClubProfileRepository clubProfileRepository;

    public ClubHubSettingsServiceImpl(ClubRepository clubRepository, ClubProfileRepository clubProfileRepository) {
        this.clubRepository = clubRepository;
        this.clubProfileRepository = clubProfileRepository;
    }

    @Override
    @Transactional(readOnly = true)
    public ClubHubSettingsDto get(UUID clubId) {
        requireClub(clubId);
        // A new ClubProfile carries the column defaults, so a club with no row reads as the defaults.
        return toDto(clubProfileRepository.findById(clubId).orElseGet(ClubProfile::new));
    }

    @Override
    @Transactional
    public ClubHubSettingsDto put(UUID clubId, ClubHubSettingsDto settings) {
        requireClub(clubId);
        if (!settings.directoryShown() && (settings.directoryPhoneShown() || settings.directoryEmailShown())) {
            throw new ValidationException("The directory must be on before its phone numbers or email addresses can be shown");
        }
        ClubProfile profile = clubProfileRepository.findById(clubId).orElseGet(() -> {
            ClubProfile created = new ClubProfile();
            created.setClubId(clubId);
            return created;
        });
        profile.setHubInfoIdentity(settings.identityShown());
        profile.setHubInfoContact(settings.contactShown());
        profile.setHubInfoLinks(settings.linksShown());
        profile.setHubInfoLogos(settings.logosShown());
        profile.setHubInfoLogoDownload(settings.logoDownloadAllowed());
        profile.setHubInfoDirectory(settings.directoryShown());
        profile.setHubInfoDirectoryPhone(settings.directoryPhoneShown());
        profile.setHubInfoDirectoryEmail(settings.directoryEmailShown());
        return toDto(clubProfileRepository.save(profile));
    }

    private ClubHubSettingsDto toDto(ClubProfile profile) {
        return new ClubHubSettingsDto(
                profile.isHubInfoIdentity(),
                profile.isHubInfoContact(),
                profile.isHubInfoLinks(),
                profile.isHubInfoLogos(),
                profile.isHubInfoLogoDownload(),
                profile.isHubInfoDirectory(),
                profile.isHubInfoDirectoryPhone(),
                profile.isHubInfoDirectoryEmail());
    }

    private void requireClub(UUID clubId) {
        if (!clubRepository.existsById(clubId)) {
            throw new NotFoundException("Club not found: " + clubId);
        }
    }
}
