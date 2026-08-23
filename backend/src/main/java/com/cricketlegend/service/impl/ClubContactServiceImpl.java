package com.cricketlegend.service.impl;

import com.cricketlegend.domain.ClubContact;
import com.cricketlegend.domain.Contact;
import com.cricketlegend.dto.ClubContactDto;
import com.cricketlegend.dto.ContactDto;
import com.cricketlegend.dto.CreateClubContactRequest;
import com.cricketlegend.dto.UpdateClubContactRequest;
import com.cricketlegend.exception.InvalidStatusTransitionException;
import com.cricketlegend.exception.NotFoundException;
import com.cricketlegend.mapper.ClubContactMapper;
import com.cricketlegend.repository.ClubContactRepository;
import com.cricketlegend.service.ClubContactService;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Business rules per docs/specs/021-club-contacts.md: {@code list} returns every contact for a
 * club (active and inactive, not paginated — a deliberately small bounded collection, see
 * docs/plans/021-club-contacts.md's Context); {@code create}/{@code update} silently auto-unset
 * {@code isPrimary} on any other active contact for the same club rather than rejecting (backed at
 * the DB level by a partial unique index, {@code ux_club_contact_primary}); {@code deactivate}/
 * {@code reactivate} mirror {@code ProductServiceImpl.retire()}'s one-way-transition-guard shape;
 * every lookup is scoped to the owning club, not just by id, for real cross-club isolation at the
 * data layer (not only {@code @PreAuthorize}).
 */
@Service
public class ClubContactServiceImpl implements ClubContactService {

    private final ClubContactRepository clubContactRepository;
    private final ClubContactMapper clubContactMapper;

    public ClubContactServiceImpl(
            ClubContactRepository clubContactRepository, ClubContactMapper clubContactMapper) {
        this.clubContactRepository = clubContactRepository;
        this.clubContactMapper = clubContactMapper;
    }

    @Override
    public List<ClubContactDto> list(UUID clubId) {
        return clubContactRepository.findByClubId(clubId).stream()
                .map(clubContactMapper::toDto)
                .toList();
    }

    @Override
    @Transactional
    public ClubContactDto create(UUID clubId, CreateClubContactRequest request) {
        ClubContact contact = clubContactMapper.toEntity(request);
        contact.setClubId(clubId);
        contact.setActive(true);

        if (request.isPrimary()) {
            unsetOtherActivePrimaries(clubId, null);
        }
        contact.setPrimary(request.isPrimary());

        return clubContactMapper.toDto(clubContactRepository.save(contact));
    }

    @Override
    @Transactional
    public ClubContactDto update(UUID clubId, UUID contactId, UpdateClubContactRequest request) {
        ClubContact contact = findOrThrowForClub(clubId, contactId);

        contact.setContact(toContact(request.contact()));
        contact.setRole(request.role());
        contact.setPhotoUrl(request.photoUrl());

        if (request.isPrimary()) {
            unsetOtherActivePrimaries(clubId, contactId);
        }
        contact.setPrimary(request.isPrimary());

        return clubContactMapper.toDto(clubContactRepository.save(contact));
    }

    @Override
    public ClubContactDto deactivate(UUID clubId, UUID contactId) {
        ClubContact contact = findOrThrowForClub(clubId, contactId);
        if (!contact.isActive()) {
            throw new InvalidStatusTransitionException("Club contact is already inactive: " + contactId);
        }
        contact.setActive(false);
        return clubContactMapper.toDto(clubContactRepository.save(contact));
    }

    @Override
    public ClubContactDto reactivate(UUID clubId, UUID contactId) {
        ClubContact contact = findOrThrowForClub(clubId, contactId);
        if (contact.isActive()) {
            throw new InvalidStatusTransitionException("Club contact is already active: " + contactId);
        }
        contact.setActive(true);
        return clubContactMapper.toDto(clubContactRepository.save(contact));
    }

    /**
     * 404s when {@code contactId} doesn't exist at all, or exists but belongs to a different
     * club — real cross-club isolation at the data layer, not only relying on the controller's
     * {@code @PreAuthorize}.
     */
    private ClubContact findOrThrowForClub(UUID clubId, UUID contactId) {
        ClubContact contact = clubContactRepository
                .findById(contactId)
                .orElseThrow(() -> new NotFoundException("Club contact not found: " + contactId));
        if (!contact.getClubId().equals(clubId)) {
            throw new NotFoundException("Club contact not found: " + contactId);
        }
        return contact;
    }

    /**
     * Unsets {@code isPrimary} on every other active contact for {@code clubId} — the auto-unset
     * behavior the spec requires, silent, not a {@link com.cricketlegend.exception.ConflictException}.
     * A deactivated contact's stale {@code isPrimary} flag is deliberately left untouched (the
     * partial unique index only guards {@code active} rows).
     *
     * <p>Uses {@code saveAndFlush}, not {@code save}: Hibernate's default flush ordering applies
     * every pending {@code INSERT} in a transaction before any pending {@code UPDATE}, regardless
     * of registration order — so on {@code create()}, the new (already-primary) row's insert
     * would otherwise hit Postgres while this unset is still a queued, unflushed update, tripping
     * the partial unique index {@code ux_club_contact_primary} instead of silently succeeding.
     * Flushing here forces the unset to commit to the DB before the caller's own save proceeds.
     */
    private void unsetOtherActivePrimaries(UUID clubId, UUID excludeContactId) {
        for (ClubContact existing : clubContactRepository.findByClubIdAndActiveTrueAndIsPrimaryTrue(clubId)) {
            if (!existing.getId().equals(excludeContactId)) {
                existing.setPrimary(false);
                clubContactRepository.saveAndFlush(existing);
            }
        }
    }

    private Contact toContact(ContactDto dto) {
        return Contact.builder()
                .firstName(dto.firstName())
                .lastName(dto.lastName())
                .email(dto.email())
                .phone(dto.phone())
                .build();
    }
}
