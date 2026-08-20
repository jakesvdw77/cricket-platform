package com.cricketlegend.service.impl;

import com.cricketlegend.domain.Address;
import com.cricketlegend.domain.ClubProfile;
import com.cricketlegend.dto.AddressDto;
import com.cricketlegend.dto.ClubProfileDto;
import com.cricketlegend.dto.UpdateClubProfileRequest;
import com.cricketlegend.exception.NotFoundException;
import com.cricketlegend.mapper.ClubProfileMapper;
import com.cricketlegend.repository.ClubProfileRepository;
import com.cricketlegend.repository.ClubRepository;
import com.cricketlegend.service.ClubProfileService;
import java.util.UUID;
import org.springframework.stereotype.Service;

/**
 * Business rules per docs/specs/012-club-profile.md: {@code get} returns a default-shaped DTO
 * instead of 404 when a Club has no profile row yet; {@code upsert} is a full-resource replace,
 * not a partial patch (matching {@code ClubServiceImpl.update()}'s existing posture for
 * {@code Club} itself); both verify the owning {@code Club} exists first.
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
    public ClubProfileDto get(UUID clubId) {
        requireClubExists(clubId);
        return clubProfileRepository
                .findById(clubId)
                .map(clubProfileMapper::toDto)
                .orElseGet(() -> defaultDto(clubId));
    }

    @Override
    public ClubProfileDto upsert(UUID clubId, UpdateClubProfileRequest request) {
        requireClubExists(clubId);

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

        return clubProfileMapper.toDto(clubProfileRepository.save(profile));
    }

    private void requireClubExists(UUID clubId) {
        if (!clubRepository.existsById(clubId)) {
            throw new NotFoundException("Club not found: " + clubId);
        }
    }

    private ClubProfileDto defaultDto(UUID clubId) {
        return new ClubProfileDto(clubId, null, null, null, null, null, null, null, null, null, null);
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
}
