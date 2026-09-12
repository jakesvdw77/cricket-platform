package com.cricketlegend.repository;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.cricketlegend.AbstractIntegrationTest;
import com.cricketlegend.domain.Club;
import com.cricketlegend.domain.ClubStatus;
import com.cricketlegend.domain.Match;
import com.cricketlegend.domain.MatchSide;
import com.cricketlegend.domain.Season;
import com.cricketlegend.domain.Section;
import com.cricketlegend.domain.Team;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.transaction.annotation.Transactional;

/**
 * Integration test for MatchSideRepository — per docs/standards/backend.md, proves the {@code
 * UNIQUE (match_id, team_id)} constraint at the DB level and {@code existsByMatchIdAndTeamId}.
 * See docs/specs/029-league-management.md.
 */
@SpringBootTest
@Import(AbstractIntegrationTest.class)
@Transactional
class MatchSideRepositoryTest {

    @Autowired
    private ClubRepository clubRepository;

    @Autowired
    private SectionRepository sectionRepository;

    @Autowired
    private TeamRepository teamRepository;

    @Autowired
    private SeasonRepository seasonRepository;

    @Autowired
    private MatchRepository matchRepository;

    @Autowired
    private MatchSideRepository matchSideRepository;

    private Club savedClub(String slug) {
        return clubRepository.save(Club.builder().name("Riverside CC").slug(slug).status(ClubStatus.ACTIVE).build());
    }

    private Team savedTeam(UUID clubId) {
        Section section = sectionRepository.save(Section.builder().clubId(clubId).name("Men").active(true).build());
        return teamRepository.save(
                Team.builder().clubId(clubId).sectionId(section.getId()).name("1st XI").active(true).build());
    }

    private Season savedSeason(UUID clubId) {
        return seasonRepository.save(Season.builder().clubId(clubId).label("2026")
                .startDate(LocalDate.of(2026, 1, 1)).endDate(LocalDate.of(2026, 12, 31)).active(true).build());
    }

    private Match savedMatch(UUID clubId, UUID homeTeamId, UUID seasonId) {
        return matchRepository.save(Match.builder().clubId(clubId).homeTeamId(homeTeamId)
                .awayTeamName("Away Occasionals").seasonId(seasonId).matchDate(Instant.now()).active(true).build());
    }

    @Test
    void existsByMatchIdAndTeamIdReflectsCurrentSides() {
        Club club = savedClub("riverside-cc");
        Team team = savedTeam(club.getId());
        Season season = savedSeason(club.getId());
        Match match = savedMatch(club.getId(), team.getId(), season.getId());

        assertThat(matchSideRepository.existsByMatchIdAndTeamId(match.getId(), team.getId())).isFalse();

        matchSideRepository.save(MatchSide.builder().matchId(match.getId()).teamId(team.getId()).build());

        assertThat(matchSideRepository.existsByMatchIdAndTeamId(match.getId(), team.getId())).isTrue();
    }

    @Test
    void uniqueConstraintRejectsASecondSideForTheSameTeamOnTheSameMatch() {
        Club club = savedClub("riverside-cc");
        Team team = savedTeam(club.getId());
        Season season = savedSeason(club.getId());
        Match match = savedMatch(club.getId(), team.getId(), season.getId());
        matchSideRepository.save(MatchSide.builder().matchId(match.getId()).teamId(team.getId()).build());

        MatchSide duplicate = MatchSide.builder().matchId(match.getId()).teamId(team.getId()).build();

        assertThatThrownBy(() -> matchSideRepository.saveAndFlush(duplicate))
                .isInstanceOf(DataIntegrityViolationException.class);
    }
}
