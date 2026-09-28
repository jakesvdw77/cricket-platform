package com.cricketlegend.repository;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.cricketlegend.AbstractIntegrationTest;
import com.cricketlegend.domain.Club;
import com.cricketlegend.domain.ClubStatus;
import com.cricketlegend.domain.DayPart;
import com.cricketlegend.domain.Section;
import com.cricketlegend.domain.SectionAvailabilityRound;
import com.cricketlegend.domain.SectionAvailabilityWindow;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.transaction.annotation.Transactional;

/**
 * Integration test for SectionAvailabilityRoundRepository — per docs/standards/backend.md, proves
 * that migration {@code 034-add-section-availability-fixture-selection.sql} applies cleanly
 * against the existing {@code 032}/{@code 033} tables (dropping {@code round_date} and its unique
 * constraint outright, adding {@code description}/{@code firstMatchDate}/{@code lastMatchDate}/
 * {@code autoClose}/{@code scheduledCloseAt}), that a round no longer carries any uniqueness
 * constraint at all (its own id is its identity, see Data Model Changes), and {@code
 * section_availability_window.round_id}'s {@code NOT NULL} FK constraint. See
 * docs/specs/063-section-availability-and-flexible-squads.md.
 */
@SpringBootTest
@Import(AbstractIntegrationTest.class)
@Transactional
class SectionAvailabilityRoundRepositoryTest {

    @Autowired
    private ClubRepository clubRepository;

    @Autowired
    private SectionRepository sectionRepository;

    @Autowired
    private SectionAvailabilityRoundRepository sectionAvailabilityRoundRepository;

    @Autowired
    private SectionAvailabilityWindowRepository sectionAvailabilityWindowRepository;

    private Club savedClub(String slug) {
        return clubRepository.save(Club.builder().name("Riverside CC").slug(slug).status(ClubStatus.ACTIVE).build());
    }

    private Section savedSection(UUID clubId) {
        return sectionRepository.save(Section.builder().clubId(clubId).name("Juniors").active(true).build());
    }

    private SectionAvailabilityRound.SectionAvailabilityRoundBuilder roundBuilder(UUID clubId, UUID sectionId) {
        LocalDate matchDate = LocalDate.of(2026, 9, 27);
        return SectionAvailabilityRound.builder()
                .clubId(clubId)
                .sectionId(sectionId)
                .description("Saturday fixtures")
                .firstMatchDate(matchDate)
                .lastMatchDate(matchDate)
                .autoClose(true)
                .open(true);
    }

    @Test
    void savingTwoRoundsForTheSameSectionAndDateIsAllowedNoUniquenessConstraintOnThisTableAtAll() {
        Club club = savedClub("riverside-cc");
        Section section = savedSection(club.getId());

        SectionAvailabilityRound first =
                sectionAvailabilityRoundRepository.saveAndFlush(roundBuilder(club.getId(), section.getId()).build());
        SectionAvailabilityRound second =
                sectionAvailabilityRoundRepository.saveAndFlush(roundBuilder(club.getId(), section.getId()).build());

        assertThat(first.getId()).isNotEqualTo(second.getId());
    }

    @Test
    void findByClubIdReturnsEveryRoundForThatClub() {
        Club club = savedClub("riverside-cc");
        Section section = savedSection(club.getId());
        sectionAvailabilityRoundRepository.save(roundBuilder(club.getId(), section.getId()).build());
        sectionAvailabilityRoundRepository.save(roundBuilder(club.getId(), section.getId()).build());

        Club otherClub = savedClub("lakeside-cc");
        Section otherSection = savedSection(otherClub.getId());
        sectionAvailabilityRoundRepository.save(roundBuilder(otherClub.getId(), otherSection.getId()).build());

        assertThat(sectionAvailabilityRoundRepository.findByClubId(club.getId())).hasSize(2);
    }

    @Test
    void windowRoundIdIsARequiredForeignKeyToAnExistingRound() {
        Club club = savedClub("riverside-cc");
        Section section = savedSection(club.getId());
        SectionAvailabilityRound round =
                sectionAvailabilityRoundRepository.save(roundBuilder(club.getId(), section.getId()).build());

        SectionAvailabilityWindow window = sectionAvailabilityWindowRepository.save(SectionAvailabilityWindow.builder()
                .clubId(club.getId())
                .sectionId(section.getId())
                .roundId(round.getId())
                .windowDate(round.getFirstMatchDate())
                .dayPart(DayPart.MORNING)
                .open(true)
                .build());

        assertThat(sectionAvailabilityWindowRepository.findByRoundId(round.getId())).containsExactly(window);

        SectionAvailabilityWindow orphan = SectionAvailabilityWindow.builder()
                .clubId(club.getId())
                .sectionId(section.getId())
                .roundId(UUID.randomUUID())
                .windowDate(round.getFirstMatchDate())
                .dayPart(DayPart.AFTERNOON)
                .open(true)
                .build();

        assertThatThrownBy(() -> sectionAvailabilityWindowRepository.saveAndFlush(orphan))
                .isInstanceOf(DataIntegrityViolationException.class);
    }
}
