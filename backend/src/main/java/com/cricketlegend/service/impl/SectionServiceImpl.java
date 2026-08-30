package com.cricketlegend.service.impl;

import com.cricketlegend.domain.ClubContact;
import com.cricketlegend.domain.Section;
import com.cricketlegend.domain.SectionContact;
import com.cricketlegend.dto.ClubContactDto;
import com.cricketlegend.dto.CreateSectionRequest;
import com.cricketlegend.dto.SectionDto;
import com.cricketlegend.dto.UpdateSectionRequest;
import com.cricketlegend.exception.ConflictException;
import com.cricketlegend.exception.InvalidStatusTransitionException;
import com.cricketlegend.exception.NotFoundException;
import com.cricketlegend.exception.ValidationException;
import com.cricketlegend.mapper.ClubContactMapper;
import com.cricketlegend.mapper.SectionMapper;
import com.cricketlegend.repository.ClubContactRepository;
import com.cricketlegend.repository.SectionContactRepository;
import com.cricketlegend.repository.SectionRepository;
import com.cricketlegend.service.SectionService;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Business rules per docs/specs/025-club-structure.md: {@code list} returns every section for a
 * club (active and inactive, flat, not paginated — mirrors {@code ClubContactServiceImpl});
 * {@code create}/{@code update} validate {@code minAge <= maxAge} when both are set; {@code
 * create} additionally verifies a non-null {@code parentSectionId} belongs to the same club;
 * {@code deactivate} is blocked both by the already-inactive case and by any still-active direct
 * child (distinct messages, checked in that order); once that guard passes, {@code deactivate}
 * either soft-deactivates (a linked contact exists) or actually deletes the row (nothing is
 * attached to it — see {@link #canHardDelete}); {@code reactivate} mirrors every other spec's
 * one-way-transition-guard shape with no child-related check; {@code link}/{@code unlink} treat
 * {@link Section} and {@link ClubContact} as independent siblings under the same club — each
 * verified against {@code clubId} independently, not against each other (unlike {@code
 * SponsorContactServiceImpl}'s parent-child chain).
 */
@Service
public class SectionServiceImpl implements SectionService {

    private final SectionRepository sectionRepository;
    private final SectionContactRepository sectionContactRepository;
    private final ClubContactRepository clubContactRepository;
    private final SectionMapper sectionMapper;
    private final ClubContactMapper clubContactMapper;

    public SectionServiceImpl(
            SectionRepository sectionRepository,
            SectionContactRepository sectionContactRepository,
            ClubContactRepository clubContactRepository,
            SectionMapper sectionMapper,
            ClubContactMapper clubContactMapper) {
        this.sectionRepository = sectionRepository;
        this.sectionContactRepository = sectionContactRepository;
        this.clubContactRepository = clubContactRepository;
        this.sectionMapper = sectionMapper;
        this.clubContactMapper = clubContactMapper;
    }

    @Override
    public List<SectionDto> list(UUID clubId) {
        return sectionRepository.findByClubId(clubId).stream().map(sectionMapper::toDto).toList();
    }

    @Override
    @Transactional
    public SectionDto create(UUID clubId, CreateSectionRequest request) {
        validateAgeRange(request.minAge(), request.maxAge());

        if (request.parentSectionId() != null) {
            findOrThrowForClub(clubId, request.parentSectionId());
        }

        Section section = sectionMapper.toEntity(request);
        section.setClubId(clubId);
        section.setActive(true);

        return sectionMapper.toDto(sectionRepository.save(section));
    }

    @Override
    @Transactional
    public SectionDto update(UUID clubId, UUID sectionId, UpdateSectionRequest request) {
        validateAgeRange(request.minAge(), request.maxAge());

        Section section = findOrThrowForClub(clubId, sectionId);
        section.setName(request.name());
        section.setMinAge(request.minAge());
        section.setMaxAge(request.maxAge());
        section.setGender(request.gender());

        return sectionMapper.toDto(sectionRepository.save(section));
    }

    @Override
    @Transactional
    public Optional<SectionDto> deactivate(UUID clubId, UUID sectionId) {
        Section section = findOrThrowForClub(clubId, sectionId);
        if (!section.isActive()) {
            throw new InvalidStatusTransitionException("Section is already inactive: " + sectionId);
        }
        List<Section> activeChildren = sectionRepository.findByParentSectionIdAndActiveTrue(sectionId);
        if (!activeChildren.isEmpty()) {
            throw new InvalidStatusTransitionException(
                    "Section has " + activeChildren.size() + " active child section(s): " + sectionId);
        }

        if (canHardDelete(sectionId)) {
            sectionRepository.delete(section);
            return Optional.empty();
        }

        section.setActive(false);
        return Optional.of(sectionMapper.toDto(sectionRepository.save(section)));
    }

    /**
     * A section with nothing attached to it — no children at all (active or inactive; an
     * inactive child row would still violate {@code parent_section_id}'s FK on delete) and no
     * linked {@code ClubContact} — carries no data worth preserving, so it's actually deleted
     * instead of left as an inactive placeholder. The one deliberate exception to this codebase's
     * "disable, never delete" posture — see docs/specs/025-club-structure.md's Data Model Changes
     * Remove rule. Once {@code Team} (001, still unbuilt) exists, its own linked-rows check
     * belongs here too.
     */
    private boolean canHardDelete(UUID sectionId) {
        return !sectionRepository.existsByParentSectionId(sectionId)
                && !sectionContactRepository.existsBySectionId(sectionId);
    }

    @Override
    public SectionDto reactivate(UUID clubId, UUID sectionId) {
        Section section = findOrThrowForClub(clubId, sectionId);
        if (section.isActive()) {
            throw new InvalidStatusTransitionException("Section is already active: " + sectionId);
        }
        section.setActive(true);
        return sectionMapper.toDto(sectionRepository.save(section));
    }

    @Override
    public List<ClubContactDto> listContacts(UUID clubId, UUID sectionId) {
        findOrThrowForClub(clubId, sectionId);
        return sectionContactRepository.findBySectionId(sectionId).stream()
                .map(link -> clubContactRepository
                        .findById(link.getClubContactId())
                        .orElseThrow(() -> new NotFoundException(
                                "Club contact not found: " + link.getClubContactId())))
                .map(clubContactMapper::toDto)
                .toList();
    }

    @Override
    @Transactional
    public void link(UUID clubId, UUID sectionId, UUID contactId) {
        findOrThrowForClub(clubId, sectionId);
        findOrThrowContactForClub(clubId, contactId);

        if (sectionContactRepository.existsBySectionIdAndClubContactId(sectionId, contactId)) {
            throw new ConflictException(
                    "Club contact " + contactId + " is already linked to section " + sectionId);
        }

        SectionContact link =
                SectionContact.builder().sectionId(sectionId).clubContactId(contactId).build();
        sectionContactRepository.save(link);
    }

    @Override
    @Transactional
    public void unlink(UUID clubId, UUID sectionId, UUID contactId) {
        findOrThrowForClub(clubId, sectionId);

        sectionContactRepository
                .findBySectionIdAndClubContactId(sectionId, contactId)
                .orElseThrow(() -> new NotFoundException(
                        "No link between section " + sectionId + " and club contact " + contactId));

        sectionContactRepository.deleteBySectionIdAndClubContactId(sectionId, contactId);
    }

    private void validateAgeRange(Integer minAge, Integer maxAge) {
        if (minAge != null && maxAge != null && minAge > maxAge) {
            throw new ValidationException("minAge must be <= maxAge");
        }
    }

    /**
     * 404s when {@code sectionId} doesn't exist at all, or exists but belongs to a different
     * club — real cross-club isolation at the data layer, not only relying on the controller's
     * {@code @PreAuthorize}. Mirrors {@code ClubContactServiceImpl.findOrThrowForClub}.
     */
    private Section findOrThrowForClub(UUID clubId, UUID sectionId) {
        Section section = sectionRepository
                .findById(sectionId)
                .orElseThrow(() -> new NotFoundException("Section not found: " + sectionId));
        if (!section.getClubId().equals(clubId)) {
            throw new NotFoundException("Section not found: " + sectionId);
        }
        return section;
    }

    /**
     * 404s when {@code contactId} doesn't exist at all, or exists but belongs to a different
     * club. {@link Section} and {@link ClubContact} are independent siblings under {@code Club},
     * not a parent-child chain, so this is checked against {@code clubId} directly rather than
     * against the section.
     */
    private ClubContact findOrThrowContactForClub(UUID clubId, UUID contactId) {
        ClubContact contact = clubContactRepository
                .findById(contactId)
                .orElseThrow(() -> new NotFoundException("Club contact not found: " + contactId));
        if (!contact.getClubId().equals(clubId)) {
            throw new NotFoundException("Club contact not found: " + contactId);
        }
        return contact;
    }
}
