package com.cricketlegend.service.support;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

import com.cricketlegend.domain.Person;
import com.cricketlegend.domain.PersonLink;
import com.cricketlegend.domain.PersonLinkStatus;
import com.cricketlegend.domain.PersonStatus;
import com.cricketlegend.domain.PlayerProfile;
import com.cricketlegend.domain.PlayerVerificationStatus;
import com.cricketlegend.exception.NotFoundException;
import com.cricketlegend.repository.PersonLinkRepository;
import com.cricketlegend.repository.PersonRepository;
import com.cricketlegend.repository.PlayerProfileRepository;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.TestingAuthenticationToken;

/**
 * The only authorisation for /me/players/**: held = the caller's own verified active record, or an ACTIVE link to an
 * active, non-rejected player. Anything else, however malformed, is a 404 (never a 403); a suspended caller is 403.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class MyPlayerAccessTest {

    @Mock private PersonRepository personRepository;
    @Mock private PersonLinkRepository personLinkRepository;
    @Mock private PlayerProfileRepository playerProfileRepository;

    private MyPlayerAccess access;
    private final TestingAuthenticationToken auth = new TestingAuthenticationToken("sub", null, List.of());
    private final UUID clubId = UUID.randomUUID();
    private final Map<UUID, Person> people = new HashMap<>();
    private final List<PlayerProfile> profiles = new ArrayList<>();
    private final List<PersonLink> links = new ArrayList<>();
    private Person me;

    @BeforeEach
    void setUp() {
        access = new MyPlayerAccess(personRepository, personLinkRepository, playerProfileRepository);
        me = person("Me", "Myself");
        me.setKeycloakUserId("sub");
        me.setStatus(PersonStatus.ACTIVE);
        when(personRepository.findByKeycloakUserId("sub")).thenReturn(Optional.of(me));
        when(personLinkRepository.findByAccountPersonIdAndStatus(me.getId(), PersonLinkStatus.ACTIVE)).thenReturn(links);
        when(playerProfileRepository.findByPersonIdIn(any())).thenReturn(profiles);
        when(personRepository.findAllById(any())).thenAnswer(i -> new ArrayList<>(people.values()));
    }

    private Person person(String first, String last) {
        Person p = Person.builder().id(UUID.randomUUID()).firstName(first).lastName(last).status(PersonStatus.ACTIVE).build();
        people.put(p.getId(), p);
        return p;
    }

    private PlayerProfile profileOf(Person p, boolean active, PlayerVerificationStatus status) {
        PlayerProfile profile = PlayerProfile.builder().id(UUID.randomUUID()).personId(p.getId()).clubId(clubId)
                .active(active).verificationStatus(status).build();
        profiles.add(profile);
        return profile;
    }

    private PersonLink linkTo(Person subject) {
        PersonLink link = PersonLink.builder().id(UUID.randomUUID()).accountPersonId(me.getId())
                .subjectPersonId(subject.getId()).clubId(clubId).status(PersonLinkStatus.ACTIVE).build();
        links.add(link);
        return link;
    }

    @Test
    void theOwnRecordComesFirstThenLinkedPlayersByName() {
        PlayerProfile own = profileOf(me, true, PlayerVerificationStatus.VERIFIED);
        Person zed = person("Zed", "Zulu");
        Person amy = person("Amy", "Alpha");
        profileOf(zed, true, PlayerVerificationStatus.VERIFIED);
        profileOf(amy, true, PlayerVerificationStatus.VERIFIED);
        linkTo(zed);
        linkTo(amy);

        List<HeldPlayer> held = access.list(auth);

        assertThat(held).extracting(h -> h.subject().getFirstName()).containsExactly("Me", "Amy", "Zed");
        assertThat(held.get(0).key()).isEqualTo("self:" + own.getId());
        assertThat(held.get(0).self()).isTrue();
        assertThat(held.get(1).self()).isFalse();
    }

    @Test
    void anUnverifiedOrInactiveOwnRecordIsNotHeld() {
        profileOf(me, true, PlayerVerificationStatus.UNVERIFIED);
        profileOf(me, false, PlayerVerificationStatus.VERIFIED);

        assertThat(access.list(auth)).isEmpty();
    }

    @Test
    void aLinkedPlayerWhoIsInactiveRejectedOrAtADifferentClubDropsOut() {
        Person inactive = person("In", "Active");
        Person rejected = person("Re", "Jected");
        Person elsewhere = person("El", "Sewhere");
        profileOf(inactive, false, PlayerVerificationStatus.VERIFIED);
        profileOf(rejected, true, PlayerVerificationStatus.REJECTED);
        PlayerProfile other = profileOf(elsewhere, true, PlayerVerificationStatus.VERIFIED);
        other.setClubId(UUID.randomUUID());
        linkTo(inactive);
        linkTo(rejected);
        linkTo(elsewhere);

        assertThat(access.list(auth)).isEmpty();
    }

    @Test
    void anUnheldMalformedOrBlankKeyIsNotFound() {
        Person kid = person("Kid", "One");
        profileOf(kid, true, PlayerVerificationStatus.VERIFIED);
        linkTo(kid);

        for (String key : new String[] {UUID.randomUUID().toString(), "self:" + UUID.randomUUID(), "garbage", "", null}) {
            assertThatThrownBy(() -> access.resolve(auth, key)).as(String.valueOf(key)).isInstanceOf(NotFoundException.class);
        }
    }

    @Test
    void aHeldKeyResolvesToThePlayerWithTheLinkOrNone() {
        Person kid = person("Kid", "One");
        profileOf(kid, true, PlayerVerificationStatus.VERIFIED);
        PersonLink link = linkTo(kid);
        PlayerProfile own = profileOf(me, true, PlayerVerificationStatus.VERIFIED);

        assertThat(access.resolve(auth, link.getId().toString()).link()).isSameAs(link);
        assertThat(access.resolve(auth, "self:" + own.getId()).link()).isNull();
    }

    @Test
    void aSuspendedCallerIsForbiddenAndALoginWithNoPersonHoldsNothing() {
        me.setStatus(PersonStatus.SUSPENDED);
        assertThatThrownBy(() -> access.list(auth)).isInstanceOf(AccessDeniedException.class);

        when(personRepository.findByKeycloakUserId("sub")).thenReturn(Optional.empty());
        assertThat(access.list(auth)).isEmpty();
    }
}
