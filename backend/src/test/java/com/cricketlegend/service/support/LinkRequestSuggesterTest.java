package com.cricketlegend.service.support;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

import com.cricketlegend.domain.LinkRequest;
import com.cricketlegend.domain.LinkRequestStatus;
import com.cricketlegend.domain.Person;
import com.cricketlegend.domain.PlayerProfile;
import com.cricketlegend.repository.PersonRepository;
import com.cricketlegend.repository.PlayerIdentityView;
import com.cricketlegend.repository.PlayerProfileRepository;
import com.cricketlegend.service.support.LinkRequestSuggester.Suggestion;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

/**
 * docs/specs/119: which of the club's own players a typed link request is suggested to refer to. Tiers: the player the
 * requester was shown, then name and date of birth, then the name alone (exactMatch false); a section scoped caller only
 * ever sees a suggestion inside their sections.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class LinkRequestSuggesterTest {

    private static final LocalDate DOB = LocalDate.of(2012, 6, 15);

    @Mock private PlayerProfileRepository playerProfileRepository;
    @Mock private PersonRepository personRepository;
    @Mock private PlayerSectionNames playerSectionNames;

    private LinkRequestSuggester suggester;
    private final UUID clubId = UUID.randomUUID();
    private final UUID sectionA = UUID.randomUUID();
    private final UUID sectionB = UUID.randomUUID();
    private final List<PlayerIdentityView> identities = new ArrayList<>();
    private final Map<UUID, PlayerProfile> profiles = new HashMap<>();
    private final Map<UUID, Person> persons = new HashMap<>();
    private final Map<UUID, Set<UUID>> sections = new HashMap<>();

    @BeforeEach
    void setUp() {
        suggester = new LinkRequestSuggester(playerProfileRepository, personRepository, playerSectionNames);
        when(playerProfileRepository.findActiveIdentitiesByClub(clubId)).thenReturn(identities);
        when(playerProfileRepository.findAllById(any())).thenAnswer(i -> {
            List<PlayerProfile> out = new ArrayList<>();
            for (Object id : (Iterable<?>) i.getArgument(0)) {
                if (profiles.containsKey(id)) {
                    out.add(profiles.get(id));
                }
            }
            return out;
        });
        when(personRepository.findAllById(any())).thenAnswer(i -> {
            List<Person> out = new ArrayList<>();
            for (Object id : (Iterable<?>) i.getArgument(0)) {
                if (persons.containsKey(id)) {
                    out.add(persons.get(id));
                }
            }
            return out;
        });
        when(playerSectionNames.sectionIds(any())).thenReturn(sections);
    }

    private record Identity(UUID getPlayerProfileId, UUID getPersonId, String getFirstName, String getLastName,
            LocalDate getDateOfBirth) implements PlayerIdentityView {}

    private PlayerProfile player(String first, String last, LocalDate dob, UUID... taggedSections) {
        Person person = Person.builder().id(UUID.randomUUID()).firstName(first).lastName(last).dateOfBirth(dob).build();
        PlayerProfile profile = PlayerProfile.builder().id(UUID.randomUUID()).personId(person.getId()).clubId(clubId)
                .active(true).build();
        persons.put(person.getId(), person);
        profiles.put(profile.getId(), profile);
        identities.add(new Identity(profile.getId(), person.getId(), first, last, dob));
        if (taggedSections.length > 0) {
            sections.put(profile.getId(), Set.of(taggedSections));
        }
        return profile;
    }

    private LinkRequest request(String first, String last, LocalDate dob, UUID target) {
        return LinkRequest.builder().id(UUID.randomUUID()).clubId(clubId).accountPersonId(UUID.randomUUID())
                .typedFirstName(first).typedLastName(last).typedDateOfBirth(dob).targetPlayerProfileId(target)
                .status(LinkRequestStatus.PENDING).build();
    }

    @Test
    void anExactNameAndDateOfBirthIsTheExactTierAndBeatsALookalikeWithAnotherDate() {
        player("Sam", "Smith", LocalDate.of(2010, 1, 1));
        PlayerProfile right = player("Sam", "Smith", DOB);
        LinkRequest request = request("Sam", "Smith", DOB, null);

        Map<UUID, Suggestion> result = suggester.suggest(clubId, List.of(request), Optional.empty());

        assertThat(result.get(request.getId()).profile().getId()).isEqualTo(right.getId());
        assertThat(result.get(request.getId()).exactMatch()).isTrue();
    }

    @Test
    void namesAreMatchedLeniently() {
        PlayerProfile stored = player("Jaco", "van der Westhuizen", DOB);
        LinkRequest request = request("jaco ", "Westhuizen", DOB, null);

        Suggestion suggestion = suggester.suggest(clubId, List.of(request), Optional.empty()).get(request.getId());

        assertThat(suggestion.profile().getId()).isEqualTo(stored.getId());
        assertThat(suggestion.exactMatch()).isTrue();
    }

    @Test
    void aNameOnlyMatchIsTheFallbackTierWithExactMatchFalse() {
        PlayerProfile stored = player("Sam", "Smith", LocalDate.of(2010, 1, 1));
        LinkRequest request = request("Sam", "Smith", DOB, null);

        Suggestion suggestion = suggester.suggest(clubId, List.of(request), Optional.empty()).get(request.getId());

        assertThat(suggestion.profile().getId()).isEqualTo(stored.getId());
        assertThat(suggestion.exactMatch()).isFalse();
    }

    @Test
    void noNameMatchMeansUnresolvedAndNoSuggestion() {
        player("Pieter", "Westhuizen", DOB);
        LinkRequest request = request("Sam", "Smith", DOB, null);

        assertThat(suggester.suggest(clubId, List.of(request), Optional.empty())).doesNotContainKey(request.getId());
    }

    @Test
    void thePlayerTheRequesterWasShownIsSuggestedEvenWhenTheTypedNameDiffers() {
        PlayerProfile shown = player("Samuel", "Smith", DOB);
        LinkRequest request = request("Totally", "Different", LocalDate.of(2000, 1, 1), shown.getId());

        Suggestion suggestion = suggester.suggest(clubId, List.of(request), Optional.empty()).get(request.getId());

        assertThat(suggestion.profile().getId()).isEqualTo(shown.getId());
        assertThat(suggestion.exactMatch()).isTrue();
    }

    @Test
    void aShownPlayerWhoIsInactiveOrAtAnotherClubFallsBackToNameMatching() {
        PlayerProfile elsewhere = player("Elsa", "Else", DOB);
        elsewhere.setClubId(UUID.randomUUID());
        PlayerProfile byName = player("Sam", "Smith", DOB);
        LinkRequest request = request("Sam", "Smith", DOB, elsewhere.getId());

        Suggestion suggestion = suggester.suggest(clubId, List.of(request), Optional.empty()).get(request.getId());

        assertThat(suggestion.profile().getId()).isEqualTo(byName.getId());
    }

    @Test
    void aSectionScopedCallerOnlyGetsSuggestionsInsideTheirSections() {
        PlayerProfile inA = player("Ann", "Alpha", DOB, sectionA);
        player("Bob", "Beta", DOB, sectionB);
        player("Una", "Untagged", DOB);
        LinkRequest forA = request("Ann", "Alpha", DOB, null);
        LinkRequest forB = request("Bob", "Beta", DOB, null);
        LinkRequest forUntagged = request("Una", "Untagged", DOB, null);

        Map<UUID, Suggestion> result =
                suggester.suggest(clubId, List.of(forA, forB, forUntagged), Optional.of(Set.of(sectionA)));

        assertThat(result).containsOnlyKeys(forA.getId());
        assertThat(result.get(forA.getId()).profile().getId()).isEqualTo(inA.getId());
    }

    @Test
    void aClubWideCallerSeesSuggestionsRegardlessOfSections() {
        player("Bob", "Beta", DOB, sectionB);
        player("Una", "Untagged", DOB);
        LinkRequest forB = request("Bob", "Beta", DOB, null);
        LinkRequest forUntagged = request("Una", "Untagged", DOB, null);

        assertThat(suggester.suggest(clubId, List.of(forB, forUntagged), Optional.empty()))
                .containsOnlyKeys(forB.getId(), forUntagged.getId());
    }

    @Test
    void anEmptyQueueIsAnEmptyResult() {
        assertThat(suggester.suggest(clubId, List.of(), Optional.empty())).isEmpty();
    }
}
