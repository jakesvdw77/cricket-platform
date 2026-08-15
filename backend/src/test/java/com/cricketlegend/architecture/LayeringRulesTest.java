package com.cricketlegend.architecture;

import com.tngtech.archunit.core.importer.ClassFileImporter;
import com.tngtech.archunit.core.importer.ImportOption;
import com.tngtech.archunit.lang.ArchRule;
import org.junit.jupiter.api.Test;

import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.classes;
import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noClasses;

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
}
