package com.cricketlegend.service.impl;

import com.cricketlegend.domain.Club;
import com.cricketlegend.domain.ClubStatus;
import com.cricketlegend.dto.ClubDto;
import com.cricketlegend.dto.CreateClubRequest;
import com.cricketlegend.dto.UpdateClubRequest;
import com.cricketlegend.exception.DuplicateSlugException;
import com.cricketlegend.exception.InvalidStatusTransitionException;
import com.cricketlegend.exception.NotFoundException;
import com.cricketlegend.exception.ReservedSlugException;
import com.cricketlegend.mapper.ClubMapper;
import com.cricketlegend.repository.ClubRepository;
import com.cricketlegend.service.ClubService;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

/**
 * Business rules per docs/specs/010-minimal-club-creation.md: slug format is enforced by bean
 * validation on the request records, the ADR-04 reserved-word blocklist and slug uniqueness
 * (case-insensitive) are enforced here; create always lands ACTIVE (bypassing Club's own
 * @PrePersist default of ONBOARDING, which stays unchanged for any other future code path); and
 * suspend/reactivate are a one-way-per-call ACTIVE <-> SUSPENDED transition pair.
 */
@Service
public class ClubServiceImpl implements ClubService {

    /**
     * docs/specs/002-realm-subdomain-auth.md ADR-04's reserved subdomain word list. Lives here for
     * now — that spec's TenantResolutionFilter doesn't exist yet to share it with; extract once it
     * does.
     */
    private static final Set<String> RESERVED_SLUGS =
            Set.of("www", "auth", "api", "app", "admin", "static", "mail", "cdn", "status", "docs");

    private final ClubRepository clubRepository;
    private final ClubMapper clubMapper;

    public ClubServiceImpl(ClubRepository clubRepository, ClubMapper clubMapper) {
        this.clubRepository = clubRepository;
        this.clubMapper = clubMapper;
    }

    @Override
    public ClubDto create(CreateClubRequest request) {
        validateSlug(request.slug());
        if (clubRepository.existsBySlugIgnoreCase(request.slug())) {
            throw new DuplicateSlugException("Club slug already in use: " + request.slug());
        }

        Club club = Club.builder().name(request.name()).slug(request.slug()).status(ClubStatus.ACTIVE).build();

        return clubMapper.toDto(clubRepository.save(club));
    }

    @Override
    public ClubDto get(UUID id) {
        return clubMapper.toDto(findOrThrow(id));
    }

    @Override
    public Page<ClubDto> list(String search, Pageable pageable) {
        Pageable effectivePageable = withDefaultSort(pageable);
        return clubRepository.search(search, effectivePageable).map(clubMapper::toDto);
    }

    private Pageable withDefaultSort(Pageable pageable) {
        if (pageable.getSort().isSorted()) {
            return pageable;
        }
        return PageRequest.of(pageable.getPageNumber(), pageable.getPageSize(), Sort.by("name").ascending());
    }

    @Override
    public ClubDto update(UUID id, UpdateClubRequest request) {
        Club club = findOrThrow(id);

        validateSlug(request.slug());
        if (clubRepository.existsBySlugIgnoreCaseAndIdNot(request.slug(), id)) {
            throw new DuplicateSlugException("Club slug already in use: " + request.slug());
        }

        club.setName(request.name());
        club.setSlug(request.slug());

        return clubMapper.toDto(clubRepository.save(club));
    }

    @Override
    public ClubDto suspend(UUID id) {
        Club club = findOrThrow(id);
        if (club.getStatus() == ClubStatus.SUSPENDED) {
            throw new InvalidStatusTransitionException("Club is already suspended: " + id);
        }
        club.setStatus(ClubStatus.SUSPENDED);
        return clubMapper.toDto(clubRepository.save(club));
    }

    @Override
    public ClubDto reactivate(UUID id) {
        Club club = findOrThrow(id);
        if (club.getStatus() != ClubStatus.SUSPENDED) {
            throw new InvalidStatusTransitionException("Club is not suspended: " + id);
        }
        club.setStatus(ClubStatus.ACTIVE);
        return clubMapper.toDto(clubRepository.save(club));
    }

    private Club findOrThrow(UUID id) {
        return clubRepository.findById(id).orElseThrow(() -> new NotFoundException("Club not found: " + id));
    }

    private void validateSlug(String slug) {
        if (RESERVED_SLUGS.contains(slug.toLowerCase(Locale.ROOT))) {
            throw new ReservedSlugException("Club slug is reserved: " + slug);
        }
    }
}
