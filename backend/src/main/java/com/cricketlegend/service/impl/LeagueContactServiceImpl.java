package com.cricketlegend.service.impl;

import com.cricketlegend.domain.Contact;
import com.cricketlegend.domain.League;
import com.cricketlegend.domain.LeagueContact;
import com.cricketlegend.dto.ContactDto;
import com.cricketlegend.dto.CreateLeagueContactRequest;
import com.cricketlegend.dto.LeagueContactDto;
import com.cricketlegend.dto.UpdateLeagueContactRequest;
import com.cricketlegend.exception.InvalidStatusTransitionException;
import com.cricketlegend.exception.NotFoundException;
import com.cricketlegend.mapper.LeagueContactMapper;
import com.cricketlegend.repository.LeagueContactRepository;
import com.cricketlegend.repository.LeagueRepository;
import com.cricketlegend.service.LeagueContactService;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Business rules per docs/specs/054-league-contacts.md: {@code list} returns every contact for a
 * league (active and inactive, not paginated — a deliberately small bounded collection, mirroring
 * {@code SponsorContactServiceImpl}); {@code create}/{@code update} silently auto-unset {@code
 * isPrimary} on any other active contact for the same league rather than rejecting (backed at the
 * DB level by a partial unique index, {@code ux_league_contact_primary}); {@code deactivate}/
 * {@code reactivate} mirror {@code SponsorContactServiceImpl}'s one-way-transition-guard shape;
 * every lookup is scoped two levels deep — the league must belong to the club ({@link
 * #findOrThrowLeagueForClub}, mirroring {@code LeagueServiceImpl.findOrThrowForClub}), and the
 * contact must belong to the league ({@link #findOrThrowContactForLeague}) — for real
 * cross-tenant isolation at the data layer, not just relying on the controller's
 * {@code @PreAuthorize}.
 */
@Service
public class LeagueContactServiceImpl implements LeagueContactService {

    private final LeagueRepository leagueRepository;
    private final LeagueContactRepository leagueContactRepository;
    private final LeagueContactMapper leagueContactMapper;

    public LeagueContactServiceImpl(
            LeagueRepository leagueRepository,
            LeagueContactRepository leagueContactRepository,
            LeagueContactMapper leagueContactMapper) {
        this.leagueRepository = leagueRepository;
        this.leagueContactRepository = leagueContactRepository;
        this.leagueContactMapper = leagueContactMapper;
    }

    @Override
    public List<LeagueContactDto> list(UUID clubId, UUID leagueId) {
        findOrThrowLeagueForClub(clubId, leagueId);
        return leagueContactRepository.findByLeagueId(leagueId).stream()
                .map(leagueContactMapper::toDto)
                .toList();
    }

    @Override
    @Transactional
    public LeagueContactDto create(UUID clubId, UUID leagueId, CreateLeagueContactRequest request) {
        findOrThrowLeagueForClub(clubId, leagueId);

        LeagueContact contact = leagueContactMapper.toEntity(request);
        contact.setLeagueId(leagueId);
        contact.setActive(true);

        if (request.isPrimary()) {
            unsetOtherActivePrimaries(leagueId, null);
        }
        contact.setPrimary(request.isPrimary());

        return leagueContactMapper.toDto(leagueContactRepository.save(contact));
    }

    @Override
    @Transactional
    public LeagueContactDto update(
            UUID clubId, UUID leagueId, UUID contactId, UpdateLeagueContactRequest request) {
        findOrThrowLeagueForClub(clubId, leagueId);
        LeagueContact contact = findOrThrowContactForLeague(leagueId, contactId);

        contact.setContact(toContact(request.contact()));
        contact.setRole(request.role());

        if (request.isPrimary()) {
            unsetOtherActivePrimaries(leagueId, contactId);
        }
        contact.setPrimary(request.isPrimary());

        return leagueContactMapper.toDto(leagueContactRepository.save(contact));
    }

    @Override
    public LeagueContactDto deactivate(UUID clubId, UUID leagueId, UUID contactId) {
        findOrThrowLeagueForClub(clubId, leagueId);
        LeagueContact contact = findOrThrowContactForLeague(leagueId, contactId);
        if (!contact.isActive()) {
            throw new InvalidStatusTransitionException(
                    "League contact is already inactive: " + contactId);
        }
        contact.setActive(false);
        return leagueContactMapper.toDto(leagueContactRepository.save(contact));
    }

    @Override
    public LeagueContactDto reactivate(UUID clubId, UUID leagueId, UUID contactId) {
        findOrThrowLeagueForClub(clubId, leagueId);
        LeagueContact contact = findOrThrowContactForLeague(leagueId, contactId);
        if (contact.isActive()) {
            throw new InvalidStatusTransitionException(
                    "League contact is already active: " + contactId);
        }
        contact.setActive(true);
        return leagueContactMapper.toDto(leagueContactRepository.save(contact));
    }

    /**
     * 404s when {@code leagueId} doesn't exist at all, or exists but belongs to a different
     * club — mirrors {@code LeagueServiceImpl.findOrThrowForClub} exactly. Called first, in
     * every method, before any contact-level lookup.
     */
    private League findOrThrowLeagueForClub(UUID clubId, UUID leagueId) {
        League league = leagueRepository
                .findById(leagueId)
                .orElseThrow(() -> new NotFoundException("League not found: " + leagueId));
        if (!league.getClubId().equals(clubId)) {
            throw new NotFoundException("League not found: " + leagueId);
        }
        return league;
    }

    /**
     * 404s when {@code contactId} doesn't exist at all, or exists but belongs to a different
     * league — the second level of this spec's two-level cross-tenant isolation, called only
     * after {@link #findOrThrowLeagueForClub} has already confirmed the league itself.
     */
    private LeagueContact findOrThrowContactForLeague(UUID leagueId, UUID contactId) {
        LeagueContact contact = leagueContactRepository
                .findById(contactId)
                .orElseThrow(() -> new NotFoundException("League contact not found: " + contactId));
        if (!contact.getLeagueId().equals(leagueId)) {
            throw new NotFoundException("League contact not found: " + contactId);
        }
        return contact;
    }

    /**
     * Unsets {@code isPrimary} on every other active contact for {@code leagueId} — the
     * auto-unset behavior the spec requires, silent, not a
     * {@link com.cricketlegend.exception.ConflictException}. A deactivated contact's stale
     * {@code isPrimary} flag is deliberately left untouched (the partial unique index only
     * guards {@code active} rows).
     *
     * <p>Uses {@code saveAndFlush}, not {@code save}: Hibernate's default flush ordering applies
     * every pending {@code INSERT} in a transaction before any pending {@code UPDATE}, regardless
     * of registration order — so on {@code create()}, the new (already-primary) row's insert
     * would otherwise hit Postgres while this unset is still a queued, unflushed update, tripping
     * the partial unique index {@code ux_league_contact_primary} instead of silently succeeding.
     * Flushing here forces the unset to commit to the DB before the caller's own save proceeds.
     * See {@code SponsorContactServiceImpl.unsetOtherActivePrimaries}'s Javadoc for the full
     * mechanism this applies from day one.
     */
    private void unsetOtherActivePrimaries(UUID leagueId, UUID excludeContactId) {
        for (LeagueContact existing :
                leagueContactRepository.findByLeagueIdAndActiveTrueAndIsPrimaryTrue(leagueId)) {
            if (!existing.getId().equals(excludeContactId)) {
                existing.setPrimary(false);
                leagueContactRepository.saveAndFlush(existing);
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
