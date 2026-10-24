package com.cricketlegend.architecture;

import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noClasses;
import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noFields;
import static org.assertj.core.api.Assertions.assertThat;

import com.tngtech.archunit.base.DescribedPredicate;
import com.tngtech.archunit.core.domain.JavaClasses;
import com.tngtech.archunit.core.domain.properties.HasName;
import com.tngtech.archunit.core.importer.ClassFileImporter;
import com.tngtech.archunit.core.importer.ImportOption;
import com.tngtech.archunit.lang.ArchRule;
import java.time.LocalDate;
import java.util.Set;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;

/**
 * docs/specs/119: who an agent link is allowed to be read or written by, enforced structurally like {@link
 * LayeringRulesTest}. The three link repositories (person_link, link_request, link_attempt) are used only by the link
 * services and their support classes, and the minimised match view can never grow a date field.
 */
class AccountLinkRulesTest {

    private static final JavaClasses CLASSES = new ClassFileImporter()
            .withImportOption(ImportOption.Predefined.DO_NOT_INCLUDE_TESTS)
            .importPackages("com.cricketlegend");

    private static final String LINK_REPOSITORIES =
            "com\\.cricketlegend\\.repository\\.(PersonLinkRepository|LinkRequestRepository|LinkAttemptRepository)(\\$.*)?";

    /** The only code that may touch the link tables: the link services (service.impl) and their support classes. */
    private static final String LINK_OWNERS =
            "com\\.cricketlegend\\.service\\."
                    + "(impl\\.(LinkServiceImpl|MyLinkRequestServiceImpl|LinkRequestManagementServiceImpl|PlayerAccountServiceImpl"
                    + "|MyPlayerServiceImpl|AgentInvitationServiceImpl|AgentInvitationEmailServiceImpl|LinkRequestOutcomeEmailServiceImpl)"
                    + "|support\\.(LinkAttemptLimiter|LinkInvitations|MyPlayerAccess|ProfileResolver))(\\$.*)?";

    @Test
    void theLinkRepositoriesAreTouchedOnlyByTheLinkServicesAndTheirSupportClasses() {
        ArchRule rule = noClasses()
                .that(DescribedPredicate.not(HasName.Predicates.nameMatching(LINK_OWNERS + "|" + LINK_REPOSITORIES)))
                .should().dependOnClassesThat().haveNameMatching(LINK_REPOSITORIES)
                .because("links grant access to a player's data, so only the services that enforce the link rules may query them")
                .allowEmptyShould(true);
        rule.check(CLASSES);
    }

    @Test
    void theLinkRepositoryUsersAreExactlyWhoWeExpect() {
        // proves the rule above is not vacuous, and that a new user must be added here on purpose
        Set<String> users = CLASSES.stream()
                .filter(c -> c.getDirectDependenciesFromSelf().stream().anyMatch(d -> d.getTargetClass().getName().matches(LINK_REPOSITORIES)))
                .map(c -> c.getName())
                .filter(n -> !n.matches(LINK_REPOSITORIES))
                .collect(Collectors.toSet());
        assertThat(users).containsExactlyInAnyOrder(
                "com.cricketlegend.service.impl.LinkServiceImpl",
                "com.cricketlegend.service.impl.MyLinkRequestServiceImpl",
                "com.cricketlegend.service.impl.LinkRequestManagementServiceImpl",
                "com.cricketlegend.service.impl.PlayerAccountServiceImpl",
                "com.cricketlegend.service.impl.MyPlayerServiceImpl",
                "com.cricketlegend.service.impl.AgentInvitationServiceImpl",
                "com.cricketlegend.service.impl.AgentInvitationEmailServiceImpl",
                "com.cricketlegend.service.impl.LinkRequestOutcomeEmailServiceImpl",
                "com.cricketlegend.service.support.LinkAttemptLimiter",
                "com.cricketlegend.service.support.LinkInvitations",
                "com.cricketlegend.service.support.MyPlayerAccess",
                "com.cricketlegend.service.support.ProfileResolver");
    }

    @Test
    void controllersAndMappersNeverReachALinkRepository() {
        ArchRule rule = noClasses().that().resideInAnyPackage("..controller..", "..mapper..", "..dto..")
                .should().dependOnClassesThat().haveNameMatching(LINK_REPOSITORIES)
                .allowEmptyShould(true);
        rule.check(CLASSES);
    }

    @Test
    void theMatchedPlayerViewAndItsResponsesCanNeverCarryADateField() {
        // Decision 28: a birth year and an adult flag only. A LocalDate field here would be a full date of birth.
        ArchRule rule = noFields()
                .that().areDeclaredInClassesThat().haveNameMatching(
                        "com\\.cricketlegend\\.(dto\\.(PlayerMatchDto|PlayerMatchWithMainAgentDto|PlayerMatchesDto|ConfirmLinksResultDto)"
                                + "|service\\.support\\.(MatchedPlayer|MatchCandidate))(\\$.*)?")
                .should().haveRawType(LocalDate.class)
                .orShould().haveRawType(java.time.Instant.class)
                .allowEmptyShould(true);
        rule.check(CLASSES);
        // and the rule is not vacuous: the classes exist
        assertThat(CLASSES.contain(com.cricketlegend.dto.PlayerMatchDto.class)).isTrue();
        assertThat(CLASSES.contain(com.cricketlegend.service.support.MatchedPlayer.class)).isTrue();
    }
}
