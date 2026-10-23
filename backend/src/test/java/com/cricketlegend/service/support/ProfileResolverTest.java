package com.cricketlegend.service.support;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.cricketlegend.config.AccessService;
import com.cricketlegend.domain.Club;
import com.cricketlegend.domain.ClubStatus;
import com.cricketlegend.domain.Person;
import com.cricketlegend.domain.PersonLink;
import com.cricketlegend.domain.PlayerProfile;
import com.cricketlegend.domain.ProfileKind;
import com.cricketlegend.domain.RoleAssignment;
import com.cricketlegend.domain.RoleAssignmentRole;
import com.cricketlegend.domain.ScopeType;
import com.cricketlegend.domain.Section;
import com.cricketlegend.dto.LinkRequestSummaryDto;
import com.cricketlegend.dto.ProfileDto;
import com.cricketlegend.repository.ClubRepository;
import com.cricketlegend.repository.PersonLinkRepository;
import com.cricketlegend.repository.RoleAssignmentRepository;
import com.cricketlegend.repository.SectionRepository;
import com.cricketlegend.service.LinkRequestManagementService;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.oauth2.jwt.Jwt;

/**
 * docs/specs/119, Decision 29: exactly two kinds of chooser card. At most one MY_PLAYERS however many players, links or
 * own records; exactly one MANAGER per club however many grants; two clubs, two cards.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class ProfileResolverTest {

    @Mock private AccessService accessService;
    @Mock private RoleAssignmentRepository roleAssignmentRepository;
    @Mock private SectionRepository sectionRepository;
    @Mock private ClubRepository clubRepository;
    @Mock private PersonLinkRepository personLinkRepository;
    @Mock private MyPlayerAccess myPlayerAccess;
    @Mock private LinkRequestManagementService linkRequestManagementService;

    private ProfileResolver resolver;
    private final TestingAuthenticationToken auth = new TestingAuthenticationToken("sub", null, List.of());
    private final Map<UUID, Club> clubs = new HashMap<>();
    private final Map<UUID, Section> sections = new HashMap<>();
    private final List<RoleAssignment> grants = new ArrayList<>();
    private Person me;

    @BeforeEach
    void setUp() {
        resolver = new ProfileResolver(accessService, roleAssignmentRepository, sectionRepository, clubRepository,
                personLinkRepository, myPlayerAccess, linkRequestManagementService);
        me = Person.builder().id(UUID.randomUUID()).firstName("Me").lastName("Myself").build();
        when(roleAssignmentRepository.findByPersonId(me.getId())).thenReturn(grants);
        when(sectionRepository.findAllById(any())).thenAnswer(i -> {
            List<Section> found = new ArrayList<>();
            for (Object id : (Iterable<?>) i.getArgument(0)) {
                if (sections.containsKey(id)) {
                    found.add(sections.get(id));
                }
            }
            return found;
        });
        when(clubRepository.findAllById(any())).thenAnswer(i -> {
            List<Club> found = new ArrayList<>();
            for (Object id : (Iterable<?>) i.getArgument(0)) {
                if (clubs.containsKey(id)) {
                    found.add(clubs.get(id));
                }
            }
            return found;
        });
        when(myPlayerAccess.list(auth)).thenReturn(List.of());
        when(linkRequestManagementService.summary(any(), any())).thenReturn(new LinkRequestSummaryDto(0));
    }

    private Jwt jwt(boolean verified) {
        return Jwt.withTokenValue("t").header("alg", "none").subject("sub").issuedAt(Instant.now())
                .expiresAt(Instant.now().plusSeconds(60)).claim("email", "me@example.com")
                .claim("email_verified", verified).build();
    }

    private Club club(String name) {
        Club c = Club.builder().id(UUID.randomUUID()).name(name).slug(name.toLowerCase().replace(" ", "-"))
                .status(ClubStatus.ACTIVE).build();
        clubs.put(c.getId(), c);
        return c;
    }

    private Section section(Club club, String name) {
        Section s = Section.builder().id(UUID.randomUUID()).clubId(club.getId()).name(name).active(true).build();
        sections.put(s.getId(), s);
        return s;
    }

    private void grant(RoleAssignmentRole role, ScopeType scope, UUID scopeId) {
        grants.add(RoleAssignment.builder().id(UUID.randomUUID()).personId(me.getId()).role(role).scopeType(scope)
                .scopeId(scopeId).build());
    }

    private HeldPlayer held(String key, String first, String last) {
        Person subject = Person.builder().id(UUID.randomUUID()).firstName(first).lastName(last).build();
        return new HeldPlayer(key, me, subject, PlayerProfile.builder().id(UUID.randomUUID()).build(), (PersonLink) null);
    }

    // ---- My players ----

    @Test
    void manyPlayersLinksAndAnOwnRecordGiveExactlyOneMyPlayersCardWithTheFirstPlayerAndACount() {
        when(myPlayerAccess.list(auth)).thenReturn(List.of(
                held("self:1", "Me", "Myself"), held("l1", "Ann", "Alpha"), held("l2", "Bob", "Beta"), held("l3", "Cy", "Gamma")));

        List<ProfileDto> profiles = resolver.resolve(auth, jwt(true), me);

        assertThat(profiles).filteredOn(p -> p.kind() == ProfileKind.MY_PLAYERS).hasSize(1);
        ProfileDto card = profiles.get(0);
        assertThat(card.title()).isEqualTo("My players");
        assertThat(card.subtitle()).isEqualTo("Me Myself and 3 more");
        assertThat(card.landing()).isEqualTo("/account");
    }

    @Test
    void aSinglePlayerSubtitleIsJustTheName() {
        when(myPlayerAccess.list(auth)).thenReturn(List.of(held("l1", "Ann", "Alpha")));

        assertThat(resolver.resolve(auth, jwt(true), me).get(0).subtitle()).isEqualTo("Ann Alpha");
    }

    @Test
    void noPlayersAndNoInvitationsMeansNoMyPlayersCard() {
        assertThat(resolver.resolve(auth, jwt(true), me)).isEmpty();
    }

    @Test
    void invitationsAloneGiveTheCardAPendingCountAndNoSubtitle() {
        when(personLinkRepository.countOpenInvitationsForEmail(anyString(), any())).thenReturn(2L);

        ProfileDto card = resolver.resolve(auth, jwt(true), me).get(0);

        assertThat(card.kind()).isEqualTo(ProfileKind.MY_PLAYERS);
        assertThat(card.subtitle()).isNull();
        assertThat(card.pendingCount()).isEqualTo(2);
    }

    @Test
    void invitationsAreNeverCountedForAnUnverifiedEmail() {
        resolver.resolve(auth, jwt(false), me);

        verify(personLinkRepository, never()).countOpenInvitationsForEmail(anyString(), any());
    }

    // ---- manager cards ----

    @Test
    void aClubWideAdminGetsOneManagerCardWithTheClubAndTheWaitingCount() {
        Club hillcrest = club("Hillcrest CC");
        grant(RoleAssignmentRole.CLUB_ADMIN, ScopeType.CLUB, hillcrest.getId());
        when(linkRequestManagementService.summary(auth, hillcrest.getId())).thenReturn(new LinkRequestSummaryDto(4));

        List<ProfileDto> profiles = resolver.resolve(auth, jwt(true), me);

        assertThat(profiles).singleElement().satisfies(p -> {
            assertThat(p.kind()).isEqualTo(ProfileKind.MANAGER);
            assertThat(p.title()).isEqualTo("Manager of Hillcrest CC");
            assertThat(p.subtitle()).isNull();
            assertThat(p.clubId()).isEqualTo(hillcrest.getId());
            assertThat(p.clubSlug()).isEqualTo("hillcrest-cc");
            assertThat(p.landing()).isEqualTo("/manage");
            assertThat(p.pendingCount()).isEqualTo(4);
        });
    }

    @Test
    void manySectionGrantsAtOneClubStillGiveOneManagerCardListingTheSections() {
        Club hillcrest = club("Hillcrest CC");
        grant(RoleAssignmentRole.CLUB_ADMIN, ScopeType.SECTION, section(hillcrest, "Juniors").getId());
        grant(RoleAssignmentRole.CLUB_ADMIN, ScopeType.SECTION, section(hillcrest, "Vets").getId());
        grant(RoleAssignmentRole.CLUB_ADMIN, ScopeType.SECTION, section(hillcrest, "Seniors").getId());

        List<ProfileDto> profiles = resolver.resolve(auth, jwt(true), me);

        assertThat(profiles).singleElement().satisfies(p -> {
            assertThat(p.kind()).isEqualTo(ProfileKind.MANAGER);
            assertThat(p.subtitle()).isEqualTo("Juniors, Seniors and Vets");
        });
    }

    @Test
    void aClubWideGrantAlongsideSectionGrantsIsOneCardWithNoSectionSubtitle() {
        Club hillcrest = club("Hillcrest CC");
        grant(RoleAssignmentRole.CLUB_ADMIN, ScopeType.CLUB, hillcrest.getId());
        grant(RoleAssignmentRole.CLUB_ADMIN, ScopeType.SECTION, section(hillcrest, "Juniors").getId());

        assertThat(resolver.resolve(auth, jwt(true), me)).singleElement().satisfies(p -> assertThat(p.subtitle()).isNull());
    }

    @Test
    void twoClubsGiveTwoManagerCardsOrderedByClubName() {
        Club zebra = club("Zebra CC");
        Club alpha = club("alpha CC");
        grant(RoleAssignmentRole.CLUB_ADMIN, ScopeType.CLUB, zebra.getId());
        grant(RoleAssignmentRole.CLUB_ADMIN, ScopeType.SECTION, section(alpha, "Juniors").getId());

        assertThat(resolver.resolve(auth, jwt(true), me)).extracting(ProfileDto::title)
                .containsExactly("Manager of alpha CC", "Manager of Zebra CC");
    }

    @Test
    void grantsOtherThanClubAdminGiveNoManagerCard() {
        Club hillcrest = club("Hillcrest CC");
        grant(RoleAssignmentRole.PLAYER, ScopeType.CLUB, hillcrest.getId());

        assertThat(resolver.resolve(auth, jwt(true), me)).isEmpty();
    }

    @Test
    void cardsAreOrderedMyPlayersThenManagersThenPlatformAdmin() {
        Club hillcrest = club("Hillcrest CC");
        grant(RoleAssignmentRole.CLUB_ADMIN, ScopeType.CLUB, hillcrest.getId());
        when(myPlayerAccess.list(auth)).thenReturn(List.of(held("l1", "Ann", "Alpha")));
        when(accessService.isPlatformAdmin(auth)).thenReturn(true);

        assertThat(resolver.resolve(auth, jwt(true), me)).extracting(ProfileDto::kind)
                .containsExactly(ProfileKind.MY_PLAYERS, ProfileKind.MANAGER, ProfileKind.PLATFORM_ADMIN);
    }

    @Test
    void aLoginWithNoPersonStillGetsThePlatformAdminCardWhenApplicable() {
        when(accessService.isPlatformAdmin(auth)).thenReturn(true);

        assertThat(resolver.resolve(auth, jwt(true), null)).extracting(ProfileDto::kind)
                .containsExactly(ProfileKind.PLATFORM_ADMIN);
    }
}
