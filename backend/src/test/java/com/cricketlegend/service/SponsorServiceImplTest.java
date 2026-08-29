package com.cricketlegend.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.cricketlegend.domain.SocialLink;
import com.cricketlegend.domain.Sponsor;
import com.cricketlegend.dto.CreateSponsorRequest;
import com.cricketlegend.dto.SocialLinkDto;
import com.cricketlegend.dto.SponsorDto;
import com.cricketlegend.dto.UpdateSponsorRequest;
import com.cricketlegend.exception.InvalidStatusTransitionException;
import com.cricketlegend.exception.NotFoundException;
import com.cricketlegend.exception.ValidationException;
import com.cricketlegend.mapper.SponsorMapper;
import com.cricketlegend.repository.ClubRepository;
import com.cricketlegend.repository.SponsorRepository;
import com.cricketlegend.service.impl.SponsorServiceImpl;
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
 * Unit tests for SponsorServiceImpl's business rules from docs/specs/023-sponsors.md:
 * create/update apply the request onto the entity (including {@code socialLinks} round-tripping),
 * a duplicate {@code platform} within a request's {@code socialLinks} is rejected before any DB
 * write, deactivate/reactivate's one-way transition guard, findOrThrowForClub's cross-club
 * isolation, and requireClubExists's guard against operating on a non-existent club. Mirrors
 * ClubContactServiceImplTest's shape. Sponsor has no primary-flag concept (unlike ClubContact), so
 * there is no primary-related test here. Per docs/standards/backend.md, every @Service method
 * carrying a business rule ships a unit test in the same change.
 */
@ExtendWith(MockitoExtension.class)
class SponsorServiceImplTest {

    @Mock
    private ClubRepository clubRepository;

    @Mock
    private SponsorRepository sponsorRepository;

    @Mock
    private SponsorMapper sponsorMapper;

    private SponsorServiceImpl sponsorService;

    @BeforeEach
    void setUp() {
        sponsorService = new SponsorServiceImpl(clubRepository, sponsorRepository, sponsorMapper);
    }

    private SponsorDto dummyDto() {
        return new SponsorDto(
                UUID.randomUUID(),
                UUID.randomUUID(),
                "Acme Sponsor",
                null,
                null,
                null,
                null,
                null,
                List.of(),
                true,
                null,
                null,
                null);
    }

    private Sponsor existingSponsor(UUID id, UUID clubId, boolean active) {
        Sponsor sponsor = new Sponsor();
        sponsor.setId(id);
        sponsor.setClubId(clubId);
        sponsor.setActive(active);
        sponsor.setName("Acme Sponsor");
        return sponsor;
    }

    @Test
    void listReturnsEverySponsorForTheClubMappedToADto() {
        UUID clubId = UUID.randomUUID();
        Sponsor sponsor = existingSponsor(UUID.randomUUID(), clubId, true);
        SponsorDto mapped = dummyDto();
        when(clubRepository.existsById(clubId)).thenReturn(true);
        when(sponsorRepository.findByClubId(clubId)).thenReturn(List.of(sponsor));
        when(sponsorMapper.toDto(sponsor)).thenReturn(mapped);

        List<SponsorDto> result = sponsorService.list(clubId);

        assertThat(result).containsExactly(mapped);
    }

    @Test
    void createSavesTheMappedEntityScopedToTheClubAndActiveByDefaultWithSocialLinksIntact() {
        UUID clubId = UUID.randomUUID();
        List<SocialLinkDto> socialLinkDtos =
                List.of(new SocialLinkDto("facebook", "https://facebook.com/acme"));
        CreateSponsorRequest request =
                new CreateSponsorRequest(
                        "Acme Sponsor", "https://acme.example", "acme@example.com", "0123456789", null, null,
                        socialLinkDtos);
        // Simulates what MapStruct's real toEntity(CreateSponsorRequest) produces: an entity with
        // socialLinks already mapped across (SponsorMapper's own list-mapping is proven separately
        // by SponsorRepositoryTest/SponsorControllerIntegrationTest, not re-derived here).
        Sponsor mapped = new Sponsor();
        mapped.setSocialLinks(List.of(SocialLink.builder().platform("facebook").url("https://facebook.com/acme").build()));
        when(clubRepository.existsById(clubId)).thenReturn(true);
        when(sponsorMapper.toEntity(request)).thenReturn(mapped);
        ArgumentCaptor<Sponsor> captor = ArgumentCaptor.forClass(Sponsor.class);
        when(sponsorRepository.save(captor.capture())).thenAnswer(invocation -> captor.getValue());
        when(sponsorMapper.toDto(any(Sponsor.class))).thenReturn(dummyDto());

        sponsorService.create(clubId, request);

        Sponsor saved = captor.getValue();
        assertThat(saved.getClubId()).isEqualTo(clubId);
        assertThat(saved.isActive()).isTrue();
        assertThat(saved.getSocialLinks())
                .extracting(SocialLink::getPlatform, SocialLink::getUrl)
                .containsExactly(org.assertj.core.api.Assertions.tuple("facebook", "https://facebook.com/acme"));
    }

    @Test
    void createWithADuplicatePlatformInSocialLinksThrowsValidationExceptionAndNeverSaves() {
        UUID clubId = UUID.randomUUID();
        CreateSponsorRequest request =
                new CreateSponsorRequest(
                        "Acme Sponsor", null, null, null, null, null,
                        List.of(
                                new SocialLinkDto("facebook", "https://facebook.com/a"),
                                new SocialLinkDto("facebook", "https://facebook.com/b")));
        when(clubRepository.existsById(clubId)).thenReturn(true);

        assertThatThrownBy(() -> sponsorService.create(clubId, request)).isInstanceOf(ValidationException.class);

        verify(sponsorRepository, never()).save(any());
    }

    @Test
    void updateAppliesRequestFieldsOntoTheExistingEntityWithSocialLinksRoundTripping() {
        UUID clubId = UUID.randomUUID();
        UUID sponsorId = UUID.randomUUID();
        Sponsor existing = existingSponsor(sponsorId, clubId, true);
        when(clubRepository.existsById(clubId)).thenReturn(true);
        when(sponsorRepository.findById(sponsorId)).thenReturn(Optional.of(existing));
        when(sponsorRepository.save(existing)).thenReturn(existing);
        when(sponsorMapper.toDto(existing)).thenReturn(dummyDto());
        SocialLinkDto linkDto = new SocialLinkDto("instagram", "https://instagram.com/acme");
        SocialLink mappedLink = SocialLink.builder().platform("instagram").url("https://instagram.com/acme").build();
        when(sponsorMapper.toEntity(linkDto)).thenReturn(mappedLink);

        UpdateSponsorRequest request = new UpdateSponsorRequest(
                "Acme Sponsor Renamed",
                "https://acme.example",
                "acme@example.com",
                "0123456789",
                "/media/logo.png",
                "/media/banner.png",
                List.of(linkDto));

        sponsorService.update(clubId, sponsorId, request);

        assertThat(existing.getName()).isEqualTo("Acme Sponsor Renamed");
        assertThat(existing.getWebsite()).isEqualTo("https://acme.example");
        assertThat(existing.getEmail()).isEqualTo("acme@example.com");
        assertThat(existing.getPhone()).isEqualTo("0123456789");
        assertThat(existing.getLogoUrl()).isEqualTo("/media/logo.png");
        assertThat(existing.getBannerUrl()).isEqualTo("/media/banner.png");
        assertThat(existing.getSocialLinks()).containsExactly(mappedLink);
    }

    @Test
    void deactivateOnActiveSponsorTransitionsToInactive() {
        UUID clubId = UUID.randomUUID();
        UUID sponsorId = UUID.randomUUID();
        Sponsor existing = existingSponsor(sponsorId, clubId, true);
        when(clubRepository.existsById(clubId)).thenReturn(true);
        when(sponsorRepository.findById(sponsorId)).thenReturn(Optional.of(existing));
        when(sponsorRepository.save(existing)).thenReturn(existing);
        when(sponsorMapper.toDto(existing)).thenReturn(dummyDto());

        sponsorService.deactivate(clubId, sponsorId);

        assertThat(existing.isActive()).isFalse();
    }

    @Test
    void deactivateOnAlreadyInactiveSponsorThrowsInvalidStatusTransitionException() {
        UUID clubId = UUID.randomUUID();
        UUID sponsorId = UUID.randomUUID();
        Sponsor existing = existingSponsor(sponsorId, clubId, false);
        when(clubRepository.existsById(clubId)).thenReturn(true);
        when(sponsorRepository.findById(sponsorId)).thenReturn(Optional.of(existing));

        assertThatThrownBy(() -> sponsorService.deactivate(clubId, sponsorId))
                .isInstanceOf(InvalidStatusTransitionException.class);
    }

    @Test
    void reactivateOnInactiveSponsorTransitionsToActive() {
        UUID clubId = UUID.randomUUID();
        UUID sponsorId = UUID.randomUUID();
        Sponsor existing = existingSponsor(sponsorId, clubId, false);
        when(clubRepository.existsById(clubId)).thenReturn(true);
        when(sponsorRepository.findById(sponsorId)).thenReturn(Optional.of(existing));
        when(sponsorRepository.save(existing)).thenReturn(existing);
        when(sponsorMapper.toDto(existing)).thenReturn(dummyDto());

        sponsorService.reactivate(clubId, sponsorId);

        assertThat(existing.isActive()).isTrue();
    }

    @Test
    void reactivateOnAlreadyActiveSponsorThrowsInvalidStatusTransitionException() {
        UUID clubId = UUID.randomUUID();
        UUID sponsorId = UUID.randomUUID();
        Sponsor existing = existingSponsor(sponsorId, clubId, true);
        when(clubRepository.existsById(clubId)).thenReturn(true);
        when(sponsorRepository.findById(sponsorId)).thenReturn(Optional.of(existing));

        assertThatThrownBy(() -> sponsorService.reactivate(clubId, sponsorId))
                .isInstanceOf(InvalidStatusTransitionException.class);
    }

    @Test
    void updateOnASponsorBelongingToADifferentClubThrowsNotFoundException() {
        UUID clubId = UUID.randomUUID();
        UUID otherClubId = UUID.randomUUID();
        UUID sponsorId = UUID.randomUUID();
        Sponsor existing = existingSponsor(sponsorId, otherClubId, true);
        when(clubRepository.existsById(clubId)).thenReturn(true);
        when(sponsorRepository.findById(sponsorId)).thenReturn(Optional.of(existing));

        UpdateSponsorRequest request =
                new UpdateSponsorRequest("Acme Sponsor", null, null, null, null, null, null);

        assertThatThrownBy(() -> sponsorService.update(clubId, sponsorId, request))
                .isInstanceOf(NotFoundException.class);
    }

    @Test
    void deactivateOnANonexistentSponsorThrowsNotFoundException() {
        UUID clubId = UUID.randomUUID();
        UUID sponsorId = UUID.randomUUID();
        when(clubRepository.existsById(clubId)).thenReturn(true);
        when(sponsorRepository.findById(sponsorId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> sponsorService.deactivate(clubId, sponsorId))
                .isInstanceOf(NotFoundException.class);
    }

    @Test
    void operatingOnANonexistentClubThrowsNotFoundExceptionBeforeAnySponsorRepositoryInteraction() {
        UUID clubId = UUID.randomUUID();
        when(clubRepository.existsById(clubId)).thenReturn(false);

        assertThatThrownBy(() -> sponsorService.list(clubId)).isInstanceOf(NotFoundException.class);

        verifyNoInteractions(sponsorRepository);
    }
}
