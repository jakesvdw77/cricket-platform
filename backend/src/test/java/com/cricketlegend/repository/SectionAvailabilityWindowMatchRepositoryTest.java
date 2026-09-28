package com.cricketlegend.repository;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.cricketlegend.AbstractIntegrationTest;
import com.cricketlegend.domain.Club;
import com.cricketlegend.domain.ClubStatus;
import com.cricketlegend.domain.DayPart;
import com.cricketlegend.domain.Match;
import com.cricketlegend.domain.Season;
import com.cricketlegend.domain.Section;
import com.cricketlegend.domain.SectionAvailabilityRound;
import com.cricketlegend.domain.SectionAvailabilityWindow;
import com.cricketlegend.domain.SectionAvailabilityWindowMatch;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.transaction.annotation.Transactional;

/**
 * Integration test for SectionAvailabilityWindowMatchRepository — per docs/standards/backend.md,
 * proves migration {@code 034-add-section-availability-fixture-selection.sql}'s own new table
 * applies cleanly and its {@code UNIQUE(match_id)} constraint is enforced at the DB level: two
 * attempts to link the same match to two different windows, the second rejected — the data-
 * integrity backstop for "a match already covered by another poll can't be selected into a second
 * one." See docs/specs/063-section-availability-and-flexible-squads.md.
 */
@SpringBootTest
@Import(AbstractIntegrationTest.class)
@Transactional
class SectionAvailabilityWindowMatchRepositoryTest {

    @Autowired
    private ClubRepository clubRepository;

    @Autowired
    private SectionRepository sectionRepository;

    @Autowired
    private SeasonRepository seasonRepository;

    @Autowired
    private MatchRepository matchRepository;

    @Autowired
    private SectionAvailabilityRoundRepository sectionAvailabilityRoundRepository;

    @Autowired
    private SectionAvailabilityWindowRepository sectionAvailabilityWindowRepository;

    @Autowired
    private SectionAvailabilityWindowMatchRepository sectionAvailabilityWindowMatchRepository;

    private Club savedClub() {
        return clubRepository.save(Club.builder().name("Riverside CC").slug("riverside-cc").status(ClubStatus.ACTIVE).build());
    }

    private Section savedSection(UUID clubId) {
        return sectionRepository.save(Section.builder().clubId(clubId).name("Juniors").active(true).build());
    }

    private Season savedSeason(UUID clubId) {
        return seasonRepository.save(Season.builder().clubId(clubId).label("2026")
                .startDate(LocalDate.of(2026, 1, 1)).endDate(LocalDate.of(2026, 12, 31)).active(true).build());
    }

    private Match savedMatch(UUID clubId, UUID seasonId) {
        return matchRepository.save(Match.builder().clubId(clubId).homeTeamName("Home Occasionals")
                .awayTeamName("Away Occasionals").seasonId(seasonId).matchDate(Instant.now()).active(true).build());
    }

    private SectionAvailabilityRound savedRound(UUID clubId, UUID sectionId) {
        LocalDate matchDate = LocalDate.of(2026, 9, 27);
        return sectionAvailabilityRoundRepository.save(SectionAvailabilityRound.builder()
                .clubId(clubId).sectionId(sectionId).description("Saturday fixtures")
                .firstMatchDate(matchDate).lastMatchDate(matchDate).autoClose(true).open(true).build());
    }

    private SectionAvailabilityWindow savedWindow(UUID clubId, UUID sectionId, UUID roundId, DayPart dayPart) {
        return sectionAvailabilityWindowRepository.save(SectionAvailabilityWindow.builder()
                .clubId(clubId).sectionId(sectionId).roundId(roundId)
                .windowDate(LocalDate.of(2026, 9, 27)).dayPart(dayPart).open(true).build());
    }

    @Test
    void findByWindowIdInReturnsEveryLinkedMatchAcrossSeveralWindows() {
        Club club = savedClub();
        Section section = savedSection(club.getId());
        Season season = savedSeason(club.getId());
        SectionAvailabilityRound round = savedRound(club.getId(), section.getId());
        SectionAvailabilityWindow morning = savedWindow(club.getId(), section.getId(), round.getId(), DayPart.MORNING);
        SectionAvailabilityWindow afternoon =
                savedWindow(club.getId(), section.getId(), round.getId(), DayPart.AFTERNOON);
        Match morningMatch = savedMatch(club.getId(), season.getId());
        Match afternoonMatch = savedMatch(club.getId(), season.getId());
        sectionAvailabilityWindowMatchRepository.save(
                SectionAvailabilityWindowMatch.builder().windowId(morning.getId()).matchId(morningMatch.getId()).build());
        sectionAvailabilityWindowMatchRepository.save(
                SectionAvailabilityWindowMatch.builder().windowId(afternoon.getId()).matchId(afternoonMatch.getId()).build());

        List<SectionAvailabilityWindowMatch> result = sectionAvailabilityWindowMatchRepository
                .findByWindowIdIn(List.of(morning.getId(), afternoon.getId()));

        assertThat(result).extracting(SectionAvailabilityWindowMatch::getMatchId)
                .containsExactlyInAnyOrder(morningMatch.getId(), afternoonMatch.getId());
    }

    @Test
    void uniqueConstraintRejectsLinkingTheSameMatchToTwoDifferentWindows() {
        Club club = savedClub();
        Section section = savedSection(club.getId());
        Season season = savedSeason(club.getId());
        SectionAvailabilityRound round = savedRound(club.getId(), section.getId());
        SectionAvailabilityWindow morning = savedWindow(club.getId(), section.getId(), round.getId(), DayPart.MORNING);
        SectionAvailabilityWindow afternoon =
                savedWindow(club.getId(), section.getId(), round.getId(), DayPart.AFTERNOON);
        Match match = savedMatch(club.getId(), season.getId());
        sectionAvailabilityWindowMatchRepository.save(
                SectionAvailabilityWindowMatch.builder().windowId(morning.getId()).matchId(match.getId()).build());

        assertThat(sectionAvailabilityWindowMatchRepository.existsByMatchId(match.getId())).isTrue();

        SectionAvailabilityWindowMatch duplicate =
                SectionAvailabilityWindowMatch.builder().windowId(afternoon.getId()).matchId(match.getId()).build();

        assertThatThrownBy(() -> sectionAvailabilityWindowMatchRepository.saveAndFlush(duplicate))
                .isInstanceOf(DataIntegrityViolationException.class);
    }
}
