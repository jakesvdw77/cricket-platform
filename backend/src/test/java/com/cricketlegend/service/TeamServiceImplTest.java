package com.cricketlegend.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.cricketlegend.config.AccessService;
import com.cricketlegend.domain.Section;
import com.cricketlegend.domain.SocialLink;
import com.cricketlegend.domain.Team;
import com.cricketlegend.dto.CreateTeamRequest;
import com.cricketlegend.dto.SocialLinkDto;
import com.cricketlegend.dto.TeamDto;
import com.cricketlegend.dto.UpdateTeamRequest;
import com.cricketlegend.exception.InvalidStatusTransitionException;
import com.cricketlegend.exception.NotFoundException;
import com.cricketlegend.exception.ValidationException;
import com.cricketlegend.mapper.TeamMapper;
import com.cricketlegend.repository.SectionRepository;
import com.cricketlegend.repository.TeamRepository;
import com.cricketlegend.service.impl.TeamServiceImpl;
import java.util.List;
import java.util.Optional;
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
 * Unit tests for TeamServiceImpl's business rules from docs/specs/026-teams.md: create/update,
 * the plain one-way-transition-guard shape for deactivate/reactivate (mirrors {@code
 * ClubContactServiceImpl}, no hard-delete branch), the two-level {@code
 * findSectionOrThrowForClub}/{@code findTeamOrThrowForSection} cross-club/cross-section {@link
 * NotFoundException} isolation, and {@code listBySection}/{@code listByClub}. Also covers
 * docs/specs/057-team-extended-profile.md's {@code abbreviation}/{@code groundName}/{@code
 * socialLinks} profile fields on {@code create}/{@code update}, including the shared
 * duplicate-social-link-platform rejection (mirrors {@code LeagueServiceImplTest}'s identical
 * {@code 053} case).
 */
@ExtendWith(MockitoExtension.class)
class TeamServiceImplTest {

    @Mock
    private TeamRepository teamRepository;

    @Mock
    private SectionRepository sectionRepository;

    @Mock
    private TeamMapper teamMapper;

    @Mock
    private AccessService accessService;

    private TeamServiceImpl teamService;
    private final Authentication authentication = new TestingAuthenticationToken(
            "club-admin-subject", null, List.of(new SimpleGrantedAuthority("ROLE_someone_else")));

    @BeforeEach
    void setUp() {
        teamService = new TeamServiceImpl(teamRepository, sectionRepository, teamMapper, accessService);
    }

    private Section section(UUID id, UUID clubId) {
        Section section = new Section();
        section.setId(id);
        section.setClubId(clubId);
        section.setName("Men");
        section.setActive(true);
        return section;
    }

    private Team team(UUID id, UUID sectionId, boolean active) {
        Team team = new Team();
        team.setId(id);
        team.setSectionId(sectionId);
        team.setActive(active);
        team.setName("1st XI");
        return team;
    }

    private TeamDto dummyDto() {
        return new TeamDto(
                UUID.randomUUID(), UUID.randomUUID(), UUID.randomUUID(), "1st XI", null, null, null,
                List.of(), true, null, null, null);
    }

    // --- create ---

    @Test
    void createUnderASectionBelongingToTheClubSucceeds() {
        UUID clubId = UUID.randomUUID();
        UUID sectionId = UUID.randomUUID();
        when(sectionRepository.findById(sectionId)).thenReturn(Optional.of(section(sectionId, clubId)));
        CreateTeamRequest request = new CreateTeamRequest("1st XI", null, null, null, null);
        Team mapped = new Team();
        when(teamMapper.toEntity(request)).thenReturn(mapped);
        when(teamRepository.save(mapped)).thenReturn(mapped);
        when(teamMapper.toDto(mapped)).thenReturn(dummyDto());

        teamService.create(clubId, sectionId, request);

        assertThat(mapped.getClubId()).isEqualTo(clubId);
        assertThat(mapped.getSectionId()).isEqualTo(sectionId);
        assertThat(mapped.isActive()).isTrue();
    }

    @Test
    void createUnderASectionBelongingToADifferentClubThrowsNotFoundException() {
        UUID clubId = UUID.randomUUID();
        UUID otherClubId = UUID.randomUUID();
        UUID sectionId = UUID.randomUUID();
        when(sectionRepository.findById(sectionId)).thenReturn(Optional.of(section(sectionId, otherClubId)));

        CreateTeamRequest request = new CreateTeamRequest("1st XI", null, null, null, null);

        assertThatThrownBy(() -> teamService.create(clubId, sectionId, request))
                .isInstanceOf(NotFoundException.class);
        verify(teamRepository, never()).save(ArgumentMatchers.any());
    }

    @Test
    void createUnderANonexistentSectionThrowsNotFoundException() {
        UUID clubId = UUID.randomUUID();
        UUID sectionId = UUID.randomUUID();
        when(sectionRepository.findById(sectionId)).thenReturn(Optional.empty());

        CreateTeamRequest request = new CreateTeamRequest("1st XI", null, null, null, null);

        assertThatThrownBy(() -> teamService.create(clubId, sectionId, request))
                .isInstanceOf(NotFoundException.class);
        verify(teamRepository, never()).save(ArgumentMatchers.any());
    }

    @Test
    void createWithALogoUrlSetsItOnTheEntity() {
        UUID clubId = UUID.randomUUID();
        UUID sectionId = UUID.randomUUID();
        when(sectionRepository.findById(sectionId)).thenReturn(Optional.of(section(sectionId, clubId)));
        CreateTeamRequest request = new CreateTeamRequest("1st XI", "https://example.com/logo.png", null, null, null);
        Team mapped = new Team();
        when(teamMapper.toEntity(request)).thenReturn(mapped);
        when(teamRepository.save(mapped)).thenReturn(mapped);
        when(teamMapper.toDto(mapped)).thenReturn(dummyDto());

        teamService.create(clubId, sectionId, request);

        assertThat(mapped.getLogoUrl()).isEqualTo("https://example.com/logo.png");
    }

    // --- 057: abbreviation/groundName/socialLinks profile fields ---

    @Test
    void createPersistsTheThreeNewProfileFieldsIncludingSocialLinks() {
        UUID clubId = UUID.randomUUID();
        UUID sectionId = UUID.randomUUID();
        when(sectionRepository.findById(sectionId)).thenReturn(Optional.of(section(sectionId, clubId)));
        SocialLinkDto linkDto = new SocialLinkDto("facebook", "https://facebook.com/1st-xi");
        SocialLink mappedLink =
                SocialLink.builder().platform("facebook").url("https://facebook.com/1st-xi").build();
        CreateTeamRequest request =
                new CreateTeamRequest("1st XI", null, "ICL", "Irene Country Club", List.of(linkDto));
        Team mapped = new Team();
        when(teamMapper.toEntity(request)).thenReturn(mapped);
        when(teamMapper.toEntity(linkDto)).thenReturn(mappedLink);
        when(teamRepository.save(mapped)).thenReturn(mapped);
        when(teamMapper.toDto(mapped)).thenReturn(dummyDto());

        teamService.create(clubId, sectionId, request);

        assertThat(mapped.getAbbreviation()).isEqualTo("ICL");
        assertThat(mapped.getGroundName()).isEqualTo("Irene Country Club");
        assertThat(mapped.getSocialLinks()).containsExactly(mappedLink);
    }

    @Test
    void createWithADuplicateSocialLinkPlatformThrowsValidationExceptionAndNeverSaves() {
        UUID clubId = UUID.randomUUID();
        UUID sectionId = UUID.randomUUID();
        CreateTeamRequest request = new CreateTeamRequest(
                "1st XI",
                null,
                null,
                null,
                List.of(
                        new SocialLinkDto("facebook", "https://facebook.com/a"),
                        new SocialLinkDto("facebook", "https://facebook.com/b")));

        assertThatThrownBy(() -> teamService.create(clubId, sectionId, request))
                .isInstanceOf(ValidationException.class);

        verify(sectionRepository, never()).findById(ArgumentMatchers.any());
        verify(teamRepository, never()).save(ArgumentMatchers.any());
    }

    // --- update ---

    @Test
    void updateAppliesTheNewNameOntoTheExistingEntity() {
        UUID clubId = UUID.randomUUID();
        UUID sectionId = UUID.randomUUID();
        UUID teamId = UUID.randomUUID();
        when(sectionRepository.findById(sectionId)).thenReturn(Optional.of(section(sectionId, clubId)));
        Team existing = team(teamId, sectionId, true);
        when(teamRepository.findById(teamId)).thenReturn(Optional.of(existing));
        when(teamRepository.save(existing)).thenReturn(existing);
        when(teamMapper.toDto(existing)).thenReturn(dummyDto());

        teamService.update(clubId, sectionId, teamId, new UpdateTeamRequest("2nd XI", null, null, null, null));

        assertThat(existing.getName()).isEqualTo("2nd XI");
    }

    @Test
    void updateSetsANewLogoUrlOverride() {
        UUID clubId = UUID.randomUUID();
        UUID sectionId = UUID.randomUUID();
        UUID teamId = UUID.randomUUID();
        when(sectionRepository.findById(sectionId)).thenReturn(Optional.of(section(sectionId, clubId)));
        Team existing = team(teamId, sectionId, true);
        when(teamRepository.findById(teamId)).thenReturn(Optional.of(existing));
        when(teamRepository.save(existing)).thenReturn(existing);
        when(teamMapper.toDto(existing)).thenReturn(dummyDto());

        teamService.update(clubId, sectionId, teamId, new UpdateTeamRequest("1st XI", "https://example.com/logo.png", null, null, null));

        assertThat(existing.getLogoUrl()).isEqualTo("https://example.com/logo.png");
    }

    @Test
    void updateWithANullLogoUrlClearsAnExistingOverride() {
        UUID clubId = UUID.randomUUID();
        UUID sectionId = UUID.randomUUID();
        UUID teamId = UUID.randomUUID();
        when(sectionRepository.findById(sectionId)).thenReturn(Optional.of(section(sectionId, clubId)));
        Team existing = team(teamId, sectionId, true);
        existing.setLogoUrl("https://example.com/old-logo.png");
        when(teamRepository.findById(teamId)).thenReturn(Optional.of(existing));
        when(teamRepository.save(existing)).thenReturn(existing);
        when(teamMapper.toDto(existing)).thenReturn(dummyDto());

        teamService.update(clubId, sectionId, teamId, new UpdateTeamRequest("1st XI", null, null, null, null));

        assertThat(existing.getLogoUrl()).isNull();
    }

    @Test
    void updatePersistsTheThreeNewProfileFieldsIncludingSocialLinks() {
        UUID clubId = UUID.randomUUID();
        UUID sectionId = UUID.randomUUID();
        UUID teamId = UUID.randomUUID();
        when(sectionRepository.findById(sectionId)).thenReturn(Optional.of(section(sectionId, clubId)));
        Team existing = team(teamId, sectionId, true);
        when(teamRepository.findById(teamId)).thenReturn(Optional.of(existing));
        when(teamRepository.save(existing)).thenReturn(existing);
        when(teamMapper.toDto(existing)).thenReturn(dummyDto());
        SocialLinkDto linkDto = new SocialLinkDto("instagram", "https://instagram.com/1st-xi");
        SocialLink mappedLink =
                SocialLink.builder().platform("instagram").url("https://instagram.com/1st-xi").build();
        when(teamMapper.toEntity(linkDto)).thenReturn(mappedLink);

        teamService.update(
                clubId,
                sectionId,
                teamId,
                new UpdateTeamRequest("1st XI", null, "ICL", "Irene Country Club", List.of(linkDto)));

        assertThat(existing.getAbbreviation()).isEqualTo("ICL");
        assertThat(existing.getGroundName()).isEqualTo("Irene Country Club");
        assertThat(existing.getSocialLinks()).containsExactly(mappedLink);
    }

    @Test
    void updateWithADuplicateSocialLinkPlatformThrowsValidationExceptionAndNeverSaves() {
        UUID clubId = UUID.randomUUID();
        UUID sectionId = UUID.randomUUID();
        UUID teamId = UUID.randomUUID();
        UpdateTeamRequest request = new UpdateTeamRequest(
                "1st XI",
                null,
                null,
                null,
                List.of(
                        new SocialLinkDto("facebook", "https://facebook.com/a"),
                        new SocialLinkDto("facebook", "https://facebook.com/b")));

        assertThatThrownBy(() -> teamService.update(clubId, sectionId, teamId, request))
                .isInstanceOf(ValidationException.class);

        verify(sectionRepository, never()).findById(ArgumentMatchers.any());
        verify(teamRepository, never()).save(ArgumentMatchers.any());
    }

    @Test
    void updateWithAllThreeNewProfileFieldsOmittedRoundTripsAsNullAndEmpty() {
        UUID clubId = UUID.randomUUID();
        UUID sectionId = UUID.randomUUID();
        UUID teamId = UUID.randomUUID();
        when(sectionRepository.findById(sectionId)).thenReturn(Optional.of(section(sectionId, clubId)));
        Team existing = team(teamId, sectionId, true);
        existing.setAbbreviation("OLD");
        existing.setGroundName("Old Ground");
        existing.setSocialLinks(new java.util.ArrayList<>(
                List.of(SocialLink.builder().platform("facebook").url("https://facebook.com/old").build())));
        when(teamRepository.findById(teamId)).thenReturn(Optional.of(existing));
        when(teamRepository.save(existing)).thenReturn(existing);
        when(teamMapper.toDto(existing)).thenReturn(dummyDto());

        teamService.update(clubId, sectionId, teamId, new UpdateTeamRequest("1st XI", null, null, null, null));

        assertThat(existing.getAbbreviation()).isNull();
        assertThat(existing.getGroundName()).isNull();
        assertThat(existing.getSocialLinks()).isEmpty();
    }

    @Test
    void updateOnASectionBelongingToADifferentClubThrowsNotFoundExceptionWithoutLoadingTheTeam() {
        UUID clubId = UUID.randomUUID();
        UUID otherClubId = UUID.randomUUID();
        UUID sectionId = UUID.randomUUID();
        UUID teamId = UUID.randomUUID();
        when(sectionRepository.findById(sectionId)).thenReturn(Optional.of(section(sectionId, otherClubId)));

        assertThatThrownBy(
                        () -> teamService.update(clubId, sectionId, teamId, new UpdateTeamRequest("2nd XI", null, null, null, null)))
                .isInstanceOf(NotFoundException.class);
        verify(teamRepository, never()).findById(ArgumentMatchers.any());
    }

    @Test
    void updateOnATeamBelongingToADifferentSectionThrowsNotFoundException() {
        UUID clubId = UUID.randomUUID();
        UUID sectionId = UUID.randomUUID();
        UUID otherSectionId = UUID.randomUUID();
        UUID teamId = UUID.randomUUID();
        when(sectionRepository.findById(sectionId)).thenReturn(Optional.of(section(sectionId, clubId)));
        when(teamRepository.findById(teamId)).thenReturn(Optional.of(team(teamId, otherSectionId, true)));

        assertThatThrownBy(
                        () -> teamService.update(clubId, sectionId, teamId, new UpdateTeamRequest("2nd XI", null, null, null, null)))
                .isInstanceOf(NotFoundException.class);
        verify(teamRepository, never()).save(ArgumentMatchers.any());
    }

    // --- deactivate/reactivate: plain one-way-transition-guard shape, no hard-delete branch ---

    @Test
    void deactivateOnAnActiveTeamTransitionsToInactive() {
        UUID clubId = UUID.randomUUID();
        UUID sectionId = UUID.randomUUID();
        UUID teamId = UUID.randomUUID();
        when(sectionRepository.findById(sectionId)).thenReturn(Optional.of(section(sectionId, clubId)));
        Team existing = team(teamId, sectionId, true);
        when(teamRepository.findById(teamId)).thenReturn(Optional.of(existing));
        when(teamRepository.save(existing)).thenReturn(existing);
        when(teamMapper.toDto(existing)).thenReturn(dummyDto());

        teamService.deactivate(clubId, sectionId, teamId);

        assertThat(existing.isActive()).isFalse();
        verify(teamRepository, never()).delete(ArgumentMatchers.any());
    }

    @Test
    void deactivateOnAlreadyInactiveTeamThrowsInvalidStatusTransitionException() {
        UUID clubId = UUID.randomUUID();
        UUID sectionId = UUID.randomUUID();
        UUID teamId = UUID.randomUUID();
        when(sectionRepository.findById(sectionId)).thenReturn(Optional.of(section(sectionId, clubId)));
        when(teamRepository.findById(teamId)).thenReturn(Optional.of(team(teamId, sectionId, false)));

        assertThatThrownBy(() -> teamService.deactivate(clubId, sectionId, teamId))
                .isInstanceOf(InvalidStatusTransitionException.class)
                .hasMessageContaining("already inactive");
        verify(teamRepository, never()).save(ArgumentMatchers.any());
    }

    @Test
    void reactivateOnAnInactiveTeamTransitionsToActive() {
        UUID clubId = UUID.randomUUID();
        UUID sectionId = UUID.randomUUID();
        UUID teamId = UUID.randomUUID();
        when(sectionRepository.findById(sectionId)).thenReturn(Optional.of(section(sectionId, clubId)));
        Team existing = team(teamId, sectionId, false);
        when(teamRepository.findById(teamId)).thenReturn(Optional.of(existing));
        when(teamRepository.save(existing)).thenReturn(existing);
        when(teamMapper.toDto(existing)).thenReturn(dummyDto());

        teamService.reactivate(clubId, sectionId, teamId);

        assertThat(existing.isActive()).isTrue();
    }

    @Test
    void reactivateOnAlreadyActiveTeamThrowsInvalidStatusTransitionException() {
        UUID clubId = UUID.randomUUID();
        UUID sectionId = UUID.randomUUID();
        UUID teamId = UUID.randomUUID();
        when(sectionRepository.findById(sectionId)).thenReturn(Optional.of(section(sectionId, clubId)));
        when(teamRepository.findById(teamId)).thenReturn(Optional.of(team(teamId, sectionId, true)));

        assertThatThrownBy(() -> teamService.reactivate(clubId, sectionId, teamId))
                .isInstanceOf(InvalidStatusTransitionException.class)
                .hasMessageContaining("already active");
        verify(teamRepository, never()).save(ArgumentMatchers.any());
    }

    @Test
    void deactivateOnATeamBelongingToADifferentSectionThrowsNotFoundException() {
        UUID clubId = UUID.randomUUID();
        UUID sectionId = UUID.randomUUID();
        UUID otherSectionId = UUID.randomUUID();
        UUID teamId = UUID.randomUUID();
        when(sectionRepository.findById(sectionId)).thenReturn(Optional.of(section(sectionId, clubId)));
        when(teamRepository.findById(teamId)).thenReturn(Optional.of(team(teamId, otherSectionId, true)));

        assertThatThrownBy(() -> teamService.deactivate(clubId, sectionId, teamId))
                .isInstanceOf(NotFoundException.class);
    }

    // --- list ---

    @Test
    void listBySectionMapsEveryTeamUnderTheSectionAndValidatesSectionOwnership() {
        UUID clubId = UUID.randomUUID();
        UUID sectionId = UUID.randomUUID();
        when(sectionRepository.findById(sectionId)).thenReturn(Optional.of(section(sectionId, clubId)));
        Team a = team(UUID.randomUUID(), sectionId, true);
        Team b = team(UUID.randomUUID(), sectionId, false);
        when(teamRepository.findByClubIdAndSectionId(clubId, sectionId)).thenReturn(List.of(a, b));
        when(teamMapper.toDto(a)).thenReturn(dummyDto());
        when(teamMapper.toDto(b)).thenReturn(dummyDto());

        List<TeamDto> result = teamService.listBySection(clubId, sectionId);

        assertThat(result).hasSize(2);
    }

    @Test
    void listBySectionOnASectionBelongingToADifferentClubThrowsNotFoundException() {
        UUID clubId = UUID.randomUUID();
        UUID otherClubId = UUID.randomUUID();
        UUID sectionId = UUID.randomUUID();
        when(sectionRepository.findById(sectionId)).thenReturn(Optional.of(section(sectionId, otherClubId)));

        assertThatThrownBy(() -> teamService.listBySection(clubId, sectionId))
                .isInstanceOf(NotFoundException.class);
        verify(teamRepository, never()).findByClubIdAndSectionId(ArgumentMatchers.any(), ArgumentMatchers.any());
    }

    @Test
    void listByClubMapsEveryTeamAcrossMultipleSectionsWithoutAnySectionCheck() {
        UUID clubId = UUID.randomUUID();
        UUID sectionOneId = UUID.randomUUID();
        UUID sectionTwoId = UUID.randomUUID();
        Team a = team(UUID.randomUUID(), sectionOneId, true);
        Team b = team(UUID.randomUUID(), sectionTwoId, true);
        when(teamRepository.findByClubId(clubId)).thenReturn(List.of(a, b));
        when(teamMapper.toDto(a)).thenReturn(dummyDto());
        when(teamMapper.toDto(b)).thenReturn(dummyDto());
        when(accessService.accessibleSectionIds(authentication, clubId)).thenReturn(Optional.empty());

        List<TeamDto> result = teamService.listByClub(authentication, clubId, null);

        assertThat(result).hasSize(2);
        verify(sectionRepository, never()).findById(ArgumentMatchers.any());
    }

    @Test
    void listByClubExcludesATeamWhoseSectionIsOutsideTheCallersAccessibleSections() {
        UUID clubId = UUID.randomUUID();
        UUID accessibleSectionId = UUID.randomUUID();
        UUID otherSectionId = UUID.randomUUID();
        Team accessibleTeam = team(UUID.randomUUID(), accessibleSectionId, true);
        Team outOfReachTeam = team(UUID.randomUUID(), otherSectionId, true);
        when(teamRepository.findByClubId(clubId)).thenReturn(List.of(accessibleTeam, outOfReachTeam));
        when(teamMapper.toDto(accessibleTeam)).thenReturn(dummyDto());
        when(accessService.accessibleSectionIds(authentication, clubId))
                .thenReturn(Optional.of(java.util.Set.of(accessibleSectionId)));

        List<TeamDto> result = teamService.listByClub(authentication, clubId, null);

        assertThat(result).hasSize(1);
        verify(teamMapper, never()).toDto(outOfReachTeam);
    }
}
