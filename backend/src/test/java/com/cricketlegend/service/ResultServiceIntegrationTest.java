package com.cricketlegend.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.cricketlegend.AbstractIntegrationTest;
import com.cricketlegend.domain.League;
import com.cricketlegend.domain.Match;
import com.cricketlegend.domain.MatchResult;
import com.cricketlegend.domain.MatchResultStatus;
import com.cricketlegend.domain.ResultMarginType;
import com.cricketlegend.domain.ResultOutcomeType;
import com.cricketlegend.domain.ResultSide;
import com.cricketlegend.domain.ResultStatus;
import com.cricketlegend.dto.InningsDto;
import com.cricketlegend.dto.MatchDto;
import com.cricketlegend.dto.MatchResultDto;
import com.cricketlegend.dto.ResultDraft;
import com.cricketlegend.dto.ResultListCriteria;
import com.cricketlegend.dto.ResultListItemDto;
import com.cricketlegend.exception.ResultPublishedException;
import com.cricketlegend.repository.MatchRepository;
import com.cricketlegend.repository.MatchResultRepository;
import com.cricketlegend.repository.ResultVisibility;
import com.cricketlegend.service.support.ResultStatusResolver;
import com.cricketlegend.support.ManagerOverviewFixtures;
import com.cricketlegend.support.ManagerOverviewFixtures.World;
import jakarta.persistence.EntityManagerFactory;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.hibernate.SessionFactory;
import org.hibernate.stat.Statistics;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.ApplicationContext;
import org.springframework.context.annotation.Import;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.core.Authentication;

/**
 * Service-tier integration tests for docs/specs/100-match-results-core.md, deliberately without an ambient
 * transaction (so {@code open-in-view=false} lazy loading and the per-call transaction boundaries are the real ones,
 * per backend.md): the full draft, publish, unpublish, delete life cycle, the publish gate ({@code ResultVisibility})
 * on repositories, the batched status resolver, section narrowing, the league default for the scheduled length, and a
 * statement-count guard on the Results list.
 */
@SpringBootTest(properties = "spring.jpa.properties.hibernate.generate_statistics=true")
@Import(AbstractIntegrationTest.class)
class ResultServiceIntegrationTest {

    private static final ResultListCriteria NO_FILTERS =
            new ResultListCriteria(null, null, null, null, null, null, null, null, null, null);

    @Autowired
    private ResultService resultService;

    @Autowired
    private MatchResultRepository resultRepository;

    @Autowired
    private MatchRepository matchRepository;

    @Autowired
    private ResultStatusResolver statusResolver;

    @Autowired
    private EntityManagerFactory entityManagerFactory;

    @Autowired
    private ApplicationContext context;

    @Autowired
    private JdbcTemplate jdbc;

    private ManagerOverviewFixtures fixtures;
    private final Authentication platformAdmin = new TestingAuthenticationToken("ops", "n/a", "ROLE_platform_admin");

    @BeforeEach
    void setUp() {
        fixtures = new ManagerOverviewFixtures(context);
    }

    @AfterEach
    void cleanUp() {
        fixtures.cleanUp();
    }

    private static InningsDto inn(ResultSide side, int runs, int wickets) {
        return new InningsDto(null, null, side, runs, wickets, 120, null, null, null);
    }

    private static ResultDraft homeWin() {
        return new ResultDraft(ResultOutcomeType.WON, null, ResultSide.HOME, ResultMarginType.RUNS, 50, null, null, null,
                null, null, null, null, null, List.of(inn(ResultSide.HOME, 200, 8), inn(ResultSide.AWAY, 150, 10)));
    }

    private Match pastMatch(World w, int daysAgo) {
        return fixtures.match(w, w.seniors1(), null, Instant.now().minus(Duration.ofDays(daysAgo)));
    }

    @Test
    void theWholeLifeCycleWorksOutsideAnyTransaction() {
        World w = fixtures.world();
        Match match = pastMatch(w, 1);
        UUID clubId = w.club().getId();

        MatchResultDto draft = resultService.upsertDraft(platformAdmin, clubId, match.getId(), homeWin());
        assertThat(draft.status()).isEqualTo(ResultStatus.DRAFT);
        assertThat(resultService.awaiting(platformAdmin, clubId, NO_FILTERS, false, PageRequest.of(0, 10))
                .getTotalElements()).isZero();

        Page<ResultListItemDto> list = resultService.list(platformAdmin, clubId, NO_FILTERS, PageRequest.of(0, 10));
        assertThat(list.getContent()).singleElement().satisfies(item -> {
            assertThat(item.match().resultStatus()).isEqualTo(MatchResultStatus.DRAFT);
            assertThat(item.result().innings()).hasSize(2);
        });

        MatchResultDto published = resultService.publish(platformAdmin, clubId, match.getId(), false);
        assertThat(published.status()).isEqualTo(ResultStatus.PUBLISHED);
        assertThat(published.publishedAt()).isNotNull();
        assertThatThrownBy(() -> resultService.deleteDraft(platformAdmin, clubId, match.getId()))
                .isInstanceOf(ResultPublishedException.class);

        MatchResultDto back = resultService.unpublish(platformAdmin, clubId, match.getId());
        assertThat(back.status()).isEqualTo(ResultStatus.DRAFT);
        assertThat(back.publishedAt()).isNull();

        resultService.deleteDraft(platformAdmin, clubId, match.getId());
        assertThat(resultRepository.findByMatchId(match.getId())).isEmpty();
        assertThat(resultService.awaiting(platformAdmin, clubId, NO_FILTERS, false, PageRequest.of(0, 10))
                .getTotalElements()).isEqualTo(1);
    }

    @Test
    void publishRecordsTheCallingPerson() {
        World w = fixtures.world();
        Match match = pastMatch(w, 1);
        String subject = fixtures.sectionManagerSubject(w.seniors());
        Authentication manager = new TestingAuthenticationToken(subject, "n/a");

        resultService.upsertDraft(manager, w.club().getId(), match.getId(), homeWin());
        resultService.publish(manager, w.club().getId(), match.getId(), false);

        MatchResult stored = resultRepository.findByMatchId(match.getId()).orElseThrow();
        UUID person = jdbc.queryForObject("select id from person where keycloak_user_id = ?", UUID.class, subject);
        assertThat(stored.getPublishedBy()).isEqualTo(person);
        assertThat(stored.getUpdatedBy()).isEqualTo(person);
    }

    @Test
    void theScheduledLengthDefaultsFromTheLeaguesPlayingConditions() {
        World w = fixtures.world();
        League league = fixtures.league(w, 11);
        fixtures.playingConditions(league, w.season()); // max 40 overs per innings
        Match match = fixtures.match(w, w.seniors1(), null, Instant.now().minus(Duration.ofDays(1)), true, league);
        ResultDraft emptyDraft = new ResultDraft(null, null, null, null, null, null, null, null, null, null, null, null,
                null, null);

        MatchResultDto saved = resultService.upsertDraft(platformAdmin, w.club().getId(), match.getId(), emptyDraft);

        assertThat(saved.scheduledBalls()).isEqualTo(240);
        // resaving with an explicit length keeps the explicit one
        ResultDraft explicit = new ResultDraft(null, null, null, null, null, null, null, 120, null, null, null, null,
                null, null);
        assertThat(resultService.upsertDraft(platformAdmin, w.club().getId(), match.getId(), explicit).scheduledBalls())
                .isEqualTo(120);
    }

    @Test
    void aSectionManagerIsRefusedForAMatchOutsideTheirSections() {
        World w = fixtures.world();
        Match seniors = pastMatch(w, 1);
        Authentication juniorsManager = new TestingAuthenticationToken(fixtures.sectionManagerSubject(w.juniors()), "n/a");

        assertThatThrownBy(() -> resultService.upsertDraft(juniorsManager, w.club().getId(), seniors.getId(), homeWin()))
                .isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(() -> resultService.get(juniorsManager, w.club().getId(), seniors.getId()))
                .isInstanceOf(AccessDeniedException.class);
        assertThat(resultRepository.findByMatchId(seniors.getId())).isEmpty();
    }

    // ---- the publish gate ----

    @Test
    void resultVisibilityHidesDraftsFromACallerWhoCannotCapture() {
        World w = fixtures.world();
        Match published = pastMatch(w, 3);
        Match draft = pastMatch(w, 2);
        Match none = pastMatch(w, 1);
        UUID clubId = w.club().getId();
        resultService.upsertDraft(platformAdmin, clubId, published.getId(), homeWin());
        resultService.publish(platformAdmin, clubId, published.getId(), false);
        resultService.upsertDraft(platformAdmin, clubId, draft.getId(), homeWin());

        List<UUID> visibleToPlayers = resultRepository.findAll(ResultVisibility.forCaller(false)).stream()
                .filter(r -> r.getClubId().equals(clubId)).map(MatchResult::getMatchId).toList();
        List<UUID> visibleToManagers = resultRepository.findAll(ResultVisibility.forCaller(true)).stream()
                .filter(r -> r.getClubId().equals(clubId)).map(MatchResult::getMatchId).toList();
        assertThat(visibleToPlayers).containsExactly(published.getId());
        assertThat(visibleToManagers).containsExactlyInAnyOrder(published.getId(), draft.getId());

        List<UUID> matchesForPlayers = matchRepository.findAll(ResultVisibility.matchesForCaller(false)).stream()
                .filter(m -> m.getClubId().equals(clubId)).map(Match::getId).toList();
        List<UUID> matchesForManagers = matchRepository.findAll(ResultVisibility.matchesForCaller(true)).stream()
                .filter(m -> m.getClubId().equals(clubId)).map(Match::getId).toList();
        assertThat(matchesForPlayers).containsExactly(published.getId());
        assertThat(matchesForManagers).containsExactlyInAnyOrder(published.getId(), draft.getId(), none.getId());
    }

    @Test
    void theStatusResolverAnswersForAWholePageInOneQuery() {
        World w = fixtures.world();
        Match published = pastMatch(w, 3);
        Match draft = pastMatch(w, 2);
        Match none = pastMatch(w, 1);
        resultService.upsertDraft(platformAdmin, w.club().getId(), published.getId(), homeWin());
        resultService.publish(platformAdmin, w.club().getId(), published.getId(), false);
        resultService.upsertDraft(platformAdmin, w.club().getId(), draft.getId(), homeWin());
        Statistics statistics = entityManagerFactory.unwrap(SessionFactory.class).getStatistics();
        statistics.clear();

        Map<UUID, MatchResultStatus> statuses =
                statusResolver.statusesFor(List.of(published.getId(), draft.getId(), none.getId()));

        assertThat(statuses).containsEntry(published.getId(), MatchResultStatus.PUBLISHED)
                .containsEntry(draft.getId(), MatchResultStatus.DRAFT)
                .doesNotContainKey(none.getId());
        assertThat(statistics.getPrepareStatementCount()).isEqualTo(1);
    }

    // ---- statement count ----

    private long listStatements(UUID clubId) {
        Statistics statistics = entityManagerFactory.unwrap(SessionFactory.class).getStatistics();
        statistics.clear();
        Page<ResultListItemDto> page = resultService.list(platformAdmin, clubId, NO_FILTERS, PageRequest.of(0, 50));
        assertThat(page.getContent()).isNotEmpty();
        return statistics.getPrepareStatementCount();
    }

    @Test
    void theResultsListIssuesTheSameNumberOfStatementsForAFewResultsAsForMany() {
        World small = seededClub(2);
        World large = seededClub(15);

        assertThat(listStatements(large.club().getId())).isEqualTo(listStatements(small.club().getId()));
    }

    private World seededClub(int size) {
        World w = fixtures.world();
        List<Match> matches = new ArrayList<>();
        for (int i = 0; i < size; i++) {
            matches.add(pastMatch(w, i + 1));
        }
        for (Match m : matches) {
            resultService.upsertDraft(platformAdmin, w.club().getId(), m.getId(), homeWin());
        }
        return w;
    }

    @Test
    void anInactiveMatchIsNeverOnTheAwaitingListAndCannotBeCaptured() {
        World w = fixtures.world();
        Match inactive = fixtures.match(w, w.seniors1(), null, Instant.now().minus(Duration.ofDays(1)), false, null);

        assertThat(resultService.awaiting(platformAdmin, w.club().getId(), NO_FILTERS, true, PageRequest.of(0, 10))
                .getContent()).extracting(MatchDto::id).doesNotContain(inactive.getId());
    }
}
