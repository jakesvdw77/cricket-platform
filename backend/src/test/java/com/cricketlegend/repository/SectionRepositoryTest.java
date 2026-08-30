package com.cricketlegend.repository;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.cricketlegend.AbstractIntegrationTest;
import com.cricketlegend.domain.Club;
import com.cricketlegend.domain.ClubContact;
import com.cricketlegend.domain.ClubStatus;
import com.cricketlegend.domain.Contact;
import com.cricketlegend.domain.Section;
import com.cricketlegend.domain.SectionContact;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.transaction.annotation.Transactional;

/**
 * Integration tests for SectionRepository/SectionContactRepository — per docs/standards/backend.md,
 * every custom repository query ships a Testcontainers-backed integration test. Also proves
 * 017-add-section.sql applies cleanly on top of 016 (implicit via context boot — this test class
 * only runs at all if the whole migration chain applied without error), the self-referential
 * {@code parent_section_id} FK across a real 3-level-deep tree (per docs/specs/025-club-structure.md's
 * own worked example — a root, a mid-level branch, two leaves), and the {@code section_contact}
 * unique {@code (section_id, club_contact_id)} constraint rejecting a duplicate insert at the DB
 * level, and that deleting a {@code Section} still referenced by a child's {@code
 * parent_section_id} genuinely fails at the DB level (backing the service-layer remove-eligibility
 * guard, not just documenting it).
 */
@SpringBootTest
@Import(AbstractIntegrationTest.class)
@Transactional
class SectionRepositoryTest {

    @Autowired
    private SectionRepository sectionRepository;

    @Autowired
    private SectionContactRepository sectionContactRepository;

    @Autowired
    private ClubRepository clubRepository;

    @Autowired
    private ClubContactRepository clubContactRepository;

    private Club savedClub(String slug) {
        return clubRepository.save(Club.builder().name("Riverside CC").slug(slug).status(ClubStatus.ACTIVE).build());
    }

    private Section section(UUID clubId, UUID parentSectionId, String name) {
        return sectionRepository.save(Section.builder()
                .clubId(clubId)
                .parentSectionId(parentSectionId)
                .name(name)
                .active(true)
                .build());
    }

    private ClubContact savedClubContact(UUID clubId) {
        return clubContactRepository.save(ClubContact.builder()
                .clubId(clubId)
                .contact(Contact.builder()
                        .firstName("Jane")
                        .lastName("Doe")
                        .email("jane@example.com")
                        .phone("0123456789")
                        .build())
                .role("Treasurer")
                .active(true)
                .build());
    }

    @Test
    void findByClubIdReturnsEveryNodeOfAThreeLevelDeepTreeFlatWithCorrectParentPointers() {
        // Mirrors the spec's own worked example: a root ("Juniors"), a mid-level branch ("U13"),
        // and two leaves ("U13A"/"U13B").
        Club club = savedClub("riverside-cc");
        Section root = section(club.getId(), null, "Juniors");
        Section branch = section(club.getId(), root.getId(), "U13");
        Section leafA = section(club.getId(), branch.getId(), "U13A");
        Section leafB = section(club.getId(), branch.getId(), "U13B");

        var all = sectionRepository.findByClubId(club.getId());

        assertThat(all).hasSize(4).extracting(Section::getId).containsExactlyInAnyOrder(
                root.getId(), branch.getId(), leafA.getId(), leafB.getId());
        assertThat(all.stream().filter(s -> s.getId().equals(root.getId())).findFirst().get()
                .getParentSectionId())
                .isNull();
        assertThat(all.stream().filter(s -> s.getId().equals(branch.getId())).findFirst().get()
                .getParentSectionId())
                .isEqualTo(root.getId());
        assertThat(all.stream().filter(s -> s.getId().equals(leafA.getId())).findFirst().get()
                .getParentSectionId())
                .isEqualTo(branch.getId());
        assertThat(all.stream().filter(s -> s.getId().equals(leafB.getId())).findFirst().get()
                .getParentSectionId())
                .isEqualTo(branch.getId());
    }

    @Test
    void findByClubIdReturnsOnlySectionsForThatClub() {
        Club clubX = savedClub("riverside-cc");
        Club clubY = savedClub("lakeside-cc");
        Section sectionForX = section(clubX.getId(), null, "Juniors");
        section(clubY.getId(), null, "Seniors");

        assertThat(sectionRepository.findByClubId(clubX.getId()))
                .extracting(Section::getId)
                .containsExactly(sectionForX.getId());
    }

    @Test
    void findByParentSectionIdAndActiveTrueExcludesInactiveChildren() {
        Club club = savedClub("riverside-cc");
        Section root = section(club.getId(), null, "Juniors");
        Section activeChild = section(club.getId(), root.getId(), "U13");
        Section inactiveChild = section(club.getId(), root.getId(), "U15");
        inactiveChild.setActive(false);
        sectionRepository.save(inactiveChild);

        assertThat(sectionRepository.findByParentSectionIdAndActiveTrue(root.getId()))
                .extracting(Section::getId)
                .containsExactly(activeChild.getId());
    }

    @Test
    void parentSectionIdFkRejectsAReferenceToANonexistentSection() {
        Club club = savedClub("riverside-cc");
        Section orphan = Section.builder()
                .clubId(club.getId())
                .parentSectionId(UUID.randomUUID())
                .name("Orphan")
                .active(true)
                .build();

        assertThatThrownBy(() -> sectionRepository.saveAndFlush(orphan))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void sectionContactUniqueSectionIdClubContactIdRejectsADuplicateInsertAtTheDbLevel() {
        Club club = savedClub("riverside-cc");
        Section section = section(club.getId(), null, "Juniors");
        ClubContact contact = savedClubContact(club.getId());
        sectionContactRepository.saveAndFlush(SectionContact.builder()
                .sectionId(section.getId())
                .clubContactId(contact.getId())
                .build());

        SectionContact duplicate = SectionContact.builder()
                .sectionId(section.getId())
                .clubContactId(contact.getId())
                .build();

        assertThatThrownBy(() -> sectionContactRepository.saveAndFlush(duplicate))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void sectionContactAllowsTheSameContactLinkedToDifferentSections() {
        Club club = savedClub("riverside-cc");
        Section sectionA = section(club.getId(), null, "Juniors");
        Section sectionB = section(club.getId(), null, "Open Sides");
        ClubContact contact = savedClubContact(club.getId());
        sectionContactRepository.saveAndFlush(SectionContact.builder()
                .sectionId(sectionA.getId())
                .clubContactId(contact.getId())
                .build());

        SectionContact secondLink = sectionContactRepository.saveAndFlush(SectionContact.builder()
                .sectionId(sectionB.getId())
                .clubContactId(contact.getId())
                .build());

        assertThat(secondLink.getId()).isNotNull();
    }

    @Test
    void existsByParentSectionIdIsTrueForAnyChildEvenAnInactiveOne() {
        // The remove-eligibility rule (SectionServiceImpl.canHardDelete) deliberately checks
        // ALL children, not just active ones — an inactive child row would still violate this
        // table's own parent_section_id FK if the parent were deleted out from under it.
        Club club = savedClub("riverside-cc");
        Section root = section(club.getId(), null, "Juniors");
        Section inactiveChild = section(club.getId(), root.getId(), "U15");
        inactiveChild.setActive(false);
        sectionRepository.save(inactiveChild);

        assertThat(sectionRepository.existsByParentSectionId(root.getId())).isTrue();
    }

    @Test
    void existsByParentSectionIdIsFalseForALeafSection() {
        Club club = savedClub("riverside-cc");
        Section leaf = section(club.getId(), null, "Over 40");

        assertThat(sectionRepository.existsByParentSectionId(leaf.getId())).isFalse();
    }

    @Test
    void deletingASectionStillReferencedByAChildsParentSectionIdFailsAtTheDbLevel() {
        // Proves the service-layer "any children at all block a hard delete" guard is backed by
        // a real DB constraint, not just documented — the same posture 021/024 already prove for
        // their own FK-backed invariants.
        Club club = savedClub("riverside-cc");
        Section root = section(club.getId(), null, "Juniors");
        section(club.getId(), root.getId(), "U13");

        assertThatThrownBy(() -> {
                    sectionRepository.delete(root);
                    sectionRepository.flush();
                })
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void existsBySectionIdOnSectionContactReflectsWhetherAnyLinkExists() {
        Club club = savedClub("riverside-cc");
        Section section = section(club.getId(), null, "Juniors");
        ClubContact contact = savedClubContact(club.getId());

        assertThat(sectionContactRepository.existsBySectionId(section.getId())).isFalse();

        sectionContactRepository.saveAndFlush(
                SectionContact.builder().sectionId(section.getId()).clubContactId(contact.getId()).build());

        assertThat(sectionContactRepository.existsBySectionId(section.getId())).isTrue();
    }

    @Test
    void findBySectionIdReturnsOnlyLinksForThatSection() {
        Club club = savedClub("riverside-cc");
        Section sectionA = section(club.getId(), null, "Juniors");
        Section sectionB = section(club.getId(), null, "Open Sides");
        ClubContact contact = savedClubContact(club.getId());
        SectionContact linkA = sectionContactRepository.save(
                SectionContact.builder().sectionId(sectionA.getId()).clubContactId(contact.getId()).build());
        sectionContactRepository.save(
                SectionContact.builder().sectionId(sectionB.getId()).clubContactId(contact.getId()).build());

        assertThat(sectionContactRepository.findBySectionId(sectionA.getId()))
                .extracting(SectionContact::getId)
                .containsExactly(linkA.getId());
    }
}
