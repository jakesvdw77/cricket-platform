package com.cricketlegend.service.support;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.cricketlegend.domain.ImportMatchLevel;
import com.cricketlegend.domain.NameAlias;
import com.cricketlegend.domain.NameAliasKind;
import com.cricketlegend.domain.ResultSide;
import com.cricketlegend.dto.ImportExactness;
import com.cricketlegend.dto.ImportNoteDto;
import com.cricketlegend.dto.ImportNoteSeverity;
import com.cricketlegend.service.support.ImportCandidateLoader.OurCandidate;
import com.cricketlegend.service.support.ImportCandidateLoader.SideCandidates;
import com.cricketlegend.service.support.ImportPlayerResolver.Person;
import com.cricketlegend.service.support.ImportPlayerResolver.SideNames;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.support.StaticListableBeanFactory;

/**
 * docs/specs/104, stage 3: {@link ImportPlayerResolver} turns the names one side of a file used into the people of
 * that side's scorecard. Our side: alias first (EXACT), then the matcher's tiers, a rule-based guess carries the flag,
 * nothing is linked by a suggestion. The opposition: no candidates, only unified within the file, and two spellings in
 * one list are never merged. The aliases are read through a mocked repository, and the {@link UnresolvedNameSuggester}
 * seam is exercised with a test-only fake. Invented names only.
 */
class ImportPlayerResolverTest {

    private final UUID club = UUID.randomUUID();
    private final UUID teamId = UUID.randomUUID();
    private final UUID abelId = UUID.randomUUID();
    private final UUID ceesId = UUID.randomUUID();
    private final UUID sanjayId = UUID.randomUUID();
    private final NameAliases aliases = mock(NameAliases.class);
    private final StaticListableBeanFactory beans = new StaticListableBeanFactory();
    private ImportPlayerResolver resolver;
    private SideCandidates ours;
    private final AtomicInteger counter = new AtomicInteger();

    @BeforeEach
    void setUp() {
        when(aliases.activeFor(any(), any(), anyCollection())).thenReturn(Map.of());
        resolver = new ImportPlayerResolver(aliases, beans.getBeanProvider(UnresolvedNameSuggester.class));
        ours = new SideCandidates(ResultSide.HOME, teamId, List.of(
                new OurCandidate(new NameCandidate(abelId, "Abel", "Nazar"), 1),
                new OurCandidate(new NameCandidate(ceesId, "Cees", "Meyer"), 2),
                new OurCandidate(new NameCandidate(sanjayId, "Sanjay", "Varma"), null)));
    }

    private SideNames resolveOurs(List<String> names, List<List<String>> lists) {
        return resolver.resolve(club, ResultSide.HOME, ours, names, lists, () -> "p" + counter.incrementAndGet());
    }

    private SideNames resolveOpposition(List<String> names, List<List<String>> lists) {
        return resolver.resolve(club, ResultSide.AWAY, null, names, lists, () -> "p" + counter.incrementAndGet());
    }

    private static ImportNoteDto noteFor(SideNames names, String code) {
        return names.notes().stream().filter(n -> n.code().equals(code)).findFirst().orElseThrow();
    }

    // ---- our side ----

    @Test
    void anExactNameIsLinkedUnflaggedWithItsPlannedBattingOrder() {
        SideNames names = resolveOurs(List.of("Abel Nazar"), List.of());

        Person person = names.of("Abel Nazar");
        assertThat(person.playerProfileId()).isEqualTo(abelId);
        assertThat(person.importMatch()).isNull();
        assertThat(person.level()).isEqualTo(ImportExactness.EXACT);
        assertThat(person.plannedBattingOrder()).isEqualTo(1);
        assertThat(person.opposition()).isFalse();
        assertThat(names.exact()).isEqualTo(1);
        assertThat(noteFor(names, "NAME_EXACT").severity()).isEqualTo(ImportNoteSeverity.INFO);
    }

    @Test
    void caseAccentAndParticleDifferencesAloneAreExactAndNotFlagged() {
        SideNames names = resolveOurs(List.of("ABEL nazar"), List.of());

        assertThat(names.of("ABEL nazar").importMatch()).isNull();
        assertThat(names.of("ABEL nazar").level()).isEqualTo(ImportExactness.EXACT);
        assertThat(noteFor(names, "NAME_NORMALISED_EXACT").severity()).isEqualTo(ImportNoteSeverity.INFO);
    }

    @Test
    void aRuleBasedLinkIsFlaggedAsAGuessWithAWarningNote() {
        SideNames names = resolveOurs(List.of("Nazar A"), List.of());

        Person person = names.of("Nazar A");
        assertThat(person.playerProfileId()).isEqualTo(abelId);
        assertThat(person.importMatch()).isEqualTo(ImportMatchLevel.NORMALISED);
        assertThat(person.level()).isEqualTo(ImportExactness.NORMALISED);
        assertThat(names.normalised()).isEqualTo(1);
        ImportNoteDto note = noteFor(names, "NAME_INITIALS");
        assertThat(note.severity()).isEqualTo(ImportNoteSeverity.WARNING);
        assertThat(note.fileText()).isEqualTo("Nazar A");
        assertThat(note.candidateName()).isEqualTo("Abel Nazar");
        assertThat(note.level()).isEqualTo(ImportExactness.NORMALISED);
        assertThat(note.message()).contains("It is a guess");
    }

    @Test
    void aNameOutsideTheCandidatesIsAGuestWithSuggestionsAndNoLink() {
        SideNames names = resolveOurs(List.of("Sanjay Varna", "Zane Quirk"), List.of());

        Person typo = names.of("Sanjay Varna");
        assertThat(typo.playerProfileId()).isNull();
        assertThat(typo.importMatch()).isNull();
        assertThat(typo.level()).isEqualTo(ImportExactness.UNRESOLVED);
        assertThat(names.of("Zane Quirk").playerProfileId()).isNull();
        assertThat(names.unresolved()).isEqualTo(2);
        ImportNoteDto note = noteFor(names, "NAME_NO_MATCH");
        assertThat(names.notes().stream().filter(n -> "NAME_NO_MATCH".equals(n.code()))).hasSize(2);
        assertThat(names.notes()).anySatisfy(n -> {
            assertThat(n.fileText()).isEqualTo("Sanjay Varna");
            assertThat(n.suggestions()).singleElement().satisfies(s -> {
                assertThat(s.displayName()).isEqualTo("Sanjay Varma");
                assertThat(s.score()).isGreaterThanOrEqualTo(0.8);
            });
        });
        assertThat(note.level()).isEqualTo(ImportExactness.UNRESOLVED);
    }

    @Test
    void anAmbiguousNameStaysAGuestAndTheNoteNamesBothCandidates() {
        ours = new SideCandidates(ResultSide.HOME, teamId, List.of(
                new OurCandidate(new NameCandidate(abelId, "Abel", "Nazar"), null),
                new OurCandidate(new NameCandidate(ceesId, "Adam", "Nazar"), null)));

        SideNames names = resolveOurs(List.of("A Nazar"), List.of());

        assertThat(names.of("A Nazar").playerProfileId()).isNull();
        assertThat(noteFor(names, "NAME_AMBIGUOUS").message()).contains("Abel Nazar", "Adam Nazar");
    }

    @Test
    void aRememberedAliasLinksAsExactWithoutAFlag() {
        NameAlias alias = NameAlias.builder().clubId(club).kind(NameAliasKind.PLAYER).aliasNormalised("nazar a")
                .targetPlayerProfileId(ceesId).active(true).build();
        when(aliases.activeFor(eq(club), eq(NameAliasKind.PLAYER), anyCollection())).thenReturn(Map.of("nazar a", alias));

        SideNames names = resolveOurs(List.of("Nazar A"), List.of());

        // the alias wins over what the rules would have chosen (Abel Nazar)
        Person person = names.of("Nazar A");
        assertThat(person.playerProfileId()).isEqualTo(ceesId);
        assertThat(person.importMatch()).isNull();
        assertThat(person.level()).isEqualTo(ImportExactness.EXACT);
        ImportNoteDto note = noteFor(names, "NAME_ALIAS");
        assertThat(note.severity()).isEqualTo(ImportNoteSeverity.INFO);
        assertThat(note.message()).contains("from a name you confirmed before");
    }

    @Test
    void anAliasWhoseTargetIsOutsideTheCandidatesIsIgnoredWithANote() {
        NameAlias alias = NameAlias.builder().clubId(club).kind(NameAliasKind.PLAYER).aliasNormalised("nazar a")
                .targetPlayerProfileId(UUID.randomUUID()).active(true).build();
        when(aliases.activeFor(eq(club), eq(NameAliasKind.PLAYER), anyCollection())).thenReturn(Map.of("nazar a", alias));

        SideNames names = resolveOurs(List.of("Nazar A"), List.of());

        assertThat(noteFor(names, "ALIAS_IGNORED").severity()).isEqualTo(ImportNoteSeverity.WARNING);
        // and the name is then matched by the rules as if there were no alias
        assertThat(names.of("Nazar A").playerProfileId()).isEqualTo(abelId);
        assertThat(names.of("Nazar A").importMatch()).isEqualTo(ImportMatchLevel.NORMALISED);
    }

    @Test
    void twoSpellingsOfOnePlayerInDifferentListsAreOnePerson() {
        SideNames names = resolveOurs(List.of("Nazar A", "A Nazar"), List.of(List.of("Nazar A"), List.of("A Nazar")));

        assertThat(names.of("Nazar A")).isSameAs(names.of("A Nazar"));
        assertThat(names.people()).filteredOn(p -> abelId.equals(p.playerProfileId())).hasSize(1);
    }

    @Test
    void twoSpellingsInOneListAreNotMergedTheSecondIsAGuest() {
        SideNames names = resolveOurs(List.of("Nazar A", "A Nazar"), List.of(List.of("Nazar A", "A Nazar")));

        assertThat(names.of("Nazar A").playerProfileId()).isEqualTo(abelId);
        assertThat(names.of("A Nazar").playerProfileId()).isNull();
        assertThat(names.of("A Nazar")).isNotSameAs(names.of("Nazar A"));
        assertThat(noteFor(names, "NAME_COLLISION").message()).contains("already listed in the same innings");
    }

    @Test
    void theBestSpellingNamesThePersonWhenOnePlayerIsWrittenTwoWays() {
        SideNames names = resolveOurs(List.of("Nazar A", "Abel Nazar"), List.of());

        Person person = names.of("Nazar A");
        assertThat(person).isSameAs(names.of("Abel Nazar"));
        assertThat(person.displayName()).isEqualTo("Abel Nazar");
        assertThat(person.importMatch()).isNull();
        assertThat(person.level()).isEqualTo(ImportExactness.EXACT);
    }

    @Test
    void theLookupTrimsAndUnknownSpellingsAreNull() {
        SideNames names = resolveOurs(List.of(" Abel Nazar "), List.of());

        assertThat(names.of("Abel Nazar")).isNotNull();
        assertThat(names.of("  Abel Nazar")).isNotNull();
        assertThat(names.of("Somebody Else")).isNull();
        assertThat(names.of(null)).isNull();
    }

    @Test
    void notesAndCountsCoverEveryDistinctSpelling() {
        SideNames names = resolveOurs(List.of("Abel Nazar", "Meyer C", "Zane Quirk"), List.of());

        assertThat(names.exact()).isEqualTo(1);
        assertThat(names.normalised()).isEqualTo(1);
        assertThat(names.unresolved()).isEqualTo(1);
        assertThat(names.aiSuggested()).isZero();
        assertThat(names.notes()).hasSize(3);
    }

    // ---- the opposition ----

    @Test
    void anOppositionNameIsNeverLinkedAndIsExact() {
        SideNames names = resolveOpposition(List.of("Pat Jones"), List.of());

        Person person = names.of("Pat Jones");
        assertThat(person.opposition()).isTrue();
        assertThat(person.playerProfileId()).isNull();
        assertThat(person.importMatch()).isNull();
        assertThat(person.level()).isEqualTo(ImportExactness.EXACT);
        assertThat(person.plannedBattingOrder()).isNull();
        assertThat(names.notes()).isEmpty();
    }

    @Test
    void twoOppositionSpellingsOfOneNameAreUnifiedWithAnInfoNote() {
        SideNames names = resolveOpposition(List.of("Walter Van Der Nell", "Walter V"), List.of());

        assertThat(names.people()).singleElement().satisfies(p -> assertThat(p.displayName()).isEqualTo("Walter Van Der Nell"));
        assertThat(names.of("Walter V")).isSameAs(names.of("Walter Van Der Nell"));
        ImportNoteDto note = noteFor(names, "OPPOSITION_NAMES_UNIFIED");
        assertThat(note.severity()).isEqualTo(ImportNoteSeverity.INFO);
        assertThat(note.fileText()).isEqualTo("Walter V");
        assertThat(note.candidateName()).isEqualTo("Walter Van Der Nell");
    }

    @Test
    void theShorterSpellingJoinsTheFullerOneWhicheverComesFirstInTheFile() {
        SideNames names = resolveOpposition(List.of("Walter V", "Walter Van Der Nell"), List.of());

        assertThat(names.people()).singleElement().satisfies(p -> assertThat(p.displayName()).isEqualTo("Walter Van Der Nell"));
    }

    @Test
    void twoSpellingsInOneListAreTwoPeopleNotMerged() {
        SideNames names = resolveOpposition(List.of("Walter Van Der Nell", "Walter V"),
                List.of(List.of("Walter Van Der Nell", "Walter V")));

        assertThat(names.people()).hasSize(2);
        assertThat(names.of("Walter V")).isNotSameAs(names.of("Walter Van Der Nell"));
        assertThat(names.notes()).noneMatch(n -> n.code().equals("OPPOSITION_NAMES_UNIFIED"));
    }

    @Test
    void anAmbiguousShortOppositionNameIsNotUnified() {
        SideNames names = resolveOpposition(List.of("John Smith", "Jack Smith", "J Smith"), List.of());

        assertThat(names.people()).hasSize(3);
    }

    @Test
    void spellingsThatDifferOnlyByCaseAndSpacingAreOnePerson() {
        SideNames names = resolveOpposition(List.of("Pat Jones", "pat  jones"), List.of());

        assertThat(names.people()).hasSize(1);
        assertThat(names.of("pat  jones")).isSameAs(names.of("Pat Jones"));
    }

    @Test
    void differentOppositionPlayersStayDifferent() {
        SideNames names = resolveOpposition(List.of("Pat Jones", "Rob Brown"), List.of());

        assertThat(names.people()).extracting(Person::displayName).containsExactly("Pat Jones", "Rob Brown");
    }

    // ---- the suggester seam ----

    @Test
    void withNoSuggesterNothingIsEverAiSuggested() {
        SideNames names = resolveOurs(List.of("Zane Quirk", "Nazar A", "Sanjay Varna"), List.of());

        assertThat(names.aiSuggested()).isZero();
        assertThat(names.people()).noneMatch(p -> p.importMatch() == ImportMatchLevel.AI_SUGGESTED);
        assertThat(names.people()).noneMatch(p -> p.level() == ImportExactness.AI_SUGGESTED);
    }

    @Test
    void aSuggestersAnswerIsLinkedProvisionallyAndFlagged() {
        NameCandidate meyer = ours.names().get(1);
        beans.addBean("fake", (UnresolvedNameSuggester) (unresolved, candidates) ->
                Map.of("Zane Quirk", new UnresolvedNameSuggester.Suggestion(meyer, 0.9)));
        resolver = new ImportPlayerResolver(aliases, beans.getBeanProvider(UnresolvedNameSuggester.class));

        SideNames names = resolveOurs(List.of("Zane Quirk"), List.of());

        Person person = names.of("Zane Quirk");
        assertThat(person.playerProfileId()).isEqualTo(ceesId);
        assertThat(person.importMatch()).isEqualTo(ImportMatchLevel.AI_SUGGESTED);
        assertThat(person.level()).isEqualTo(ImportExactness.AI_SUGGESTED);
        assertThat(names.aiSuggested()).isEqualTo(1);
        assertThat(names.unresolved()).isZero();
        ImportNoteDto note = noteFor(names, "NAME_SUGGESTED");
        assertThat(note.severity()).isEqualTo(ImportNoteSeverity.WARNING);
        assertThat(note.level()).isEqualTo(ImportExactness.AI_SUGGESTED);
    }

    @Test
    void aSuggesterIsOnlyAskedAboutTheUnresolvedNamesAndNeverForAPlayerOutsideTheCandidates() {
        List<List<String>> asked = new ArrayList<>();
        NameCandidate stranger = new NameCandidate(UUID.randomUUID(), "Not", "Ours");
        beans.addBean("fake", (UnresolvedNameSuggester) (unresolved, candidates) -> {
            asked.add(unresolved);
            return Map.of("Zane Quirk", new UnresolvedNameSuggester.Suggestion(stranger, 0.99));
        });
        resolver = new ImportPlayerResolver(aliases, beans.getBeanProvider(UnresolvedNameSuggester.class));

        SideNames names = resolveOurs(List.of("Abel Nazar", "Zane Quirk"), List.of());

        assertThat(asked).containsExactly(List.of("Zane Quirk"));
        assertThat(names.of("Zane Quirk").playerProfileId()).isNull();
        assertThat(names.aiSuggested()).isZero();
    }

    @Test
    void aSuggesterCannotTakeAPlayerAlreadyPlacedByARule() {
        NameCandidate abel = ours.names().get(0);
        beans.addBean("fake", (UnresolvedNameSuggester) (unresolved, candidates) ->
                Map.of("Zane Quirk", new UnresolvedNameSuggester.Suggestion(abel, 0.95)));
        resolver = new ImportPlayerResolver(aliases, beans.getBeanProvider(UnresolvedNameSuggester.class));

        SideNames names = resolveOurs(List.of("Abel Nazar", "Zane Quirk"), List.of());

        assertThat(names.of("Abel Nazar").playerProfileId()).isEqualTo(abelId);
        assertThat(names.of("Zane Quirk").playerProfileId()).isNull();
    }

    @Test
    void aSuggesterIsNotCalledWhenEveryNameIsPlacedOrForTheOpposition() {
        UnresolvedNameSuggester suggester = mock(UnresolvedNameSuggester.class);
        beans.addBean("fake", suggester);
        resolver = new ImportPlayerResolver(aliases, beans.getBeanProvider(UnresolvedNameSuggester.class));

        resolveOurs(List.of("Abel Nazar"), List.of());
        resolveOpposition(List.of("Zane Quirk"), List.of());

        verify(suggester, never()).suggest(any(), any());
    }

    @SuppressWarnings("unused")
    private static ObjectProvider<UnresolvedNameSuggester> unused() {
        return null;
    }
}
