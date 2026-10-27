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
import com.cricketlegend.domain.LinkRequest;
import com.cricketlegend.domain.LinkRequestStatus;
import com.cricketlegend.domain.Person;
import com.cricketlegend.domain.Section;
import com.cricketlegend.dto.MyLinkRequestDto;
import com.cricketlegend.dto.SectionOptionDto;
import com.cricketlegend.dto.CreateLinkRequestRequest;
import com.cricketlegend.dto.LinkRequestReceivedDto;
import com.cricketlegend.exception.ConflictException;
import com.cricketlegend.exception.EmailNotVerifiedException;
import com.cricketlegend.exception.InvalidStatusTransitionException;
import com.cricketlegend.exception.LinkRateLimitedException;
import com.cricketlegend.exception.NotFoundException;
import com.cricketlegend.exception.ValidationException;
import com.cricketlegend.mapper.LinkRequestMapper;
import com.cricketlegend.repository.ClubRepository;
import com.cricketlegend.repository.LinkRequestRepository;
import com.cricketlegend.repository.PersonRepository;
import com.cricketlegend.service.LinkService;
import com.cricketlegend.service.support.LinkAttemptLimiter;
import com.cricketlegend.service.support.OwnMatch;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
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
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.oauth2.jwt.Jwt;

/** docs/specs/119, the requester's side: the typed request is untrusted input and the reply never reveals a match. */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class MyLinkRequestServiceImplTest {

    private static final String SUB = "sub-parent";
    private static final String REPLY = "Thanks, the club will review this";
    private static final LocalDate DOB = LocalDate.of(2012, 6, 15);

    @Mock private PersonRepository personRepository;
    @Mock private ClubRepository clubRepository;
    @Mock private LinkRequestRepository linkRequestRepository;
    @Mock private com.cricketlegend.repository.SectionRepository sectionRepository;
    @Mock private LinkService linkService;
    @Mock private LinkAttemptLimiter limiter;

    private MyLinkRequestServiceImpl service;
    private final TestingAuthenticationToken auth = new TestingAuthenticationToken(SUB, null, List.of());
    private Person caller;
    private Club club;

    @BeforeEach
    void setUp() {
        service = new MyLinkRequestServiceImpl(
                personRepository, clubRepository, linkRequestRepository, sectionRepository, linkService, limiter, new LinkRequestMapper());
        caller = Person.builder().id(UUID.randomUUID()).firstName("Pat").lastName("Parent").email("p@example.com").build();
        club = Club.builder().id(UUID.randomUUID()).name("Hillcrest CC").slug("hillcrest").status(ClubStatus.ACTIVE).build();
        when(personRepository.findByKeycloakUserId(SUB)).thenReturn(Optional.of(caller));
        when(clubRepository.findById(club.getId())).thenReturn(Optional.of(club));
        when(linkRequestRepository.save(any(LinkRequest.class))).thenAnswer(i -> i.getArgument(0));
    }

    private Jwt jwt(boolean verified) {
        return Jwt.withTokenValue("t").header("alg", "none").subject(SUB).issuedAt(Instant.now())
                .expiresAt(Instant.now().plusSeconds(60)).claim("email", "p@example.com")
                .claim("email_verified", verified).build();
    }

    private CreateLinkRequestRequest body(LocalDate dob, String targetRef) {
        return new CreateLinkRequestRequest(club.getId(), "  Sam ", " Smith ", dob, "082 123 4567", " Please link ", targetRef, null);
    }

    @Test
    void aTypedRequestStoresTheFullDateOfBirthTrimmedNamesAndAPendingStatus() {
        LinkRequestReceivedDto reply = service.create(auth, jwt(true), body(DOB, null));

        ArgumentCaptor<LinkRequest> saved = ArgumentCaptor.forClass(LinkRequest.class);
        verify(linkRequestRepository).save(saved.capture());
        LinkRequest request = saved.getValue();
        assertThat(request.getTypedDateOfBirth()).isEqualTo(DOB);
        assertThat(request.getTypedFirstName()).isEqualTo("Sam");
        assertThat(request.getTypedLastName()).isEqualTo("Smith");
        assertThat(request.getMessage()).isEqualTo("Please link");
        assertThat(request.getContactNumber()).isEqualTo("082 123 4567");
        assertThat(request.getAccountPersonId()).isEqualTo(caller.getId());
        assertThat(request.getStatus()).isEqualTo(LinkRequestStatus.PENDING);
        assertThat(reply.message()).isEqualTo(REPLY);
        verify(limiter).countRequest(caller.getId());
    }

    @Test
    void theReplyIsIdenticalForATypedRequestAShownPlayerAndARepeat() {
        UUID profileId = UUID.randomUUID();
        when(linkService.findOwnMatch(any(), eq(caller.getId()), eq("ref-1")))
                .thenReturn(Optional.of(new OwnMatch(profileId, club.getId())));

        LinkRequestReceivedDto typed = service.create(auth, jwt(true), body(DOB, null));
        LinkRequestReceivedDto shown = service.create(auth, jwt(true), body(DOB, "ref-1"));
        when(linkRequestRepository
                        .existsByAccountPersonIdAndClubIdAndStatusAndTypedDateOfBirthAndTypedFirstNameIgnoreCaseAndTypedLastNameIgnoreCase(
                                any(), any(), any(), any(), any(), any()))
                .thenReturn(true);
        LinkRequestReceivedDto repeat = service.create(auth, jwt(true), body(DOB, null));

        assertThat(shown).isEqualTo(typed);
        assertThat(repeat).isEqualTo(typed);
        // the repeat added nothing
        verify(linkRequestRepository, org.mockito.Mockito.times(2)).save(any());
    }

    @Test
    void aShownPlayerIsStoredAsTheTargetOnlyWhenItIsAtTheSameClub() {
        UUID profileId = UUID.randomUUID();
        when(linkService.findOwnMatch(any(), eq(caller.getId()), eq("ref-1")))
                .thenReturn(Optional.of(new OwnMatch(profileId, club.getId())));
        when(linkService.findOwnMatch(any(), eq(caller.getId()), eq("ref-elsewhere")))
                .thenReturn(Optional.of(new OwnMatch(UUID.randomUUID(), UUID.randomUUID())));

        service.create(auth, jwt(true), body(DOB, "ref-1"));
        ArgumentCaptor<LinkRequest> saved = ArgumentCaptor.forClass(LinkRequest.class);
        verify(linkRequestRepository).save(saved.capture());
        assertThat(saved.getValue().getTargetPlayerProfileId()).isEqualTo(profileId);

        assertThatThrownBy(() -> service.create(auth, jwt(true), body(DOB, "ref-elsewhere")))
                .isInstanceOf(ValidationException.class);
        assertThatThrownBy(() -> service.create(auth, jwt(true), body(DOB, "made-up")))
                .isInstanceOf(ValidationException.class);
    }

    @Test
    void anUnverifiedEmailIsRefusedAndNothingIsRead() {
        assertThatThrownBy(() -> service.create(auth, jwt(false), body(DOB, null)))
                .isInstanceOf(EmailNotVerifiedException.class);
        verifyNoInteractions(linkRequestRepository, limiter);
    }

    @Test
    void aFutureOrImplausiblyOldDateOfBirthIsRefused() {
        assertThatThrownBy(() -> service.create(auth, jwt(true), body(LocalDate.now().plusDays(1), null)))
                .isInstanceOf(ValidationException.class);
        assertThatThrownBy(() -> service.create(auth, jwt(true), body(LocalDate.of(1899, 12, 31), null)))
                .isInstanceOf(ValidationException.class);
        verify(linkRequestRepository, never()).save(any());
    }

    @Test
    void anUnknownOrInactiveClubIsNotFound() {
        club.setStatus(ClubStatus.SUSPENDED);
        assertThatThrownBy(() -> service.create(auth, jwt(true), body(DOB, null))).isInstanceOf(NotFoundException.class);
    }

    @Test
    void theDailyLimitIs429AndNothingIsSaved() {
        org.mockito.Mockito.doThrow(new LinkRateLimitedException(3600)).when(limiter).countRequest(caller.getId());

        assertThatThrownBy(() -> service.create(auth, jwt(true), body(DOB, null)))
                .isInstanceOf(LinkRateLimitedException.class);
        verify(linkRequestRepository, never()).save(any());
    }

    @Test
    void aFourthPendingRequestAtTheSameClubIsAConflict() {
        when(linkRequestRepository.countByAccountPersonIdAndClubIdAndStatus(
                        caller.getId(), club.getId(), LinkRequestStatus.PENDING))
                .thenReturn(3L);

        assertThatThrownBy(() -> service.create(auth, jwt(true), body(DOB, null))).isInstanceOf(ConflictException.class);
        verify(linkRequestRepository, never()).save(any());
    }

    @Test
    void twoPendingRequestsAreStillAllowed() {
        when(linkRequestRepository.countByAccountPersonIdAndClubIdAndStatus(
                        caller.getId(), club.getId(), LinkRequestStatus.PENDING))
                .thenReturn(2L);

        assertThat(service.create(auth, jwt(true), body(DOB, null)).message()).isEqualTo(REPLY);
    }

    @Test
    void cancellingAnotherAccountsRequestIsNotFound() {
        LinkRequest foreign = LinkRequest.builder().id(UUID.randomUUID()).accountPersonId(UUID.randomUUID())
                .status(LinkRequestStatus.PENDING).build();
        when(linkRequestRepository.findById(foreign.getId())).thenReturn(Optional.of(foreign));

        assertThatThrownBy(() -> service.cancel(auth, foreign.getId())).isInstanceOf(NotFoundException.class);
        assertThat(foreign.getStatus()).isEqualTo(LinkRequestStatus.PENDING);
    }

    @Test
    void onlyAPendingOwnRequestCanBeCancelled() {
        LinkRequest pending = LinkRequest.builder().id(UUID.randomUUID()).accountPersonId(caller.getId())
                .clubId(club.getId()).status(LinkRequestStatus.PENDING).build();
        LinkRequest decided = LinkRequest.builder().id(UUID.randomUUID()).accountPersonId(caller.getId())
                .clubId(club.getId()).status(LinkRequestStatus.APPROVED).build();
        when(linkRequestRepository.findById(pending.getId())).thenReturn(Optional.of(pending));
        when(linkRequestRepository.findById(decided.getId())).thenReturn(Optional.of(decided));

        service.cancel(auth, pending.getId());
        assertThat(pending.getStatus()).isEqualTo(LinkRequestStatus.CANCELLED);
        assertThatThrownBy(() -> service.cancel(auth, decided.getId())).isInstanceOf(InvalidStatusTransitionException.class);
    }

    @Test
    void aLoginWithNoPersonHasNoRequests() {
        when(personRepository.findByKeycloakUserId(SUB)).thenReturn(Optional.empty());
        assertThat(service.list(auth)).isEmpty();
    }

    // ---- sections (spec 119 Decision 31) ----

    private Section section(String name, boolean active, UUID parentId) {
        return Section.builder().id(UUID.randomUUID()).clubId(club.getId()).name(name).active(active)
                .parentSectionId(parentId).build();
    }

    private CreateLinkRequestRequest bodyWithSection(UUID sectionId, String targetRef) {
        return new CreateLinkRequestRequest(club.getId(), "Sam", "Smith", DOB, "082 123 4567", null, targetRef, sectionId);
    }

    private LinkRequest savedRequest() {
        ArgumentCaptor<LinkRequest> saved = ArgumentCaptor.forClass(LinkRequest.class);
        verify(linkRequestRepository).save(saved.capture());
        return saved.getValue();
    }

    @Test
    void aTypedRequestToAClubWithSectionsStoresTheChosenSection() {
        Section juniors = section("Juniors", true, null);
        when(sectionRepository.findByClubId(club.getId())).thenReturn(List.of(juniors, section("Vets", true, null)));

        service.create(auth, jwt(true), bodyWithSection(juniors.getId(), null));

        assertThat(savedRequest().getSectionId()).isEqualTo(juniors.getId());
    }

    @Test
    void aTypedRequestToAClubWithSectionsNeedsOne() {
        when(sectionRepository.findByClubId(club.getId())).thenReturn(List.of(section("Juniors", true, null)));

        assertThatThrownBy(() -> service.create(auth, jwt(true), bodyWithSection(null, null)))
                .isInstanceOf(ValidationException.class);
        verify(linkRequestRepository, never()).save(any());
        verifyNoInteractions(limiter);
    }

    @Test
    void aSectionOutsideTheClubsActiveSectionsIsRefused() {
        Section retired = section("Retired", false, null);
        when(sectionRepository.findByClubId(club.getId())).thenReturn(List.of(section("Juniors", true, null), retired));

        assertThatThrownBy(() -> service.create(auth, jwt(true), bodyWithSection(UUID.randomUUID(), null)))
                .isInstanceOf(ValidationException.class);
        assertThatThrownBy(() -> service.create(auth, jwt(true), bodyWithSection(retired.getId(), null)))
                .isInstanceOf(ValidationException.class);
        verify(linkRequestRepository, never()).save(any());
    }

    @Test
    void aClubWithNoActiveSectionsStoresNoSectionAndIgnoresOneSent() {
        when(sectionRepository.findByClubId(club.getId())).thenReturn(List.of(section("Retired", false, null)));

        service.create(auth, jwt(true), bodyWithSection(UUID.randomUUID(), null));

        assertThat(savedRequest().getSectionId()).isNull();
    }

    @Test
    void aRequestWithATargetPlayerNeedsNoSectionButAChosenOneIsStored() {
        UUID profileId = UUID.randomUUID();
        Section juniors = section("Juniors", true, null);
        when(sectionRepository.findByClubId(club.getId())).thenReturn(List.of(juniors));
        when(linkService.findOwnMatch(any(), eq(caller.getId()), eq("ref-1")))
                .thenReturn(Optional.of(new OwnMatch(profileId, club.getId())));

        service.create(auth, jwt(true), bodyWithSection(null, "ref-1"));
        service.create(auth, jwt(true), new CreateLinkRequestRequest(club.getId(), "Tom", "Jones", DOB, "082 123 4567",
                null, "ref-1", juniors.getId()));

        ArgumentCaptor<LinkRequest> saved = ArgumentCaptor.forClass(LinkRequest.class);
        verify(linkRequestRepository, org.mockito.Mockito.times(2)).save(saved.capture());
        assertThat(saved.getAllValues().get(0).getSectionId()).isNull();
        assertThat(saved.getAllValues().get(1).getSectionId()).isEqualTo(juniors.getId());
    }

    @Test
    void sectionOptionsAreTheActiveSectionsByNameWithTheParentNameAsGroupLabel() {
        Section senior = section("Senior", true, null);
        Section firsts = section("1st XI", true, senior.getId());
        Section colts = section("colts", true, null);
        Section retired = section("Aardvarks", false, null);
        when(sectionRepository.findByClubId(club.getId())).thenReturn(List.of(senior, colts, retired, firsts));

        List<SectionOptionDto> options = service.sectionOptions(jwt(true), club.getId());

        assertThat(options).extracting(SectionOptionDto::name).containsExactly("1st XI", "colts", "Senior");
        assertThat(options.get(0).groupLabel()).isEqualTo("Senior");
        assertThat(options.get(1).groupLabel()).isNull();
    }

    @Test
    void sectionOptionsNeedAVerifiedEmailAndAnActiveClub() {
        assertThatThrownBy(() -> service.sectionOptions(jwt(false), club.getId()))
                .isInstanceOf(EmailNotVerifiedException.class);
        assertThatThrownBy(() -> service.sectionOptions(jwt(true), UUID.randomUUID()))
                .isInstanceOf(NotFoundException.class);
        club.setStatus(ClubStatus.SUSPENDED);
        assertThatThrownBy(() -> service.sectionOptions(jwt(true), club.getId())).isInstanceOf(NotFoundException.class);
    }

    @Test
    void myRequestsCarryTheSectionName() {
        Section juniors = section("Juniors", true, null);
        LinkRequest withSection = LinkRequest.builder().id(UUID.randomUUID()).accountPersonId(caller.getId())
                .clubId(club.getId()).typedFirstName("Sam").typedLastName("Smith").sectionId(juniors.getId())
                .status(LinkRequestStatus.PENDING).build();
        LinkRequest without = LinkRequest.builder().id(UUID.randomUUID()).accountPersonId(caller.getId())
                .clubId(club.getId()).typedFirstName("Tom").typedLastName("Jones").status(LinkRequestStatus.PENDING).build();
        when(linkRequestRepository.findByAccountPersonIdOrderByCreatedAtDesc(caller.getId()))
                .thenReturn(List.of(withSection, without));
        when(clubRepository.findAllById(any())).thenReturn(List.of(club));
        when(sectionRepository.findAllById(any())).thenReturn(List.of(juniors));

        List<MyLinkRequestDto> mine = service.list(auth);

        assertThat(mine).extracting(MyLinkRequestDto::sectionName).containsExactly("Juniors", null);
    }
}
