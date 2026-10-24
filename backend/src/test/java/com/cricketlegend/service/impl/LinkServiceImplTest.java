package com.cricketlegend.service.impl;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.cricketlegend.domain.Club;
import com.cricketlegend.domain.ClubStatus;
import com.cricketlegend.domain.LinkAttemptKind;
import com.cricketlegend.domain.LinkGrantedVia;
import com.cricketlegend.domain.Person;
import com.cricketlegend.domain.PersonLink;
import com.cricketlegend.domain.PersonLinkStatus;
import com.cricketlegend.domain.PersonStatus;
import com.cricketlegend.domain.PlayerProfile;
import com.cricketlegend.dto.ConfirmLinksRequest;
import com.cricketlegend.dto.PlayerMatchDto;
import com.cricketlegend.dto.PlayerMatchWithMainAgentDto;
import com.cricketlegend.dto.PlayerMatchesDto;
import com.cricketlegend.exception.ConflictException;
import com.cricketlegend.exception.EmailNotVerifiedException;
import com.cricketlegend.exception.LinkLockedException;
import com.cricketlegend.exception.ValidationException;
import com.cricketlegend.mapper.LinkMapperImpl;
import com.cricketlegend.repository.ClubRepository;
import com.cricketlegend.repository.PersonLinkRepository;
import com.cricketlegend.repository.PersonRepository;
import com.cricketlegend.repository.PlayerProfileRepository;
import com.cricketlegend.service.support.LinkAttemptLimiter;
import com.cricketlegend.service.support.PlayerGroupLabels;
import java.lang.reflect.RecordComponent;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.oauth2.jwt.Jwt;

/**
 * docs/specs/119 slice 3 Test Plan, "LinkService": the email match and the confirm step. Repositories are mocked, the
 * mapper is the real generated one so the minimisation of the response is tested end to end below the controller.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class LinkServiceImplTest {

    private static final String SUB = "sub-parent";
    private static final String EMAIL = "parent@example.com";

    @Mock private PersonRepository personRepository;
    @Mock private PlayerProfileRepository playerProfileRepository;
    @Mock private PersonLinkRepository personLinkRepository;
    @Mock private ClubRepository clubRepository;
    @Mock private LinkAttemptLimiter limiter;
    @Mock private PlayerGroupLabels groupLabels;

    private LinkServiceImpl service;
    private final TestingAuthenticationToken auth = new TestingAuthenticationToken(SUB, null, List.of());
    private final Map<UUID, Person> people = new HashMap<>();
    private Person caller;
    private Club club;

    @BeforeEach
    void setUp() {
        service = new LinkServiceImpl(personRepository, playerProfileRepository, personLinkRepository, clubRepository,
                new LinkMapperImpl(), limiter, groupLabels);
        caller = person("Pat", "Parent", EMAIL, null);
        caller.setKeycloakUserId(SUB);
        when(personRepository.findByKeycloakUserId(SUB)).thenReturn(Optional.of(caller));
        when(personRepository.findById(caller.getId())).thenReturn(Optional.of(caller));
        when(personRepository.findAllById(any())).thenAnswer(i -> {
            List<Person> found = new ArrayList<>();
            for (Object id : (Iterable<?>) i.getArgument(0)) {
                if (people.containsKey(id)) {
                    found.add(people.get(id));
                }
            }
            return found;
        });
        club = Club.builder().id(UUID.randomUUID()).name("Hillcrest CC").slug("hillcrest").status(ClubStatus.ACTIVE).build();
        when(clubRepository.findAllById(any())).thenReturn(List.of(club));
        when(personLinkRepository.findByAccountAndSubjects(any(), any(), any())).thenReturn(List.of());
        when(personLinkRepository.findActiveMains(any())).thenReturn(List.of());
        when(groupLabels.groupLabels(any())).thenAnswer(i -> {
            Map<UUID, String> labels = new HashMap<>();
            for (PlayerProfile p : (Collection<PlayerProfile>) i.getArgument(0)) {
                labels.put(p.getId(), "U13");
            }
            return labels;
        });
    }

    private Person person(String first, String last, String email, LocalDate dob) {
        Person p = Person.builder()
                .id(UUID.randomUUID())
                .firstName(first)
                .lastName(last)
                .email(email)
                .dateOfBirth(dob)
                .status(PersonStatus.ACTIVE)
                .build();
        people.put(p.getId(), p);
        return p;
    }

    private PlayerProfile playerFor(Person subject) {
        PlayerProfile profile = PlayerProfile.builder()
                .id(UUID.randomUUID())
                .personId(subject.getId())
                .clubId(club.getId())
                .email(EMAIL)
                .phone("0821234567")
                .medicalAidProvider("Discovery")
                .photoUrl("https://img/x.png")
                .active(true)
                .build();
        return profile;
    }

    private void matching(PlayerProfile... profiles) {
        when(playerProfileRepository.findMatchesByEmail(EMAIL, caller.getId())).thenReturn(Arrays.asList(profiles));
    }

    private Jwt jwt(boolean verified) {
        return Jwt.withTokenValue("t").header("alg", "none").subject(SUB).issuedAt(Instant.now())
                .expiresAt(Instant.now().plusSeconds(60)).claim("email", EMAIL).claim("email_verified", verified).build();
    }

    private PersonLink mainLinkFor(Person subject, Person agent) {
        return PersonLink.builder()
                .id(UUID.randomUUID())
                .accountPersonId(agent.getId())
                .subjectPersonId(subject.getId())
                .clubId(club.getId())
                .status(PersonLinkStatus.ACTIVE)
                .main(true)
                .grantedVia(LinkGrantedVia.EMAIL_MATCH)
                .build();
    }

    // ---- matches ----

    @Test
    void anUnverifiedEmailIsRefusedForMatchesAndConfirmAndNothingIsRead() {
        assertThatThrownBy(() -> service.matches(auth, jwt(false))).isInstanceOf(EmailNotVerifiedException.class);
        assertThatThrownBy(() -> service.confirm(auth, jwt(false), new ConfirmLinksRequest(List.of("x"), true)))
                .isInstanceOf(EmailNotVerifiedException.class);
        verifyNoInteractions(playerProfileRepository, personLinkRepository);
    }

    @Test
    void aMatchCarriesFirstNameSurnameInitialClubGroupBirthYearAndAdultFlagOnly() {
        Person child = person("Sam", "smith", null, LocalDate.of(2012, 6, 15));
        matching(playerFor(child));

        PlayerMatchesDto result = service.matches(auth, jwt(true));

        assertThat(result.withMainAgent()).isEmpty();
        assertThat(result.withoutMainAgent()).singleElement().satisfies(m -> {
            assertThat(m.firstName()).isEqualTo("Sam");
            assertThat(m.surnameInitial()).isEqualTo("S");
            assertThat(m.clubName()).isEqualTo("Hillcrest CC");
            assertThat(m.groupLabel()).isEqualTo("U13");
            assertThat(m.birthYear()).isEqualTo(2012);
            assertThat(m.adult()).isFalse();
        });
    }

    @Test
    void birthYearIsTheYearOfTheStoredDateAndAnAdultIsFlaggedAdult() {
        Person adult = person("Alex", "Adams", null, LocalDate.of(1990, 12, 31));
        matching(playerFor(adult));

        PlayerMatchDto match = service.matches(auth, jwt(true)).withoutMainAgent().get(0);

        assertThat(match.birthYear()).isEqualTo(1990);
        assertThat(match.adult()).isTrue();
    }

    @Test
    void theMatchResponseTypesHaveNoRoomForAFullDateOfBirthPhoneEmailMedicalOrPhoto() {
        for (Class<?> type : List.of(PlayerMatchDto.class, PlayerMatchWithMainAgentDto.class)) {
            for (RecordComponent component : type.getRecordComponents()) {
                assertThat(component.getType()).as(type.getSimpleName() + "." + component.getName())
                        .isNotIn(LocalDate.class, Instant.class, java.time.LocalDateTime.class);
                assertThat(component.getName().toLowerCase())
                        .doesNotContain("dateofbirth", "dob", "phone", "medical", "photo", "address");
            }
        }
    }

    @Test
    void matchesAreSplitByMainAgentAndOnlyTheWithMainAgentRowCarriesAMaskedEmail() {
        Person freeKid = person("Fred", "Free", null, LocalDate.of(2013, 1, 1));
        Person takenKid = person("Tara", "Taken", null, LocalDate.of(2013, 2, 2));
        Person otherParent = person("Olga", "Other", "olga@example.org", null);
        matching(playerFor(freeKid), playerFor(takenKid));
        when(personLinkRepository.findActiveMains(any())).thenReturn(List.of(mainLinkFor(takenKid, otherParent)));

        PlayerMatchesDto result = service.matches(auth, jwt(true));

        assertThat(result.withoutMainAgent()).extracting(PlayerMatchDto::firstName).containsExactly("Fred");
        assertThat(result.withMainAgent()).singleElement().satisfies(m -> {
            assertThat(m.firstName()).isEqualTo("Tara");
            assertThat(m.maskedMainAgentEmail()).isEqualTo("o***@example.org").doesNotContain("lga");
        });
    }

    @Test
    void aPlayerTheCallerAlreadyHoldsIsHidden() {
        Person kid = person("Hal", "Held", null, LocalDate.of(2011, 3, 3));
        PlayerProfile profile = playerFor(kid);
        matching(profile);
        PersonLink held = mainLinkFor(kid, caller);
        when(personLinkRepository.findByAccountAndSubjects(eq(caller.getId()), eq(PersonLinkStatus.ACTIVE), any()))
                .thenReturn(List.of(held));

        PlayerMatchesDto result = service.matches(auth, jwt(true));

        assertThat(result.withoutMainAgent()).isEmpty();
        assertThat(result.withMainAgent()).isEmpty();
    }

    // ---- confirm ----

    @Test
    void confirmFalseOrMissingIsRefusedAndWritesNothing() {
        Person kid = person("Cal", "Cole", null, LocalDate.of(2012, 1, 1));
        PlayerProfile profile = playerFor(kid);
        matching(profile);

        assertThatThrownBy(() -> service.confirm(auth, jwt(true),
                new ConfirmLinksRequest(List.of(profile.getId().toString()), false)))
                .isInstanceOf(ValidationException.class);
        assertThatThrownBy(() -> service.confirm(auth, jwt(true),
                new ConfirmLinksRequest(List.of(profile.getId().toString()), null)))
                .isInstanceOf(ValidationException.class);
        verify(personLinkRepository, never()).saveAndFlush(any());
    }

    @Test
    void confirmingAForeignRefIsRefusedCountedAsAFailureAndNothingIsLinked() {
        Person kid = person("Cal", "Cole", null, LocalDate.of(2012, 1, 1));
        matching(playerFor(kid));

        assertThatThrownBy(() -> service.confirm(auth, jwt(true),
                new ConfirmLinksRequest(List.of(UUID.randomUUID().toString()), true)))
                .isInstanceOf(ValidationException.class);

        verify(limiter).recordFailedConfirm(caller.getId());
        verify(personLinkRepository, never()).saveAndFlush(any());
    }

    @Test
    void aPlayerWithAMainAgentIsNeverLinkedByConfirmAndGetsTheSameRefusalAsAForeignRef() {
        Person takenKid = person("Tara", "Taken", null, LocalDate.of(2013, 2, 2));
        Person otherParent = person("Olga", "Other", "olga@example.org", null);
        PlayerProfile profile = playerFor(takenKid);
        matching(profile);
        when(personLinkRepository.findActiveMains(any())).thenReturn(List.of(mainLinkFor(takenKid, otherParent)));

        assertThatThrownBy(() -> service.confirm(auth, jwt(true),
                new ConfirmLinksRequest(List.of(profile.getId().toString()), true)))
                .isInstanceOf(ValidationException.class)
                .hasMessage("One or more of these players cannot be confirmed.");
        verify(personLinkRepository, never()).saveAndFlush(any());
    }

    @Test
    void confirmedPlayersGetActiveMainEmailMatchLinksForTheCaller() {
        Person kid = person("Cal", "Cole", null, LocalDate.of(2012, 1, 1));
        PlayerProfile profile = playerFor(kid);
        matching(profile);

        var result = service.confirm(auth, jwt(true), new ConfirmLinksRequest(List.of(profile.getId().toString()), true));

        ArgumentCaptor<PersonLink> saved = ArgumentCaptor.forClass(PersonLink.class);
        verify(personLinkRepository).saveAndFlush(saved.capture());
        PersonLink link = saved.getValue();
        assertThat(link.getAccountPersonId()).isEqualTo(caller.getId());
        assertThat(link.getSubjectPersonId()).isEqualTo(kid.getId());
        assertThat(link.getClubId()).isEqualTo(club.getId());
        assertThat(link.getStatus()).isEqualTo(PersonLinkStatus.ACTIVE);
        assertThat(link.isMain()).isTrue();
        assertThat(link.getGrantedVia()).isEqualTo(LinkGrantedVia.EMAIL_MATCH);
        assertThat(result.linked()).extracting(PlayerMatchDto::firstName).containsExactly("Cal");
    }

    @Test
    void aLockedAccountGets423BeforeAnyMatchingIsDone() {
        org.mockito.Mockito.doThrow(new LinkLockedException(600)).when(limiter)
                .assertNotLocked(caller.getId(), LinkAttemptKind.CONFIRM);

        assertThatThrownBy(() -> service.confirm(auth, jwt(true), new ConfirmLinksRequest(List.of("x"), true)))
                .isInstanceOf(LinkLockedException.class);
        verifyNoInteractions(playerProfileRepository);
    }

    @Test
    void aLostRaceOnTheOneMainAgentIndexIsAConflict() {
        Person kid = person("Cal", "Cole", null, LocalDate.of(2012, 1, 1));
        PlayerProfile profile = playerFor(kid);
        matching(profile);
        when(personLinkRepository.saveAndFlush(any())).thenThrow(new DataIntegrityViolationException("ux_person_link_one_main"));

        assertThatThrownBy(() -> service.confirm(auth, jwt(true),
                new ConfirmLinksRequest(List.of(profile.getId().toString()), true)))
                .isInstanceOf(ConflictException.class);
    }

    // ---- findOwnMatch (used by typed requests) ----

    @Test
    void findOwnMatchFindsAShownPlayerWithOrWithoutAMainAgentAndNothingElse() {
        Person takenKid = person("Tara", "Taken", null, LocalDate.of(2013, 2, 2));
        Person otherParent = person("Olga", "Other", "olga@example.org", null);
        PlayerProfile profile = playerFor(takenKid);
        matching(profile);
        when(personLinkRepository.findActiveMains(any())).thenReturn(List.of(mainLinkFor(takenKid, otherParent)));

        assertThat(service.findOwnMatch(EMAIL, caller.getId(), profile.getId().toString()))
                .hasValueSatisfying(m -> assertThat(m.profileId()).isEqualTo(profile.getId()));
        assertThat(service.findOwnMatch(EMAIL, caller.getId(), UUID.randomUUID().toString())).isEmpty();
    }
}
