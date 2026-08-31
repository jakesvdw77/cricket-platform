package com.cricketlegend.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.cricketlegend.domain.BattingStance;
import com.cricketlegend.domain.BowlingArm;
import com.cricketlegend.domain.BowlingType;
import com.cricketlegend.domain.ClubMembership;
import com.cricketlegend.domain.Gender;
import com.cricketlegend.domain.Person;
import com.cricketlegend.domain.PersonStatus;
import com.cricketlegend.domain.PlayerProfile;
import com.cricketlegend.dto.CreatePlayerRequest;
import com.cricketlegend.dto.UpdatePlayerRequest;
import com.cricketlegend.exception.InvalidStatusTransitionException;
import com.cricketlegend.exception.NotFoundException;
import com.cricketlegend.mapper.PlayerMapper;
import com.cricketlegend.repository.ClubMembershipRepository;
import com.cricketlegend.repository.ClubRepository;
import com.cricketlegend.repository.PersonRepository;
import com.cricketlegend.repository.PlayerProfileRepository;
import com.cricketlegend.repository.PlayerSectionRepository;
import com.cricketlegend.service.impl.PlayerServiceImpl;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentMatchers;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

/**
 * Unit tests for PlayerServiceImpl's business rules from docs/specs/028-players.md: {@code
 * create} builds all three rows (Person/ClubMembership/PlayerProfile), {@code Person.status =
 * ACTIVE}, {@code Person.email} stays {@code null} even when the request supplies a
 * PlayerProfile-level email; {@code update} writes through to the linked {@code Person}; {@code
 * deactivate} closes the {@code ClubMembership} and its {@code 409}; {@code reactivate} reopens
 * it and both its {@code 409}s (already active; a different active membership already exists);
 * cross-club {@link NotFoundException} isolation for {@code playerId}.
 */
@ExtendWith(MockitoExtension.class)
class PlayerServiceImplTest {

    @Mock
    private ClubRepository clubRepository;

    @Mock
    private PersonRepository personRepository;

    @Mock
    private ClubMembershipRepository clubMembershipRepository;

    @Mock
    private PlayerProfileRepository playerProfileRepository;

    @Mock
    private PlayerSectionRepository playerSectionRepository;

    private final PlayerMapper playerMapper = new PlayerMapper();

    private PlayerServiceImpl playerService;

    @BeforeEach
    void setUp() {
        playerService = new PlayerServiceImpl(
                clubRepository,
                personRepository,
                clubMembershipRepository,
                playerProfileRepository,
                playerSectionRepository,
                playerMapper);
    }

    private Person person(UUID id, UUID personId) {
        return Person.builder()
                .id(id != null ? id : personId)
                .firstName("Jane")
                .lastName("Doe")
                .status(PersonStatus.ACTIVE)
                .build();
    }

    private PlayerProfile profile(UUID id, UUID personId, UUID clubId, boolean active) {
        return PlayerProfile.builder()
                .id(id)
                .personId(personId)
                .clubId(clubId)
                .active(active)
                .build();
    }

    private CreatePlayerRequest createRequest() {
        return new CreatePlayerRequest(
                "Jane",
                "Doe",
                LocalDate.of(2005, 3, 4),
                Gender.FEMALE,
                null,
                "M-123",
                null,
                null,
                "0821234567",
                null,
                null,
                null,
                BattingStance.RIGHT_HANDED,
                BowlingArm.RIGHT_ARM,
                BowlingType.MEDIUM,
                false);
    }

    private UpdatePlayerRequest updateRequest() {
        return new UpdatePlayerRequest(
                "Janet",
                "Doey",
                LocalDate.of(2005, 3, 4),
                Gender.FEMALE,
                null,
                "M-999",
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                true);
    }

    // --- create ---

    @Test
    void createBuildsPersonClubMembershipAndPlayerProfileWithPersonStatusActiveAndNullEmail() {
        UUID clubId = UUID.randomUUID();
        when(clubRepository.existsById(clubId)).thenReturn(true);
        when(personRepository.save(ArgumentMatchers.any(Person.class)))
                .thenAnswer(invocation -> {
                    Person p = invocation.getArgument(0);
                    p.setId(UUID.randomUUID());
                    return p;
                });
        when(clubMembershipRepository.save(ArgumentMatchers.any(ClubMembership.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));
        when(playerProfileRepository.save(ArgumentMatchers.any(PlayerProfile.class)))
                .thenAnswer(invocation -> {
                    PlayerProfile p = invocation.getArgument(0);
                    p.setId(UUID.randomUUID());
                    return p;
                });

        var dto = playerService.create(clubId, createRequest());

        assertThat(dto.firstName()).isEqualTo("Jane");
        assertThat(dto.lastName()).isEqualTo("Doe");
        assertThat(dto.email()).isNull(); // PlayerProfile.email, request didn't set one
        assertThat(dto.clubMembershipNumber()).isEqualTo("M-123");
        assertThat(dto.active()).isTrue();
        assertThat(dto.sectionIds()).isEmpty();

        org.mockito.ArgumentCaptor<Person> personCaptor = org.mockito.ArgumentCaptor.forClass(Person.class);
        verify(personRepository).save(personCaptor.capture());
        assertThat(personCaptor.getValue().getStatus()).isEqualTo(PersonStatus.ACTIVE);
        assertThat(personCaptor.getValue().getEmail()).isNull();

        org.mockito.ArgumentCaptor<ClubMembership> membershipCaptor =
                org.mockito.ArgumentCaptor.forClass(ClubMembership.class);
        verify(clubMembershipRepository).save(membershipCaptor.capture());
        assertThat(membershipCaptor.getValue().getClubId()).isEqualTo(clubId);
        assertThat(membershipCaptor.getValue().getValidTo()).isNull();

        org.mockito.ArgumentCaptor<PlayerProfile> profileCaptor =
                org.mockito.ArgumentCaptor.forClass(PlayerProfile.class);
        verify(playerProfileRepository).save(profileCaptor.capture());
        assertThat(profileCaptor.getValue().getClubId()).isEqualTo(clubId);
        assertThat(profileCaptor.getValue().isActive()).isTrue();
    }

    @Test
    void createOnANonexistentClubThrowsNotFoundException() {
        UUID clubId = UUID.randomUUID();
        when(clubRepository.existsById(clubId)).thenReturn(false);

        assertThatThrownBy(() -> playerService.create(clubId, createRequest()))
                .isInstanceOf(NotFoundException.class);
        verify(personRepository, never()).save(ArgumentMatchers.any());
    }

    // --- update ---

    @Test
    void updateWritesThroughToTheLinkedPerson() {
        UUID clubId = UUID.randomUUID();
        UUID playerId = UUID.randomUUID();
        UUID personId = UUID.randomUUID();
        PlayerProfile existingProfile = profile(playerId, personId, clubId, true);
        Person existingPerson = person(personId, personId);
        when(playerProfileRepository.findById(playerId)).thenReturn(Optional.of(existingProfile));
        when(personRepository.findById(personId)).thenReturn(Optional.of(existingPerson));
        when(personRepository.save(existingPerson)).thenReturn(existingPerson);
        when(playerProfileRepository.save(existingProfile)).thenReturn(existingProfile);
        when(playerSectionRepository.findByPlayerProfileId(playerId)).thenReturn(List.of());

        var dto = playerService.update(clubId, playerId, updateRequest());

        assertThat(existingPerson.getFirstName()).isEqualTo("Janet");
        assertThat(existingPerson.getLastName()).isEqualTo("Doey");
        assertThat(dto.firstName()).isEqualTo("Janet");
        assertThat(dto.clubMembershipNumber()).isEqualTo("M-999");
        assertThat(dto.isWicketKeeper()).isTrue();
    }

    @Test
    void updateOnAPlayerBelongingToADifferentClubThrowsNotFoundException() {
        UUID clubId = UUID.randomUUID();
        UUID otherClubId = UUID.randomUUID();
        UUID playerId = UUID.randomUUID();
        when(playerProfileRepository.findById(playerId))
                .thenReturn(Optional.of(profile(playerId, UUID.randomUUID(), otherClubId, true)));

        assertThatThrownBy(() -> playerService.update(clubId, playerId, updateRequest()))
                .isInstanceOf(NotFoundException.class);
        verify(personRepository, never()).findById(ArgumentMatchers.any());
    }

    @Test
    void updateOnANonexistentPlayerThrowsNotFoundException() {
        UUID clubId = UUID.randomUUID();
        UUID playerId = UUID.randomUUID();
        when(playerProfileRepository.findById(playerId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> playerService.update(clubId, playerId, updateRequest()))
                .isInstanceOf(NotFoundException.class);
    }

    // --- deactivate ---

    @Test
    void deactivateClosesTheClubMembershipAndSetsProfileInactive() {
        UUID clubId = UUID.randomUUID();
        UUID playerId = UUID.randomUUID();
        UUID personId = UUID.randomUUID();
        PlayerProfile existingProfile = profile(playerId, personId, clubId, true);
        ClubMembership membership =
                ClubMembership.builder().id(UUID.randomUUID()).personId(personId).clubId(clubId).build();
        when(playerProfileRepository.findById(playerId)).thenReturn(Optional.of(existingProfile));
        when(clubMembershipRepository.findByPersonIdAndValidToIsNull(personId))
                .thenReturn(Optional.of(membership));
        when(clubMembershipRepository.save(membership)).thenReturn(membership);
        when(playerProfileRepository.save(existingProfile)).thenReturn(existingProfile);
        when(personRepository.findById(personId)).thenReturn(Optional.of(person(personId, personId)));
        when(playerSectionRepository.findByPlayerProfileId(playerId)).thenReturn(List.of());

        var dto = playerService.deactivate(clubId, playerId);

        assertThat(dto.active()).isFalse();
        assertThat(membership.getValidTo()).isEqualTo(LocalDate.now());
        assertThat(existingProfile.isActive()).isFalse();
    }

    @Test
    void deactivateOnAnAlreadyInactivePlayerThrowsInvalidStatusTransitionException() {
        UUID clubId = UUID.randomUUID();
        UUID playerId = UUID.randomUUID();
        when(playerProfileRepository.findById(playerId))
                .thenReturn(Optional.of(profile(playerId, UUID.randomUUID(), clubId, false)));

        assertThatThrownBy(() -> playerService.deactivate(clubId, playerId))
                .isInstanceOf(InvalidStatusTransitionException.class)
                .hasMessageContaining("already inactive");
        verify(clubMembershipRepository, never())
                .findByPersonIdAndValidToIsNull(ArgumentMatchers.any());
    }

    // --- reactivate ---

    @Test
    void reactivateReopensTheClubMembershipAndSetsProfileActive() {
        UUID clubId = UUID.randomUUID();
        UUID playerId = UUID.randomUUID();
        UUID personId = UUID.randomUUID();
        PlayerProfile existingProfile = profile(playerId, personId, clubId, false);
        ClubMembership membership = ClubMembership.builder()
                .id(UUID.randomUUID())
                .personId(personId)
                .clubId(clubId)
                .validTo(LocalDate.now().minusDays(1))
                .build();
        when(playerProfileRepository.findById(playerId)).thenReturn(Optional.of(existingProfile));
        when(clubMembershipRepository.findByPersonIdAndClubId(personId, clubId)).thenReturn(Optional.of(membership));
        when(clubMembershipRepository.findByPersonIdAndValidToIsNull(personId)).thenReturn(Optional.empty());
        when(clubMembershipRepository.save(membership)).thenReturn(membership);
        when(playerProfileRepository.save(existingProfile)).thenReturn(existingProfile);
        when(personRepository.findById(personId)).thenReturn(Optional.of(person(personId, personId)));
        when(playerSectionRepository.findByPlayerProfileId(playerId)).thenReturn(List.of());

        var dto = playerService.reactivate(clubId, playerId);

        assertThat(dto.active()).isTrue();
        assertThat(membership.getValidTo()).isNull();
        assertThat(existingProfile.isActive()).isTrue();
    }

    @Test
    void reactivateOnAnAlreadyActivePlayerThrowsInvalidStatusTransitionException() {
        UUID clubId = UUID.randomUUID();
        UUID playerId = UUID.randomUUID();
        when(playerProfileRepository.findById(playerId))
                .thenReturn(Optional.of(profile(playerId, UUID.randomUUID(), clubId, true)));

        assertThatThrownBy(() -> playerService.reactivate(clubId, playerId))
                .isInstanceOf(InvalidStatusTransitionException.class)
                .hasMessageContaining("already active");
        verify(clubMembershipRepository, never())
                .findByPersonIdAndClubId(ArgumentMatchers.any(), ArgumentMatchers.any());
    }

    @Test
    void reactivateWhenADifferentActiveClubMembershipAlreadyExistsThrowsInvalidStatusTransitionException() {
        UUID clubId = UUID.randomUUID();
        UUID playerId = UUID.randomUUID();
        UUID personId = UUID.randomUUID();
        PlayerProfile existingProfile = profile(playerId, personId, clubId, false);
        ClubMembership ownMembership = ClubMembership.builder()
                .id(UUID.randomUUID())
                .personId(personId)
                .clubId(clubId)
                .validTo(LocalDate.now().minusDays(1))
                .build();
        ClubMembership differentActiveMembership = ClubMembership.builder()
                .id(UUID.randomUUID())
                .personId(personId)
                .clubId(UUID.randomUUID())
                .build();
        when(playerProfileRepository.findById(playerId)).thenReturn(Optional.of(existingProfile));
        when(clubMembershipRepository.findByPersonIdAndClubId(personId, clubId)).thenReturn(Optional.of(ownMembership));
        when(clubMembershipRepository.findByPersonIdAndValidToIsNull(personId))
                .thenReturn(Optional.of(differentActiveMembership));

        assertThatThrownBy(() -> playerService.reactivate(clubId, playerId))
                .isInstanceOf(InvalidStatusTransitionException.class)
                .hasMessageContaining("different active club membership");
        verify(clubMembershipRepository, never()).save(ArgumentMatchers.any());
        verify(playerProfileRepository, never()).save(ArgumentMatchers.any());
    }

    // --- cross-club isolation ---

    @Test
    void deactivateOnAPlayerBelongingToADifferentClubThrowsNotFoundException() {
        UUID clubId = UUID.randomUUID();
        UUID otherClubId = UUID.randomUUID();
        UUID playerId = UUID.randomUUID();
        when(playerProfileRepository.findById(playerId))
                .thenReturn(Optional.of(profile(playerId, UUID.randomUUID(), otherClubId, true)));

        assertThatThrownBy(() -> playerService.deactivate(clubId, playerId))
                .isInstanceOf(NotFoundException.class);
    }

    @Test
    void listOnlyReturnsPlayersForTheGivenClub() {
        UUID clubId = UUID.randomUUID();
        UUID personId = UUID.randomUUID();
        UUID playerId = UUID.randomUUID();
        PlayerProfile existingProfile = profile(playerId, personId, clubId, true);
        when(playerProfileRepository.findByClubId(clubId)).thenReturn(List.of(existingProfile));
        when(personRepository.findById(personId)).thenReturn(Optional.of(person(personId, personId)));
        when(playerSectionRepository.findByPlayerProfileId(playerId)).thenReturn(List.of());

        var result = playerService.list(clubId);

        assertThat(result).hasSize(1);
        assertThat(result.get(0).clubId()).isEqualTo(clubId);
    }
}
