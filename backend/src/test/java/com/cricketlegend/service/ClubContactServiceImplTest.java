package com.cricketlegend.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.cricketlegend.domain.ClubContact;
import com.cricketlegend.dto.ClubContactDto;
import com.cricketlegend.dto.ContactDto;
import com.cricketlegend.dto.CreateClubContactRequest;
import com.cricketlegend.dto.UpdateClubContactRequest;
import com.cricketlegend.exception.InvalidStatusTransitionException;
import com.cricketlegend.exception.NotFoundException;
import com.cricketlegend.mapper.ClubContactMapper;
import com.cricketlegend.repository.ClubContactRepository;
import com.cricketlegend.service.impl.ClubContactServiceImpl;
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
 * Unit tests for ClubContactServiceImpl's business rules from docs/specs/021-club-contacts.md:
 * setting isPrimary auto-unsets any other active primary for the same club (leaving an inactive
 * contact's stale flag alone), deactivate/reactivate's one-way transition guard (mirroring {@code
 * ProductServiceImplTest.retire()}'s exact style), and findOrThrowForClub's cross-club isolation.
 * Per docs/standards/backend.md, every @Service method carrying a business rule ships a unit test
 * in the same change.
 */
@ExtendWith(MockitoExtension.class)
class ClubContactServiceImplTest {

    @Mock
    private ClubContactRepository clubContactRepository;

    @Mock
    private ClubContactMapper clubContactMapper;

    private ClubContactServiceImpl clubContactService;

    @BeforeEach
    void setUp() {
        clubContactService = new ClubContactServiceImpl(clubContactRepository, clubContactMapper);
    }

    private ContactDto contactDto() {
        return new ContactDto("Jane", "Doe", "jane@example.com", "0123456789");
    }

    private ClubContactDto dummyDto() {
        return new ClubContactDto(
                UUID.randomUUID(), UUID.randomUUID(), contactDto(), "Chairman", false, true, null, null, null, null);
    }

    private ClubContact existingContact(UUID id, UUID clubId, boolean active, boolean primary) {
        ClubContact contact = new ClubContact();
        contact.setId(id);
        contact.setClubId(clubId);
        contact.setActive(active);
        contact.setPrimary(primary);
        contact.setRole("Treasurer");
        return contact;
    }

    @Test
    void createSavesAMappedEntityScopedToTheClubAndActiveByDefault() {
        UUID clubId = UUID.randomUUID();
        CreateClubContactRequest request = new CreateClubContactRequest(contactDto(), "Chairman", false, null);
        ClubContact mapped = new ClubContact();
        when(clubContactMapper.toEntity(request)).thenReturn(mapped);
        when(clubContactRepository.save(mapped)).thenReturn(mapped);
        when(clubContactMapper.toDto(mapped)).thenReturn(dummyDto());

        clubContactService.create(clubId, request);

        assertThat(mapped.getClubId()).isEqualTo(clubId);
        assertThat(mapped.isActive()).isTrue();
        assertThat(mapped.isPrimary()).isFalse();
        verify(clubContactRepository, never()).findByClubIdAndActiveTrueAndIsPrimaryTrue(clubId);
    }

    @Test
    void updateAppliesRequestFieldsOntoTheExistingEntity() {
        UUID clubId = UUID.randomUUID();
        UUID contactId = UUID.randomUUID();
        ClubContact existing = existingContact(contactId, clubId, true, false);
        when(clubContactRepository.findById(contactId)).thenReturn(Optional.of(existing));
        when(clubContactRepository.save(existing)).thenReturn(existing);
        when(clubContactMapper.toDto(existing)).thenReturn(dummyDto());

        UpdateClubContactRequest request =
                new UpdateClubContactRequest(contactDto(), "Ground Manager", false, "/media/photo.png");

        clubContactService.update(clubId, contactId, request);

        assertThat(existing.getRole()).isEqualTo("Ground Manager");
        assertThat(existing.getPhotoUrl()).isEqualTo("/media/photo.png");
        assertThat(existing.getContact().getFirstName()).isEqualTo("Jane");
        assertThat(existing.getContact().getEmail()).isEqualTo("jane@example.com");
    }

    @Test
    void createWithIsPrimaryTrueUnsetsAnotherActiveContactsPrimaryFlagForTheSameClub() {
        UUID clubId = UUID.randomUUID();
        ClubContact otherActivePrimary = existingContact(UUID.randomUUID(), clubId, true, true);
        when(clubContactRepository.findByClubIdAndActiveTrueAndIsPrimaryTrue(clubId))
                .thenReturn(List.of(otherActivePrimary));

        CreateClubContactRequest request = new CreateClubContactRequest(contactDto(), "Chairman", true, null);
        ClubContact mapped = new ClubContact();
        when(clubContactMapper.toEntity(request)).thenReturn(mapped);
        when(clubContactRepository.save(org.mockito.ArgumentMatchers.any(ClubContact.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));
        when(clubContactMapper.toDto(mapped)).thenReturn(dummyDto());

        clubContactService.create(clubId, request);

        assertThat(otherActivePrimary.isPrimary()).isFalse();
        // saveAndFlush, not save — see ClubContactServiceImpl.unsetOtherActivePrimaries's Javadoc:
        // the unset must physically hit the DB before create()'s own insert of the new primary row.
        verify(clubContactRepository).saveAndFlush(otherActivePrimary);
        assertThat(mapped.isPrimary()).isTrue();
    }

    @Test
    void createWithIsPrimaryTrueDoesNotTouchAnInactiveContactsStalePrimaryFlag() {
        // findByClubIdAndActiveTrueAndIsPrimaryTrue's own name/contract already excludes inactive
        // rows from what it returns (proven for real by ClubContactRepositoryTest's partial-index
        // coverage) — this test confirms the service calls that exact repository method and only
        // acts on whatever it returns, not that it re-derives DB filtering logic itself.
        UUID clubId = UUID.randomUUID();
        when(clubContactRepository.findByClubIdAndActiveTrueAndIsPrimaryTrue(clubId)).thenReturn(List.of());

        CreateClubContactRequest request = new CreateClubContactRequest(contactDto(), "Chairman", true, null);
        ClubContact mapped = new ClubContact();
        when(clubContactMapper.toEntity(request)).thenReturn(mapped);
        when(clubContactRepository.save(mapped)).thenReturn(mapped);
        when(clubContactMapper.toDto(mapped)).thenReturn(dummyDto());

        clubContactService.create(clubId, request);

        verify(clubContactRepository, times(1)).save(mapped);
    }

    @Test
    void updateWithIsPrimaryTrueExcludesTheContactBeingUpdatedFromTheUnsetPass() {
        UUID clubId = UUID.randomUUID();
        UUID contactId = UUID.randomUUID();
        ClubContact existing = existingContact(contactId, clubId, true, true);
        when(clubContactRepository.findById(contactId)).thenReturn(Optional.of(existing));
        when(clubContactRepository.findByClubIdAndActiveTrueAndIsPrimaryTrue(clubId))
                .thenReturn(List.of(existing));
        when(clubContactRepository.save(existing)).thenReturn(existing);
        when(clubContactMapper.toDto(existing)).thenReturn(dummyDto());

        UpdateClubContactRequest request = new UpdateClubContactRequest(contactDto(), "Chairman", true, null);

        clubContactService.update(clubId, contactId, request);

        assertThat(existing.isPrimary()).isTrue();
        ArgumentCaptor<ClubContact> saved = ArgumentCaptor.forClass(ClubContact.class);
        verify(clubContactRepository, times(1)).save(saved.capture());
        assertThat(saved.getValue()).isSameAs(existing);
    }

    @Test
    void deactivateOnActiveContactTransitionsToInactive() {
        UUID clubId = UUID.randomUUID();
        UUID contactId = UUID.randomUUID();
        ClubContact existing = existingContact(contactId, clubId, true, false);
        when(clubContactRepository.findById(contactId)).thenReturn(Optional.of(existing));
        when(clubContactRepository.save(existing)).thenReturn(existing);
        when(clubContactMapper.toDto(existing)).thenReturn(dummyDto());

        clubContactService.deactivate(clubId, contactId);

        assertThat(existing.isActive()).isFalse();
    }

    @Test
    void deactivateOnAlreadyInactiveContactThrowsInvalidStatusTransitionException() {
        UUID clubId = UUID.randomUUID();
        UUID contactId = UUID.randomUUID();
        ClubContact existing = existingContact(contactId, clubId, false, false);
        when(clubContactRepository.findById(contactId)).thenReturn(Optional.of(existing));

        assertThatThrownBy(() -> clubContactService.deactivate(clubId, contactId))
                .isInstanceOf(InvalidStatusTransitionException.class);
    }

    @Test
    void reactivateOnInactiveContactTransitionsToActive() {
        UUID clubId = UUID.randomUUID();
        UUID contactId = UUID.randomUUID();
        ClubContact existing = existingContact(contactId, clubId, false, false);
        when(clubContactRepository.findById(contactId)).thenReturn(Optional.of(existing));
        when(clubContactRepository.save(existing)).thenReturn(existing);
        when(clubContactMapper.toDto(existing)).thenReturn(dummyDto());

        clubContactService.reactivate(clubId, contactId);

        assertThat(existing.isActive()).isTrue();
    }

    @Test
    void reactivateOnAlreadyActiveContactThrowsInvalidStatusTransitionException() {
        UUID clubId = UUID.randomUUID();
        UUID contactId = UUID.randomUUID();
        ClubContact existing = existingContact(contactId, clubId, true, false);
        when(clubContactRepository.findById(contactId)).thenReturn(Optional.of(existing));

        assertThatThrownBy(() -> clubContactService.reactivate(clubId, contactId))
                .isInstanceOf(InvalidStatusTransitionException.class);
    }

    @Test
    void updateOnAContactBelongingToADifferentClubThrowsNotFoundException() {
        UUID clubId = UUID.randomUUID();
        UUID otherClubId = UUID.randomUUID();
        UUID contactId = UUID.randomUUID();
        ClubContact existing = existingContact(contactId, otherClubId, true, false);
        when(clubContactRepository.findById(contactId)).thenReturn(Optional.of(existing));

        UpdateClubContactRequest request = new UpdateClubContactRequest(contactDto(), "Chairman", false, null);

        assertThatThrownBy(() -> clubContactService.update(clubId, contactId, request))
                .isInstanceOf(NotFoundException.class);
    }

    @Test
    void deactivateOnANonexistentContactThrowsNotFoundException() {
        UUID clubId = UUID.randomUUID();
        UUID contactId = UUID.randomUUID();
        when(clubContactRepository.findById(contactId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> clubContactService.deactivate(clubId, contactId))
                .isInstanceOf(NotFoundException.class);
    }
}
