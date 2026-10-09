package com.cricketlegend.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.cricketlegend.config.AccessService;
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
import com.cricketlegend.exception.ValidationException;
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
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentMatchers;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;

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

    @Mock
    private com.cricketlegend.repository.TeamSquadMemberRepository teamSquadMemberRepository;

    @Mock
    private com.cricketlegend.repository.MatchSidePlayerRepository matchSidePlayerRepository;

    @Mock
    private AccessService accessService;

    private final PlayerMapper playerMapper = new PlayerMapper();

    private PlayerServiceImpl playerService;
    private final Authentication authentication = new TestingAuthenticationToken(
            "club-admin-subject", null, List.of(new SimpleGrantedAuthority("ROLE_someone_else")));

    @BeforeEach
    void setUp() {
        playerService = new PlayerServiceImpl(
                clubRepository,
                personRepository,
                clubMembershipRepository,
                playerProfileRepository,
                playerSectionRepository,
                teamSquadMemberRepository,
                matchSidePlayerRepository,
                playerMapper,
                accessService);
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
        return createRequest(null);
    }

    private CreatePlayerRequest createRequest(Integer jerseyNumber) {
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
                false,
                jerseyNumber);
    }

    private UpdatePlayerRequest updateRequest() {
        return updateRequest(null);
    }

    private UpdatePlayerRequest updateRequest(Integer jerseyNumber) {
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
                true,
                jerseyNumber);
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
    void createPersistsTheSuppliedJerseyNumber() {
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

        var dto = playerService.create(clubId, createRequest(7));

        assertThat(dto.jerseyNumber()).isEqualTo(7);
    }

    @Test
    void createWithNoJerseyNumberPersistsNull() {
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

        var dto = playerService.create(clubId, createRequest(null));

        assertThat(dto.jerseyNumber()).isNull();
    }

    @Test
    void createWithANegativeJerseyNumberThrowsValidationException() {
        UUID clubId = UUID.randomUUID();
        when(clubRepository.existsById(clubId)).thenReturn(true);

        assertThatThrownBy(() -> playerService.create(clubId, createRequest(-1)))
                .isInstanceOf(ValidationException.class);
        verify(personRepository, never()).save(ArgumentMatchers.any());
    }

    @Test
    void createAppliesNoUniquenessCheckOnJerseyNumberAcrossPlayers() {
        // No repository lookup for an existing jerseyNumber is stubbed or verified — create()
        // never queries for one, proving no uniqueness check is applied to the standing number
        // (per docs/specs/031-jersey-numbers.md's Non-goals).
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

        var first = playerService.create(clubId, createRequest(7));
        var second = playerService.create(clubId, createRequest(7));

        assertThat(first.jerseyNumber()).isEqualTo(7);
        assertThat(second.jerseyNumber()).isEqualTo(7);
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

        var dto = playerService.update(authentication, clubId, playerId, updateRequest());

        assertThat(existingPerson.getFirstName()).isEqualTo("Janet");
        assertThat(existingPerson.getLastName()).isEqualTo("Doey");
        assertThat(dto.firstName()).isEqualTo("Janet");
        assertThat(dto.clubMembershipNumber()).isEqualTo("M-999");
        assertThat(dto.isWicketKeeper()).isTrue();
    }

    @Test
    void updatePersistsTheSuppliedJerseyNumberIncludingClearingItToNull() {
        UUID clubId = UUID.randomUUID();
        UUID playerId = UUID.randomUUID();
        UUID personId = UUID.randomUUID();
        PlayerProfile existingProfile = profile(playerId, personId, clubId, true);
        existingProfile.setJerseyNumber(7);
        Person existingPerson = person(personId, personId);
        when(playerProfileRepository.findById(playerId)).thenReturn(Optional.of(existingProfile));
        when(personRepository.findById(personId)).thenReturn(Optional.of(existingPerson));
        when(personRepository.save(existingPerson)).thenReturn(existingPerson);
        when(playerProfileRepository.save(existingProfile)).thenReturn(existingProfile);
        when(playerSectionRepository.findByPlayerProfileId(playerId)).thenReturn(List.of());

        var dto = playerService.update(authentication, clubId, playerId, updateRequest(null));

        assertThat(dto.jerseyNumber()).isNull();
        assertThat(existingProfile.getJerseyNumber()).isNull();
    }

    @Test
    void updateWithANegativeJerseyNumberThrowsValidationException() {
        UUID clubId = UUID.randomUUID();
        UUID playerId = UUID.randomUUID();
        UUID personId = UUID.randomUUID();
        PlayerProfile existingProfile = profile(playerId, personId, clubId, true);
        when(playerProfileRepository.findById(playerId)).thenReturn(Optional.of(existingProfile));

        assertThatThrownBy(() -> playerService.update(authentication, clubId, playerId, updateRequest(-1)))
                .isInstanceOf(ValidationException.class);
        verify(playerProfileRepository, never()).save(ArgumentMatchers.any());
    }

    @Test
    void updateOnAPlayerBelongingToADifferentClubThrowsNotFoundException() {
        UUID clubId = UUID.randomUUID();
        UUID otherClubId = UUID.randomUUID();
        UUID playerId = UUID.randomUUID();
        when(playerProfileRepository.findById(playerId))
                .thenReturn(Optional.of(profile(playerId, UUID.randomUUID(), otherClubId, true)));

        assertThatThrownBy(() -> playerService.update(authentication, clubId, playerId, updateRequest()))
                .isInstanceOf(NotFoundException.class);
        verify(personRepository, never()).findById(ArgumentMatchers.any());
    }

    @Test
    void updateOnANonexistentPlayerThrowsNotFoundException() {
        UUID clubId = UUID.randomUUID();
        UUID playerId = UUID.randomUUID();
        when(playerProfileRepository.findById(playerId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> playerService.update(authentication, clubId, playerId, updateRequest()))
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

        var dto = playerService.deactivate(authentication, clubId, playerId);

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

        assertThatThrownBy(() -> playerService.deactivate(authentication, clubId, playerId))
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

        var dto = playerService.reactivate(authentication, clubId, playerId);

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

        assertThatThrownBy(() -> playerService.reactivate(authentication, clubId, playerId))
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

        assertThatThrownBy(() -> playerService.reactivate(authentication, clubId, playerId))
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

        assertThatThrownBy(() -> playerService.deactivate(authentication, clubId, playerId))
                .isInstanceOf(NotFoundException.class);
    }

    @Test
    void listOnlyReturnsPlayersForTheGivenClub() {
        UUID clubId = UUID.randomUUID();
        UUID personId = UUID.randomUUID();
        UUID playerId = UUID.randomUUID();
        PlayerProfile existingProfile = profile(playerId, personId, clubId, true);
        when(playerProfileRepository.findByClubId(clubId)).thenReturn(List.of(existingProfile));
        when(personRepository.findAllById(List.of(personId))).thenReturn(List.of(person(personId, personId)));
        when(playerSectionRepository.findByPlayerProfileIdIn(List.of(playerId))).thenReturn(List.of());
        when(accessService.accessibleSectionIds(authentication, clubId)).thenReturn(Optional.empty());

        var result = playerService.list(authentication, clubId, null, false, true, null, null);

        assertThat(result).hasSize(1);
        assertThat(result.get(0).clubId()).isEqualTo(clubId);
    }

    @Test
    void listExcludesAPlayerWhoseTaggedSectionsAreOutsideTheCallersAccessibleSections() {
        UUID clubId = UUID.randomUUID();
        UUID personId = UUID.randomUUID();
        UUID playerId = UUID.randomUUID();
        UUID taggedSectionId = UUID.randomUUID();
        UUID accessibleSectionId = UUID.randomUUID();
        PlayerProfile existingProfile = profile(playerId, personId, clubId, true);
        when(playerProfileRepository.findByClubId(clubId)).thenReturn(List.of(existingProfile));
        when(playerSectionRepository.findByPlayerProfileIdIn(List.of(playerId))).thenReturn(List.of(
                com.cricketlegend.domain.PlayerSection.builder()
                        .playerProfileId(playerId).sectionId(taggedSectionId).build()));
        when(accessService.accessibleSectionIds(authentication, clubId))
                .thenReturn(Optional.of(Set.of(accessibleSectionId)));

        var result = playerService.list(authentication, clubId, null, false, true, null, null);

        assertThat(result).isEmpty();
    }

    @Test
    void listWithMissingDateOfBirthUsesTheMissingDateQueryAndNotTheFullClubQuery() {
        UUID clubId = UUID.randomUUID();
        UUID personId = UUID.randomUUID();
        UUID playerId = UUID.randomUUID();
        when(playerProfileRepository.findByClubIdWithoutDateOfBirth(clubId))
                .thenReturn(List.of(profile(playerId, personId, clubId, true)));
        when(personRepository.findAllById(List.of(personId))).thenReturn(List.of(person(personId, personId)));
        when(playerSectionRepository.findByPlayerProfileIdIn(List.of(playerId))).thenReturn(List.of());
        when(accessService.accessibleSectionIds(authentication, clubId)).thenReturn(Optional.empty());

        var result = playerService.list(authentication, clubId, null, true, true, null, null);

        assertThat(result).hasSize(1);
        verify(playerProfileRepository, never()).findByClubId(clubId);
    }

    // --- docs/specs/088-players-polls-alignment.md: includeInactive, focus, summary, verify and reject ---

    private PlayerProfile withStatus(PlayerProfile profile, com.cricketlegend.domain.PlayerVerificationStatus status) {
        profile.setVerificationStatus(status);
        return profile;
    }

    private void stubClubRoster(UUID clubId, PlayerProfile... profiles) {
        when(playerProfileRepository.findByClubId(clubId)).thenReturn(List.of(profiles));
        when(playerSectionRepository.findByPlayerProfileIdIn(any())).thenReturn(List.of());
        when(accessService.accessibleSectionIds(authentication, clubId)).thenReturn(Optional.empty());
    }

    @Test
    void listWithoutInactiveHidesSuspendedAndRejectedPlayersButKeepsUnverifiedOnes() {
        UUID clubId = UUID.randomUUID();
        PlayerProfile verified = profile(UUID.randomUUID(), UUID.randomUUID(), clubId, true);
        PlayerProfile unverified = withStatus(
                profile(UUID.randomUUID(), UUID.randomUUID(), clubId, true),
                com.cricketlegend.domain.PlayerVerificationStatus.UNVERIFIED);
        PlayerProfile rejected = withStatus(
                profile(UUID.randomUUID(), UUID.randomUUID(), clubId, true),
                com.cricketlegend.domain.PlayerVerificationStatus.REJECTED);
        PlayerProfile suspended = profile(UUID.randomUUID(), UUID.randomUUID(), clubId, false);
        stubClubRoster(clubId, verified, unverified, rejected, suspended);
        when(personRepository.findAllById(any())).thenAnswer(invocation -> ((java.util.Collection<UUID>) invocation.getArgument(0))
                .stream().map(id -> person(id, id)).toList());

        var hidden = playerService.list(authentication, clubId, null, false, false, null, null);
        var everyone = playerService.list(authentication, clubId, null, false, true, null, null);

        assertThat(hidden).extracting(com.cricketlegend.dto.PlayerDto::id).containsExactlyInAnyOrder(verified.getId(), unverified.getId());
        assertThat(everyone).hasSize(4);
    }

    @Test
    void aSeasonFocusWithoutASeasonIsAValidationError() {
        UUID clubId = UUID.randomUUID();

        assertThatThrownBy(() -> playerService.list(
                        authentication, clubId, null, false, false, com.cricketlegend.domain.PlayerListFocus.IN_SQUAD, null))
                .isInstanceOf(ValidationException.class);
        assertThatThrownBy(() -> playerService.list(
                        authentication, clubId, null, false, false, com.cricketlegend.domain.PlayerListFocus.SELECTED, null))
                .isInstanceOf(ValidationException.class);
    }

    @Test
    void theFocusesNarrowTheListToSquadSelectedAndUnverifiedPlayers() {
        UUID clubId = UUID.randomUUID();
        UUID seasonId = UUID.randomUUID();
        PlayerProfile inSquad = profile(UUID.randomUUID(), UUID.randomUUID(), clubId, true);
        PlayerProfile picked = profile(UUID.randomUUID(), UUID.randomUUID(), clubId, true);
        PlayerProfile waiting = withStatus(
                profile(UUID.randomUUID(), UUID.randomUUID(), clubId, true),
                com.cricketlegend.domain.PlayerVerificationStatus.UNVERIFIED);
        stubClubRoster(clubId, inSquad, picked, waiting);
        when(personRepository.findAllById(any())).thenAnswer(invocation -> ((java.util.Collection<UUID>) invocation.getArgument(0))
                .stream().map(id -> person(id, id)).toList());
        when(teamSquadMemberRepository.findDistinctPlayerProfileIdsBySeasonId(seasonId)).thenReturn(List.of(inSquad.getId()));
        when(matchSidePlayerRepository.findDistinctSelectedPlayerProfileIds(clubId, seasonId)).thenReturn(List.of(picked.getId()));

        var squad = playerService.list(authentication, clubId, null, false, true, com.cricketlegend.domain.PlayerListFocus.IN_SQUAD, seasonId);
        var selected = playerService.list(authentication, clubId, null, false, true, com.cricketlegend.domain.PlayerListFocus.SELECTED, seasonId);
        var unverified = playerService.list(authentication, clubId, null, false, true, com.cricketlegend.domain.PlayerListFocus.UNVERIFIED, null);

        assertThat(squad).extracting(com.cricketlegend.dto.PlayerDto::id).containsExactly(inSquad.getId());
        assertThat(selected).extracting(com.cricketlegend.dto.PlayerDto::id).containsExactly(picked.getId());
        assertThat(unverified).extracting(com.cricketlegend.dto.PlayerDto::id).containsExactly(waiting.getId());
    }

    @Test
    void summaryCountsTheSameSetsTheListReturnsAndSkipsThePersonLookup() {
        UUID clubId = UUID.randomUUID();
        UUID seasonId = UUID.randomUUID();
        PlayerProfile a = profile(UUID.randomUUID(), UUID.randomUUID(), clubId, true);
        PlayerProfile b = withStatus(
                profile(UUID.randomUUID(), UUID.randomUUID(), clubId, true),
                com.cricketlegend.domain.PlayerVerificationStatus.UNVERIFIED);
        PlayerProfile rejected = withStatus(
                profile(UUID.randomUUID(), UUID.randomUUID(), clubId, true),
                com.cricketlegend.domain.PlayerVerificationStatus.REJECTED);
        stubClubRoster(clubId, a, b, rejected);
        when(teamSquadMemberRepository.findDistinctPlayerProfileIdsBySeasonId(seasonId))
                .thenReturn(List.of(a.getId(), b.getId(), rejected.getId()));
        when(matchSidePlayerRepository.findDistinctSelectedPlayerProfileIds(clubId, seasonId)).thenReturn(List.of(a.getId()));

        var counters = playerService.summary(authentication, clubId, null, false, false, seasonId);

        // the rejected player is out of the list, so out of every figure
        assertThat(counters).isEqualTo(new com.cricketlegend.dto.PlayersSummaryDto(2, 2, 1, 1));
        verify(personRepository, never()).findAllById(any());
    }

    @Test
    void summaryWithoutASeasonReportsZeroForTheTwoSeasonFiguresAndQueriesNeitherSource() {
        UUID clubId = UUID.randomUUID();
        stubClubRoster(clubId, profile(UUID.randomUUID(), UUID.randomUUID(), clubId, true));

        var counters = playerService.summary(authentication, clubId, null, false, false, null);

        assertThat(counters).isEqualTo(new com.cricketlegend.dto.PlayersSummaryDto(1, 0, 0, 0));
        verify(teamSquadMemberRepository, never()).findDistinctPlayerProfileIdsBySeasonId(any());
        verify(matchSidePlayerRepository, never()).findDistinctSelectedPlayerProfileIds(any(), any());
    }

    private void stubSingleProfile(PlayerProfile profile) {
        when(playerProfileRepository.findById(profile.getId())).thenReturn(Optional.of(profile));
        // the conflict paths never reach save or the person lookup
        org.mockito.Mockito.lenient().when(playerSectionRepository.findByPlayerProfileId(profile.getId())).thenReturn(List.of());
        org.mockito.Mockito.lenient().when(playerProfileRepository.save(any(PlayerProfile.class))).thenAnswer(invocation -> invocation.getArgument(0));
        org.mockito.Mockito.lenient().when(personRepository.findById(profile.getPersonId()))
                .thenReturn(Optional.of(person(profile.getPersonId(), profile.getPersonId())));
    }

    @Test
    void verifyAcceptsAnUnverifiedAndUndoesARejectedPlayer() {
        UUID clubId = UUID.randomUUID();
        PlayerProfile unverified = withStatus(
                profile(UUID.randomUUID(), UUID.randomUUID(), clubId, true),
                com.cricketlegend.domain.PlayerVerificationStatus.UNVERIFIED);
        stubSingleProfile(unverified);

        var result = playerService.verify(authentication, clubId, unverified.getId());

        assertThat(result.verificationStatus()).isEqualTo(com.cricketlegend.domain.PlayerVerificationStatus.VERIFIED);

        PlayerProfile rejected = withStatus(
                profile(UUID.randomUUID(), UUID.randomUUID(), clubId, true),
                com.cricketlegend.domain.PlayerVerificationStatus.REJECTED);
        stubSingleProfile(rejected);

        assertThat(playerService.verify(authentication, clubId, rejected.getId()).verificationStatus())
                .isEqualTo(com.cricketlegend.domain.PlayerVerificationStatus.VERIFIED);
    }

    @Test
    void verifyingAVerifiedPlayerIsAConflict() {
        UUID clubId = UUID.randomUUID();
        PlayerProfile verified = profile(UUID.randomUUID(), UUID.randomUUID(), clubId, true);
        stubSingleProfile(verified);

        assertThatThrownBy(() -> playerService.verify(authentication, clubId, verified.getId()))
                .isInstanceOf(InvalidStatusTransitionException.class);
        verify(playerProfileRepository, never()).save(any(PlayerProfile.class));
    }

    @Test
    void rejectOnlyWorksForAnUnverifiedPlayer() {
        UUID clubId = UUID.randomUUID();
        PlayerProfile unverified = withStatus(
                profile(UUID.randomUUID(), UUID.randomUUID(), clubId, true),
                com.cricketlegend.domain.PlayerVerificationStatus.UNVERIFIED);
        stubSingleProfile(unverified);

        assertThat(playerService.reject(authentication, clubId, unverified.getId()).verificationStatus())
                .isEqualTo(com.cricketlegend.domain.PlayerVerificationStatus.REJECTED);

        for (var status : new com.cricketlegend.domain.PlayerVerificationStatus[] {
            com.cricketlegend.domain.PlayerVerificationStatus.VERIFIED,
            com.cricketlegend.domain.PlayerVerificationStatus.REJECTED}) {
            PlayerProfile other = withStatus(profile(UUID.randomUUID(), UUID.randomUUID(), clubId, true), status);
            stubSingleProfile(other);
            assertThatThrownBy(() -> playerService.reject(authentication, clubId, other.getId()))
                    .isInstanceOf(InvalidStatusTransitionException.class);
        }
    }

    @Test
    void verifyAndRejectAreScopedToTheClubAndTheCallersSections() {
        UUID clubId = UUID.randomUUID();
        UUID playerId = UUID.randomUUID();
        when(playerProfileRepository.findById(playerId))
                .thenReturn(Optional.of(profile(playerId, UUID.randomUUID(), UUID.randomUUID(), true)));

        assertThatThrownBy(() -> playerService.verify(authentication, clubId, playerId)).isInstanceOf(NotFoundException.class);
        assertThatThrownBy(() -> playerService.reject(authentication, clubId, playerId)).isInstanceOf(NotFoundException.class);

        PlayerProfile own = withStatus(
                profile(UUID.randomUUID(), UUID.randomUUID(), clubId, true),
                com.cricketlegend.domain.PlayerVerificationStatus.UNVERIFIED);
        stubSingleProfile(own);
        verify(accessService, never()).assertCanAdministerAnySection(any(), any(), any());
        playerService.reject(authentication, clubId, own.getId());
        verify(accessService).assertCanAdministerAnySection(any(), any(), any());
    }

    // --- date of birth rule (077) ---

    private CreatePlayerRequest createRequestWithDob(LocalDate dateOfBirth) {
        CreatePlayerRequest base = createRequest();
        return new CreatePlayerRequest(base.firstName(), base.lastName(), dateOfBirth, base.gender(),
                null, null, null, null, null, null, null, null, null, null, null, false, null);
    }

    private UpdatePlayerRequest updateRequestWithDob(LocalDate dateOfBirth) {
        UpdatePlayerRequest base = updateRequest();
        return new UpdatePlayerRequest(base.firstName(), base.lastName(), dateOfBirth, base.gender(),
                null, null, null, null, null, null, null, null, null, null, null, false, null);
    }

    @Test
    void createWithoutDateOfBirthIsRejectedAndNothingIsSaved() {
        UUID clubId = UUID.randomUUID();
        when(clubRepository.existsById(clubId)).thenReturn(true);

        assertThatThrownBy(() -> playerService.create(clubId, createRequestWithDob(null)))
                .isInstanceOf(ValidationException.class)
                .hasMessage("Date of birth is required");
        verify(personRepository, never()).save(ArgumentMatchers.any());
    }

    @Test
    void createWithAFutureDateOfBirthIsRejected() {
        UUID clubId = UUID.randomUUID();
        when(clubRepository.existsById(clubId)).thenReturn(true);

        assertThatThrownBy(() -> playerService.create(clubId, createRequestWithDob(LocalDate.now().plusDays(1))))
                .isInstanceOf(ValidationException.class)
                .hasMessage("Date of birth must not be in the future");
    }

    @Test
    void createWithADateOfBirthBefore1900IsRejected() {
        UUID clubId = UUID.randomUUID();
        when(clubRepository.existsById(clubId)).thenReturn(true);

        assertThatThrownBy(() -> playerService.create(clubId, createRequestWithDob(LocalDate.of(1899, 12, 31))))
                .isInstanceOf(ValidationException.class)
                .hasMessage("Date of birth must not be before 1900-01-01");
    }

    @Test
    void createAcceptsTheBoundaryDatesTodayAndFirstOfJanuary1900() {
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
                .thenAnswer(invocation -> invocation.getArgument(0));

        assertThat(playerService.create(clubId, createRequestWithDob(LocalDate.now())).dateOfBirth())
                .isEqualTo(LocalDate.now());
        assertThat(playerService.create(clubId, createRequestWithDob(LocalDate.of(1900, 1, 1))).dateOfBirth())
                .isEqualTo(LocalDate.of(1900, 1, 1));
    }

    @Test
    void updateWithoutDateOfBirthIsRejectedEvenWhenTheStoredPersonHasNone() {
        UUID clubId = UUID.randomUUID();
        UUID playerId = UUID.randomUUID();
        UUID personId = UUID.randomUUID();
        when(playerProfileRepository.findById(playerId))
                .thenReturn(Optional.of(profile(playerId, personId, clubId, true)));
        when(playerSectionRepository.findByPlayerProfileId(playerId)).thenReturn(List.of());

        assertThatThrownBy(() -> playerService.update(authentication, clubId, playerId, updateRequestWithDob(null)))
                .isInstanceOf(ValidationException.class)
                .hasMessage("Date of birth is required");
        verify(personRepository, never()).save(ArgumentMatchers.any());
    }

    @Test
    void updateWithAFutureOrPre1900DateOfBirthIsRejected() {
        UUID clubId = UUID.randomUUID();
        UUID playerId = UUID.randomUUID();
        UUID personId = UUID.randomUUID();
        when(playerProfileRepository.findById(playerId))
                .thenReturn(Optional.of(profile(playerId, personId, clubId, true)));
        when(playerSectionRepository.findByPlayerProfileId(playerId)).thenReturn(List.of());

        assertThatThrownBy(() -> playerService.update(
                        authentication, clubId, playerId, updateRequestWithDob(LocalDate.now().plusDays(1))))
                .isInstanceOf(ValidationException.class)
                .hasMessage("Date of birth must not be in the future");
        assertThatThrownBy(() -> playerService.update(
                        authentication, clubId, playerId, updateRequestWithDob(LocalDate.of(1899, 12, 31))))
                .isInstanceOf(ValidationException.class)
                .hasMessage("Date of birth must not be before 1900-01-01");
    }

    @Test
    void updateAcceptsTheBoundaryDates() {
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

        playerService.update(authentication, clubId, playerId, updateRequestWithDob(LocalDate.of(1900, 1, 1)));
        assertThat(existingPerson.getDateOfBirth()).isEqualTo(LocalDate.of(1900, 1, 1));
        playerService.update(authentication, clubId, playerId, updateRequestWithDob(LocalDate.now()));
        assertThat(existingPerson.getDateOfBirth()).isEqualTo(LocalDate.now());
    }
}
