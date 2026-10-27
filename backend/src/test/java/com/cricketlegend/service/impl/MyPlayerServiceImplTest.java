package com.cricketlegend.service.impl;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import com.cricketlegend.domain.Club;
import com.cricketlegend.domain.ClubStatus;
import com.cricketlegend.domain.Person;
import com.cricketlegend.domain.PersonLink;
import com.cricketlegend.domain.PersonLinkStatus;
import com.cricketlegend.domain.PlayerProfile;
import com.cricketlegend.dto.MyPlayerDto;
import com.cricketlegend.dto.UpdateMyPlayerRequest;
import com.cricketlegend.exception.ValidationException;
import com.cricketlegend.mapper.MyPlayerMapper;
import com.cricketlegend.repository.ClubRepository;
import com.cricketlegend.repository.PersonLinkRepository;
import com.cricketlegend.repository.PersonRepository;
import com.cricketlegend.repository.PlayerProfileRepository;
import com.cricketlegend.service.support.HeldPlayer;
import com.cricketlegend.service.support.MyPlayerAccess;
import com.cricketlegend.service.support.PlayerGroupLabels;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.slf4j.LoggerFactory;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.TestingAuthenticationToken;

/**
 * docs/specs/119 "My players" whitelist: medical aid, date of birth and the contact email only for the main agent or the
 * adult player (403 otherwise, a null leaves the stored value), date of birth validated, updatedBy set, and no value of a
 * date of birth in the audit log.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class MyPlayerServiceImplTest {

    private static final LocalDate CHILD_DOB = LocalDate.of(2012, 6, 15);

    @Mock private MyPlayerAccess access;
    @Mock private ClubRepository clubRepository;
    @Mock private PlayerProfileRepository playerProfileRepository;
    @Mock private PersonLinkRepository personLinkRepository;
    @Mock private PersonRepository personRepository;
    @Mock private PlayerGroupLabels groupLabels;

    private MyPlayerServiceImpl service;
    private final TestingAuthenticationToken auth = new TestingAuthenticationToken("sub", null, List.of());
    private final UUID clubId = UUID.randomUUID();
    private final Map<UUID, Person> people = new HashMap<>();
    private Person caller;
    private Person child;
    private PlayerProfile profile;
    private final ListAppender<ILoggingEvent> logs = new ListAppender<>();

    @BeforeEach
    void setUp() {
        service = new MyPlayerServiceImpl(access, clubRepository, playerProfileRepository, personLinkRepository,
                personRepository, groupLabels, new MyPlayerMapper());
        caller = person("Pat", "Parent", "pat@example.com", null);
        child = person("Sam", "Smith", null, CHILD_DOB);
        profile = PlayerProfile.builder().id(UUID.randomUUID()).personId(child.getId()).clubId(clubId).active(true)
                .medicalAidProvider("Discovery").medicalAidMemberNumber("12345").email("pat@example.com")
                .phone("0821234567").build();
        when(clubRepository.findById(clubId)).thenReturn(Optional.of(
                Club.builder().id(clubId).name("Hillcrest CC").slug("hc").status(ClubStatus.ACTIVE).build()));
        when(groupLabels.sectionNames(any())).thenReturn(Map.of());
        when(groupLabels.teamNames(any())).thenReturn(Map.of());
        when(personLinkRepository.findActiveBySubjectAndClub(any(), any())).thenReturn(List.of());
        when(personLinkRepository.findOpenInvitationsBySubjectAndClub(any(), any(), any())).thenReturn(List.of());
        when(personRepository.findAllById(any())).thenAnswer(i -> {
            List<Person> found = new ArrayList<>();
            for (Object id : (Iterable<?>) i.getArgument(0)) {
                if (people.containsKey(id)) {
                    found.add(people.get(id));
                }
            }
            return found;
        });
        Logger logger = (Logger) LoggerFactory.getLogger(MyPlayerServiceImpl.class);
        logs.start();
        logger.addAppender(logs);
    }

    @AfterEach
    void detach() {
        ((Logger) LoggerFactory.getLogger(MyPlayerServiceImpl.class)).detachAppender(logs);
    }

    private Person person(String first, String last, String email, LocalDate dob) {
        Person p = Person.builder().id(UUID.randomUUID()).firstName(first).lastName(last).email(email).dateOfBirth(dob).build();
        people.put(p.getId(), p);
        return p;
    }

    private HeldPlayer linked(boolean main) {
        PersonLink link = PersonLink.builder().id(UUID.randomUUID()).accountPersonId(caller.getId())
                .subjectPersonId(child.getId()).clubId(clubId).status(PersonLinkStatus.ACTIVE).main(main)
                .createdAt(Instant.now()).build();
        HeldPlayer held = new HeldPlayer(link.getId().toString(), caller, child, profile, link);
        when(access.resolve(auth, held.key())).thenReturn(held);
        return held;
    }

    private HeldPlayer self(Person who) {
        PlayerProfile own = PlayerProfile.builder().id(UUID.randomUUID()).personId(who.getId()).clubId(clubId).active(true)
                .medicalAidProvider("Discovery").build();
        HeldPlayer held = new HeldPlayer("self:" + own.getId(), who, who, own, null);
        when(access.resolve(auth, held.key())).thenReturn(held);
        return held;
    }

    /** What the player has now, resent unchanged, with isWicketKeeper (the one required field) set. */
    private UpdateMyPlayerRequest same(String medicalProvider, String medicalNumber, String email, LocalDate dob) {
        return new UpdateMyPlayerRequest(null, "0821234567", email, null, null, null, null, null, false,
                medicalProvider, medicalNumber, dob);
    }

    // ---- medical aid ----

    @Test
    void theMainAgentCanChangeMedicalAidAndTheEditIsAttributedToThem() {
        HeldPlayer held = linked(true);

        service.update(auth, held.key(), same("Bonitas", "999", "pat@example.com", null));

        assertThat(profile.getMedicalAidProvider()).isEqualTo("Bonitas");
        assertThat(profile.getMedicalAidMemberNumber()).isEqualTo("999");
        assertThat(profile.getUpdatedBy()).isEqualTo(caller.getId());
        verify(playerProfileRepository).save(profile);
    }

    @Test
    void aNonMainAgentCannotChangeMedicalAidAndNothingIsSaved() {
        HeldPlayer held = linked(false);

        assertThatThrownBy(() -> service.update(auth, held.key(), same("Bonitas", "999", "pat@example.com", null)))
                .isInstanceOf(AccessDeniedException.class);
        assertThat(profile.getMedicalAidProvider()).isEqualTo("Discovery");
        verify(playerProfileRepository, never()).save(any());
    }

    @Test
    void aNonMainAgentSendingNullMedicalOrTheStoredValuesLeavesThemUntouchedWithout403() {
        HeldPlayer held = linked(false);

        service.update(auth, held.key(), same(null, null, "pat@example.com", null));
        service.update(auth, held.key(), same("Discovery", "12345", "pat@example.com", null));

        assertThat(profile.getMedicalAidProvider()).isEqualTo("Discovery");
        assertThat(profile.getMedicalAidMemberNumber()).isEqualTo("12345");
        verify(playerProfileRepository, org.mockito.Mockito.times(2)).save(profile);
    }

    @Test
    void anAdultPlayerCanChangeTheirOwnMedicalAidButAMinorsOwnRecordCannot() {
        Person adult = person("Alex", "Adams", "alex@example.com", LocalDate.of(1990, 1, 1));
        HeldPlayer adultSelf = self(adult);
        service.update(auth, adultSelf.key(), same("Bonitas", "1", null, null));
        assertThat(adultSelf.profile().getMedicalAidProvider()).isEqualTo("Bonitas");

        Person minor = person("Mia", "Minor", null, LocalDate.now().minusYears(12));
        HeldPlayer minorSelf = self(minor);
        assertThatThrownBy(() -> service.update(auth, minorSelf.key(), same("Bonitas", "1", null, null)))
                .isInstanceOf(AccessDeniedException.class);
    }

    @Test
    void aPlayerWithNoDateOfBirthCountsAsAnAdultForMedicalAid() {
        Person unknownAge = person("Una", "Known", null, null);
        HeldPlayer held = self(unknownAge);

        service.update(auth, held.key(), same("Bonitas", "1", null, null));

        assertThat(held.profile().getMedicalAidProvider()).isEqualTo("Bonitas");
    }

    // ---- contact email ----

    @Test
    void aNonMainAgentCannotChangeTheContactEmailButMayResendTheStoredOne() {
        HeldPlayer held = linked(false);

        assertThatThrownBy(() -> service.update(auth, held.key(), same("Discovery", "12345", "other@example.com", null)))
                .isInstanceOf(AccessDeniedException.class);
        service.update(auth, held.key(), same("Discovery", "12345", "pat@example.com", null));
        assertThat(profile.getEmail()).isEqualTo("pat@example.com");
    }

    // ---- date of birth ----

    @Test
    void theMainAgentCanChangeTheDateOfBirthAndItIsStoredOnThePerson() {
        HeldPlayer held = linked(true);
        LocalDate corrected = LocalDate.of(2011, 6, 15);

        service.update(auth, held.key(), same("Discovery", "12345", "pat@example.com", corrected));

        assertThat(child.getDateOfBirth()).isEqualTo(corrected);
        verify(personRepository).save(child);
    }

    @Test
    void aNullOrUnchangedDateOfBirthWritesNothingToThePerson() {
        HeldPlayer held = linked(true);

        service.update(auth, held.key(), same("Discovery", "12345", "pat@example.com", null));
        service.update(auth, held.key(), same("Discovery", "12345", "pat@example.com", CHILD_DOB));

        assertThat(child.getDateOfBirth()).isEqualTo(CHILD_DOB);
        verify(personRepository, never()).save(any());
    }

    @Test
    void aNonMainAgentCannotChangeTheDateOfBirth() {
        HeldPlayer held = linked(false);

        assertThatThrownBy(() -> service.update(auth, held.key(),
                same("Discovery", "12345", "pat@example.com", LocalDate.of(2011, 6, 15))))
                .isInstanceOf(AccessDeniedException.class);
        assertThat(child.getDateOfBirth()).isEqualTo(CHILD_DOB);
    }

    @Test
    void aFutureTooEarlyOrOverOneHundredYearsDateOfBirthIsRefused() {
        HeldPlayer held = linked(true);
        for (LocalDate bad : new LocalDate[] {
            LocalDate.now().plusDays(1), LocalDate.of(1899, 12, 31), LocalDate.now().minusYears(101)}) {
            assertThatThrownBy(() -> service.update(auth, held.key(), same("Discovery", "12345", "pat@example.com", bad)))
                    .as(bad.toString()).isInstanceOf(ValidationException.class);
        }
        assertThat(child.getDateOfBirth()).isEqualTo(CHILD_DOB);
    }

    @Test
    void aDateJustInsideTheBoundsIsAccepted() {
        HeldPlayer held = linked(true);
        LocalDate oldest = LocalDate.now().minusYears(100).plusDays(1);

        service.update(auth, held.key(), same("Discovery", "12345", "pat@example.com", oldest));

        assertThat(child.getDateOfBirth()).isEqualTo(oldest);
        assertThat(LocalDate.of(1900, 1, 1).isBefore(oldest)).isTrue();
    }

    @Test
    void theAuditLogNamesTheChangedFieldsButNeverTheDateOfBirthValuesOrMedicalDetails() {
        HeldPlayer held = linked(true);
        LocalDate corrected = LocalDate.of(2011, 6, 15);

        service.update(auth, held.key(), same("Bonitas", "SECRET-999", "pat@example.com", corrected));

        String all = String.join("\n", logs.list.stream().map(ILoggingEvent::getFormattedMessage).toList());
        assertThat(all).contains("dateOfBirth");
        assertThat(all).doesNotContain("2011").doesNotContain("2012").doesNotContain("6-15");
        assertThat(all).doesNotContain("SECRET-999").doesNotContain("Bonitas").doesNotContain("Discovery");
    }

    // ---- response ----

    @Test
    void everyAgentSeesAllActiveAgentsMainFirstButOnlyTheMainAgentGetsMaskedEmailsAndLinkIds() {
        Person otherAgent = person("Olga", "Other", "olga@example.org", null);
        PersonLink mine = linked(true).link();
        PersonLink theirs = PersonLink.builder().id(UUID.randomUUID()).accountPersonId(otherAgent.getId())
                .subjectPersonId(child.getId()).clubId(clubId).status(PersonLinkStatus.ACTIVE).main(false)
                .createdAt(Instant.now()).build();
        when(personLinkRepository.findActiveBySubjectAndClub(child.getId(), clubId)).thenReturn(List.of(mine, theirs));

        MyPlayerDto asMain = service.get(auth, mine.getId().toString());
        assertThat(asMain.agentCount()).isEqualTo(2);
        assertThat(asMain.agents()).hasSize(2);
        assertThat(asMain.agents().get(0).main()).isTrue();
        assertThat(asMain.agents().get(0).you()).isTrue();
        assertThat(asMain.agents().get(1)).satisfies(a -> {
            assertThat(a.name()).isEqualTo("Olga Other");
            assertThat(a.maskedEmail()).isEqualTo("o***@example.org");
            assertThat(a.linkId()).isEqualTo(theirs.getId());
            assertThat(a.you()).isFalse();
        });
        assertThat(asMain.toString()).doesNotContain("olga@example.org");

        // the same player seen by a second, non-main agent
        Person second = person("Sec", "Ond", "sec@example.com", null);
        PersonLink secondLink = PersonLink.builder().id(UUID.randomUUID()).accountPersonId(second.getId())
                .subjectPersonId(child.getId()).clubId(clubId).status(PersonLinkStatus.ACTIVE).main(false)
                .createdAt(Instant.now()).build();
        HeldPlayer asSecond = new HeldPlayer(secondLink.getId().toString(), second, child, profile, secondLink);
        when(access.resolve(auth, asSecond.key())).thenReturn(asSecond);
        when(personLinkRepository.findActiveBySubjectAndClub(child.getId(), clubId))
                .thenReturn(List.of(mine, theirs, secondLink));

        MyPlayerDto seen = service.get(auth, asSecond.key());
        // all three agents, the main agent first, names for everyone, but no email and no link id for a non-main viewer
        assertThat(seen.agents()).hasSize(3);
        assertThat(seen.agents().get(0).main()).isTrue();
        assertThat(seen.agents()).filteredOn(a -> a.you()).singleElement().satisfies(a -> assertThat(a.name()).isEqualTo("Sec Ond"));
        assertThat(seen.agents()).allSatisfy(a -> {
            assertThat(a.maskedEmail()).isNull();
            assertThat(a.linkId()).isNull();
        });
        assertThat(seen.agents()).extracting(a -> a.name()).contains("Olga Other");
        assertThat(seen.agentCount()).isEqualTo(3);
        assertThat(seen.canManageAgents()).isFalse();
        assertThat(seen.toString()).doesNotContain("olga@example.org").doesNotContain("o***@").doesNotContain("sec@example.com");
    }

    @Test
    void anOpenInvitationIsShownToTheMainAgentByMaskedInvitedEmailOnly() {
        HeldPlayer held = linked(true);
        PersonLink invitation = PersonLink.builder().id(UUID.randomUUID()).invitedEmail("guest@example.net")
                .subjectPersonId(child.getId()).clubId(clubId).status(PersonLinkStatus.INVITED)
                .createdAt(Instant.now()).build();
        when(personLinkRepository.findActiveBySubjectAndClub(child.getId(), clubId)).thenReturn(List.of(held.link()));
        when(personLinkRepository.findOpenInvitationsBySubjectAndClub(any(), any(), any())).thenReturn(List.of(invitation));

        MyPlayerDto dto = service.get(auth, held.key());

        assertThat(dto.agents()).hasSize(2); // the main agent themself, then the invitation
        assertThat(dto.agents().get(1)).satisfies(a -> {
            assertThat(a.status()).isEqualTo(PersonLinkStatus.INVITED);
            assertThat(a.maskedEmail()).isEqualTo("g***@example.net");
        });
        assertThat(dto.toString()).doesNotContain("guest@example.net");
    }
}
