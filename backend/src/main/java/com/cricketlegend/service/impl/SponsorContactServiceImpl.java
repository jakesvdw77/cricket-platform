package com.cricketlegend.service.impl;

import com.cricketlegend.domain.Contact;
import com.cricketlegend.domain.Sponsor;
import com.cricketlegend.domain.SponsorContact;
import com.cricketlegend.dto.ContactDto;
import com.cricketlegend.dto.CreateSponsorContactRequest;
import com.cricketlegend.dto.SponsorContactDto;
import com.cricketlegend.dto.UpdateSponsorContactRequest;
import com.cricketlegend.exception.InvalidStatusTransitionException;
import com.cricketlegend.exception.NotFoundException;
import com.cricketlegend.mapper.SponsorContactMapper;
import com.cricketlegend.repository.SponsorContactRepository;
import com.cricketlegend.repository.SponsorRepository;
import com.cricketlegend.service.SponsorContactService;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Business rules per docs/specs/024-sponsor-contacts.md: {@code list} returns every contact for a
 * sponsor (active and inactive, not paginated — a deliberately small bounded collection, mirroring
 * {@code ClubContactServiceImpl}); {@code create}/{@code update} silently auto-unset {@code
 * isPrimary} on any other active contact for the same sponsor rather than rejecting (backed at the
 * DB level by a partial unique index, {@code ux_sponsor_contact_primary}); {@code deactivate}/
 * {@code reactivate} mirror {@code ClubContactServiceImpl}'s one-way-transition-guard shape; every
 * lookup is scoped two levels deep — the sponsor must belong to the club ({@link
 * #findOrThrowSponsorForClub}, mirroring {@code SponsorServiceImpl.findOrThrowForClub}), and the
 * contact must belong to the sponsor ({@link #findOrThrowContactForSponsor}) — for real
 * cross-tenant isolation at the data layer, not just relying on the controller's
 * {@code @PreAuthorize}.
 */
@Service
public class SponsorContactServiceImpl implements SponsorContactService {

    private final SponsorRepository sponsorRepository;
    private final SponsorContactRepository sponsorContactRepository;
    private final SponsorContactMapper sponsorContactMapper;

    public SponsorContactServiceImpl(
            SponsorRepository sponsorRepository,
            SponsorContactRepository sponsorContactRepository,
            SponsorContactMapper sponsorContactMapper) {
        this.sponsorRepository = sponsorRepository;
        this.sponsorContactRepository = sponsorContactRepository;
        this.sponsorContactMapper = sponsorContactMapper;
    }

    @Override
    public List<SponsorContactDto> list(UUID clubId, UUID sponsorId) {
        findOrThrowSponsorForClub(clubId, sponsorId);
        return sponsorContactRepository.findBySponsorId(sponsorId).stream()
                .map(sponsorContactMapper::toDto)
                .toList();
    }

    @Override
    @Transactional
    public SponsorContactDto create(
            UUID clubId, UUID sponsorId, CreateSponsorContactRequest request) {
        findOrThrowSponsorForClub(clubId, sponsorId);

        SponsorContact contact = sponsorContactMapper.toEntity(request);
        contact.setSponsorId(sponsorId);
        contact.setActive(true);

        if (request.isPrimary()) {
            unsetOtherActivePrimaries(sponsorId, null);
        }
        contact.setPrimary(request.isPrimary());

        return sponsorContactMapper.toDto(sponsorContactRepository.save(contact));
    }

    @Override
    @Transactional
    public SponsorContactDto update(
            UUID clubId, UUID sponsorId, UUID contactId, UpdateSponsorContactRequest request) {
        findOrThrowSponsorForClub(clubId, sponsorId);
        SponsorContact contact = findOrThrowContactForSponsor(sponsorId, contactId);

        contact.setContact(toContact(request.contact()));
        contact.setRole(request.role());

        if (request.isPrimary()) {
            unsetOtherActivePrimaries(sponsorId, contactId);
        }
        contact.setPrimary(request.isPrimary());

        return sponsorContactMapper.toDto(sponsorContactRepository.save(contact));
    }

    @Override
    public SponsorContactDto deactivate(UUID clubId, UUID sponsorId, UUID contactId) {
        findOrThrowSponsorForClub(clubId, sponsorId);
        SponsorContact contact = findOrThrowContactForSponsor(sponsorId, contactId);
        if (!contact.isActive()) {
            throw new InvalidStatusTransitionException(
                    "Sponsor contact is already inactive: " + contactId);
        }
        contact.setActive(false);
        return sponsorContactMapper.toDto(sponsorContactRepository.save(contact));
    }

    @Override
    public SponsorContactDto reactivate(UUID clubId, UUID sponsorId, UUID contactId) {
        findOrThrowSponsorForClub(clubId, sponsorId);
        SponsorContact contact = findOrThrowContactForSponsor(sponsorId, contactId);
        if (contact.isActive()) {
            throw new InvalidStatusTransitionException(
                    "Sponsor contact is already active: " + contactId);
        }
        contact.setActive(true);
        return sponsorContactMapper.toDto(sponsorContactRepository.save(contact));
    }

    /**
     * 404s when {@code sponsorId} doesn't exist at all, or exists but belongs to a different
     * club — mirrors {@code SponsorServiceImpl.findOrThrowForClub} exactly. Called first, in
     * every method, before any contact-level lookup.
     */
    private Sponsor findOrThrowSponsorForClub(UUID clubId, UUID sponsorId) {
        Sponsor sponsor = sponsorRepository
                .findById(sponsorId)
                .orElseThrow(() -> new NotFoundException("Sponsor not found: " + sponsorId));
        if (!sponsor.getClubId().equals(clubId)) {
            throw new NotFoundException("Sponsor not found: " + sponsorId);
        }
        return sponsor;
    }

    /**
     * 404s when {@code contactId} doesn't exist at all, or exists but belongs to a different
     * sponsor — the second level of this spec's two-level cross-tenant isolation, called only
     * after {@link #findOrThrowSponsorForClub} has already confirmed the sponsor itself.
     */
    private SponsorContact findOrThrowContactForSponsor(UUID sponsorId, UUID contactId) {
        SponsorContact contact = sponsorContactRepository
                .findById(contactId)
                .orElseThrow(() -> new NotFoundException("Sponsor contact not found: " + contactId));
        if (!contact.getSponsorId().equals(sponsorId)) {
            throw new NotFoundException("Sponsor contact not found: " + contactId);
        }
        return contact;
    }

    /**
     * Unsets {@code isPrimary} on every other active contact for {@code sponsorId} — the
     * auto-unset behavior the spec requires, silent, not a
     * {@link com.cricketlegend.exception.ConflictException}. A deactivated contact's stale
     * {@code isPrimary} flag is deliberately left untouched (the partial unique index only
     * guards {@code active} rows).
     *
     * <p>Uses {@code saveAndFlush}, not {@code save}: Hibernate's default flush ordering applies
     * every pending {@code INSERT} in a transaction before any pending {@code UPDATE}, regardless
     * of registration order — so on {@code create()}, the new (already-primary) row's insert
     * would otherwise hit Postgres while this unset is still a queued, unflushed update, tripping
     * the partial unique index {@code ux_sponsor_contact_primary} instead of silently succeeding.
     * Flushing here forces the unset to commit to the DB before the caller's own save proceeds.
     * See {@code ClubContactServiceImpl.unsetOtherActivePrimaries}'s Javadoc for the full
     * mechanism this applies from day one.
     */
    private void unsetOtherActivePrimaries(UUID sponsorId, UUID excludeContactId) {
        for (SponsorContact existing :
                sponsorContactRepository.findBySponsorIdAndActiveTrueAndIsPrimaryTrue(sponsorId)) {
            if (!existing.getId().equals(excludeContactId)) {
                existing.setPrimary(false);
                sponsorContactRepository.saveAndFlush(existing);
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
