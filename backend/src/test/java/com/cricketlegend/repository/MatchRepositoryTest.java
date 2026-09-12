package com.cricketlegend.repository;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.cricketlegend.AbstractIntegrationTest;
import com.cricketlegend.domain.Club;
import com.cricketlegend.domain.ClubStatus;
import com.cricketlegend.domain.Match;
import com.cricketlegend.domain.Season;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.transaction.annotation.Transactional;

/**
 * Integration test for MatchRepository — per docs/standards/backend.md, proves the {@code
 * findByClubId(..., Pageable)} query genuinely pages (a real {@code LIMIT}/{@code OFFSET}, not a
 * fetch-all-then-slice), and that the two {@code CHECK} constraints on {@code match} (exactly one
 * of team-id/team-name per side) are enforced at the DB level. See
 * docs/specs/029-league-management.md.
 */
@SpringBootTest
@Import(AbstractIntegrationTest.class)
@Transactional
class MatchRepositoryTest {

    @Autowired
    private ClubRepository clubRepository;

    @Autowired
    private SeasonRepository seasonRepository;

    @Autowired
    private MatchRepository matchRepository;

    private Club savedClub(String slug) {
        return clubRepository.save(Club.builder().name("Riverside CC").slug(slug).status(ClubStatus.ACTIVE).build());
    }

    private Season savedSeason(UUID clubId) {
        return seasonRepository.save(Season.builder().clubId(clubId).label("2026")
                .startDate(LocalDate.of(2026, 1, 1)).endDate(LocalDate.of(2026, 12, 31)).active(true).build());
    }

    private Match match(UUID clubId, UUID seasonId, Instant matchDate) {
        return Match.builder().clubId(clubId).homeTeamName("Home Occasionals").awayTeamName("Away Occasionals")
                .seasonId(seasonId).matchDate(matchDate).active(true).build();
    }

    @Test
    void findByClubIdActuallyPagesInsteadOfReturningEverything() {
        Club club = savedClub("riverside-cc");
        Season season = savedSeason(club.getId());
        Instant now = Instant.now();
        for (int i = 0; i < 3; i++) {
            matchRepository.save(match(club.getId(), season.getId(), now.plus(i, ChronoUnit.DAYS)));
        }

        Page<Match> firstPage = matchRepository.findByClubId(club.getId(), PageRequest.of(0, 2));

        assertThat(firstPage.getTotalElements()).isEqualTo(3);
        assertThat(firstPage.getContent()).hasSize(2);
        assertThat(firstPage.getTotalPages()).isEqualTo(2);
    }

    @Test
    void checkConstraintRejectsAHomeSideWithBothTeamIdAndTeamNameNull() {
        Club club = savedClub("riverside-cc");
        Season season = savedSeason(club.getId());
        Match invalid = Match.builder().clubId(club.getId()).homeTeamId(null).homeTeamName(null)
                .awayTeamName("Away Occasionals").seasonId(season.getId()).matchDate(Instant.now())
                .active(true).build();

        assertThatThrownBy(() -> matchRepository.saveAndFlush(invalid))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void checkConstraintRejectsAnAwaySideWithBothTeamIdAndTeamNameSet() {
        Club club = savedClub("riverside-cc");
        Season season = savedSeason(club.getId());
        Match invalid = Match.builder().clubId(club.getId()).homeTeamName("Home Occasionals")
                .awayTeamId(UUID.randomUUID()).awayTeamName("Away Occasionals").seasonId(season.getId())
                .matchDate(Instant.now()).active(true).build();

        assertThatThrownBy(() -> matchRepository.saveAndFlush(invalid))
                .isInstanceOf(DataIntegrityViolationException.class);
    }
}
