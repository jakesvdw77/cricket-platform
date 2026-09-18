package com.cricketlegend.repository;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.cricketlegend.AbstractIntegrationTest;
import com.cricketlegend.domain.Club;
import com.cricketlegend.domain.ClubStatus;
import com.cricketlegend.domain.Match;
import com.cricketlegend.domain.Season;
import com.cricketlegend.domain.Section;
import com.cricketlegend.domain.Team;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.Set;
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

    @Autowired
    private SectionRepository sectionRepository;

    @Autowired
    private TeamRepository teamRepository;

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
    void findByClubIdAndSectionIdInReturnsOnlyMatchesWithAnOwnClubTeamSideInTheGivenSectionsAndStillPages() {
        Club club = savedClub("riverside-cc");
        Season season = savedSeason(club.getId());
        Section juniors = sectionRepository.save(Section.builder().clubId(club.getId()).name("Juniors").active(true).build());
        Section open = sectionRepository.save(Section.builder().clubId(club.getId()).name("Open").active(true).build());
        Team juniorsTeam = teamRepository.save(
                Team.builder().clubId(club.getId()).sectionId(juniors.getId()).name("U15").active(true).build());
        Team openTeam = teamRepository.save(
                Team.builder().clubId(club.getId()).sectionId(open.getId()).name("1st XI").active(true).build());
        Instant now = Instant.now();
        Match inScopeHome = matchRepository.save(Match.builder().clubId(club.getId()).homeTeamId(juniorsTeam.getId())
                .awayTeamName("Away Occasionals").seasonId(season.getId()).matchDate(now).active(true).build());
        Match inScopeAway = matchRepository.save(Match.builder().clubId(club.getId()).homeTeamName("Home Occasionals")
                .awayTeamId(juniorsTeam.getId()).seasonId(season.getId()).matchDate(now.plus(1, ChronoUnit.DAYS))
                .active(true).build());
        matchRepository.save(Match.builder().clubId(club.getId()).homeTeamId(openTeam.getId())
                .awayTeamName("Away Occasionals").seasonId(season.getId()).matchDate(now).active(true).build());

        org.springframework.data.domain.Page<Match> firstPage = matchRepository.findByClubIdAndSectionIdIn(
                club.getId(), Set.of(juniors.getId()), org.springframework.data.domain.PageRequest.of(0, 1));

        assertThat(firstPage.getTotalElements()).isEqualTo(2);
        assertThat(firstPage.getContent()).hasSize(1);
        assertThat(firstPage.getTotalPages()).isEqualTo(2);
        org.springframework.data.domain.Page<Match> allMatches = matchRepository.findByClubIdAndSectionIdIn(
                club.getId(), Set.of(juniors.getId()), org.springframework.data.domain.PageRequest.of(0, 10));
        assertThat(allMatches.getContent()).extracting(Match::getId)
                .containsExactlyInAnyOrder(inScopeHome.getId(), inScopeAway.getId());
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
