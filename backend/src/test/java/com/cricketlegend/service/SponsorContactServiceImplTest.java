package com.cricketlegend.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

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
import com.cricketlegend.service.impl.SponsorContactServiceImpl;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

/**
 * Unit tests for SponsorContactServiceImpl's business rules from
 * docs/specs/024-sponsor-contacts.md: setting isPrimary auto-unsets any other active primary for
 * the same sponsor (leaving an inactive contact's stale flag alone) via {@code saveAndFlush} (not
 * {@code save} — the fix {@code ClubContactServiceImpl} needed after the fact, applied here from
 * day one), deactivate/reactivate's one-way transition guard, and the two-level cross-tenant
 * isolation this spec adds on top of {@code ClubContactServiceImplTest}'s single-level pattern:
 * {@code findOrThrowSponsorForClub} (a real sponsor belonging to a different club) and {@code
 * findOrThrowContactForSponsor} (a real contact belonging to a different sponsor).
 */
@ExtendWith(MockitoExtension.class)
class SponsorContactServiceImplTest {

    @Mock
    private SponsorRepository sponsorRepository;

    @Mock
    private SponsorContactRepository sponsorContactRepository;

    @Mock
    private SponsorContactMapper sponsorContactMapper;

    private SponsorContactServiceImpl sponsorContactService;

    @BeforeEach
    void setUp() {
        sponsorContactService =
                new SponsorContactServiceImpl(sponsorRepository, sponsorContactRepository, sponsorContactMapper);
    }

    private ContactDto contactDto() {
        return new ContactDto("Jane", "Doe", "jane@example.com", "0123456789");
    }

    private SponsorContactDto dummyDto() {
        return new SponsorContactDto(
                UUID.randomUUID(), UUID.randomUUID(), contactDto(), "Marketing Lead", false, true, null, null, null);
    }

    private Sponsor sponsor(UUID sponsorId, UUID clubId) {
        return Sponsor.builder().id(sponsorId).clubId(clubId).name("Acme Sponsor").active(true).build();
    }

    private SponsorContact existingContact(UUID id, UUID sponsorId, boolean active, boolean primary) {
        SponsorContact contact = new SponsorContact();
        contact.setId(id);
        contact.setSponsorId(sponsorId);
        contact.setActive(active);
        contact.setPrimary(primary);
        contact.setRole("Treasurer");
        return contact;
    }

    @Test
    void createSavesAMappedEntityScopedToTheSponsorAndActiveByDefault() {
        UUID clubId = UUID.randomUUID();
        UUID sponsorId = UUID.randomUUID();
        when(sponsorRepository.findById(sponsorId)).thenReturn(Optional.of(sponsor(sponsorId, clubId)));

        CreateSponsorContactRequest request = new CreateSponsorContactRequest(contactDto(), "Marketing Lead", false);
        SponsorContact mapped = new SponsorContact();
        when(sponsorContactMapper.toEntity(request)).thenReturn(mapped);
        when(sponsorContactRepository.save(mapped)).thenReturn(mapped);
        when(sponsorContactMapper.toDto(mapped)).thenReturn(dummyDto());

        sponsorContactService.create(clubId, sponsorId, request);

        assertThat(mapped.getSponsorId()).isEqualTo(sponsorId);
        assertThat(mapped.isActive()).isTrue();
        assertThat(mapped.isPrimary()).isFalse();
        verify(sponsorContactRepository, never()).findBySponsorIdAndActiveTrueAndIsPrimaryTrue(sponsorId);
    }

    @Test
    void updateAppliesRequestFieldsOntoTheExistingEntity() {
        UUID clubId = UUID.randomUUID();
        UUID sponsorId = UUID.randomUUID();
        UUID contactId = UUID.randomUUID();
        when(sponsorRepository.findById(sponsorId)).thenReturn(Optional.of(sponsor(sponsorId, clubId)));
        SponsorContact existing = existingContact(contactId, sponsorId, true, false);
        when(sponsorContactRepository.findById(contactId)).thenReturn(Optional.of(existing));
        when(sponsorContactRepository.save(existing)).thenReturn(existing);
        when(sponsorContactMapper.toDto(existing)).thenReturn(dummyDto());

        UpdateSponsorContactRequest request = new UpdateSponsorContactRequest(contactDto(), "Ground Manager", false);

        sponsorContactService.update(clubId, sponsorId, contactId, request);

        assertThat(existing.getRole()).isEqualTo("Ground Manager");
        assertThat(existing.getContact().getFirstName()).isEqualTo("Jane");
        assertThat(existing.getContact().getEmail()).isEqualTo("jane@example.com");
    }

    @Test
    void createWithIsPrimaryTrueUnsetsAnotherActiveContactsPrimaryFlagForTheSameSponsor() {
        UUID clubId = UUID.randomUUID();
        UUID sponsorId = UUID.randomUUID();
        when(sponsorRepository.findById(sponsorId)).thenReturn(Optional.of(sponsor(sponsorId, clubId)));
        SponsorContact otherActivePrimary = existingContact(UUID.randomUUID(), sponsorId, true, true);
        when(sponsorContactRepository.findBySponsorIdAndActiveTrueAndIsPrimaryTrue(sponsorId))
                .thenReturn(List.of(otherActivePrimary));

        CreateSponsorContactRequest request = new CreateSponsorContactRequest(contactDto(), "Marketing Lead", true);
        SponsorContact mapped = new SponsorContact();
        when(sponsorContactMapper.toEntity(request)).thenReturn(mapped);
        when(sponsorContactRepository.save(org.mockito.ArgumentMatchers.any(SponsorContact.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));
        when(sponsorContactMapper.toDto(mapped)).thenReturn(dummyDto());

        sponsorContactService.create(clubId, sponsorId, request);

        assertThat(otherActivePrimary.isPrimary()).isFalse();
        // saveAndFlush, not save — see SponsorContactServiceImpl.unsetOtherActivePrimaries's
        // Javadoc: the unset must physically hit the DB before create()'s own insert of the new
        // primary row, otherwise Hibernate's flush ordering trips ux_sponsor_contact_primary.
        verify(sponsorContactRepository).saveAndFlush(otherActivePrimary);
        assertThat(mapped.isPrimary()).isTrue();
    }

    @Test
    void createWithIsPrimaryTrueDoesNotTouchAnInactiveContactsStalePrimaryFlag() {
        UUID clubId = UUID.randomUUID();
        UUID sponsorId = UUID.randomUUID();
        when(sponsorRepository.findById(sponsorId)).thenReturn(Optional.of(sponsor(sponsorId, clubId)));
        when(sponsorContactRepository.findBySponsorIdAndActiveTrueAndIsPrimaryTrue(sponsorId))
                .thenReturn(List.of());

        CreateSponsorContactRequest request = new CreateSponsorContactRequest(contactDto(), "Marketing Lead", true);
        SponsorContact mapped = new SponsorContact();
        when(sponsorContactMapper.toEntity(request)).thenReturn(mapped);
        when(sponsorContactRepository.save(mapped)).thenReturn(mapped);
        when(sponsorContactMapper.toDto(mapped)).thenReturn(dummyDto());

        sponsorContactService.create(clubId, sponsorId, request);

        verify(sponsorContactRepository, times(1)).save(mapped);
    }

    @Test
    void updateWithIsPrimaryTrueExcludesTheContactBeingUpdatedFromTheUnsetPass() {
        UUID clubId = UUID.randomUUID();
        UUID sponsorId = UUID.randomUUID();
        UUID contactId = UUID.randomUUID();
        when(sponsorRepository.findById(sponsorId)).thenReturn(Optional.of(sponsor(sponsorId, clubId)));
        SponsorContact existing = existingContact(contactId, sponsorId, true, true);
        when(sponsorContactRepository.findById(contactId)).thenReturn(Optional.of(existing));
        when(sponsorContactRepository.findBySponsorIdAndActiveTrueAndIsPrimaryTrue(sponsorId))
                .thenReturn(List.of(existing));
        when(sponsorContactRepository.save(existing)).thenReturn(existing);
        when(sponsorContactMapper.toDto(existing)).thenReturn(dummyDto());

        UpdateSponsorContactRequest request = new UpdateSponsorContactRequest(contactDto(), "Marketing Lead", true);

        sponsorContactService.update(clubId, sponsorId, contactId, request);

        assertThat(existing.isPrimary()).isTrue();
        ArgumentCaptor<SponsorContact> saved = ArgumentCaptor.forClass(SponsorContact.class);
        verify(sponsorContactRepository, times(1)).save(saved.capture());
        assertThat(saved.getValue()).isSameAs(existing);
    }

    @Test
    void deactivateOnActiveContactTransitionsToInactive() {
        UUID clubId = UUID.randomUUID();
        UUID sponsorId = UUID.randomUUID();
        UUID contactId = UUID.randomUUID();
        when(sponsorRepository.findById(sponsorId)).thenReturn(Optional.of(sponsor(sponsorId, clubId)));
        SponsorContact existing = existingContact(contactId, sponsorId, true, false);
        when(sponsorContactRepository.findById(contactId)).thenReturn(Optional.of(existing));
        when(sponsorContactRepository.save(existing)).thenReturn(existing);
        when(sponsorContactMapper.toDto(existing)).thenReturn(dummyDto());

        sponsorContactService.deactivate(clubId, sponsorId, contactId);

        assertThat(existing.isActive()).isFalse();
    }

    @Test
    void deactivateOnAlreadyInactiveContactThrowsInvalidStatusTransitionException() {
        UUID clubId = UUID.randomUUID();
        UUID sponsorId = UUID.randomUUID();
        UUID contactId = UUID.randomUUID();
        when(sponsorRepository.findById(sponsorId)).thenReturn(Optional.of(sponsor(sponsorId, clubId)));
        SponsorContact existing = existingContact(contactId, sponsorId, false, false);
        when(sponsorContactRepository.findById(contactId)).thenReturn(Optional.of(existing));

        assertThatThrownBy(() -> sponsorContactService.deactivate(clubId, sponsorId, contactId))
                .isInstanceOf(InvalidStatusTransitionException.class);
    }

    @Test
    void reactivateOnInactiveContactTransitionsToActive() {
        UUID clubId = UUID.randomUUID();
        UUID sponsorId = UUID.randomUUID();
        UUID contactId = UUID.randomUUID();
        when(sponsorRepository.findById(sponsorId)).thenReturn(Optional.of(sponsor(sponsorId, clubId)));
        SponsorContact existing = existingContact(contactId, sponsorId, false, false);
        when(sponsorContactRepository.findById(contactId)).thenReturn(Optional.of(existing));
        when(sponsorContactRepository.save(existing)).thenReturn(existing);
        when(sponsorContactMapper.toDto(existing)).thenReturn(dummyDto());

        sponsorContactService.reactivate(clubId, sponsorId, contactId);

        assertThat(existing.isActive()).isTrue();
    }

    @Test
    void reactivateOnAlreadyActiveContactThrowsInvalidStatusTransitionException() {
        UUID clubId = UUID.randomUUID();
        UUID sponsorId = UUID.randomUUID();
        UUID contactId = UUID.randomUUID();
        when(sponsorRepository.findById(sponsorId)).thenReturn(Optional.of(sponsor(sponsorId, clubId)));
        SponsorContact existing = existingContact(contactId, sponsorId, true, false);
        when(sponsorContactRepository.findById(contactId)).thenReturn(Optional.of(existing));

        assertThatThrownBy(() -> sponsorContactService.reactivate(clubId, sponsorId, contactId))
                .isInstanceOf(InvalidStatusTransitionException.class);
    }

    @Test
    void updateOnASponsorBelongingToADifferentClubThrowsNotFoundException() {
        UUID clubId = UUID.randomUUID();
        UUID otherClubId = UUID.randomUUID();
        UUID sponsorId = UUID.randomUUID();
        UUID contactId = UUID.randomUUID();
        when(sponsorRepository.findById(sponsorId)).thenReturn(Optional.of(sponsor(sponsorId, otherClubId)));

        UpdateSponsorContactRequest request = new UpdateSponsorContactRequest(contactDto(), "Marketing Lead", false);

        assertThatThrownBy(() -> sponsorContactService.update(clubId, sponsorId, contactId, request))
                .isInstanceOf(NotFoundException.class);
        verify(sponsorContactRepository, never()).findById(contactId);
    }

    @Test
    void updateOnAContactBelongingToADifferentSponsorThrowsNotFoundException() {
        UUID clubId = UUID.randomUUID();
        UUID sponsorId = UUID.randomUUID();
        UUID otherSponsorId = UUID.randomUUID();
        UUID contactId = UUID.randomUUID();
        when(sponsorRepository.findById(sponsorId)).thenReturn(Optional.of(sponsor(sponsorId, clubId)));
        SponsorContact existing = existingContact(contactId, otherSponsorId, true, false);
        when(sponsorContactRepository.findById(contactId)).thenReturn(Optional.of(existing));

        UpdateSponsorContactRequest request = new UpdateSponsorContactRequest(contactDto(), "Marketing Lead", false);

        assertThatThrownBy(() -> sponsorContactService.update(clubId, sponsorId, contactId, request))
                .isInstanceOf(NotFoundException.class);
    }

    @Test
    void deactivateOnANonexistentSponsorThrowsNotFoundException() {
        UUID clubId = UUID.randomUUID();
        UUID sponsorId = UUID.randomUUID();
        UUID contactId = UUID.randomUUID();
        when(sponsorRepository.findById(sponsorId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> sponsorContactService.deactivate(clubId, sponsorId, contactId))
                .isInstanceOf(NotFoundException.class);
        verify(sponsorContactRepository, never()).findById(contactId);
    }

    @Test
    void deactivateOnANonexistentContactThrowsNotFoundException() {
        UUID clubId = UUID.randomUUID();
        UUID sponsorId = UUID.randomUUID();
        UUID contactId = UUID.randomUUID();
        when(sponsorRepository.findById(sponsorId)).thenReturn(Optional.of(sponsor(sponsorId, clubId)));
        when(sponsorContactRepository.findById(contactId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> sponsorContactService.deactivate(clubId, sponsorId, contactId))
                .isInstanceOf(NotFoundException.class);
    }
}
