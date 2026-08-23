package com.cricketlegend.service.impl;

import com.cricketlegend.domain.Address;
import com.cricketlegend.domain.ClubProfile;
import com.cricketlegend.domain.SocialLink;
import com.cricketlegend.dto.AddressDto;
import com.cricketlegend.dto.ClubProfileDto;
import com.cricketlegend.dto.SocialLinkDto;
import com.cricketlegend.dto.UpdateClubProfileRequest;
import com.cricketlegend.exception.NotFoundException;
import com.cricketlegend.exception.ValidationException;
import com.cricketlegend.mapper.ClubProfileMapper;
import com.cricketlegend.repository.ClubProfileRepository;
import com.cricketlegend.repository.ClubRepository;
import com.cricketlegend.service.ClubProfileService;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Business rules per docs/specs/012-club-profile.md: {@code get} returns a default-shaped DTO
 * instead of 404 when a Club has no profile row yet; {@code upsert} is a full-resource replace,
 * not a partial patch (matching {@code ClubServiceImpl.update()}'s existing posture for
 * {@code Club} itself); both verify the owning {@code Club} exists first.
 *
 * <p>Both methods are {@code @Transactional} since docs/specs/022-club-social-media.md added
 * {@code ClubProfile.socialLinks}, an {@code @ElementCollection} — which JPA defaults to lazy.
 * {@code get()} previously mapped the fetched entity to a DTO *after* {@code findById}'s own
 * transaction had already closed, so {@code socialLinks} was an uninitialized Hibernate proxy by
 * the time the mapper touched it — a {@code LazyInitializationException}, surfacing as a 500,
 * caught by manual smoke testing (a plain {@code GET} on a real profile). {@code upsert()} never
 * hit this in practice (it maps the entity it just set the collection on directly, never lazily
 * loading anything), but is annotated too for the same reason {@code ClubContactServiceImpl}'s
 * `create`/`update` already are (021) — a read-then-write sequence should be one atomic unit.
 */
@Service
public class ClubProfileServiceImpl implements ClubProfileService {

    private final ClubRepository clubRepository;
    private final ClubProfileRepository clubProfileRepository;
    private final ClubProfileMapper clubProfileMapper;

    public ClubProfileServiceImpl(
            ClubRepository clubRepository,
            ClubProfileRepository clubProfileRepository,
            ClubProfileMapper clubProfileMapper) {
        this.clubRepository = clubRepository;
        this.clubProfileRepository = clubProfileRepository;
        this.clubProfileMapper = clubProfileMapper;
    }

    @Override
    @Transactional(readOnly = true)
    public ClubProfileDto get(UUID clubId) {
        requireClubExists(clubId);
        return clubProfileRepository
                .findById(clubId)
                .map(clubProfileMapper::toDto)
                .orElseGet(() -> defaultDto(clubId));
    }

    @Override
    @Transactional
    public ClubProfileDto upsert(UUID clubId, UpdateClubProfileRequest request) {
        requireClubExists(clubId);
        requireNoDuplicatePlatform(request.socialLinks());

        ClubProfile profile = clubProfileRepository.findById(clubId).orElseGet(() -> {
            ClubProfile created = new ClubProfile();
            created.setClubId(clubId);
            return created;
        });

        profile.setType(request.type());
        profile.setLogoUrl(request.logoUrl());
        profile.setBannerUrl(request.bannerUrl());
        profile.setAddress(toAddress(request.address()));
        profile.setEmail(request.email());
        profile.setPhone(request.phone());
        profile.setWebsite(request.website());
        profile.setSocialLinks(toSocialLinks(request.socialLinks()));

        return clubProfileMapper.toDto(clubProfileRepository.save(profile));
    }

    private void requireClubExists(UUID clubId) {
        if (!clubRepository.existsById(clubId)) {
            throw new NotFoundException("Club not found: " + clubId);
        }
    }

    private ClubProfileDto defaultDto(UUID clubId) {
        return new ClubProfileDto(
                clubId, null, null, null, null, null, null, null, null, null, null, List.of());
    }

    private Address toAddress(AddressDto dto) {
        if (dto == null) {
            return null;
        }
        return Address.builder()
                .number(dto.number())
                .street(dto.street())
                .city(dto.city())
                .provinceState(dto.provinceState())
                .country(dto.country())
                .postalCode(dto.postalCode())
                .build();
    }

    private void requireNoDuplicatePlatform(List<SocialLinkDto> dtos) {
        if (dtos == null) {
            return;
        }
        Set<String> seen = new HashSet<>();
        for (SocialLinkDto dto : dtos) {
            if (!seen.add(dto.platform())) {
                throw new ValidationException("Duplicate social media platform: " + dto.platform());
            }
        }
    }

    private List<SocialLink> toSocialLinks(List<SocialLinkDto> dtos) {
        if (dtos == null) {
            return new ArrayList<>();
        }
        List<SocialLink> links = new ArrayList<>();
        for (SocialLinkDto dto : dtos) {
            links.add(SocialLink.builder().platform(dto.platform()).url(dto.url()).build());
        }
        return links;
    }
}
