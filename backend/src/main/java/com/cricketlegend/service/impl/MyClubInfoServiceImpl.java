package com.cricketlegend.service.impl;

import com.cricketlegend.domain.Address;
import com.cricketlegend.domain.Club;
import com.cricketlegend.domain.ClubContact;
import com.cricketlegend.domain.ClubProfile;
import com.cricketlegend.domain.Contact;
import com.cricketlegend.domain.SocialLink;
import com.cricketlegend.dto.MyClubAboutDto;
import com.cricketlegend.dto.MyClubAddressDto;
import com.cricketlegend.dto.MyClubContactDto;
import com.cricketlegend.dto.MyClubContactPageDto;
import com.cricketlegend.dto.MyClubDirectoryDto;
import com.cricketlegend.dto.MyClubInfoDto;
import com.cricketlegend.dto.MyClubLinksDto;
import com.cricketlegend.dto.MyClubLogosDto;
import com.cricketlegend.dto.MyClubSocialLinkDto;
import com.cricketlegend.dto.MyClubTabDto;
import com.cricketlegend.exception.NotFoundException;
import com.cricketlegend.exception.ValidationException;
import com.cricketlegend.repository.ClubContactRepository;
import com.cricketlegend.repository.ClubProfileRepository;
import com.cricketlegend.repository.ClubRepository;
import com.cricketlegend.service.MyClubInfoService;
import com.cricketlegend.service.support.ClubInfoRules;
import com.cricketlegend.service.support.HeldPlayer;
import com.cricketlegend.service.support.MyPlayerAccess;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * docs/specs/148-player-hub-club-info.md. Authorised only by {@link MyPlayerAccess#resolve}; the club comes from the
 * resolved player, never from the request. Every club switch is applied here, so a switched-off block is null in the
 * response. The directory is club contacts only: it never reads person, player_profile or person_link, so no player or
 * player's manager can be returned. A club with no profile row reads as the default switches (a new
 * {@link ClubProfile} carries them).
 */
@Service
class MyClubInfoServiceImpl implements MyClubInfoService {

    static final int DEFAULT_SIZE = 25;
    static final int MAX_SIZE = 50;
    static final int MAX_QUERY_LENGTH = 60;
    private static final String SORT_NAME = "name";
    private static final String SORT_ROLE = "role";
    private static final String NOT_SHARED = "Contacts are not shared";
    private static final Logger log = LoggerFactory.getLogger(MyClubInfoServiceImpl.class);

    private final MyPlayerAccess myPlayerAccess;
    private final ClubRepository clubRepository;
    private final ClubProfileRepository clubProfileRepository;
    private final ClubContactRepository clubContactRepository;

    MyClubInfoServiceImpl(
            MyPlayerAccess myPlayerAccess,
            ClubRepository clubRepository,
            ClubProfileRepository clubProfileRepository,
            ClubContactRepository clubContactRepository) {
        this.myPlayerAccess = myPlayerAccess;
        this.clubRepository = clubRepository;
        this.clubProfileRepository = clubProfileRepository;
        this.clubContactRepository = clubContactRepository;
    }

    @Override
    @Transactional(readOnly = true)
    public MyClubInfoDto info(Authentication authentication, String playerKey) {
        HeldPlayer held = myPlayerAccess.resolve(authentication, playerKey);
        UUID clubId = held.profile().getClubId();
        String clubName = clubRepository.findById(clubId).map(Club::getName).orElse(null);
        ClubProfile profile = clubProfileRepository.findById(clubId).orElseGet(ClubProfile::new);
        boolean directoryVisible = profile.isHubInfoDirectory() && held.canSeeClubDirectory();
        long contactTotal = directoryVisible ? clubContactRepository.countDirectory(clubId, "%", "") : 0;
        return build(clubName, profile, directoryVisible, contactTotal);
    }

    @Override
    @Transactional(readOnly = true)
    public MyClubContactPageDto contacts(
            Authentication authentication, String playerKey, String query, String sort, String letter, Integer page, Integer size) {
        HeldPlayer held = myPlayerAccess.resolve(authentication, playerKey);
        UUID clubId = held.profile().getClubId();
        ClubProfile profile = clubProfileRepository.findById(clubId).orElseGet(ClubProfile::new);
        if (!held.canSeeClubDirectory() || !profile.isHubInfoDirectory()) {
            throw new NotFoundException(NOT_SHARED);
        }
        String text = ClubInfoRules.blankToNull(query);
        if (text != null && text.length() > MAX_QUERY_LENGTH) {
            throw new ValidationException("query must be at most " + MAX_QUERY_LENGTH + " characters");
        }
        String letterFilter = letter == null || letter.isEmpty() ? "" : letter;
        if (!letterFilter.isEmpty() && !ClubInfoRules.isLetterFilter(letterFilter)) {
            throw new ValidationException("letter must be A to Z or #");
        }
        String sortKey = sort == null || sort.isEmpty() ? SORT_NAME : sort;
        if (!SORT_NAME.equals(sortKey) && !SORT_ROLE.equals(sortKey)) {
            throw new ValidationException("sort must be name or role");
        }
        int pageNumber = page == null ? 0 : page;
        int pageSize = size == null ? DEFAULT_SIZE : size;
        if (pageNumber < 0) {
            throw new ValidationException("page must not be negative");
        }
        if (pageSize < 1 || pageSize > MAX_SIZE) {
            throw new ValidationException("size must be between 1 and " + MAX_SIZE);
        }

        String pattern = ClubInfoRules.likePattern(text);
        PageRequest pageRequest = PageRequest.of(pageNumber, pageSize);
        long total = clubContactRepository.countDirectory(clubId, pattern, letterFilter);
        List<ClubContact> rows = SORT_ROLE.equals(sortKey)
                ? clubContactRepository.directoryByRole(clubId, pattern, letterFilter, pageRequest)
                : clubContactRepository.directoryByName(clubId, pattern, letterFilter, pageRequest);
        List<String> letters = ClubInfoRules.sortedLetters(clubContactRepository.directoryLetters(clubId, pattern));

        // The audit line of who read the directory: ids and counts only, never a name, number or email.
        log.info("Club directory read: clubId={} personId={} returned={} total={}",
                clubId, held.caller().getId(), rows.size(), total);
        return buildPage(profile, rows, letters, pageNumber, pageSize, total);
    }

    /** The one place the Club info response is built (backend.md exception of 2026-11-12). */
    private MyClubInfoDto build(String clubName, ClubProfile profile, boolean directoryVisible, long contactTotal) {
        Address address = profile.getAddress();
        MyClubAddressDto addressDto = profile.isHubInfoIdentity() ? addressOf(address) : null;
        String type = profile.isHubInfoIdentity() && profile.getType() != null ? profile.getType().name() : null;
        String phone = profile.isHubInfoContact() ? ClubInfoRules.blankToNull(profile.getPhone()) : null;
        String email = profile.isHubInfoContact() ? ClubInfoRules.blankToNull(profile.getEmail()) : null;
        String logoUrl = profile.isHubInfoLogos() ? ClubInfoRules.blankToNull(profile.getLogoUrl()) : null;
        String bannerUrl = profile.isHubInfoLogos() ? ClubInfoRules.blankToNull(profile.getBannerUrl()) : null;

        // Decision 11: the logos block counts toward About (the images live there); each field below is already gated by its own switch.
        boolean aboutVisible = (profile.isHubInfoIdentity() || profile.isHubInfoContact() || profile.isHubInfoLogos())
                && (type != null || addressDto != null || phone != null || email != null || logoUrl != null || bannerUrl != null);
        MyClubAboutDto about = aboutVisible ? new MyClubAboutDto(type, addressDto, phone, email) : null;
        MyClubLogosDto logos = aboutVisible && (logoUrl != null || bannerUrl != null)
                ? new MyClubLogosDto(logoUrl, bannerUrl, profile.isHubInfoLogoDownload())
                : null;

        String website = profile.isHubInfoLinks() ? ClubInfoRules.httpsUrl(profile.getWebsite()) : null;
        List<MyClubSocialLinkDto> social = new ArrayList<>();
        if (profile.isHubInfoLinks()) {
            for (SocialLink link : profile.getSocialLinks()) {
                String url = ClubInfoRules.httpsUrl(link.getUrl());
                if (url != null) {
                    social.add(new MyClubSocialLinkDto(ClubInfoRules.blankToNull(link.getPlatform()), url));
                }
            }
        }
        boolean linksVisible = website != null || !social.isEmpty();
        MyClubLinksDto links = linksVisible ? new MyClubLinksDto(website, social) : null;

        boolean contactsVisible = directoryVisible && contactTotal > 0;
        MyClubDirectoryDto directory = contactsVisible
                ? new MyClubDirectoryDto(contactTotal, phoneShown(profile), emailShown(profile))
                : null;

        List<MyClubTabDto> tabs = new ArrayList<>();
        if (aboutVisible) {
            tabs.add(new MyClubTabDto("about", null));
        }
        if (contactsVisible) {
            tabs.add(new MyClubTabDto("contacts", (int) contactTotal));
        }
        if (linksVisible) {
            tabs.add(new MyClubTabDto("links", (website == null ? 0 : 1) + social.size()));
        }
        return new MyClubInfoDto(clubName, tabs, about, links, logos, directory);
    }

    private MyClubAddressDto addressOf(Address address) {
        if (address == null) {
            return null;
        }
        MyClubAddressDto dto = new MyClubAddressDto(
                ClubInfoRules.blankToNull(address.getNumber()),
                ClubInfoRules.blankToNull(address.getStreet()),
                ClubInfoRules.blankToNull(address.getCity()),
                ClubInfoRules.blankToNull(address.getProvinceState()),
                ClubInfoRules.blankToNull(address.getCountry()),
                ClubInfoRules.blankToNull(address.getPostalCode()));
        boolean any = dto.number() != null || dto.street() != null || dto.city() != null
                || dto.provinceState() != null || dto.country() != null || dto.postalCode() != null;
        return any ? dto : null;
    }

    private MyClubContactPageDto buildPage(
            ClubProfile profile, List<ClubContact> rows, List<String> letters, int page, int size, long total) {
        boolean phoneShown = phoneShown(profile);
        boolean emailShown = emailShown(profile);
        List<MyClubContactDto> items = new ArrayList<>();
        for (ClubContact row : rows) {
            Contact contact = row.getContact();
            items.add(new MyClubContactDto(
                    row.getId(),
                    contact.getFirstName(),
                    contact.getLastName(),
                    row.getRole(),
                    row.isPrimary(),
                    phoneShown ? ClubInfoRules.blankToNull(contact.getPhone()) : null,
                    emailShown ? ClubInfoRules.blankToNull(contact.getEmail()) : null));
        }
        return new MyClubContactPageDto(items, letters, page, size, total, (long) (page + 1) * size < total);
    }

    /** Directory phone and email count as off whenever the directory itself is off. */
    private boolean phoneShown(ClubProfile profile) {
        return profile.isHubInfoDirectory() && profile.isHubInfoDirectoryPhone();
    }

    private boolean emailShown(ClubProfile profile) {
        return profile.isHubInfoDirectory() && profile.isHubInfoDirectoryEmail();
    }
}
