package com.cricketlegend.repository;

import static org.assertj.core.api.Assertions.assertThat;

import com.cricketlegend.AbstractIntegrationTest;
import com.cricketlegend.domain.Club;
import com.cricketlegend.domain.ClubStatus;
import com.cricketlegend.domain.DayPart;
import com.cricketlegend.domain.Section;
import com.cricketlegend.domain.SectionAvailabilityRound;
import com.cricketlegend.domain.SectionAvailabilityWindow;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.transaction.annotation.Transactional;

/** Integration test for {@code findByRoundIdIn}, the batched lookup behind the group-poll list (docs/specs/066). */
@SpringBootTest
@Import(AbstractIntegrationTest.class)
@Transactional
class SectionAvailabilityWindowRepositoryTest {

    @Autowired
    private ClubRepository clubRepository;

    @Autowired
    private SectionRepository sectionRepository;

    @Autowired
    private SectionAvailabilityRoundRepository roundRepository;

    @Autowired
    private SectionAvailabilityWindowRepository windowRepository;

    private SectionAvailabilityRound round(Club club, Section section) {
        LocalDate date = LocalDate.of(2026, 9, 27);
        return roundRepository.save(SectionAvailabilityRound.builder()
                .clubId(club.getId()).sectionId(section.getId()).description("Fixtures")
                .firstMatchDate(date).lastMatchDate(date).autoClose(true).open(true).build());
    }

    private SectionAvailabilityWindow window(Club club, Section section, UUID roundId, DayPart dayPart, int dayOffset) {
        return windowRepository.save(SectionAvailabilityWindow.builder()
                .clubId(club.getId()).sectionId(section.getId()).roundId(roundId)
                .windowDate(LocalDate.of(2026, 9, 27).plusDays(dayOffset)).dayPart(dayPart).open(true).build());
    }

    @Test
    void findByRoundIdInReturnsTheWindowsOfOnlyTheRequestedRounds() {
        Club club = clubRepository.save(
                Club.builder().name("Riverside CC").slug("riverside-cc").status(ClubStatus.ACTIVE).build());
        Section section = sectionRepository.save(
                Section.builder().clubId(club.getId()).name("Juniors").active(true).build());
        SectionAvailabilityRound r1 = round(club, section);
        SectionAvailabilityRound r2 = round(club, section);
        SectionAvailabilityRound r3 = round(club, section);
        SectionAvailabilityWindow w1 = window(club, section, r1.getId(), DayPart.MORNING, 0);
        SectionAvailabilityWindow w1b = window(club, section, r1.getId(), DayPart.AFTERNOON, 0);
        SectionAvailabilityWindow w2 = window(club, section, r2.getId(), DayPart.MORNING, 1);
        window(club, section, r3.getId(), DayPart.MORNING, 2);

        List<SectionAvailabilityWindow> found = windowRepository.findByRoundIdIn(List.of(r1.getId(), r2.getId()));

        assertThat(found).extracting(SectionAvailabilityWindow::getId)
                .containsExactlyInAnyOrder(w1.getId(), w1b.getId(), w2.getId());
        assertThat(windowRepository.findByRoundIdIn(List.of())).isEmpty();
    }
}
