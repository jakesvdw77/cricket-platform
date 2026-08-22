package com.cricketlegend.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.cricketlegend.domain.Club;
import com.cricketlegend.domain.ClubStatus;
import com.cricketlegend.dto.ClubDto;
import com.cricketlegend.dto.CreateClubRequest;
import com.cricketlegend.dto.UpdateClubRequest;
import com.cricketlegend.exception.DuplicateSlugException;
import com.cricketlegend.exception.InvalidStatusTransitionException;
import com.cricketlegend.exception.KeycloakProvisioningException;
import com.cricketlegend.exception.ReservedSlugException;
import com.cricketlegend.mapper.ClubMapper;
import com.cricketlegend.repository.ClubRepository;
import com.cricketlegend.service.impl.ClubServiceImpl;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;

/**
 * Unit tests for ClubServiceImpl's business rules from docs/specs/010-minimal-club-creation.md:
 * create always lands ACTIVE, the ADR-04 reserved-word blocklist, slug uniqueness (create and
 * update-excluding-self), the suspend/reactivate transition pair, and the name-ascending default
 * sort. Per docs/standards/backend.md, every @Service method carrying a business rule ships a
 * unit test in the same change.
 *
 * <p>Slug <em>format</em> validation (lowercase alphanumeric + single hyphens, 3-63 chars) is
 * bean validation on {@link CreateClubRequest}/{@link UpdateClubRequest} (@Pattern/@Size),
 * enforced by Spring MVC's @Valid at the controller boundary — ClubServiceImpl itself never
 * re-checks slug format, only the reserved-word list and uniqueness. That coverage lives in
 * {@code CreateClubRequestValidationTest} instead; there is deliberately no
 * "malformed slug rejected by the service" test here since calling
 * {@code ClubServiceImpl.create()}/{@code update()} directly with a malformed slug wouldn't
 * exercise any real production behavior — bean validation never runs when the service is called
 * this way.
 */
@ExtendWith(MockitoExtension.class)
class ClubServiceImplTest {

    @Mock
    private ClubRepository clubRepository;

    @Mock
    private ClubMapper clubMapper;

    @Mock
    private KeycloakProvisioningService keycloakProvisioningService;

    private ClubServiceImpl clubService;

    @BeforeEach
    void setUp() {
        clubService = new ClubServiceImpl(clubRepository, clubMapper, keycloakProvisioningService);
    }

    private ClubDto dummyDto() {
        return new ClubDto(UUID.randomUUID(), "Name", "slug", ClubStatus.ACTIVE, Instant.now(), Instant.now(), null);
    }

    @Test
    void createDefaultsStatusToActiveRegardlessOfClubsOwnPrePersistOnboardingDefault() {
        CreateClubRequest request = new CreateClubRequest("Riverside CC", "riverside-cc");
        when(clubRepository.existsBySlugIgnoreCase("riverside-cc")).thenReturn(false);
        ArgumentCaptor<Club> captor = ArgumentCaptor.forClass(Club.class);
        when(clubRepository.save(captor.capture())).thenAnswer(invocation -> captor.getValue());
        when(clubMapper.toDto(any(Club.class))).thenReturn(dummyDto());

        clubService.create(request);

        assertThat(captor.getValue().getStatus()).isEqualTo(ClubStatus.ACTIVE);
        assertThat(captor.getValue().getName()).isEqualTo("Riverside CC");
        assertThat(captor.getValue().getSlug()).isEqualTo("riverside-cc");
    }

    @Test
    void createRegistersTheNewSlugForKeycloakRedirectAccess() {
        CreateClubRequest request = new CreateClubRequest("Riverside CC", "riverside-cc");
        when(clubRepository.existsBySlugIgnoreCase("riverside-cc")).thenReturn(false);
        when(clubRepository.save(any(Club.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(clubMapper.toDto(any(Club.class))).thenReturn(dummyDto());

        clubService.create(request);

        verify(keycloakProvisioningService).registerClubRedirectAccess("riverside-cc");
    }

    @Test
    void createStillReturns201WhenKeycloakRedirectRegistrationThrows() {
        CreateClubRequest request = new CreateClubRequest("Riverside CC", "riverside-cc");
        ClubDto dto = dummyDto();
        when(clubRepository.existsBySlugIgnoreCase("riverside-cc")).thenReturn(false);
        when(clubRepository.save(any(Club.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(clubMapper.toDto(any(Club.class))).thenReturn(dto);
        doThrow(new KeycloakProvisioningException("Keycloak unreachable", null))
                .when(keycloakProvisioningService)
                .registerClubRedirectAccess("riverside-cc");

        ClubDto result = clubService.create(request);

        assertThat(result).isEqualTo(dto);
    }

    @Test
    void updateOnASlugRenameRegistersTheNewSlugForKeycloakRedirectAccess() {
        UUID id = UUID.randomUUID();
        Club existing = existingClub(id, "Riverside CC", "riverside-cc", ClubStatus.ACTIVE);
        when(clubRepository.findById(id)).thenReturn(Optional.of(existing));
        when(clubRepository.existsBySlugIgnoreCaseAndIdNot("riverside-cricket-club", id)).thenReturn(false);
        when(clubRepository.save(existing)).thenReturn(existing);
        when(clubMapper.toDto(existing)).thenReturn(dummyDto());

        UpdateClubRequest request = new UpdateClubRequest("Riverside CC", "riverside-cricket-club");

        clubService.update(id, request);

        verify(keycloakProvisioningService).registerClubRedirectAccess("riverside-cricket-club");
    }

    @ParameterizedTest
    @ValueSource(strings = {"admin", "ADMIN", "Admin", "www", "WWW"})
    void createWithReservedSlugThrowsReservedSlugExceptionCaseInsensitively(String slug) {
        CreateClubRequest request = new CreateClubRequest("Some Club", slug);

        assertThatThrownBy(() -> clubService.create(request)).isInstanceOf(ReservedSlugException.class);
    }

    @Test
    void updateWithReservedSlugThrowsReservedSlugException() {
        UUID id = UUID.randomUUID();
        Club existing = existingClub(id, "Riverside CC", "riverside-cc", ClubStatus.ACTIVE);
        when(clubRepository.findById(id)).thenReturn(Optional.of(existing));

        UpdateClubRequest request = new UpdateClubRequest("Riverside CC", "www");

        assertThatThrownBy(() -> clubService.update(id, request)).isInstanceOf(ReservedSlugException.class);
    }

    @Test
    void createWithDuplicateSlugCaseInsensitiveThrowsDuplicateSlugException() {
        CreateClubRequest request = new CreateClubRequest("Riverside CC", "riverside-cc");
        when(clubRepository.existsBySlugIgnoreCase("riverside-cc")).thenReturn(true);

        assertThatThrownBy(() -> clubService.create(request)).isInstanceOf(DuplicateSlugException.class);
    }

    @Test
    void updateWithDuplicateSlugExcludingSelfThrowsDuplicateSlugException() {
        UUID id = UUID.randomUUID();
        Club existing = existingClub(id, "Old Name", "old-slug", ClubStatus.ACTIVE);
        when(clubRepository.findById(id)).thenReturn(Optional.of(existing));
        when(clubRepository.existsBySlugIgnoreCaseAndIdNot("taken-slug", id)).thenReturn(true);

        UpdateClubRequest request = new UpdateClubRequest("New Name", "taken-slug");

        assertThatThrownBy(() -> clubService.update(id, request)).isInstanceOf(DuplicateSlugException.class);
    }

    @Test
    void updateWithUnchangedOwnSlugDoesNotFalsePositiveAsDuplicate() {
        UUID id = UUID.randomUUID();
        Club existing = existingClub(id, "Riverside CC", "riverside-cc", ClubStatus.ACTIVE);
        when(clubRepository.findById(id)).thenReturn(Optional.of(existing));
        when(clubRepository.existsBySlugIgnoreCaseAndIdNot("riverside-cc", id)).thenReturn(false);
        when(clubRepository.save(existing)).thenReturn(existing);
        when(clubMapper.toDto(existing)).thenReturn(dummyDto());

        UpdateClubRequest request = new UpdateClubRequest("Riverside CC (renamed)", "riverside-cc");

        clubService.update(id, request);

        assertThat(existing.getName()).isEqualTo("Riverside CC (renamed)");
        assertThat(existing.getSlug()).isEqualTo("riverside-cc");
    }

    @Test
    void suspendOnActiveClubTransitionsToSuspended() {
        UUID id = UUID.randomUUID();
        Club existing = existingClub(id, "Riverside CC", "riverside-cc", ClubStatus.ACTIVE);
        when(clubRepository.findById(id)).thenReturn(Optional.of(existing));
        when(clubRepository.save(existing)).thenReturn(existing);
        when(clubMapper.toDto(existing)).thenReturn(dummyDto());

        clubService.suspend(id);

        assertThat(existing.getStatus()).isEqualTo(ClubStatus.SUSPENDED);
    }

    @Test
    void reactivateOnSuspendedClubTransitionsToActive() {
        UUID id = UUID.randomUUID();
        Club existing = existingClub(id, "Riverside CC", "riverside-cc", ClubStatus.SUSPENDED);
        when(clubRepository.findById(id)).thenReturn(Optional.of(existing));
        when(clubRepository.save(existing)).thenReturn(existing);
        when(clubMapper.toDto(existing)).thenReturn(dummyDto());

        clubService.reactivate(id);

        assertThat(existing.getStatus()).isEqualTo(ClubStatus.ACTIVE);
    }

    @Test
    void suspendOnAlreadySuspendedClubThrowsInvalidStatusTransitionException() {
        UUID id = UUID.randomUUID();
        Club existing = existingClub(id, "Riverside CC", "riverside-cc", ClubStatus.SUSPENDED);
        when(clubRepository.findById(id)).thenReturn(Optional.of(existing));

        assertThatThrownBy(() -> clubService.suspend(id)).isInstanceOf(InvalidStatusTransitionException.class);
    }

    @Test
    void reactivateOnAlreadyActiveClubThrowsInvalidStatusTransitionException() {
        UUID id = UUID.randomUUID();
        Club existing = existingClub(id, "Riverside CC", "riverside-cc", ClubStatus.ACTIVE);
        when(clubRepository.findById(id)).thenReturn(Optional.of(existing));

        assertThatThrownBy(() -> clubService.reactivate(id)).isInstanceOf(InvalidStatusTransitionException.class);
    }

    @Test
    void listWithNoCallerSortDefaultsToNameAscending() {
        Pageable requested = PageRequest.of(0, 20);
        Pageable expectedEffective = PageRequest.of(0, 20, Sort.by("name").ascending());
        when(clubRepository.search(null, expectedEffective)).thenReturn(new PageImpl<>(List.of(new Club())));
        when(clubMapper.toDto(any(Club.class))).thenReturn(dummyDto());

        Page<ClubDto> result = clubService.list(null, requested);

        assertThat(result.getContent()).hasSize(1);
    }

    @Test
    void listPreservesCallerSuppliedSort() {
        Pageable requested = PageRequest.of(0, 20, Sort.by("createdAt").descending());
        when(clubRepository.search(null, requested)).thenReturn(new PageImpl<>(List.of(new Club())));
        when(clubMapper.toDto(any(Club.class))).thenReturn(dummyDto());

        Page<ClubDto> result = clubService.list(null, requested);

        assertThat(result.getContent()).hasSize(1);
    }

    private Club existingClub(UUID id, String name, String slug, ClubStatus status) {
        Club club = new Club();
        club.setId(id);
        club.setName(name);
        club.setSlug(slug);
        club.setStatus(status);
        return club;
    }
}
