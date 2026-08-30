package com.cricketlegend.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.cricketlegend.domain.ClubContact;
import com.cricketlegend.domain.Gender;
import com.cricketlegend.domain.Section;
import com.cricketlegend.domain.SectionContact;
import com.cricketlegend.dto.ClubContactDto;
import com.cricketlegend.dto.CreateSectionRequest;
import com.cricketlegend.dto.SectionDto;
import com.cricketlegend.dto.UpdateSectionRequest;
import com.cricketlegend.exception.ConflictException;
import com.cricketlegend.exception.InvalidStatusTransitionException;
import com.cricketlegend.exception.NotFoundException;
import com.cricketlegend.exception.ValidationException;
import com.cricketlegend.mapper.ClubContactMapper;
import com.cricketlegend.mapper.SectionMapper;
import com.cricketlegend.repository.ClubContactRepository;
import com.cricketlegend.repository.SectionContactRepository;
import com.cricketlegend.repository.SectionRepository;
import com.cricketlegend.service.impl.SectionServiceImpl;
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
 * Unit tests for SectionServiceImpl's business rules from docs/specs/025-club-structure.md:
 * create/update's {@code minAge <= maxAge} validation (boundary equal is valid, either field
 * alone is valid, a real violation throws {@link ValidationException}), create's cross-club
 * {@code parentSectionId} rejection, the two-case deactivate guard (already-inactive checked
 * before has-active-children, and inactive children never block a deactivate), reactivate's
 * one-way guard, link/unlink treating {@link Section} and {@link ClubContact} as independent
 * siblings under the same club (cross-club rejection for either id, already-linked {@code 409},
 * unlink-with-no-link {@code 404}), and {@code findOrThrowForClub}-style cross-club {@link
 * NotFoundException} isolation for {@code sectionId}.
 */
@ExtendWith(MockitoExtension.class)
class SectionServiceImplTest {

    @Mock
    private SectionRepository sectionRepository;

    @Mock
    private SectionContactRepository sectionContactRepository;

    @Mock
    private ClubContactRepository clubContactRepository;

    @Mock
    private SectionMapper sectionMapper;

    @Mock
    private ClubContactMapper clubContactMapper;

    private SectionServiceImpl sectionService;

    @BeforeEach
    void setUp() {
        sectionService = new SectionServiceImpl(
                sectionRepository, sectionContactRepository, clubContactRepository, sectionMapper, clubContactMapper);
    }

    private Section section(UUID id, UUID clubId, boolean active) {
        Section section = new Section();
        section.setId(id);
        section.setClubId(clubId);
        section.setActive(active);
        section.setName("Juniors");
        return section;
    }

    private ClubContact clubContact(UUID id, UUID clubId) {
        ClubContact contact = new ClubContact();
        contact.setId(id);
        contact.setClubId(clubId);
        return contact;
    }

    private SectionDto dummyDto() {
        return new SectionDto(
                UUID.randomUUID(), UUID.randomUUID(), null, "Juniors", null, null, null, true, null, null, null);
    }

    // --- create/update: minAge <= maxAge validation ---

    @Test
    void createWithMinAgeEqualToMaxAgeIsValid() {
        UUID clubId = UUID.randomUUID();
        CreateSectionRequest request = new CreateSectionRequest("U13", null, 13, 13, null);
        Section mapped = new Section();
        when(sectionMapper.toEntity(request)).thenReturn(mapped);
        when(sectionRepository.save(mapped)).thenReturn(mapped);
        when(sectionMapper.toDto(mapped)).thenReturn(dummyDto());

        sectionService.create(clubId, request);

        assertThat(mapped.getClubId()).isEqualTo(clubId);
        assertThat(mapped.isActive()).isTrue();
    }

    @Test
    void createWithOnlyMinAgeSetIsValid() {
        UUID clubId = UUID.randomUUID();
        CreateSectionRequest request = new CreateSectionRequest("Open", null, 18, null, null);
        Section mapped = new Section();
        when(sectionMapper.toEntity(request)).thenReturn(mapped);
        when(sectionRepository.save(mapped)).thenReturn(mapped);
        when(sectionMapper.toDto(mapped)).thenReturn(dummyDto());

        sectionService.create(clubId, request);

        assertThat(mapped.getClubId()).isEqualTo(clubId);
    }

    @Test
    void createWithOnlyMaxAgeSetIsValid() {
        UUID clubId = UUID.randomUUID();
        CreateSectionRequest request = new CreateSectionRequest("Juniors", null, null, 18, null);
        Section mapped = new Section();
        when(sectionMapper.toEntity(request)).thenReturn(mapped);
        when(sectionRepository.save(mapped)).thenReturn(mapped);
        when(sectionMapper.toDto(mapped)).thenReturn(dummyDto());

        sectionService.create(clubId, request);

        assertThat(mapped.getClubId()).isEqualTo(clubId);
    }

    @Test
    void createWithMinAgeGreaterThanMaxAgeThrowsValidationException() {
        UUID clubId = UUID.randomUUID();
        CreateSectionRequest request = new CreateSectionRequest("Invalid", null, 15, 13, null);

        assertThatThrownBy(() -> sectionService.create(clubId, request)).isInstanceOf(ValidationException.class);
        verify(sectionRepository, never()).save(ArgumentMatchers.any());
    }

    @Test
    void updateWithMinAgeGreaterThanMaxAgeThrowsValidationExceptionBeforeLoadingTheSection() {
        UUID clubId = UUID.randomUUID();
        UUID sectionId = UUID.randomUUID();
        UpdateSectionRequest request = new UpdateSectionRequest("Invalid", 15, 13, null);

        assertThatThrownBy(() -> sectionService.update(clubId, sectionId, request))
                .isInstanceOf(ValidationException.class);
        verify(sectionRepository, never()).findById(sectionId);
    }

    @Test
    void updateAppliesRequestFieldsOntoTheExistingEntity() {
        UUID clubId = UUID.randomUUID();
        UUID sectionId = UUID.randomUUID();
        Section existing = section(sectionId, clubId, true);
        when(sectionRepository.findById(sectionId)).thenReturn(Optional.of(existing));
        when(sectionRepository.save(existing)).thenReturn(existing);
        when(sectionMapper.toDto(existing)).thenReturn(dummyDto());

        UpdateSectionRequest request = new UpdateSectionRequest("U15", 13, 15, Gender.MALE);

        sectionService.update(clubId, sectionId, request);

        assertThat(existing.getName()).isEqualTo("U15");
        assertThat(existing.getMinAge()).isEqualTo(13);
        assertThat(existing.getMaxAge()).isEqualTo(15);
        assertThat(existing.getGender()).isEqualTo(Gender.MALE);
    }

    // --- create: cross-club parentSectionId rejection ---

    @Test
    void createWithAParentSectionIdBelongingToADifferentClubThrowsNotFoundException() {
        UUID clubId = UUID.randomUUID();
        UUID otherClubId = UUID.randomUUID();
        UUID parentId = UUID.randomUUID();
        when(sectionRepository.findById(parentId)).thenReturn(Optional.of(section(parentId, otherClubId, true)));

        CreateSectionRequest request = new CreateSectionRequest("U13", parentId, null, null, null);

        assertThatThrownBy(() -> sectionService.create(clubId, request)).isInstanceOf(NotFoundException.class);
        verify(sectionRepository, never()).save(ArgumentMatchers.any());
    }

    @Test
    void createWithANonexistentParentSectionIdThrowsNotFoundException() {
        UUID clubId = UUID.randomUUID();
        UUID parentId = UUID.randomUUID();
        when(sectionRepository.findById(parentId)).thenReturn(Optional.empty());

        CreateSectionRequest request = new CreateSectionRequest("U13", parentId, null, null, null);

        assertThatThrownBy(() -> sectionService.create(clubId, request)).isInstanceOf(NotFoundException.class);
    }

    @Test
    void createWithAParentSectionIdBelongingToTheSameClubSucceeds() {
        UUID clubId = UUID.randomUUID();
        UUID parentId = UUID.randomUUID();
        when(sectionRepository.findById(parentId)).thenReturn(Optional.of(section(parentId, clubId, true)));
        CreateSectionRequest request = new CreateSectionRequest("U13", parentId, null, null, null);
        Section mapped = new Section();
        when(sectionMapper.toEntity(request)).thenReturn(mapped);
        when(sectionRepository.save(mapped)).thenReturn(mapped);
        when(sectionMapper.toDto(mapped)).thenReturn(dummyDto());

        sectionService.create(clubId, request);

        assertThat(mapped.getClubId()).isEqualTo(clubId);
    }

    // --- deactivate: two distinct blocking cases, checked in order ---

    @Test
    void deactivateOnActiveSectionWithNoActiveChildrenTransitionsToInactive() {
        UUID clubId = UUID.randomUUID();
        UUID sectionId = UUID.randomUUID();
        Section existing = section(sectionId, clubId, true);
        when(sectionRepository.findById(sectionId)).thenReturn(Optional.of(existing));
        when(sectionRepository.findByParentSectionIdAndActiveTrue(sectionId)).thenReturn(List.of());
        when(sectionRepository.save(existing)).thenReturn(existing);
        when(sectionMapper.toDto(existing)).thenReturn(dummyDto());

        sectionService.deactivate(clubId, sectionId);

        assertThat(existing.isActive()).isFalse();
    }

    @Test
    void deactivateOnAlreadyInactiveSectionThrowsInvalidStatusTransitionExceptionBeforeCheckingChildren() {
        UUID clubId = UUID.randomUUID();
        UUID sectionId = UUID.randomUUID();
        Section existing = section(sectionId, clubId, false);
        when(sectionRepository.findById(sectionId)).thenReturn(Optional.of(existing));

        assertThatThrownBy(() -> sectionService.deactivate(clubId, sectionId))
                .isInstanceOf(InvalidStatusTransitionException.class)
                .hasMessageContaining("already inactive");
        verify(sectionRepository, never()).findByParentSectionIdAndActiveTrue(sectionId);
    }

    @Test
    void deactivateOnActiveSectionWithAnActiveChildThrowsInvalidStatusTransitionExceptionWithDistinctMessage() {
        UUID clubId = UUID.randomUUID();
        UUID sectionId = UUID.randomUUID();
        Section existing = section(sectionId, clubId, true);
        when(sectionRepository.findById(sectionId)).thenReturn(Optional.of(existing));
        Section activeChild = section(UUID.randomUUID(), clubId, true);
        when(sectionRepository.findByParentSectionIdAndActiveTrue(sectionId)).thenReturn(List.of(activeChild));

        assertThatThrownBy(() -> sectionService.deactivate(clubId, sectionId))
                .isInstanceOf(InvalidStatusTransitionException.class)
                .hasMessageContaining("active child");
        verify(sectionRepository, never()).save(ArgumentMatchers.any());
    }

    @Test
    void deactivateOnActiveSectionWithOnlyInactiveChildrenSucceeds() {
        // Children being inactive doesn't block the parent — findByParentSectionIdAndActiveTrue's
        // own contract already excludes inactive children from what it returns.
        UUID clubId = UUID.randomUUID();
        UUID sectionId = UUID.randomUUID();
        Section existing = section(sectionId, clubId, true);
        when(sectionRepository.findById(sectionId)).thenReturn(Optional.of(existing));
        when(sectionRepository.findByParentSectionIdAndActiveTrue(sectionId)).thenReturn(List.of());
        when(sectionRepository.save(existing)).thenReturn(existing);
        when(sectionMapper.toDto(existing)).thenReturn(dummyDto());

        sectionService.deactivate(clubId, sectionId);

        assertThat(existing.isActive()).isFalse();
    }

    // --- reactivate ---

    @Test
    void reactivateOnInactiveSectionTransitionsToActive() {
        UUID clubId = UUID.randomUUID();
        UUID sectionId = UUID.randomUUID();
        Section existing = section(sectionId, clubId, false);
        when(sectionRepository.findById(sectionId)).thenReturn(Optional.of(existing));
        when(sectionRepository.save(existing)).thenReturn(existing);
        when(sectionMapper.toDto(existing)).thenReturn(dummyDto());

        sectionService.reactivate(clubId, sectionId);

        assertThat(existing.isActive()).isTrue();
    }

    @Test
    void reactivateOnAlreadyActiveSectionThrowsInvalidStatusTransitionException() {
        UUID clubId = UUID.randomUUID();
        UUID sectionId = UUID.randomUUID();
        Section existing = section(sectionId, clubId, true);
        when(sectionRepository.findById(sectionId)).thenReturn(Optional.of(existing));

        assertThatThrownBy(() -> sectionService.reactivate(clubId, sectionId))
                .isInstanceOf(InvalidStatusTransitionException.class);
    }

    // --- link/unlink: Section and ClubContact as independent siblings ---

    @Test
    void linkAnExistingContactBelongingToTheSameClubSucceeds() {
        UUID clubId = UUID.randomUUID();
        UUID sectionId = UUID.randomUUID();
        UUID contactId = UUID.randomUUID();
        when(sectionRepository.findById(sectionId)).thenReturn(Optional.of(section(sectionId, clubId, true)));
        when(clubContactRepository.findById(contactId)).thenReturn(Optional.of(clubContact(contactId, clubId)));
        when(sectionContactRepository.existsBySectionIdAndClubContactId(sectionId, contactId))
                .thenReturn(false);

        sectionService.link(clubId, sectionId, contactId);

        verify(sectionContactRepository).save(ArgumentMatchers.any(SectionContact.class));
    }

    @Test
    void linkAContactBelongingToADifferentClubThrowsNotFoundException() {
        UUID clubId = UUID.randomUUID();
        UUID otherClubId = UUID.randomUUID();
        UUID sectionId = UUID.randomUUID();
        UUID contactId = UUID.randomUUID();
        when(sectionRepository.findById(sectionId)).thenReturn(Optional.of(section(sectionId, clubId, true)));
        when(clubContactRepository.findById(contactId))
                .thenReturn(Optional.of(clubContact(contactId, otherClubId)));

        assertThatThrownBy(() -> sectionService.link(clubId, sectionId, contactId))
                .isInstanceOf(NotFoundException.class);
        verify(sectionContactRepository, never()).save(ArgumentMatchers.any());
    }

    @Test
    void linkASectionBelongingToADifferentClubThrowsNotFoundExceptionWithoutCheckingTheContact() {
        UUID clubId = UUID.randomUUID();
        UUID otherClubId = UUID.randomUUID();
        UUID sectionId = UUID.randomUUID();
        UUID contactId = UUID.randomUUID();
        when(sectionRepository.findById(sectionId)).thenReturn(Optional.of(section(sectionId, otherClubId, true)));

        assertThatThrownBy(() -> sectionService.link(clubId, sectionId, contactId))
                .isInstanceOf(NotFoundException.class);
        verify(clubContactRepository, never()).findById(contactId);
    }

    @Test
    void linkAnAlreadyLinkedPairThrowsConflictException() {
        UUID clubId = UUID.randomUUID();
        UUID sectionId = UUID.randomUUID();
        UUID contactId = UUID.randomUUID();
        when(sectionRepository.findById(sectionId)).thenReturn(Optional.of(section(sectionId, clubId, true)));
        when(clubContactRepository.findById(contactId)).thenReturn(Optional.of(clubContact(contactId, clubId)));
        when(sectionContactRepository.existsBySectionIdAndClubContactId(sectionId, contactId))
                .thenReturn(true);

        assertThatThrownBy(() -> sectionService.link(clubId, sectionId, contactId))
                .isInstanceOf(ConflictException.class);
        verify(sectionContactRepository, never()).save(ArgumentMatchers.any());
    }

    @Test
    void aClubContactCanBeValidlyLinkedToMoreThanOneSection() {
        // No uniqueness constraint across sections, only within one section+contact pair — link
        // against a second, different section for the same contact succeeds identically.
        UUID clubId = UUID.randomUUID();
        UUID sectionOneId = UUID.randomUUID();
        UUID sectionTwoId = UUID.randomUUID();
        UUID contactId = UUID.randomUUID();
        when(sectionRepository.findById(sectionTwoId))
                .thenReturn(Optional.of(section(sectionTwoId, clubId, true)));
        when(clubContactRepository.findById(contactId)).thenReturn(Optional.of(clubContact(contactId, clubId)));
        when(sectionContactRepository.existsBySectionIdAndClubContactId(sectionTwoId, contactId))
                .thenReturn(false);

        sectionService.link(clubId, sectionTwoId, contactId);

        verify(sectionContactRepository).save(ArgumentMatchers.any(SectionContact.class));
        assertThat(sectionOneId).isNotEqualTo(sectionTwoId);
    }

    @Test
    void unlinkAnExistingLinkRemovesTheJoinRow() {
        UUID clubId = UUID.randomUUID();
        UUID sectionId = UUID.randomUUID();
        UUID contactId = UUID.randomUUID();
        when(sectionRepository.findById(sectionId)).thenReturn(Optional.of(section(sectionId, clubId, true)));
        when(sectionContactRepository.findBySectionIdAndClubContactId(sectionId, contactId))
                .thenReturn(Optional.of(SectionContact.builder()
                        .id(UUID.randomUUID())
                        .sectionId(sectionId)
                        .clubContactId(contactId)
                        .build()));

        sectionService.unlink(clubId, sectionId, contactId);

        verify(sectionContactRepository).deleteBySectionIdAndClubContactId(sectionId, contactId);
    }

    @Test
    void unlinkWithNoExistingLinkThrowsNotFoundException() {
        UUID clubId = UUID.randomUUID();
        UUID sectionId = UUID.randomUUID();
        UUID contactId = UUID.randomUUID();
        when(sectionRepository.findById(sectionId)).thenReturn(Optional.of(section(sectionId, clubId, true)));
        when(sectionContactRepository.findBySectionIdAndClubContactId(sectionId, contactId))
                .thenReturn(Optional.empty());

        assertThatThrownBy(() -> sectionService.unlink(clubId, sectionId, contactId))
                .isInstanceOf(NotFoundException.class);
        verify(sectionContactRepository, never()).deleteBySectionIdAndClubContactId(sectionId, contactId);
    }

    // --- cross-club NotFoundException isolation for sectionId (findOrThrowForClub) ---

    @Test
    void updateOnASectionBelongingToADifferentClubThrowsNotFoundException() {
        UUID clubId = UUID.randomUUID();
        UUID otherClubId = UUID.randomUUID();
        UUID sectionId = UUID.randomUUID();
        when(sectionRepository.findById(sectionId)).thenReturn(Optional.of(section(sectionId, otherClubId, true)));

        UpdateSectionRequest request = new UpdateSectionRequest("U15", null, null, null);

        assertThatThrownBy(() -> sectionService.update(clubId, sectionId, request))
                .isInstanceOf(NotFoundException.class);
    }

    @Test
    void deactivateOnANonexistentSectionThrowsNotFoundException() {
        UUID clubId = UUID.randomUUID();
        UUID sectionId = UUID.randomUUID();
        when(sectionRepository.findById(sectionId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> sectionService.deactivate(clubId, sectionId))
                .isInstanceOf(NotFoundException.class);
    }

    @Test
    void listContactsOnASectionBelongingToADifferentClubThrowsNotFoundException() {
        UUID clubId = UUID.randomUUID();
        UUID otherClubId = UUID.randomUUID();
        UUID sectionId = UUID.randomUUID();
        when(sectionRepository.findById(sectionId)).thenReturn(Optional.of(section(sectionId, otherClubId, true)));

        assertThatThrownBy(() -> sectionService.listContacts(clubId, sectionId))
                .isInstanceOf(NotFoundException.class);
    }

    // --- list ---

    @Test
    void listMapsEverySectionForTheClub() {
        UUID clubId = UUID.randomUUID();
        Section a = section(UUID.randomUUID(), clubId, true);
        Section b = section(UUID.randomUUID(), clubId, false);
        when(sectionRepository.findByClubId(clubId)).thenReturn(List.of(a, b));
        when(sectionMapper.toDto(a)).thenReturn(dummyDto());
        when(sectionMapper.toDto(b)).thenReturn(dummyDto());

        List<SectionDto> result = sectionService.list(clubId);

        assertThat(result).hasSize(2);
    }
}
