package com.cricketlegend.service.impl;

import com.cricketlegend.domain.SocialLink;
import com.cricketlegend.domain.Sponsor;
import com.cricketlegend.dto.CreateSponsorRequest;
import com.cricketlegend.dto.SocialLinkDto;
import com.cricketlegend.dto.SponsorDto;
import com.cricketlegend.dto.UpdateSponsorRequest;
import com.cricketlegend.exception.InvalidStatusTransitionException;
import com.cricketlegend.exception.NotFoundException;
import com.cricketlegend.mapper.SponsorMapper;
import com.cricketlegend.repository.ClubRepository;
import com.cricketlegend.repository.SponsorRepository;
import com.cricketlegend.service.SponsorService;
import com.cricketlegend.service.support.SocialLinkValidation;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Business rules per docs/specs/023-sponsors.md: {@code list} returns every sponsor for a club
 * (active and inactive, not paginated — a deliberately small bounded collection, mirroring {@code
 * ClubContactServiceImpl}); {@code create}/{@code update} reject a duplicate {@code platform}
 * within the request's {@code socialLinks} via the shared {@link
 * com.cricketlegend.service.support.SocialLinkValidation}, also used by {@code
 * ClubProfileServiceImpl}; {@code deactivate}/{@code reactivate} mirror {@code
 * ClubContactServiceImpl}'s one-way
 * transition-guard shape; every lookup is scoped to the owning club, not just by id, for real
 * cross-club isolation at the data layer (not only {@code @PreAuthorize}).
 *
 * <p>Every method here is {@code @Transactional} ({@code readOnly = true} on {@code list}, plain
 * {@code @Transactional} on the rest) — {@code Sponsor.socialLinks} is an
 * {@code @ElementCollection}, which JPA defaults to lazy, the exact same shape that caused a real
 * {@code LazyInitializationException} (a 500 on a plain {@code GET}, caught only by manual
 * testing) in {@code ClubProfileServiceImpl} before it had {@code @Transactional} anywhere — see
 * that class's own Javadoc. Applied uniformly here from the start rather than rediscovered.
 */
@Service
public class SponsorServiceImpl implements SponsorService {

    private final ClubRepository clubRepository;
    private final SponsorRepository sponsorRepository;
    private final SponsorMapper sponsorMapper;

    public SponsorServiceImpl(
            ClubRepository clubRepository,
            SponsorRepository sponsorRepository,
            SponsorMapper sponsorMapper) {
        this.clubRepository = clubRepository;
        this.sponsorRepository = sponsorRepository;
        this.sponsorMapper = sponsorMapper;
    }

    @Override
    @Transactional(readOnly = true)
    public List<SponsorDto> list(UUID clubId) {
        requireClubExists(clubId);
        return sponsorRepository.findByClubId(clubId).stream().map(sponsorMapper::toDto).toList();
    }

    @Override
    @Transactional
    public SponsorDto create(UUID clubId, CreateSponsorRequest request) {
        requireClubExists(clubId);
        SocialLinkValidation.requireNoDuplicatePlatform(request.socialLinks());

        Sponsor sponsor = sponsorMapper.toEntity(request);
        sponsor.setClubId(clubId);
        sponsor.setActive(true);

        return sponsorMapper.toDto(sponsorRepository.save(sponsor));
    }

    @Override
    @Transactional
    public SponsorDto update(UUID clubId, UUID sponsorId, UpdateSponsorRequest request) {
        requireClubExists(clubId);
        SocialLinkValidation.requireNoDuplicatePlatform(request.socialLinks());
        Sponsor sponsor = findOrThrowForClub(clubId, sponsorId);

        sponsor.setName(request.name());
        sponsor.setWebsite(request.website());
        sponsor.setEmail(request.email());
        sponsor.setPhone(request.phone());
        sponsor.setLogoUrl(request.logoUrl());
        sponsor.setBannerUrl(request.bannerUrl());
        sponsor.setSocialLinks(toSocialLinks(request.socialLinks()));

        return sponsorMapper.toDto(sponsorRepository.save(sponsor));
    }

    @Override
    @Transactional
    public SponsorDto deactivate(UUID clubId, UUID sponsorId) {
        requireClubExists(clubId);
        Sponsor sponsor = findOrThrowForClub(clubId, sponsorId);
        if (!sponsor.isActive()) {
            throw new InvalidStatusTransitionException("Sponsor is already inactive: " + sponsorId);
        }
        sponsor.setActive(false);
        return sponsorMapper.toDto(sponsorRepository.save(sponsor));
    }

    @Override
    @Transactional
    public SponsorDto reactivate(UUID clubId, UUID sponsorId) {
        requireClubExists(clubId);
        Sponsor sponsor = findOrThrowForClub(clubId, sponsorId);
        if (sponsor.isActive()) {
            throw new InvalidStatusTransitionException("Sponsor is already active: " + sponsorId);
        }
        sponsor.setActive(true);
        return sponsorMapper.toDto(sponsorRepository.save(sponsor));
    }

    private void requireClubExists(UUID clubId) {
        if (!clubRepository.existsById(clubId)) {
            throw new NotFoundException("Club not found: " + clubId);
        }
    }

    /**
     * 404s when {@code sponsorId} doesn't exist at all, or exists but belongs to a different
     * club — real cross-club isolation at the data layer, not only relying on the controller's
     * {@code @PreAuthorize}. Mirrors {@code ClubContactServiceImpl.findOrThrowForClub}.
     */
    private Sponsor findOrThrowForClub(UUID clubId, UUID sponsorId) {
        Sponsor sponsor = sponsorRepository
                .findById(sponsorId)
                .orElseThrow(() -> new NotFoundException("Sponsor not found: " + sponsorId));
        if (!sponsor.getClubId().equals(clubId)) {
            throw new NotFoundException("Sponsor not found: " + sponsorId);
        }
        return sponsor;
    }

    private List<SocialLink> toSocialLinks(List<SocialLinkDto> dtos) {
        if (dtos == null) {
            return new ArrayList<>();
        }
        List<SocialLink> links = new ArrayList<>();
        for (SocialLinkDto dto : dtos) {
            links.add(sponsorMapper.toEntity(dto));
        }
        return links;
    }
}
