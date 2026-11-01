package com.cricketlegend.architecture;

import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.classes;
import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noClasses;
import static org.assertj.core.api.Assertions.assertThat;

import com.tngtech.archunit.core.domain.JavaClass;
import com.tngtech.archunit.core.domain.JavaClasses;
import com.tngtech.archunit.core.importer.ClassFileImporter;
import com.tngtech.archunit.core.importer.ImportOption;
import java.util.Set;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;

/**
 * docs/specs/132-match-scheduling-rules.md: the own-team and venue rules ({@code ScheduleOverlapRules}) are applied by
 * the import validator and by {@code MatchScheduleRulesImpl} only, so a route that saves a match cannot grow a rule of
 * its own, and every manual route reaches the rules through {@code MatchScheduleRules}.
 */
class ScheduleRuleBypassTest {

    private static final JavaClasses CLASSES = new ClassFileImporter()
            .withImportOption(ImportOption.Predefined.DO_NOT_INCLUDE_TESTS)
            .importPackages("com.cricketlegend");

    private static final String OVERLAP = "com.cricketlegend.service.support.schedule.ScheduleOverlapRules";
    private static final String VALIDATOR = "com.cricketlegend.service.support.schedule.LeagueScheduleValidator";
    private static final String RULES_IMPL = "com.cricketlegend.service.impl.MatchScheduleRulesImpl";

    @Test
    void onlyTheValidatorAndMatchScheduleRulesUseTheOverlapRules() {
        String allowed = Set.of(OVERLAP, VALIDATOR, RULES_IMPL).stream()
                .map(n -> n.replace(".", "\\.") + "(\\$.*)?").collect(Collectors.joining("|"));
        noClasses().that().haveNameNotMatching(allowed)
                .should().dependOnClassesThat().haveNameMatching(OVERLAP.replace(".", "\\.") + "(\\$.*)?")
                .because("one scheduling rule, applied through MatchScheduleRules, never copied into a route")
                .check(CLASSES);
    }

    @Test
    void theGuardIsNotVacuous() {
        Set<String> users = CLASSES.stream()
                .filter(c -> c.getDirectDependenciesFromSelf().stream()
                        .anyMatch(d -> d.getTargetClass().getName().startsWith(OVERLAP)))
                .map(JavaClass::getName)
                .collect(Collectors.toSet());
        assertThat(users).anyMatch(n -> n.startsWith(VALIDATOR)).anyMatch(n -> n.startsWith(RULES_IMPL));
    }

    @Test
    void matchServiceSavesThroughTheSharedRules() {
        classes().that().haveFullyQualifiedName("com.cricketlegend.service.impl.MatchServiceImpl")
                .should().dependOnClassesThat().haveFullyQualifiedName("com.cricketlegend.service.MatchScheduleRules")
                .check(CLASSES);
    }
}
