package com.cricketlegend.repository;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.cricketlegend.AbstractIntegrationTest;
import com.cricketlegend.domain.Club;
import com.cricketlegend.domain.ClubStatus;
import com.cricketlegend.domain.League;
import com.cricketlegend.domain.LeagueSource;
import com.cricketlegend.domain.Match;
import com.cricketlegend.domain.Season;
import com.cricketlegend.domain.Section;
import com.cricketlegend.domain.Team;
import com.cricketlegend.dto.MatchFilterOptionsDto;
import com.cricketlegend.service.MatchService;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
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

    @Autowired
    private LeagueRepository leagueRepository;

    @Autowired
    private MatchService matchService;

    // canAdministerClub(...) short-circuits true on ROLE_platform_admin before ever touching
    // Person/RoleAssignment — no DB fixture needed to exercise the unrestricted (Optional.empty())
    // path these tests want.
    private static final Authentication PLATFORM_ADMIN =
            new TestingAuthenticationToken("platform-admin", "n/a", List.of(new SimpleGrantedAuthority("ROLE_platform_admin")));

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

    // --- 042: MatchSpecifications ---

    @Test
    void sectionInSpecificationProducesTheSameResultAsTheExistingSectionFilteredJpqlQuery() {
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

        Specification<Match> spec = Specification.where(MatchSpecifications.clubId(club.getId()))
                .and(MatchSpecifications.sectionIn(Set.of(juniors.getId())));
        Page<Match> viaSpecification = matchRepository.findAll(spec, PageRequest.of(0, 10));
        Page<Match> viaExistingJpql =
                matchRepository.findByClubIdAndSectionIdIn(club.getId(), Set.of(juniors.getId()), PageRequest.of(0, 10));

        assertThat(viaSpecification.getContent()).extracting(Match::getId)
                .containsExactlyInAnyOrderElementsOf(
                        viaExistingJpql.getContent().stream().map(Match::getId).toList());
        assertThat(viaSpecification.getContent()).extracting(Match::getId)
                .containsExactlyInAnyOrder(inScopeHome.getId(), inScopeAway.getId());
    }

    @Test
    void searchMatchesSpecificationMatchesARealTeamNameCaseInsensitively() {
        Club club = savedClub("riverside-cc");
        Season season = savedSeason(club.getId());
        Section section = sectionRepository.save(Section.builder().clubId(club.getId()).name("Open").active(true).build());
        Team riverside = teamRepository.save(
                Team.builder().clubId(club.getId()).sectionId(section.getId()).name("Riverside 1st XI").active(true).build());
        Match matchWithRealTeam = matchRepository.save(Match.builder().clubId(club.getId())
                .homeTeamId(riverside.getId()).awayTeamName("Away Occasionals").seasonId(season.getId())
                .matchDate(Instant.now()).active(true).build());
        matchRepository.save(match(club.getId(), season.getId(), Instant.now()));

        Specification<Match> spec = Specification.where(MatchSpecifications.clubId(club.getId()))
                .and(MatchSpecifications.searchMatches("RIVERSIDE"));
        Page<Match> result = matchRepository.findAll(spec, PageRequest.of(0, 10));

        assertThat(result.getContent()).extracting(Match::getId).containsExactly(matchWithRealTeam.getId());
    }

    @Test
    void searchMatchesSpecificationMatchesAFreeTextOpponentNameCaseInsensitively() {
        Club club = savedClub("riverside-cc");
        Season season = savedSeason(club.getId());
        Match freeTextMatch = matchRepository.save(Match.builder().clubId(club.getId())
                .homeTeamName("Sunday Occasionals").awayTeamName("Away Occasionals").seasonId(season.getId())
                .matchDate(Instant.now()).active(true).build());
        matchRepository.save(Match.builder().clubId(club.getId()).homeTeamName("Wanderers")
                .awayTeamName("Nomads").seasonId(season.getId()).matchDate(Instant.now()).active(true).build());

        Specification<Match> spec = Specification.where(MatchSpecifications.clubId(club.getId()))
                .and(MatchSpecifications.searchMatches("sunday"));
        Page<Match> result = matchRepository.findAll(spec, PageRequest.of(0, 10));

        assertThat(result.getContent()).extracting(Match::getId).containsExactly(freeTextMatch.getId());
    }

    @Test
    void leagueIdEqualsAndSeasonIdEqualsSpecificationsFilterCorrectly() {
        Club club = savedClub("riverside-cc");
        Season seasonA = savedSeason(club.getId());
        Season seasonB = seasonRepository.save(Season.builder().clubId(club.getId()).label("2027")
                .startDate(LocalDate.of(2027, 1, 1)).endDate(LocalDate.of(2027, 12, 31)).active(true).build());
        League league = leagueRepository.save(League.builder().clubId(club.getId()).name("Premier League")
                .source(LeagueSource.INTERNAL).maxPlayingXiSize(11).active(true).build());

        Match inLeagueAndSeasonA = matchRepository.save(Match.builder().clubId(club.getId())
                .homeTeamName("Home").awayTeamName("Away").leagueId(league.getId()).seasonId(seasonA.getId())
                .matchDate(Instant.now()).active(true).build());
        matchRepository.save(match(club.getId(), seasonA.getId(), Instant.now())); // no league
        matchRepository.save(Match.builder().clubId(club.getId()).homeTeamName("Home2").awayTeamName("Away2")
                .leagueId(league.getId()).seasonId(seasonB.getId()).matchDate(Instant.now()).active(true).build());

        Specification<Match> spec = Specification.where(MatchSpecifications.clubId(club.getId()))
                .and(MatchSpecifications.leagueIdEquals(league.getId()))
                .and(MatchSpecifications.seasonIdEquals(seasonA.getId()));
        Page<Match> result = matchRepository.findAll(spec, PageRequest.of(0, 10));

        assertThat(result.getContent()).extracting(Match::getId).containsExactly(inLeagueAndSeasonA.getId());
    }

    @Test
    void allFiltersCombinedTogetherNarrowToExactlyTheMatchingMatch() {
        Club club = savedClub("riverside-cc");
        Season season = savedSeason(club.getId());
        Section juniors = sectionRepository.save(Section.builder().clubId(club.getId()).name("Juniors").active(true).build());
        Team juniorsTeam = teamRepository.save(
                Team.builder().clubId(club.getId()).sectionId(juniors.getId()).name("Juniors Riverside").active(true).build());
        League league = leagueRepository.save(League.builder().clubId(club.getId()).name("Junior League")
                .source(LeagueSource.INTERNAL).maxPlayingXiSize(11).active(true).build());
        Instant tomorrow = Instant.now().plus(1, ChronoUnit.DAYS);

        Match matching = matchRepository.save(Match.builder().clubId(club.getId()).homeTeamId(juniorsTeam.getId())
                .awayTeamName("Away Occasionals").leagueId(league.getId()).seasonId(season.getId())
                .matchDate(tomorrow).active(true).build());
        // Wrong league — excluded.
        matchRepository.save(Match.builder().clubId(club.getId()).homeTeamId(juniorsTeam.getId())
                .awayTeamName("Away Occasionals").seasonId(season.getId()).matchDate(tomorrow).active(true).build());

        Specification<Match> spec = Specification.where(MatchSpecifications.clubId(club.getId()))
                .and(MatchSpecifications.sectionIn(Set.of(juniors.getId())))
                .and(MatchSpecifications.matchDateOnOrAfter(Instant.now()))
                .and(MatchSpecifications.leagueIdEquals(league.getId()))
                .and(MatchSpecifications.seasonIdEquals(season.getId()))
                .and(MatchSpecifications.searchMatches("riverside"));
        Page<Match> result = matchRepository.findAll(spec, PageRequest.of(0, 10));

        assertThat(result.getContent()).extracting(Match::getId).containsExactly(matching.getId());
    }

    /**
     * Per docs/specs/042-match-list-filters-and-search.md's Search-autocomplete narrowing fix and
     * standards-reviewer finding: {@code MatchServiceImpl.filterOptions()} deliberately omits
     * {@code search} from the specification it builds for {@code teamIds} (to avoid the
     * autocomplete suggestion list narrowing itself out as the admin types), while genuinely
     * applying it to {@code sectionIds}/{@code leagueIds}/{@code seasonIds}. Exercises the real
     * {@link MatchService} bean end to end (not just {@link MatchSpecifications} in isolation) —
     * only a real narrowed-vs-unnarrowed comparison against actual saved rows can prove the
     * service wires {@code search} into three of the four arrays and not the fourth.
     */
    @Test
    void filterOptionsTeamIdsIgnoresSearchWhileSectionLeagueAndSeasonIdsAreNarrowedByIt() {
        Club club = savedClub("riverside-cc");
        Season seasonA = savedSeason(club.getId());
        Season seasonB = seasonRepository.save(Season.builder().clubId(club.getId()).label("2027")
                .startDate(LocalDate.of(2027, 1, 1)).endDate(LocalDate.of(2027, 12, 31)).active(true).build());
        Section sectionA = sectionRepository.save(Section.builder().clubId(club.getId()).name("Section A").active(true).build());
        Section sectionB = sectionRepository.save(Section.builder().clubId(club.getId()).name("Section B").active(true).build());
        Team teamAlpha = teamRepository.save(
                Team.builder().clubId(club.getId()).sectionId(sectionA.getId()).name("Alpha").active(true).build());
        Team teamBeta = teamRepository.save(
                Team.builder().clubId(club.getId()).sectionId(sectionB.getId()).name("Beta").active(true).build());
        League leagueA = leagueRepository.save(League.builder().clubId(club.getId()).name("League A")
                .source(LeagueSource.INTERNAL).maxPlayingXiSize(11).active(true).build());
        League leagueB = leagueRepository.save(League.builder().clubId(club.getId()).name("League B")
                .source(LeagueSource.INTERNAL).maxPlayingXiSize(11).active(true).build());

        matchRepository.save(Match.builder().clubId(club.getId()).homeTeamId(teamAlpha.getId())
                .awayTeamName("Occasionals A").leagueId(leagueA.getId()).seasonId(seasonA.getId())
                .matchDate(Instant.now()).active(true).build());
        matchRepository.save(Match.builder().clubId(club.getId()).homeTeamId(teamBeta.getId())
                .awayTeamName("Occasionals B").leagueId(leagueB.getId()).seasonId(seasonB.getId())
                .matchDate(Instant.now()).active(true).build());

        MatchFilterOptionsDto result = matchService.filterOptions(
                PLATFORM_ADMIN, club.getId(), null, null, null, "Alpha", false);

        assertThat(result.sectionIds()).containsExactly(sectionA.getId());
        assertThat(result.leagueIds()).containsExactly(leagueA.getId());
        assertThat(result.seasonIds()).containsExactly(seasonA.getId());
        assertThat(result.teamIds()).containsExactlyInAnyOrder(teamAlpha.getId(), teamBeta.getId());
    }
}
