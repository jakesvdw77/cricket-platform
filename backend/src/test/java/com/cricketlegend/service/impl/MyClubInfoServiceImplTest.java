package com.cricketlegend.service.impl;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.cricketlegend.domain.Address;
import com.cricketlegend.domain.Club;
import com.cricketlegend.domain.ClubContact;
import com.cricketlegend.domain.ClubProfile;
import com.cricketlegend.domain.ClubProfileType;
import com.cricketlegend.domain.Contact;
import com.cricketlegend.domain.Person;
import com.cricketlegend.domain.PersonLink;
import com.cricketlegend.domain.PlayerProfile;
import com.cricketlegend.domain.SocialLink;
import com.cricketlegend.dto.MyClubContactPageDto;
import com.cricketlegend.dto.MyClubInfoDto;
import com.cricketlegend.exception.NotFoundException;
import com.cricketlegend.exception.ValidationException;
import com.cricketlegend.repository.ClubContactRepository;
import com.cricketlegend.repository.ClubProfileRepository;
import com.cricketlegend.repository.ClubRepository;
import com.cricketlegend.service.support.HeldPlayer;
import com.cricketlegend.service.support.MyPlayerAccess;
import java.time.LocalDate;
import java.util.ArrayList;
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
import org.springframework.data.domain.Pageable;
import org.springframework.security.core.Authentication;

/** Unit tests for docs/specs/148-player-hub-club-info.md's Club info switches, tabs and directory rules. */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class MyClubInfoServiceImplTest {

    @Mock private MyPlayerAccess myPlayerAccess;
    @Mock private ClubRepository clubRepository;
    @Mock private ClubProfileRepository clubProfileRepository;
    @Mock private ClubContactRepository clubContactRepository;
    @Mock private Authentication authentication;

    private MyClubInfoServiceImpl service;
    private final UUID clubId = UUID.randomUUID();
    private HeldPlayer held;

    @BeforeEach
    void setUp() {
        service = new MyClubInfoServiceImpl(myPlayerAccess, clubRepository, clubProfileRepository, clubContactRepository);
        held = adultSelf();
        when(myPlayerAccess.resolve(authentication, "key")).thenAnswer(i -> held);
        when(clubRepository.findById(clubId)).thenReturn(Optional.of(Club.builder().id(clubId).name("Hillcrest CC").build()));
        when(clubContactRepository.countDirectory(eq(clubId), anyString(), anyString())).thenReturn(0L);
        when(clubContactRepository.directoryByName(eq(clubId), anyString(), anyString(), any(Pageable.class))).thenReturn(List.of());
        when(clubContactRepository.directoryByRole(eq(clubId), anyString(), anyString(), any(Pageable.class))).thenReturn(List.of());
        when(clubContactRepository.directoryLetters(eq(clubId), anyString())).thenReturn(List.of());
    }

    // ---- fixtures ----

    private HeldPlayer adultSelf() {
        Person me = Person.builder().id(UUID.randomUUID()).firstName("Ada").lastName("Adult")
                .dateOfBirth(LocalDate.now().minusYears(30)).build();
        return new HeldPlayer("key", me, me, PlayerProfile.builder().clubId(clubId).build(), null);
    }

    private HeldPlayer juniorSelf() {
        Person me = Person.builder().id(UUID.randomUUID()).firstName("Jo").lastName("Junior")
                .dateOfBirth(LocalDate.now().minusYears(12)).build();
        return new HeldPlayer("key", me, me, PlayerProfile.builder().clubId(clubId).build(), null);
    }

    private HeldPlayer linkedNonMain() {
        Person caller = Person.builder().id(UUID.randomUUID()).firstName("Al").lastName("Agent").build();
        Person kid = Person.builder().id(UUID.randomUUID()).firstName("Sam").lastName("Smith")
                .dateOfBirth(LocalDate.now().minusYears(10)).build();
        return new HeldPlayer("key", caller, kid, PlayerProfile.builder().clubId(clubId).build(), PersonLink.builder().main(false).build());
    }

    /** A profile with every Club info switch on and every block filled in. */
    private ClubProfile full() {
        ClubProfile p = ClubProfile.builder().clubId(clubId).type(ClubProfileType.CLUB).email("hi@club.test").phone("0211234567")
                .website("https://club.test").logoUrl("/media/logo.png").bannerUrl("/media/banner.png")
                .address(Address.builder().number("1").street("High St").city("Cape Town").country("ZA").build())
                .socialLinks(new ArrayList<>(List.of(SocialLink.builder().platform("Facebook").url("https://facebook.com/club").build())))
                .build();
        p.setHubInfoDirectory(true);
        p.setHubInfoDirectoryPhone(true);
        p.setHubInfoDirectoryEmail(true);
        return p;
    }

    private void profile(ClubProfile p) {
        when(clubProfileRepository.findById(clubId)).thenReturn(Optional.of(p));
    }

    private void contactTotal(long total) {
        when(clubContactRepository.countDirectory(eq(clubId), eq("%"), eq(""))).thenReturn(total);
    }

    private static ClubContact contact(String first, String last, String role, String phone, String email, boolean primary) {
        return ClubContact.builder().id(UUID.randomUUID()).role(role).isPrimary(primary).active(true)
                .contact(Contact.builder().firstName(first).lastName(last).phone(phone).email(email).build()).build();
    }

    // ---- info: switches ----

    @Test
    void everythingOnShowsEveryBlockAndTheTabsInOrder() {
        profile(full());
        contactTotal(3);

        MyClubInfoDto dto = service.info(authentication, "key");

        assertThat(dto.clubName()).isEqualTo("Hillcrest CC");
        assertThat(dto.about().type()).isEqualTo("CLUB");
        assertThat(dto.about().address().street()).isEqualTo("High St");
        assertThat(dto.about().phone()).isEqualTo("0211234567");
        assertThat(dto.about().email()).isEqualTo("hi@club.test");
        assertThat(dto.logos().logoUrl()).isEqualTo("/media/logo.png");
        assertThat(dto.links().website()).isEqualTo("https://club.test");
        assertThat(dto.links().social()).hasSize(1);
        assertThat(dto.directory().total()).isEqualTo(3);
        assertThat(dto.directory().phoneShown()).isTrue();
        assertThat(dto.directory().emailShown()).isTrue();
        assertThat(dto.tabs()).extracting("id").containsExactly("about", "contacts", "links");
        assertThat(dto.tabs()).extracting("count").containsExactly(null, 3, 2);
    }

    @Test
    void identityOffHidesTypeAndAddressOnly() {
        ClubProfile p = full();
        p.setHubInfoIdentity(false);
        profile(p);

        MyClubInfoDto dto = service.info(authentication, "key");

        assertThat(dto.about().type()).isNull();
        assertThat(dto.about().address()).isNull();
        assertThat(dto.about().phone()).isEqualTo("0211234567");
        assertThat(dto.logos()).isNotNull();
        assertThat(dto.links()).isNotNull();
    }

    @Test
    void contactOffHidesTheClubPhoneAndEmailOnly() {
        ClubProfile p = full();
        p.setHubInfoContact(false);
        profile(p);

        MyClubInfoDto dto = service.info(authentication, "key");

        assertThat(dto.about().phone()).isNull();
        assertThat(dto.about().email()).isNull();
        assertThat(dto.about().type()).isEqualTo("CLUB");
        assertThat(dto.about().address()).isNotNull();
        assertThat(dto.logos()).isNotNull();
    }

    @Test
    void linksOffHidesTheLinksBlockAndTabOnly() {
        ClubProfile p = full();
        p.setHubInfoLinks(false);
        profile(p);

        MyClubInfoDto dto = service.info(authentication, "key");

        assertThat(dto.links()).isNull();
        assertThat(dto.tabs()).extracting("id").containsExactly("about");
        assertThat(dto.about()).isNotNull();
    }

    @Test
    void logosOffHidesTheLogosBlockOnly() {
        ClubProfile p = full();
        p.setHubInfoLogos(false);
        profile(p);

        MyClubInfoDto dto = service.info(authentication, "key");

        assertThat(dto.logos()).isNull();
        assertThat(dto.about().type()).isEqualTo("CLUB");
        assertThat(dto.about().phone()).isEqualTo("0211234567");
    }

    @Test
    void aboutIsVisibleWhenOnlyTheLogosAreOnAndTheClubHasALogo() {
        ClubProfile p = full();
        p.setHubInfoIdentity(false);
        p.setHubInfoContact(false);
        p.setHubInfoLinks(false);
        profile(p);

        MyClubInfoDto dto = service.info(authentication, "key");

        assertThat(dto.about()).isNotNull();
        assertThat(dto.about().type()).isNull();
        assertThat(dto.about().address()).isNull();
        assertThat(dto.about().phone()).isNull();
        assertThat(dto.about().email()).isNull();
        assertThat(dto.logos().logoUrl()).isEqualTo("/media/logo.png");
        assertThat(dto.tabs()).extracting("id").containsExactly("about");
    }

    @Test
    void logoDownloadSwitchIsReportedOnTheLogosBlock() {
        ClubProfile p = full();
        p.setHubInfoLogoDownload(true);
        profile(p);

        assertThat(service.info(authentication, "key").logos().downloadable()).isTrue();
    }

    @Test
    void everySwitchOffGivesNoTabsAndNoBlocksButTheClubName() {
        ClubProfile p = full();
        p.setHubInfoIdentity(false);
        p.setHubInfoContact(false);
        p.setHubInfoLinks(false);
        p.setHubInfoLogos(false);
        p.setHubInfoDirectory(false);
        profile(p);

        MyClubInfoDto dto = service.info(authentication, "key");

        assertThat(dto.clubName()).isEqualTo("Hillcrest CC");
        assertThat(dto.tabs()).isEmpty();
        assertThat(dto.about()).isNull();
        assertThat(dto.logos()).isNull();
        assertThat(dto.links()).isNull();
        assertThat(dto.directory()).isNull();
    }

    @Test
    void aClubWithNothingSetHasNoTabs() {
        profile(ClubProfile.builder().clubId(clubId).build());

        MyClubInfoDto dto = service.info(authentication, "key");

        assertThat(dto.tabs()).isEmpty();
        assertThat(dto.about()).isNull();
        assertThat(dto.links()).isNull();
        assertThat(dto.clubName()).isEqualTo("Hillcrest CC");
    }

    @Test
    void aClubWithNoProfileRowReadsTheDefaults() {
        when(clubProfileRepository.findById(clubId)).thenReturn(Optional.empty());

        MyClubInfoDto dto = service.info(authentication, "key");

        assertThat(dto.clubName()).isEqualTo("Hillcrest CC");
        assertThat(dto.tabs()).isEmpty();
        assertThat(dto.directory()).isNull();
        // the default has the directory off, so the contacts are never even counted
        verify(clubContactRepository, never()).countDirectory(any(), anyString(), anyString());
    }

    @Test
    void onlyHttpsSocialLinksAndWebsiteAreKept() {
        ClubProfile p = full();
        p.setWebsite("http://insecure.test");
        p.setSocialLinks(new ArrayList<>(List.of(
                SocialLink.builder().platform("Facebook").url("https://facebook.com/club").build(),
                SocialLink.builder().platform("Old").url("http://old.test").build(),
                SocialLink.builder().platform("Bad").url("javascript:alert(1)").build())));
        profile(p);

        MyClubInfoDto dto = service.info(authentication, "key");

        assertThat(dto.links().website()).isNull();
        assertThat(dto.links().social()).extracting("url").containsExactly("https://facebook.com/club");
        assertThat(dto.tabs()).extracting("id", "count").contains(org.assertj.core.groups.Tuple.tuple("links", 1));
    }

    @Test
    void noHttpsLinkAtAllMeansNoLinksBlockAndNoLinksTab() {
        ClubProfile p = full();
        p.setWebsite("http://insecure.test");
        p.setSocialLinks(new ArrayList<>(List.of(SocialLink.builder().platform("Old").url("http://old.test").build())));
        profile(p);

        MyClubInfoDto dto = service.info(authentication, "key");

        assertThat(dto.links()).isNull();
        assertThat(dto.tabs()).extracting("id").doesNotContain("links");
    }

    @Test
    void blankValuesAreTurnedIntoNulls() {
        ClubProfile p = full();
        p.setPhone("  ");
        p.setEmail("");
        p.setAddress(Address.builder().street("  ").city("").build());
        profile(p);

        MyClubInfoDto dto = service.info(authentication, "key");

        assertThat(dto.about().phone()).isNull();
        assertThat(dto.about().email()).isNull();
        assertThat(dto.about().address()).isNull();
    }

    @Test
    void theContactsTabNeedsTheDirectoryOnAContactToShowAndAnAllowedViewer() {
        ClubProfile p = full();
        profile(p);
        contactTotal(0);
        assertThat(service.info(authentication, "key").tabs()).extracting("id").doesNotContain("contacts");

        contactTotal(2);
        held = juniorSelf();
        MyClubInfoDto junior = service.info(authentication, "key");
        assertThat(junior.directory()).isNull();
        assertThat(junior.tabs()).extracting("id").doesNotContain("contacts");
        assertThat(junior.about()).isNotNull();

        held = linkedNonMain();
        assertThat(service.info(authentication, "key").tabs()).extracting("id").contains("contacts");
    }

    @Test
    void theDirectoryPhoneAndEmailCountAsOffWhenTheDirectoryIsOff() {
        ClubProfile p = full();
        p.setHubInfoDirectory(false);
        p.setHubInfoDirectoryPhone(true);
        p.setHubInfoDirectoryEmail(true);
        profile(p);
        contactTotal(5);

        MyClubInfoDto dto = service.info(authentication, "key");

        assertThat(dto.directory()).isNull();
    }

    @Test
    void thePhoneAndEmailColumnsFollowTheirOwnSwitches() {
        ClubProfile p = full();
        p.setHubInfoDirectoryEmail(false);
        profile(p);
        contactTotal(1);

        assertThat(service.info(authentication, "key").directory().phoneShown()).isTrue();
        assertThat(service.info(authentication, "key").directory().emailShown()).isFalse();
    }

    // ---- contacts: access ----

    @Test
    void aJuniorsOwnLoginAsksForContactsAndGetsNotFoundBeforeAnyValidation() {
        held = juniorSelf();
        profile(full());

        assertThatThrownBy(() -> service.contacts(authentication, "key", "x".repeat(61), "bogus", "AB", -1, 500))
                .isInstanceOf(NotFoundException.class)
                .hasMessage("Contacts are not shared");
        verifyNoInteractions(clubContactRepository);
    }

    @Test
    void aClubWithTheDirectoryOffAnswersNotFoundBeforeAnyValidation() {
        ClubProfile p = full();
        p.setHubInfoDirectory(false);
        profile(p);

        assertThatThrownBy(() -> service.contacts(authentication, "key", null, "bogus", "a", 0, 0))
                .isInstanceOf(NotFoundException.class)
                .hasMessage("Contacts are not shared");
    }

    @Test
    void aClubWithNoProfileRowHasTheDirectoryOff() {
        when(clubProfileRepository.findById(clubId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.contacts(authentication, "key", null, null, null, null, null))
                .isInstanceOf(NotFoundException.class)
                .hasMessage("Contacts are not shared");
    }

    @Test
    void aKeyThatIsNotHeldPassesTheAccessNotFoundThrough() {
        when(myPlayerAccess.resolve(authentication, "nope")).thenThrow(new NotFoundException("Player not found"));

        assertThatThrownBy(() -> service.contacts(authentication, "nope", null, null, null, null, null))
                .isInstanceOf(NotFoundException.class).hasMessage("Player not found");
        assertThatThrownBy(() -> service.info(authentication, "nope")).isInstanceOf(NotFoundException.class);
    }

    // ---- contacts: validation ----

    private void assertBadRequest(String query, String sort, String letter, Integer page, Integer size) {
        profile(full());
        assertThatThrownBy(() -> service.contacts(authentication, "key", query, sort, letter, page, size))
                .isInstanceOf(ValidationException.class);
        verify(clubContactRepository, never()).countDirectory(any(), anyString(), anyString());
    }

    @Test
    void sizeAboveFiftyIsRejected() {
        assertBadRequest(null, null, null, 0, 51);
    }

    @Test
    void sizeZeroIsRejected() {
        assertBadRequest(null, null, null, 0, 0);
    }

    @Test
    void aNegativePageIsRejected() {
        assertBadRequest(null, null, null, -1, 10);
    }

    @Test
    void aQueryOfSixtyOneCharactersIsRejected() {
        assertBadRequest("x".repeat(61), null, null, 0, 10);
    }

    @Test
    void aTwoLetterOrLowerCaseLetterIsRejected() {
        assertBadRequest(null, null, "AB", 0, 10);
        assertBadRequest(null, null, "a", 0, 10);
    }

    @Test
    void anUnknownSortIsRejected() {
        assertBadRequest(null, "x", null, 0, 10);
    }

    @Test
    void theLimitsThemselvesAreAccepted() {
        profile(full());

        service.contacts(authentication, "key", "x".repeat(60), "role", "#", 0, 50);
        service.contacts(authentication, "key", null, "name", "Z", 0, 1);
    }

    // ---- contacts: behaviour ----

    @Test
    void defaultsAreNameSortPageZeroSizeTwentyFive() {
        profile(full());

        MyClubContactPageDto page = service.contacts(authentication, "key", null, null, null, null, null);

        assertThat(page.page()).isZero();
        assertThat(page.size()).isEqualTo(25);
        ArgumentCaptor<Pageable> pageable = ArgumentCaptor.forClass(Pageable.class);
        verify(clubContactRepository).directoryByName(eq(clubId), eq("%"), eq(""), pageable.capture());
        verify(clubContactRepository, never()).directoryByRole(any(), anyString(), anyString(), any());
        assertThat(pageable.getValue().getPageNumber()).isZero();
        assertThat(pageable.getValue().getPageSize()).isEqualTo(25);
    }

    @Test
    void sortRoleUsesTheRoleQuery() {
        profile(full());

        service.contacts(authentication, "key", null, "role", null, 1, 10);

        verify(clubContactRepository).directoryByRole(eq(clubId), eq("%"), eq(""), any(Pageable.class));
        verify(clubContactRepository, never()).directoryByName(any(), anyString(), anyString(), any());
    }

    @Test
    void theQueryIsEscapedAndPassedAsALowerCasePatternAndTheLetterIsPassedThrough() {
        profile(full());

        service.contacts(authentication, "key", " 50%_Off ", null, "S", 0, 10);

        verify(clubContactRepository).directoryByName(eq(clubId), eq("%50!%!_off%"), eq("S"), any(Pageable.class));
        verify(clubContactRepository).countDirectory(clubId, "%50!%!_off%", "S");
    }

    @Test
    void lettersAreComputedOverTheQueryFilteredSetNotTheLetterFilter() {
        profile(full());
        when(clubContactRepository.directoryLetters(clubId, "%sm%")).thenReturn(List.of("#", "S", "A"));

        MyClubContactPageDto page = service.contacts(authentication, "key", "Sm", null, "S", 0, 10);

        assertThat(page.letters()).containsExactly("A", "S", "#");
        verify(clubContactRepository).directoryLetters(clubId, "%sm%");
    }

    @Test
    void phoneAndEmailAppearOnlyWhenTheirSwitchesAreOnAndBlankValuesAreNull() {
        ClubProfile p = full();
        p.setHubInfoDirectoryEmail(false);
        profile(p);
        when(clubContactRepository.countDirectory(clubId, "%", "")).thenReturn(2L);
        when(clubContactRepository.directoryByName(eq(clubId), eq("%"), eq(""), any(Pageable.class))).thenReturn(List.of(
                contact("Ann", "Able", "Treasurer", "0821111111", "ann@club.test", true),
                contact("Bob", "Baker", "Coach", "", "", false)));

        MyClubContactPageDto page = service.contacts(authentication, "key", null, null, null, 0, 25);

        assertThat(page.items()).hasSize(2);
        assertThat(page.items().get(0).phone()).isEqualTo("0821111111");
        assertThat(page.items().get(0).email()).isNull();
        assertThat(page.items().get(0).primary()).isTrue();
        assertThat(page.items().get(0).role()).isEqualTo("Treasurer");
        assertThat(page.items().get(1).phone()).isNull();
        assertThat(page.items().get(1).email()).isNull();
        assertThat(page.total()).isEqualTo(2);
    }

    @Test
    void hasMoreIsTrueOnlyWhenAnotherPageRemains() {
        profile(full());

        when(clubContactRepository.countDirectory(clubId, "%", "")).thenReturn(51L);
        assertThat(service.contacts(authentication, "key", null, null, null, 0, 25).hasMore()).isTrue();
        assertThat(service.contacts(authentication, "key", null, null, null, 1, 25).hasMore()).isTrue();
        assertThat(service.contacts(authentication, "key", null, null, null, 2, 25).hasMore()).isFalse();

        when(clubContactRepository.countDirectory(clubId, "%", "")).thenReturn(50L);
        assertThat(service.contacts(authentication, "key", null, null, null, 1, 25).hasMore()).isFalse();
        assertThat(service.contacts(authentication, "key", null, null, null, 0, 25).hasMore()).isTrue();
    }
}
