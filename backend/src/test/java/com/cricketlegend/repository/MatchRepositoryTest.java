package com.cricketlegend.repository;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.cricketlegend.AbstractIntegrationTest;
import com.cricketlegend.domain.Club;
import com.cricketlegend.domain.ClubStatus;
import com.cricketlegend.domain.League;
import com.cricketlegend.domain.LeagueSource;
import com.cricketlegend.domain.Match;
import com.cricketlegend.domain.MatchListFocus;
import com.cricketlegend.domain.Season;
import com.cricketlegend.domain.Section;
import com.cricketlegend.domain.Team;
import com.cricketlegend.dto.MatchFilterOptionsDto;
import com.cricketlegend.service.MatchService;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Optional;
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

    // --- 070: rewritten side CHECK constraints (league-team references) ---

    @Autowired
    private LeagueTeamRepository leagueTeamRepository;

    private UUID savedLeagueTeamId(Club club, Season season) {
        League league = leagueRepository.save(League.builder().clubId(club.getId()).name("Premier")
                .source(LeagueSource.INTERNAL).maxPlayingXiSize(11).active(true).build());
        return leagueTeamRepository.save(com.cricketlegend.domain.LeagueTeam.builder().leagueId(league.getId())
                        .seasonId(season.getId()).name("Riverside CC").active(true).build())
                .getId();
    }

    @Test
    void checkConstraintAcceptsAnOwnTeamAFreeTextAndANamedLeagueTeamSide() {
        Club club = savedClub("riverside-cc");
        Season season = savedSeason(club.getId());
        Section section = sectionRepository.save(Section.builder().clubId(club.getId()).name("Men").active(true).build());
        Team team = teamRepository.save(
                Team.builder().clubId(club.getId()).sectionId(section.getId()).name("1st XI").active(true).build());
        UUID leagueTeamId = savedLeagueTeamId(club, season);

        matchRepository.saveAndFlush(Match.builder().clubId(club.getId()).homeTeamId(team.getId())
                .awayTeamName("Free text").seasonId(season.getId()).matchDate(Instant.now()).active(true).build());
        matchRepository.saveAndFlush(Match.builder().clubId(club.getId()).homeTeamName("Riverside CC")
                .homeLeagueTeamId(leagueTeamId).awayTeamId(team.getId()).seasonId(season.getId())
                .matchDate(Instant.now()).active(true).build());
        matchRepository.saveAndFlush(Match.builder().clubId(club.getId()).homeTeamName("Free text")
                .awayTeamName("Riverside CC").awayLeagueTeamId(leagueTeamId).seasonId(season.getId())
                .matchDate(Instant.now()).active(true).build());
    }

    @Test
    void checkConstraintRejectsALeagueTeamIdAlongsideATeamIdOnTheHomeSide() {
        Club club = savedClub("riverside-cc");
        Season season = savedSeason(club.getId());
        Section section = sectionRepository.save(Section.builder().clubId(club.getId()).name("Men").active(true).build());
        Team team = teamRepository.save(
                Team.builder().clubId(club.getId()).sectionId(section.getId()).name("1st XI").active(true).build());
        UUID leagueTeamId = savedLeagueTeamId(club, season);
        Match invalid = Match.builder().clubId(club.getId()).homeTeamId(team.getId()).homeLeagueTeamId(leagueTeamId)
                .awayTeamName("Away").seasonId(season.getId()).matchDate(Instant.now()).active(true).build();

        assertThatThrownBy(() -> matchRepository.saveAndFlush(invalid))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void checkConstraintRejectsALeagueTeamIdWithNoNameOnTheAwaySide() {
        Club club = savedClub("riverside-cc");
        Season season = savedSeason(club.getId());
        UUID leagueTeamId = savedLeagueTeamId(club, season);
        Match invalid = Match.builder().clubId(club.getId()).homeTeamName("Home").awayLeagueTeamId(leagueTeamId)
                .seasonId(season.getId()).matchDate(Instant.now()).active(true).build();

        assertThatThrownBy(() -> matchRepository.saveAndFlush(invalid))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void checkConstraintStillRejectsATeamIdWithANameOnTheAwaySide() {
        Club club = savedClub("riverside-cc");
        Season season = savedSeason(club.getId());
        Section section = sectionRepository.save(Section.builder().clubId(club.getId()).name("Men").active(true).build());
        Team team = teamRepository.save(
                Team.builder().clubId(club.getId()).sectionId(section.getId()).name("1st XI").active(true).build());
        Match teamIdAndName = Match.builder().clubId(club.getId()).homeTeamName("Home")
                .awayTeamId(team.getId()).awayTeamName("Away").seasonId(season.getId())
                .matchDate(Instant.now()).active(true).build();

        assertThatThrownBy(() -> matchRepository.saveAndFlush(teamIdAndName))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void checkConstraintStillRejectsAnAwaySideWithNeitherATeamIdNorAName() {
        Club club = savedClub("riverside-cc");
        Season season = savedSeason(club.getId());
        Match neither = Match.builder().clubId(club.getId()).homeTeamName("Home").seasonId(season.getId())
                .matchDate(Instant.now()).active(true).build();

        assertThatThrownBy(() -> matchRepository.saveAndFlush(neither))
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

    // 070: a league-team side (teamId null, name copied) is still an external opponent for the
    // search and team/section filters.
    @Test
    void searchMatchesSpecificationMatchesALeagueTeamSidesCopiedName() {
        Club club = savedClub("riverside-cc");
        Season season = savedSeason(club.getId());
        UUID leagueTeamId = savedLeagueTeamId(club, season);
        Match leagueTeamMatch = matchRepository.save(Match.builder().clubId(club.getId())
                .homeTeamName("Home Occasionals").awayTeamName("Hillside Hawks").awayLeagueTeamId(leagueTeamId)
                .seasonId(season.getId()).matchDate(Instant.now()).active(true).build());
        matchRepository.save(Match.builder().clubId(club.getId()).homeTeamName("Wanderers")
                .awayTeamName("Nomads").seasonId(season.getId()).matchDate(Instant.now()).active(true).build());

        Specification<Match> spec = Specification.where(MatchSpecifications.clubId(club.getId()))
                .and(MatchSpecifications.searchMatches("HAWKS"));
        Page<Match> result = matchRepository.findAll(spec, PageRequest.of(0, 10));

        assertThat(result.getContent()).extracting(Match::getId).containsExactly(leagueTeamMatch.getId());
    }

    @Test
    void teamAndSectionFiltersMatchOnlyRealTeamIdsAndNeverALeagueTeamSide() {
        Club club = savedClub("riverside-cc");
        Season season = savedSeason(club.getId());
        Section section = sectionRepository.save(Section.builder().clubId(club.getId()).name("Men").active(true).build());
        Team team = teamRepository.save(
                Team.builder().clubId(club.getId()).sectionId(section.getId()).name("1st XI").active(true).build());
        UUID leagueTeamId = savedLeagueTeamId(club, season);
        Match ownVsLeagueTeam = matchRepository.save(Match.builder().clubId(club.getId()).homeTeamId(team.getId())
                .awayTeamName("Hillside Hawks").awayLeagueTeamId(leagueTeamId).seasonId(season.getId())
                .matchDate(Instant.now()).active(true).build());
        matchRepository.save(Match.builder().clubId(club.getId()).homeTeamName("Wanderers")
                .homeLeagueTeamId(leagueTeamId).awayTeamName("Nomads").seasonId(season.getId())
                .matchDate(Instant.now()).active(true).build());

        Page<Match> byTeam = matchRepository.findAll(Specification.where(MatchSpecifications.clubId(club.getId()))
                .and(MatchSpecifications.teamIdEquals(team.getId())), PageRequest.of(0, 10));
        // A league team's id is not a team id: it must match nothing in the team filter.
        Page<Match> byLeagueTeamIdAsTeamId = matchRepository.findAll(
                Specification.where(MatchSpecifications.clubId(club.getId()))
                        .and(MatchSpecifications.teamIdEquals(leagueTeamId)), PageRequest.of(0, 10));
        // The league-team-only match contributes nothing to the section filter either.
        Page<Match> bySection = matchRepository.findAll(Specification.where(MatchSpecifications.clubId(club.getId()))
                .and(MatchSpecifications.sectionIn(Set.of(section.getId()))), PageRequest.of(0, 10));

        assertThat(byTeam.getContent()).extracting(Match::getId).containsExactly(ownVsLeagueTeam.getId());
        assertThat(byLeagueTeamIdAsTeamId.getContent()).isEmpty();
        assertThat(bySection.getContent()).extracting(Match::getId).containsExactly(ownVsLeagueTeam.getId());
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
                PLATFORM_ADMIN, club.getId(), null, null, null, null, "Alpha", false);

        assertThat(result.sectionIds()).containsExactly(sectionA.getId());
        assertThat(result.leagueIds()).containsExactly(leagueA.getId());
        assertThat(result.seasonIds()).containsExactly(seasonA.getId());
        assertThat(result.teamIds()).containsExactlyInAnyOrder(teamAlpha.getId(), teamBeta.getId());
    }

    // --- 064: findUpcomingMatchesBySection (squad-mode predicate dropped) ---

    @Test
    void findUpcomingMatchesBySectionReturnsFutureMatchesOfEveryTeamInThatSection() {
        Club club = savedClub("riverside-cc");
        Season season = savedSeason(club.getId());
        Section juniors = sectionRepository.save(Section.builder().clubId(club.getId()).name("Juniors").active(true).build());
        Section seniors = sectionRepository.save(Section.builder().clubId(club.getId()).name("Seniors").active(true).build());
        Team juniorTeamA = teamRepository.save(Team.builder().clubId(club.getId()).sectionId(juniors.getId())
                .name("U15 Colts").active(true).build());
        Team juniorTeamB = teamRepository.save(Team.builder().clubId(club.getId()).sectionId(juniors.getId())
                .name("U15 Panthers").active(true).build());
        Team seniorTeam = teamRepository.save(Team.builder().clubId(club.getId()).sectionId(seniors.getId())
                .name("1st XI").active(true).build());
        Instant now = Instant.now();

        Match futureA = matchRepository.save(Match.builder().clubId(club.getId())
                .homeTeamId(juniorTeamA.getId()).awayTeamName("Occasionals").seasonId(season.getId())
                .matchDate(now.plus(2, ChronoUnit.DAYS)).active(true).build());
        Match futureB = matchRepository.save(Match.builder().clubId(club.getId())
                .awayTeamId(juniorTeamB.getId()).homeTeamName("Occasionals").seasonId(season.getId())
                .matchDate(now.plus(3, ChronoUnit.DAYS)).active(true).build());
        // Past — excluded.
        matchRepository.save(Match.builder().clubId(club.getId())
                .homeTeamId(juniorTeamA.getId()).awayTeamName("Occasionals").seasonId(season.getId())
                .matchDate(now.minus(2, ChronoUnit.DAYS)).active(true).build());
        // Future, but a different section — excluded.
        matchRepository.save(Match.builder().clubId(club.getId())
                .homeTeamId(seniorTeam.getId()).awayTeamName("Occasionals").seasonId(season.getId())
                .matchDate(now.plus(1, ChronoUnit.DAYS)).active(true).build());

        List<Match> result = matchRepository.findUpcomingMatchesBySection(club.getId(), juniors.getId(), now);

        assertThat(result).extracting(Match::getId).containsExactly(futureA.getId(), futureB.getId());
    }

    // --- 071: summariseByLeagueForSeason ---

    private League savedLeague(UUID clubId, String name) {
        return leagueRepository.save(League.builder().clubId(clubId).name(name).source(LeagueSource.INTERNAL)
                .maxPlayingXiSize(11).active(true).build());
    }

    private Match leagueMatch(UUID clubId, UUID seasonId, UUID leagueId, Instant matchDate, boolean active) {
        return matchRepository.save(Match.builder().clubId(clubId).homeTeamName("Home").awayTeamName("Away")
                .leagueId(leagueId).seasonId(seasonId).matchDate(matchDate).active(active).build());
    }

    private MatchRepository.LeagueMatchSummary summaryFor(
            List<MatchRepository.LeagueMatchSummary> rows, UUID leagueId) {
        return rows.stream().filter(r -> r.getLeagueId().equals(leagueId)).findFirst().orElseThrow();
    }

    @Test
    void summariseCountsOnlyActiveMatchesOfTheStatedClubSeasonAndLeagueAndIgnoresNoLeagueMatches() {
        Club club = savedClub("riverside-cc");
        Club otherClub = savedClub("lakeside-cc");
        Season season = savedSeason(club.getId());
        Season otherSeason = savedSeason(club.getId());
        Season otherClubSeason = savedSeason(otherClub.getId());
        League league = savedLeague(club.getId(), "Premier");
        League otherLeague = savedLeague(club.getId(), "Cup");
        League otherClubLeague = savedLeague(otherClub.getId(), "Premier");
        Instant now = Instant.now().truncatedTo(ChronoUnit.SECONDS);
        leagueMatch(club.getId(), season.getId(), league.getId(), now.plus(1, ChronoUnit.DAYS), true);
        leagueMatch(club.getId(), season.getId(), league.getId(), now.minus(1, ChronoUnit.DAYS), true);
        leagueMatch(club.getId(), season.getId(), league.getId(), now.plus(2, ChronoUnit.DAYS), false);
        leagueMatch(club.getId(), otherSeason.getId(), league.getId(), now.plus(3, ChronoUnit.DAYS), true);
        leagueMatch(club.getId(), season.getId(), otherLeague.getId(), now.plus(4, ChronoUnit.DAYS), true);
        leagueMatch(otherClub.getId(), otherClubSeason.getId(), otherClubLeague.getId(), now, true);
        leagueMatch(club.getId(), season.getId(), null, now.plus(5, ChronoUnit.DAYS), true);

        List<MatchRepository.LeagueMatchSummary> rows =
                matchRepository.summariseByLeagueForSeason(club.getId(), season.getId(), now);

        assertThat(rows).extracting(MatchRepository.LeagueMatchSummary::getLeagueId)
                .containsExactlyInAnyOrder(league.getId(), otherLeague.getId());
        MatchRepository.LeagueMatchSummary summary = summaryFor(rows, league.getId());
        assertThat(summary.getMatchCount()).isEqualTo(2);
        assertThat(summary.getPlayedCount()).isEqualTo(1);
        assertThat(summaryFor(rows, otherLeague.getId()).getMatchCount()).isEqualTo(1);
    }

    @Test
    void summariseTreatsAMatchExactlyAtNowAsToGoAndTheNextMatch() {
        Club club = savedClub("riverside-cc");
        Season season = savedSeason(club.getId());
        League league = savedLeague(club.getId(), "Premier");
        Instant now = Instant.now().truncatedTo(ChronoUnit.SECONDS);
        leagueMatch(club.getId(), season.getId(), league.getId(), now.minus(1, ChronoUnit.DAYS), true);
        leagueMatch(club.getId(), season.getId(), league.getId(), now, true);
        leagueMatch(club.getId(), season.getId(), league.getId(), now.plus(7, ChronoUnit.DAYS), true);

        MatchRepository.LeagueMatchSummary summary = summaryFor(
                matchRepository.summariseByLeagueForSeason(club.getId(), season.getId(), now), league.getId());

        assertThat(summary.getMatchCount()).isEqualTo(3);
        assertThat(summary.getPlayedCount()).isEqualTo(1);
        assertThat(summary.getNextMatchDate()).isEqualTo(now);
        assertThat(summary.getFirstMatchDate()).isEqualTo(now.minus(1, ChronoUnit.DAYS));
        assertThat(summary.getLastMatchDate()).isEqualTo(now.plus(7, ChronoUnit.DAYS));
    }

    @Test
    void summariseHandlesAllPastAllFutureAndASingleMatchAndGroupsLeaguesInOneCall() {
        Club club = savedClub("riverside-cc");
        Season season = savedSeason(club.getId());
        League allPast = savedLeague(club.getId(), "Past");
        League allFuture = savedLeague(club.getId(), "Future");
        League single = savedLeague(club.getId(), "Single");
        Instant now = Instant.now().truncatedTo(ChronoUnit.SECONDS);
        Instant pastOne = now.minus(10, ChronoUnit.DAYS);
        Instant pastTwo = now.minus(3, ChronoUnit.DAYS);
        Instant futureOne = now.plus(3, ChronoUnit.DAYS);
        Instant futureTwo = now.plus(10, ChronoUnit.DAYS);
        leagueMatch(club.getId(), season.getId(), allPast.getId(), pastOne, true);
        leagueMatch(club.getId(), season.getId(), allPast.getId(), pastTwo, true);
        leagueMatch(club.getId(), season.getId(), allFuture.getId(), futureTwo, true);
        leagueMatch(club.getId(), season.getId(), allFuture.getId(), futureOne, true);
        leagueMatch(club.getId(), season.getId(), single.getId(), futureOne, true);

        List<MatchRepository.LeagueMatchSummary> rows =
                matchRepository.summariseByLeagueForSeason(club.getId(), season.getId(), now);

        assertThat(rows).hasSize(3);
        MatchRepository.LeagueMatchSummary past = summaryFor(rows, allPast.getId());
        assertThat(past.getPlayedCount()).isEqualTo(2);
        assertThat(past.getNextMatchDate()).isNull();
        assertThat(past.getFirstMatchDate()).isEqualTo(pastOne);
        assertThat(past.getLastMatchDate()).isEqualTo(pastTwo);
        MatchRepository.LeagueMatchSummary future = summaryFor(rows, allFuture.getId());
        assertThat(future.getPlayedCount()).isZero();
        assertThat(future.getNextMatchDate()).isEqualTo(futureOne);
        assertThat(future.getFirstMatchDate()).isEqualTo(futureOne);
        assertThat(future.getLastMatchDate()).isEqualTo(futureTwo);
        MatchRepository.LeagueMatchSummary one = summaryFor(rows, single.getId());
        assertThat(one.getMatchCount()).isEqualTo(1);
        assertThat(one.getFirstMatchDate()).isEqualTo(one.getLastMatchDate());
        assertThat(one.getNextMatchDate()).isEqualTo(futureOne);
    }
    // docs/specs/076-team-selection.md: the window query behind MatchSlots' slot-collision check.
    @Test
    void findActiveInWindowReturnsOnlyTheClubsActiveMatchesInAHalfOpenRange() {
        Club club = savedClub("riverside-cc");
        Club otherClub = savedClub("hillside-cc");
        Season season = savedSeason(club.getId());
        Season otherSeason = savedSeason(otherClub.getId());
        Instant from = Instant.parse("2026-06-01T00:00:00Z");
        Instant to = Instant.parse("2026-06-08T00:00:00Z");
        Match atFrom = matchRepository.save(match(club.getId(), season.getId(), from));
        Match inside = matchRepository.save(match(club.getId(), season.getId(), from.plus(3, ChronoUnit.DAYS)));
        matchRepository.save(match(club.getId(), season.getId(), to));
        matchRepository.save(match(club.getId(), season.getId(), from.minusSeconds(1)));
        matchRepository.save(match(otherClub.getId(), otherSeason.getId(), from.plus(3, ChronoUnit.DAYS)));
        Match deactivated = match(club.getId(), season.getId(), from.plus(2, ChronoUnit.DAYS));
        deactivated.setActive(false);
        matchRepository.save(deactivated);

        List<Match> found = matchRepository.findActiveInWindow(club.getId(), from, to);

        assertThat(found).extracting(Match::getId).containsExactlyInAnyOrder(atFrom.getId(), inside.getId());
    }
    // ---- docs/specs/087-matches-polls-alignment.md: the Matches quick filters ----

    @Test
    void thisWeekFocusIncludesTheStartInstantExcludesTheEndInstantAndSkipsInactiveMatches() {
        Club club = savedClub("riverside-cc");
        Season season = savedSeason(club.getId());
        Instant start = Instant.parse("2031-03-03T00:00:00Z");
        Instant end = start.plus(7, ChronoUnit.DAYS);
        Match atStart = matchRepository.save(match(club.getId(), season.getId(), start));
        Match lastMoment = matchRepository.save(match(club.getId(), season.getId(), end.minusSeconds(1)));
        matchRepository.save(match(club.getId(), season.getId(), end)); // the half-open end
        matchRepository.save(match(club.getId(), season.getId(), start.minusSeconds(1))); // yesterday
        Match inactive = match(club.getId(), season.getId(), start.plus(1, ChronoUnit.DAYS));
        inactive.setActive(false);
        matchRepository.save(inactive);

        List<Match> found = matchRepository.findAll(
                MatchSpecifications.focus(MatchListFocus.THIS_WEEK, club.getId(), Optional.empty(), start, end));

        assertThat(found).extracting(Match::getId).containsExactlyInAnyOrder(atStart.getId(), lastMoment.getId());
    }

    @Test
    void teamIdOnForListMatchesTheTeamOnEitherSideAndComposesWithTheOtherFilters() {
        Club club = savedClub("riverside-cc");
        Season season = savedSeason(club.getId());
        Section section = sectionRepository.save(Section.builder().clubId(club.getId()).name("Open").active(true).build());
        Team first = teamRepository.save(Team.builder().clubId(club.getId()).sectionId(section.getId()).name("1st XI").active(true).build());
        Team second = teamRepository.save(Team.builder().clubId(club.getId()).sectionId(section.getId()).name("2nd XI").active(true).build());
        Instant now = Instant.now();
        Match derby = matchRepository.save(Match.builder().clubId(club.getId()).homeTeamId(first.getId())
                .awayTeamId(second.getId()).seasonId(season.getId()).matchDate(now).active(true).build());
        Match secondAway = matchRepository.save(Match.builder().clubId(club.getId()).homeTeamName("Away Occasionals")
                .awayTeamId(second.getId()).seasonId(season.getId()).matchDate(now).active(true).build());
        matchRepository.save(Match.builder().clubId(club.getId()).homeTeamId(first.getId())
                .awayTeamName("Home Occasionals").seasonId(season.getId()).matchDate(now).active(true).build());

        List<Match> found = matchRepository.findAll(
                MatchSpecifications.forList(club.getId(), Optional.empty(), null, null, null, second.getId(), null));
        List<Match> narrowed = matchRepository.findAll(
                MatchSpecifications.forList(club.getId(), Optional.empty(), null, null, null, second.getId(), "away"));

        assertThat(found).extracting(Match::getId).containsExactlyInAnyOrder(derby.getId(), secondAway.getId());
        assertThat(narrowed).extracting(Match::getId).containsExactly(secondAway.getId());
    }
}
