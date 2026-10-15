package com.cricketlegend.architecture;

import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noClasses;
import static org.assertj.core.api.Assertions.assertThat;

import com.tngtech.archunit.base.DescribedPredicate;
import com.tngtech.archunit.core.domain.JavaCall;
import com.tngtech.archunit.core.domain.JavaClass;
import com.tngtech.archunit.core.domain.JavaClasses;
import com.tngtech.archunit.core.domain.properties.HasName;
import com.tngtech.archunit.core.importer.ClassFileImporter;
import com.tngtech.archunit.core.importer.ImportOption;
import java.util.Set;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;

/**
 * docs/specs/104-match-results-import-adaptors.md, Test Plan "Structural": an adaptor can only turn input into the
 * common import document. It can never write a result, so nothing in {@code service.adaptor} may depend on a
 * repository, a result service, an entity or the Result Processor, and only {@code ResultImportServiceImpl} may call
 * {@code ResultService.saveImportedDraft}.
 */
class ImportAdaptorRulesTest {

    private static final JavaClasses CLASSES = new ClassFileImporter()
            .withImportOption(ImportOption.Predefined.DO_NOT_INCLUDE_TESTS)
            .importPackages("com.cricketlegend");

    private static final String ADAPTOR = "..service.adaptor..";

    // ---- the four named prohibitions, one rule each so a failure says which one broke ----

    @Test
    void adaptorsDependOnNoRepository() {
        noClasses().that().resideInAPackage(ADAPTOR)
                .should().dependOnClassesThat().resideInAPackage("..repository..")
                .because("an adaptor never reads or writes data")
                .check(CLASSES);
    }

    @Test
    void adaptorsDependOnNoResultOrImportService() {
        noClasses().that().resideInAPackage(ADAPTOR)
                .should().dependOnClassesThat().haveNameMatching(
                        "com\\.cricketlegend\\.service\\.(ResultService|ResultImportService|ScorecardService"
                                + "|impl\\..*)(\\$.*)?")
                .because("an adaptor can not write a result")
                .check(CLASSES);
    }

    @Test
    void adaptorsDependOnNoEntity() {
        noClasses().that().resideInAPackage(ADAPTOR)
                .should().dependOnClassesThat(DescribedPredicate.describe(
                        "are JPA entities",
                        (JavaClass c) -> c.isAnnotatedWith(jakarta.persistence.Entity.class)))
                .because("an adaptor works on the common import document, not on stored rows")
                .check(CLASSES);
    }

    @Test
    void adaptorsDoNotDependOnTheProcessor() {
        noClasses().that().resideInAPackage(ADAPTOR)
                .should().dependOnClassesThat().haveNameMatching(
                        "com\\.cricketlegend\\.service\\.support\\.(ResultImportProcessor|ImportPlayerResolver"
                                + "|ImportCandidateLoader|ImportMatchLocator|ImportTeamMapper|NameAliases)(\\$.*)?")
                .because("the processor accepts the common document; an adaptor must not reach past it")
                .check(CLASSES);
    }

    // ---- the closed list: anything of ours an adaptor may depend on, and nothing else ----

    /**
     * What the adaptor package is allowed to depend on inside {@code com.cricketlegend}, and nothing else: its own
     * package; {@code dto} (the common document and the error DTO); {@code exception} (the import exceptions); the
     * domain ENUMS only ({@code DismissalType}, {@code InningsKind} and the other result vocabulary the common document is
     * written in, never a domain entity); and {@code service.support.OversFormat}, the pure overs parser the common
     * format shares with the processor.
     */
    private static final DescribedPredicate<JavaClass> ALLOWED_OF_OURS = DescribedPredicate.describe(
            "the adaptor package itself, dto, exception, domain enums and service.support.OversFormat",
            (JavaClass c) -> c.getPackageName().startsWith("com.cricketlegend.service.adaptor")
                    || c.getPackageName().startsWith("com.cricketlegend.dto")
                    || c.getPackageName().startsWith("com.cricketlegend.exception")
                    || (c.getPackageName().equals("com.cricketlegend.domain") && c.isEnum())
                    || c.getName().equals("com.cricketlegend.service.support.OversFormat")
                    || c.getName().startsWith("com.cricketlegend.service.support.OversFormat$"));

    @Test
    void adaptorsDependOnNothingOfOursBeyondTheClosedList() {
        noClasses().that().resideInAPackage(ADAPTOR)
                .should().dependOnClassesThat(DescribedPredicate.describe(
                        "are ours and not on the closed list",
                        (JavaClass c) -> c.getName().startsWith("com.cricketlegend.") && !ALLOWED_OF_OURS.test(c)))
                .because("service.adaptor may use only dto, exception, domain enums and service.support.OversFormat")
                .check(CLASSES);
    }

    @Test
    void theAdaptorRulesAreNotVacuous() {
        Set<String> adaptorClasses = CLASSES.stream()
                .filter(c -> c.getPackageName().startsWith("com.cricketlegend.service.adaptor"))
                .map(JavaClass::getSimpleName)
                .collect(Collectors.toSet());
        assertThat(adaptorClasses).contains("AbstractAdaptor", "JsonAdaptor", "AdaptorRegistry", "ImportedResultValidator");

        Set<String> used = CLASSES.stream()
                .filter(c -> c.getPackageName().startsWith("com.cricketlegend.service.adaptor"))
                .flatMap(c -> c.getDirectDependenciesFromSelf().stream())
                .map(d -> d.getTargetClass())
                .filter(t -> t.getName().startsWith("com.cricketlegend.") && !t.getPackageName().startsWith("com.cricketlegend.service.adaptor"))
                .map(JavaClass::getSimpleName)
                .collect(Collectors.toSet());
        assertThat(used).contains("ImportedResultDto", "ImportInputValidationException", "DismissalType", "OversFormat");
    }

    // ---- only the import service saves an imported draft ----

    @Test
    void onlyResultImportServiceImplCallsSaveImportedDraft() {
        DescribedPredicate<JavaCall<?>> save = JavaCall.Predicates
                .target(HasName.Predicates.name("saveImportedDraft"));
        noClasses().that(DescribedPredicate.not(HasName.Predicates.nameMatching(
                        "com\\.cricketlegend\\.service\\.impl\\.ResultImportServiceImpl(\\$.*)?")))
                .should().callMethodWhere(save)
                .because("source and external_id are written only through the import service")
                .allowEmptyShould(true)
                .check(CLASSES);
    }

    @Test
    void theSaveImportedDraftRuleIsNotVacuous() {
        Set<String> callers = CLASSES.stream()
                .filter(c -> c.getMethodCallsFromSelf().stream().anyMatch(call -> call.getTarget().getName().equals("saveImportedDraft")))
                .map(JavaClass::getSimpleName)
                .collect(Collectors.toSet());
        assertThat(callers).containsExactly("ResultImportServiceImpl");
    }
}
