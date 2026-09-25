package com.cricketlegend.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

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
import com.cricketlegend.service.impl.LeagueContactServiceImpl;
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
 * Unit tests for LeagueContactServiceImpl's business rules from
 * docs/specs/054-league-contacts.md: setting isPrimary auto-unsets any other active primary for
 * the same league (leaving an inactive contact's stale flag alone) via {@code saveAndFlush} (not
 * {@code save} — the fix {@code SponsorContactServiceImpl} already applies, mirrored here from
 * day one), deactivate/reactivate's one-way transition guard, and the two-level cross-tenant
 * isolation this spec adds on top of {@code ClubContactServiceImplTest}'s single-level pattern:
 * {@code findOrThrowLeagueForClub} (a real league belonging to a different club) and {@code
 * findOrThrowContactForLeague} (a real contact belonging to a different league).
 */
@ExtendWith(MockitoExtension.class)
class LeagueContactServiceImplTest {

    @Mock
    private LeagueRepository leagueRepository;

    @Mock
    private LeagueContactRepository leagueContactRepository;

    @Mock
    private LeagueContactMapper leagueContactMapper;

    private LeagueContactServiceImpl leagueContactService;

    @BeforeEach
    void setUp() {
        leagueContactService =
                new LeagueContactServiceImpl(leagueRepository, leagueContactRepository, leagueContactMapper);
    }

    private ContactDto contactDto() {
        return new ContactDto("Jane", "Doe", "jane@example.com", "0123456789");
    }

    private LeagueContactDto dummyDto() {
        return new LeagueContactDto(
                UUID.randomUUID(), UUID.randomUUID(), contactDto(), "Umpire Coordinator", false, true, null, null, null);
    }

    private League league(UUID leagueId, UUID clubId) {
        return League.builder().id(leagueId).clubId(clubId).name("Premier League").active(true).build();
    }

    private LeagueContact existingContact(UUID id, UUID leagueId, boolean active, boolean primary) {
        LeagueContact contact = new LeagueContact();
        contact.setId(id);
        contact.setLeagueId(leagueId);
        contact.setActive(active);
        contact.setPrimary(primary);
        contact.setRole("Treasurer");
        return contact;
    }

    @Test
    void createSavesAMappedEntityScopedToTheLeagueAndActiveByDefault() {
        UUID clubId = UUID.randomUUID();
        UUID leagueId = UUID.randomUUID();
        when(leagueRepository.findById(leagueId)).thenReturn(Optional.of(league(leagueId, clubId)));

        CreateLeagueContactRequest request =
                new CreateLeagueContactRequest(contactDto(), "Umpire Coordinator", false);
        LeagueContact mapped = new LeagueContact();
        when(leagueContactMapper.toEntity(request)).thenReturn(mapped);
        when(leagueContactRepository.save(mapped)).thenReturn(mapped);
        when(leagueContactMapper.toDto(mapped)).thenReturn(dummyDto());

        leagueContactService.create(clubId, leagueId, request);

        assertThat(mapped.getLeagueId()).isEqualTo(leagueId);
        assertThat(mapped.isActive()).isTrue();
        assertThat(mapped.isPrimary()).isFalse();
        verify(leagueContactRepository, never()).findByLeagueIdAndActiveTrueAndIsPrimaryTrue(leagueId);
    }

    @Test
    void updateAppliesRequestFieldsOntoTheExistingEntity() {
        UUID clubId = UUID.randomUUID();
        UUID leagueId = UUID.randomUUID();
        UUID contactId = UUID.randomUUID();
        when(leagueRepository.findById(leagueId)).thenReturn(Optional.of(league(leagueId, clubId)));
        LeagueContact existing = existingContact(contactId, leagueId, true, false);
        when(leagueContactRepository.findById(contactId)).thenReturn(Optional.of(existing));
        when(leagueContactRepository.save(existing)).thenReturn(existing);
        when(leagueContactMapper.toDto(existing)).thenReturn(dummyDto());

        UpdateLeagueContactRequest request =
                new UpdateLeagueContactRequest(contactDto(), "League Administrator", false);

        leagueContactService.update(clubId, leagueId, contactId, request);

        assertThat(existing.getRole()).isEqualTo("League Administrator");
        assertThat(existing.getContact().getFirstName()).isEqualTo("Jane");
        assertThat(existing.getContact().getEmail()).isEqualTo("jane@example.com");
    }

    @Test
    void createWithIsPrimaryTrueUnsetsAnotherActiveContactsPrimaryFlagForTheSameLeague() {
        UUID clubId = UUID.randomUUID();
        UUID leagueId = UUID.randomUUID();
        when(leagueRepository.findById(leagueId)).thenReturn(Optional.of(league(leagueId, clubId)));
        LeagueContact otherActivePrimary = existingContact(UUID.randomUUID(), leagueId, true, true);
        when(leagueContactRepository.findByLeagueIdAndActiveTrueAndIsPrimaryTrue(leagueId))
                .thenReturn(List.of(otherActivePrimary));

        CreateLeagueContactRequest request =
                new CreateLeagueContactRequest(contactDto(), "Umpire Coordinator", true);
        LeagueContact mapped = new LeagueContact();
        when(leagueContactMapper.toEntity(request)).thenReturn(mapped);
        when(leagueContactRepository.save(org.mockito.ArgumentMatchers.any(LeagueContact.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));
        when(leagueContactMapper.toDto(mapped)).thenReturn(dummyDto());

        leagueContactService.create(clubId, leagueId, request);

        assertThat(otherActivePrimary.isPrimary()).isFalse();
        // saveAndFlush, not save — see LeagueContactServiceImpl.unsetOtherActivePrimaries's
        // Javadoc: the unset must physically hit the DB before create()'s own insert of the new
        // primary row, otherwise Hibernate's flush ordering trips ux_league_contact_primary.
        verify(leagueContactRepository).saveAndFlush(otherActivePrimary);
        assertThat(mapped.isPrimary()).isTrue();
    }

    @Test
    void createWithIsPrimaryTrueDoesNotTouchAnInactiveContactsStalePrimaryFlag() {
        UUID clubId = UUID.randomUUID();
        UUID leagueId = UUID.randomUUID();
        when(leagueRepository.findById(leagueId)).thenReturn(Optional.of(league(leagueId, clubId)));
        when(leagueContactRepository.findByLeagueIdAndActiveTrueAndIsPrimaryTrue(leagueId))
                .thenReturn(List.of());

        CreateLeagueContactRequest request =
                new CreateLeagueContactRequest(contactDto(), "Umpire Coordinator", true);
        LeagueContact mapped = new LeagueContact();
        when(leagueContactMapper.toEntity(request)).thenReturn(mapped);
        when(leagueContactRepository.save(mapped)).thenReturn(mapped);
        when(leagueContactMapper.toDto(mapped)).thenReturn(dummyDto());

        leagueContactService.create(clubId, leagueId, request);

        verify(leagueContactRepository, times(1)).save(mapped);
    }

    @Test
    void updateWithIsPrimaryTrueExcludesTheContactBeingUpdatedFromTheUnsetPass() {
        UUID clubId = UUID.randomUUID();
        UUID leagueId = UUID.randomUUID();
        UUID contactId = UUID.randomUUID();
        when(leagueRepository.findById(leagueId)).thenReturn(Optional.of(league(leagueId, clubId)));
        LeagueContact existing = existingContact(contactId, leagueId, true, true);
        when(leagueContactRepository.findById(contactId)).thenReturn(Optional.of(existing));
        when(leagueContactRepository.findByLeagueIdAndActiveTrueAndIsPrimaryTrue(leagueId))
                .thenReturn(List.of(existing));
        when(leagueContactRepository.save(existing)).thenReturn(existing);
        when(leagueContactMapper.toDto(existing)).thenReturn(dummyDto());

        UpdateLeagueContactRequest request =
                new UpdateLeagueContactRequest(contactDto(), "Umpire Coordinator", true);

        leagueContactService.update(clubId, leagueId, contactId, request);

        assertThat(existing.isPrimary()).isTrue();
        ArgumentCaptor<LeagueContact> saved = ArgumentCaptor.forClass(LeagueContact.class);
        verify(leagueContactRepository, times(1)).save(saved.capture());
        assertThat(saved.getValue()).isSameAs(existing);
    }

    @Test
    void deactivateOnActiveContactTransitionsToInactive() {
        UUID clubId = UUID.randomUUID();
        UUID leagueId = UUID.randomUUID();
        UUID contactId = UUID.randomUUID();
        when(leagueRepository.findById(leagueId)).thenReturn(Optional.of(league(leagueId, clubId)));
        LeagueContact existing = existingContact(contactId, leagueId, true, false);
        when(leagueContactRepository.findById(contactId)).thenReturn(Optional.of(existing));
        when(leagueContactRepository.save(existing)).thenReturn(existing);
        when(leagueContactMapper.toDto(existing)).thenReturn(dummyDto());

        leagueContactService.deactivate(clubId, leagueId, contactId);

        assertThat(existing.isActive()).isFalse();
    }

    @Test
    void deactivateOnAlreadyInactiveContactThrowsInvalidStatusTransitionException() {
        UUID clubId = UUID.randomUUID();
        UUID leagueId = UUID.randomUUID();
        UUID contactId = UUID.randomUUID();
        when(leagueRepository.findById(leagueId)).thenReturn(Optional.of(league(leagueId, clubId)));
        LeagueContact existing = existingContact(contactId, leagueId, false, false);
        when(leagueContactRepository.findById(contactId)).thenReturn(Optional.of(existing));

        assertThatThrownBy(() -> leagueContactService.deactivate(clubId, leagueId, contactId))
                .isInstanceOf(InvalidStatusTransitionException.class);
    }

    @Test
    void reactivateOnInactiveContactTransitionsToActive() {
        UUID clubId = UUID.randomUUID();
        UUID leagueId = UUID.randomUUID();
        UUID contactId = UUID.randomUUID();
        when(leagueRepository.findById(leagueId)).thenReturn(Optional.of(league(leagueId, clubId)));
        LeagueContact existing = existingContact(contactId, leagueId, false, false);
        when(leagueContactRepository.findById(contactId)).thenReturn(Optional.of(existing));
        when(leagueContactRepository.save(existing)).thenReturn(existing);
        when(leagueContactMapper.toDto(existing)).thenReturn(dummyDto());

        leagueContactService.reactivate(clubId, leagueId, contactId);

        assertThat(existing.isActive()).isTrue();
    }

    @Test
    void reactivateOnAlreadyActiveContactThrowsInvalidStatusTransitionException() {
        UUID clubId = UUID.randomUUID();
        UUID leagueId = UUID.randomUUID();
        UUID contactId = UUID.randomUUID();
        when(leagueRepository.findById(leagueId)).thenReturn(Optional.of(league(leagueId, clubId)));
        LeagueContact existing = existingContact(contactId, leagueId, true, false);
        when(leagueContactRepository.findById(contactId)).thenReturn(Optional.of(existing));

        assertThatThrownBy(() -> leagueContactService.reactivate(clubId, leagueId, contactId))
                .isInstanceOf(InvalidStatusTransitionException.class);
    }

    @Test
    void updateOnALeagueBelongingToADifferentClubThrowsNotFoundException() {
        UUID clubId = UUID.randomUUID();
        UUID otherClubId = UUID.randomUUID();
        UUID leagueId = UUID.randomUUID();
        UUID contactId = UUID.randomUUID();
        when(leagueRepository.findById(leagueId)).thenReturn(Optional.of(league(leagueId, otherClubId)));

        UpdateLeagueContactRequest request =
                new UpdateLeagueContactRequest(contactDto(), "Umpire Coordinator", false);

        assertThatThrownBy(() -> leagueContactService.update(clubId, leagueId, contactId, request))
                .isInstanceOf(NotFoundException.class);
        verify(leagueContactRepository, never()).findById(contactId);
    }

    @Test
    void updateOnAContactBelongingToADifferentLeagueThrowsNotFoundException() {
        UUID clubId = UUID.randomUUID();
        UUID leagueId = UUID.randomUUID();
        UUID otherLeagueId = UUID.randomUUID();
        UUID contactId = UUID.randomUUID();
        when(leagueRepository.findById(leagueId)).thenReturn(Optional.of(league(leagueId, clubId)));
        LeagueContact existing = existingContact(contactId, otherLeagueId, true, false);
        when(leagueContactRepository.findById(contactId)).thenReturn(Optional.of(existing));

        UpdateLeagueContactRequest request =
                new UpdateLeagueContactRequest(contactDto(), "Umpire Coordinator", false);

        assertThatThrownBy(() -> leagueContactService.update(clubId, leagueId, contactId, request))
                .isInstanceOf(NotFoundException.class);
    }

    @Test
    void deactivateOnANonexistentLeagueThrowsNotFoundException() {
        UUID clubId = UUID.randomUUID();
        UUID leagueId = UUID.randomUUID();
        UUID contactId = UUID.randomUUID();
        when(leagueRepository.findById(leagueId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> leagueContactService.deactivate(clubId, leagueId, contactId))
                .isInstanceOf(NotFoundException.class);
        verify(leagueContactRepository, never()).findById(contactId);
    }

    @Test
    void deactivateOnANonexistentContactThrowsNotFoundException() {
        UUID clubId = UUID.randomUUID();
        UUID leagueId = UUID.randomUUID();
        UUID contactId = UUID.randomUUID();
        when(leagueRepository.findById(leagueId)).thenReturn(Optional.of(league(leagueId, clubId)));
        when(leagueContactRepository.findById(contactId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> leagueContactService.deactivate(clubId, leagueId, contactId))
                .isInstanceOf(NotFoundException.class);
    }
}
