package com.cricketlegend.architecture;

import com.cricketlegend.repository.MatchSpecifications;
import com.tngtech.archunit.base.DescribedPredicate;
import com.tngtech.archunit.core.domain.JavaCall;
import com.tngtech.archunit.core.domain.JavaClass;
import com.tngtech.archunit.core.domain.properties.HasName;
import com.tngtech.archunit.core.importer.ClassFileImporter;
import com.tngtech.archunit.core.importer.ImportOption;
import com.tngtech.archunit.lang.ArchRule;
import org.junit.jupiter.api.Test;

import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.classes;
import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noClasses;
import static com.tngtech.archunit.library.GeneralCodingRules.NO_CLASSES_SHOULD_ACCESS_STANDARD_STREAMS;

/**
 * Enforces backend.md's non-negotiables mechanically — see docs/standards/backend.md.
 * Trivially passes with zero controllers/services/repositories; starts catching
 * violations the moment real ones are added.
 */
class LayeringRulesTest {

    private static final com.tngtech.archunit.core.domain.JavaClasses CLASSES = new ClassFileImporter()
            .withImportOption(ImportOption.Predefined.DO_NOT_INCLUDE_TESTS)
            .importPackages("com.cricketlegend");

    @Test
    void controllersMustNotDependOnRepositories() {
        ArchRule rule = noClasses().that().resideInAPackage("..controller..")
                .should().dependOnClassesThat().resideInAPackage("..repository..")
                .allowEmptyShould(true);
        rule.check(CLASSES);
    }

    @Test
    void repositoriesMustNotDependOnControllers() {
        ArchRule rule = noClasses().that().resideInAPackage("..repository..")
                .should().dependOnClassesThat().resideInAPackage("..controller..")
                .allowEmptyShould(true);
        rule.check(CLASSES);
    }

    @Test
    void servicesMustBeInterfaceWithImplPattern() {
        ArchRule rule = classes().that().resideInAPackage("..service.impl..")
                .should().haveSimpleNameEndingWith("Impl")
                .andShould().beAnnotatedWith(org.springframework.stereotype.Service.class)
                .allowEmptyShould(true);
        rule.check(CLASSES);
    }

    @Test
    void noClassesAccessStandardStreams() {
        NO_CLASSES_SHOULD_ACCESS_STANDARD_STREAMS.check(CLASSES);
    }

    // ---- docs/specs/100-match-results-core.md: the publish gate, enforced structurally ----

    /** Origins allowed to use the unguarded, result-based Match specifications: manager paths only. */
    private static final DescribedPredicate<HasName> MANAGER_RESULT_QUERY_CALLERS = HasName.Predicates
            .nameMatching("com\\.cricketlegend\\."
                    + "(service\\.impl\\.(ResultServiceImpl|MatchServiceImpl)"
                    + "|repository\\.(MatchSpecifications|ResultVisibility))(\\$.*)?")
            .as("the manager results service, the manager Matches service, MatchSpecifications and ResultVisibility");

    private static final String RESULT_SPECIFICATIONS =
            "hasResult|noResult|resultStatus|resultOutcomeIn|wonByOwnSide|lostByOwnSide";

    @Test
    void noMatchResultAccessOutsideTheResultServices() {
        ArchRule rule = noClasses().that(DescribedPredicate.not(HasName.Predicates.nameMatching(ownersRegex())))
                .should().dependOnClassesThat().haveNameMatching(
                        "com\\.cricketlegend\\.(domain\\.(MatchResult|MatchInnings|ResultPlayer|BattingEntry|BowlingEntry"
                                + "|FieldingEntry|MatchAward)"
                                + "|repository\\.(MatchResultRepository|MatchInningsRepository|ResultPlayerRepository"
                                + "|BattingEntryRepository|BowlingEntryRepository|FieldingEntryRepository"
                                + "|MatchAwardRepository))(\\$.*)?")
                .allowEmptyShould(true);
        rule.check(CLASSES);
    }

    @Test
    void theResultDataOwnersAreExactlyWhoWeExpect() {
        // proves the rule above is not vacuous: these two really are the only users of the result repositories
        java.util.Set<String> users = CLASSES.stream()
                .filter(c -> c.getDirectDependenciesFromSelf().stream()
                        .anyMatch(d -> d.getTargetClass().getName().equals("com.cricketlegend.repository.MatchResultRepository")))
                .map(c -> c.getSimpleName())
                .filter(n -> !n.startsWith("MatchResultRepository"))
                .collect(java.util.stream.Collectors.toSet());
        org.assertj.core.api.Assertions.assertThat(users)
                .containsExactlyInAnyOrder("ResultServiceImpl", "ResultStatusResolver", "ScorecardServiceImpl");
    }

    @Test
    void resultBasedMatchQueriesAreOnlyUsedOnManagerPaths() {
        DescribedPredicate<JavaCall<?>> resultSpec = JavaCall.Predicates
                .target(HasName.Predicates.nameMatching(RESULT_SPECIFICATIONS))
                .and(JavaCall.Predicates.target(
                        com.tngtech.archunit.core.domain.properties.HasOwner.Predicates.With.owner(
                                JavaClass.Predicates.equivalentTo(MatchSpecifications.class))));
        ArchRule rule = noClasses().that(DescribedPredicate.not(MANAGER_RESULT_QUERY_CALLERS))
                .should().callMethodWhere(resultSpec)
                .because("a non-manager read path must go through ResultVisibility so a draft result is never visible")
                .allowEmptyShould(true);
        rule.check(CLASSES);
    }

    /** The only code allowed to touch the match_result / match_innings tables and entities, and (docs/specs/101) the scorecard's. */
    private static String ownersRegex() {
        return "com\\.cricketlegend\\."
                + "(service\\.impl\\.(ResultServiceImpl|ScorecardServiceImpl)"
                + "|service\\.support\\.(ResultStatusResolver|ScorecardRows)"
                + "|mapper\\.(MatchResultMapper|ScorecardMapper)(Impl)?"
                + "|domain\\.(MatchResult|MatchInnings|ResultPlayer|BattingEntry|BowlingEntry|FieldingEntry|MatchAward)"
                + "|repository\\.(MatchResultRepository|MatchInningsRepository|ResultPlayerRepository"
                + "|BattingEntryRepository|BowlingEntryRepository|FieldingEntryRepository|MatchAwardRepository"
                + "|PlayerStatsAggregateRepository|PlayerStatsFactsRepository"
                + "|TeamStatsAggregateRepository|TeamStatsFactsRepository"
                + "|MatchSpecifications|ResultVisibility))"
                + "(\\$.*)?";
    }

    // ---- docs/specs/103-player-stats.md: statistics are computed from published results by one set of classes ----

    private static final String STATS_REPOSITORIES =
            "com\\.cricketlegend\\.repository\\.(PlayerStatsAggregateRepository|PlayerStatsFactsRepository"
                    + "|TeamStatsAggregateRepository|TeamStatsFactsRepository)(\\$.*)?";

    /**
     * The statistics services and their two helpers that read a stats repository row type: the only classes that may
     * use the stats repositories.
     */
    private static final String STATS_SERVICES =
            "com\\.cricketlegend\\.service\\.(impl\\.(PlayerStatsServiceImpl|LeaderboardServiceImpl|PlayerMatchListServiceImpl|TeamStatsServiceImpl|PlayerDashboardServiceImpl|TeamDashboardServiceImpl)"
                    + "|support\\.(PlayerStatsCountersReader|StatsFilterOptionLists|PlayerMatchFactsReader|TeamStatsCountersReader|TeamStatsFactsReader|TeamDashboardFactsReader))(\\$.*)?";

    @Test
    void theStatsRepositoriesAreTouchedOnlyByTheStatsServices() {
        ArchRule rule = noClasses()
                .that(DescribedPredicate.not(HasName.Predicates.nameMatching(
                        STATS_SERVICES + "|" + STATS_REPOSITORIES
                                + "|com\\.cricketlegend\\.repository\\.(PlayerStatsSql|TeamStatsSql|StatsCountingSql)")))
                .should().dependOnClassesThat().haveNameMatching(STATS_REPOSITORIES)
                .because("the stats repositories read published results with their own copy of the publish gate (spec 103)")
                .allowEmptyShould(true);
        rule.check(CLASSES);
    }

    @Test
    void theStatsRepositoryUsersAreExactlyWhoWeExpect() {
        // proves the rule above is not vacuous: the statistics service really is a user of both repositories
        java.util.Set<String> users = CLASSES.stream()
                .filter(c -> c.getDirectDependenciesFromSelf().stream()
                        .anyMatch(d -> d.getTargetClass().getName().matches(STATS_REPOSITORIES)))
                .map(c -> c.getName())
                .filter(n -> !n.matches(STATS_REPOSITORIES))
                .collect(java.util.stream.Collectors.toSet());
        org.assertj.core.api.Assertions.assertThat(users)
                .containsExactlyInAnyOrder(
                        "com.cricketlegend.service.impl.PlayerStatsServiceImpl",
                        "com.cricketlegend.service.impl.LeaderboardServiceImpl",
                        "com.cricketlegend.service.impl.PlayerMatchListServiceImpl",
                        "com.cricketlegend.service.impl.TeamStatsServiceImpl",
                        "com.cricketlegend.service.impl.PlayerDashboardServiceImpl",
                        "com.cricketlegend.service.impl.TeamDashboardServiceImpl",
                        "com.cricketlegend.service.support.TeamDashboardFactsReader",
                        "com.cricketlegend.service.support.PlayerMatchFactsReader",
                        "com.cricketlegend.service.support.PlayerStatsCountersReader",
                        "com.cricketlegend.service.support.StatsFilterOptionLists",
                        "com.cricketlegend.service.support.TeamStatsCountersReader",
                        "com.cricketlegend.service.support.TeamStatsFactsReader");
    }

    /** The pure statistics classes: definitions and ranking that a player-facing route must be able to reuse. */
    private static final String PURE_STATS_CLASSES =
            "com\\.cricketlegend\\.service\\.support\\."
                    + "(PlayerStatsCalculator|PlayerStatsCounters|PlayerStatsFacts|StatsScope"
                    + "|LeaderboardRanker|LeaderboardTableRanker|LeaderboardColumn|LeaderboardQualification|LeaderboardBoard|LeaderboardInningsFact|LeaderboardPlayers|PlayerMatchRowBuilder"
                    + "|TeamStatsCalculator|TeamStatsCounters|TeamStatsColumn|TeamTableRanker"
                    + "|PlayerDashboardSeriesBuilder|TeamDashboardSeriesBuilder|StatsTrend|DashboardLimits)(\\$.*)?";

    @Test
    void thePureStatsClassesDependOnNoSpringRepositoryOrEntity() {
        ArchRule rule = noClasses().that().haveNameMatching(PURE_STATS_CLASSES)
                .should().dependOnClassesThat().resideInAnyPackage(
                        "org.springframework..", "..repository..", "..config..", "..service.impl..", "..controller..",
                        "jakarta.persistence..")
                .orShould().dependOnClassesThat().areAnnotatedWith(jakarta.persistence.Entity.class)
                .because("a figure is defined without any caller, access or storage information (spec 103)")
                .allowEmptyShould(true);
        rule.check(CLASSES);
    }

    @Test
    void thePureStatsClassesExist() {
        // proves the rule above is not vacuous: exactly the 20 named top-level classes plus their nested types (87 in all: 39 from specs 103 and 115, 33 for the team calculator, counters, column and ranker with their records and compiler-generated switch helpers, and 15 for spec 117's two series builders, trend and limits with the calculators' new records).
        // A new pure stats class (or nested type) must be added to PURE_STATS_CLASSES and to this count on purpose.
        long count = CLASSES.stream().filter(c -> c.getName().matches(PURE_STATS_CLASSES)).count();
        org.assertj.core.api.Assertions.assertThat(count).isEqualTo(87);
    }
}
