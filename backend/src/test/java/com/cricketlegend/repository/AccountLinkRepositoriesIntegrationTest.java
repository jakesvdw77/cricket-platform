package com.cricketlegend.repository;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.cricketlegend.AbstractIntegrationTest;
import com.cricketlegend.AbstractLinkIntegrationTest;
import com.cricketlegend.domain.AvailabilityStatus;
import com.cricketlegend.domain.Club;
import com.cricketlegend.domain.LinkGrantedVia;
import com.cricketlegend.domain.Person;
import com.cricketlegend.domain.PersonLink;
import com.cricketlegend.domain.PersonLinkStatus;
import com.cricketlegend.domain.PlayerAvailability;
import com.cricketlegend.domain.PlayerProfile;
import com.cricketlegend.domain.Section;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.transaction.annotation.Transactional;

/**
 * docs/specs/119, "new custom repository query -> integration test": every query added for the link feature, against real
 * Postgres, plus the partial unique indexes of migration 053 reached through the repositories.
 */
@SpringBootTest
@Import(AbstractIntegrationTest.class)
@Transactional
class AccountLinkRepositoriesIntegrationTest extends AbstractLinkIntegrationTest {

    @Autowired private PlayerAvailabilityRepository availabilityRepository;

    // ---- PlayerProfileRepository ----

    @Test
    void findMatchesByEmailIsCaseInsensitiveActiveVerifiedAndExcludesTheCallersOwnPerson() {
        Club club = club("Hillcrest");
        Club other = club("Beta");
        Person caller = account("Pat", "Parent", "pat@example.com");
        PlayerProfile upper = profile(club, playerPerson("Upper", "Case", CHILD_DOB), "PAT@Example.COM");
        PlayerProfile atOtherClub = profile(other, playerPerson("Other", "Club", CHILD_DOB), "pat@example.com");
        PlayerProfile inactive = profile(club, playerPerson("In", "Active", CHILD_DOB), "pat@example.com");
        inactive.setActive(false);
        playerProfileRepository.save(inactive);
        PlayerProfile unverified = profile(club, playerPerson("Un", "Verified", CHILD_DOB), "pat@example.com");
        unverified.setVerificationStatus(com.cricketlegend.domain.PlayerVerificationStatus.UNVERIFIED);
        playerProfileRepository.save(unverified);
        profile(club, playerPerson("Else", "Where", CHILD_DOB), "someone.else@example.com");
        profile(club, caller, "pat@example.com"); // the caller's own record is excluded

        assertThat(playerProfileRepository.findMatchesByEmail("pat@example.com", caller.getId()))
                .extracting(PlayerProfile::getId)
                .containsExactlyInAnyOrder(upper.getId(), atOtherClub.getId());
    }

    @Test
    void findActiveIdentitiesByClubReturnsActivePlayersOfThatClubWithNameAndDateOfBirth() {
        Club club = club("Hillcrest");
        Club other = club("Beta");
        Person sam = playerPerson("Sam", "Smith", CHILD_DOB);
        PlayerProfile samProfile = profile(club, sam, null);
        PlayerProfile gone = profile(club, playerPerson("Gone", "Away", CHILD_DOB), null);
        gone.setActive(false);
        playerProfileRepository.save(gone);
        profile(other, playerPerson("Zoe", "Zulu", CHILD_DOB), null);

        List<PlayerIdentityView> identities = playerProfileRepository.findActiveIdentitiesByClub(club.getId());

        assertThat(identities).singleElement().satisfies(i -> {
            assertThat(i.getPlayerProfileId()).isEqualTo(samProfile.getId());
            assertThat(i.getPersonId()).isEqualTo(sam.getId());
            assertThat(i.getFirstName()).isEqualTo("Sam");
            assertThat(i.getLastName()).isEqualTo("Smith");
            assertThat(i.getDateOfBirth()).isEqualTo(CHILD_DOB);
        });
    }

    @Test
    void searchForAccountsPagesByNameAndFiltersBySectionMainAgentAndSearchText() {
        Club club = club("Hillcrest");
        Section juniors = section(club, "Juniors");
        Section vets = section(club, "Vets");
        Person agent = account("Mary", "Main");
        Person ann = playerPerson("Ann", "Alpha", CHILD_DOB);
        Person bob = playerPerson("Bob", "Beta", CHILD_DOB);
        Person cy = playerPerson("Cy", "Gamma", CHILD_DOB);
        PlayerProfile annP = profile(club, ann, null);
        PlayerProfile bobP = profile(club, bob, null);
        PlayerProfile cyP = profile(club, cy, null);
        tag(annP, juniors);
        tag(bobP, vets);
        link(agent, bob, club, true);
        PlayerProfile inactive = profile(club, playerPerson("Zed", "Zulu", CHILD_DOB), null);
        inactive.setActive(false);
        playerProfileRepository.save(inactive);
        UUID none = new UUID(0L, 0L);

        Page<PlayerProfile> all = playerProfileRepository.searchForAccounts(club.getId(), false, Set.of(none), false, "%%", PageRequest.of(0, 2));
        assertThat(all.getTotalElements()).isEqualTo(3);
        assertThat(all.getContent()).extracting(PlayerProfile::getId).containsExactly(annP.getId(), bobP.getId()); // by surname
        assertThat(playerProfileRepository.searchForAccounts(club.getId(), false, Set.of(none), false, "%%", PageRequest.of(1, 2))
                .getContent()).extracting(PlayerProfile::getId).containsExactly(cyP.getId());

        assertThat(playerProfileRepository.searchForAccounts(club.getId(), true, Set.of(juniors.getId()), false, "%%", PageRequest.of(0, 10))
                .getContent()).extracting(PlayerProfile::getId).containsExactly(annP.getId());
        assertThat(playerProfileRepository.searchForAccounts(club.getId(), true, Set.of(none), false, "%%", PageRequest.of(0, 10))
                .getContent()).isEmpty();
        assertThat(playerProfileRepository.searchForAccounts(club.getId(), false, Set.of(none), true, "%%", PageRequest.of(0, 10))
                .getContent()).extracting(PlayerProfile::getId).containsExactly(annP.getId(), cyP.getId());
        assertThat(playerProfileRepository.searchForAccounts(club.getId(), false, Set.of(none), false, "%bob%", PageRequest.of(0, 10))
                .getContent()).extracting(PlayerProfile::getId).containsExactly(bobP.getId());
        assertThat(playerProfileRepository.searchForAccounts(club.getId(), false, Set.of(none), false, "%cy gamma%", PageRequest.of(0, 10))
                .getContent()).extracting(PlayerProfile::getId).containsExactly(cyP.getId());
        // an ended main agent link no longer counts as "has a main agent"
        PersonLink bobsLink = personLinkRepository.findActiveBySubjectAndClub(bob.getId(), club.getId()).get(0);
        bobsLink.setStatus(PersonLinkStatus.REVOKED);
        personLinkRepository.save(bobsLink);
        assertThat(playerProfileRepository.searchForAccounts(club.getId(), false, Set.of(none), true, "%%", PageRequest.of(0, 10))
                .getTotalElements()).isEqualTo(3);
    }

    @Test
    void findByPersonIdInReturnsTheProfilesOfThosePeopleAtEveryClub() {
        Club a = club("Alpha");
        Club b = club("Beta");
        Person one = playerPerson("One", "Person", CHILD_DOB);
        Person two = playerPerson("Two", "Person", CHILD_DOB);
        Person three = playerPerson("Three", "Person", CHILD_DOB);
        PlayerProfile oneA = profile(a, one, null);
        PlayerProfile oneB = profile(b, one, null);
        PlayerProfile twoA = profile(a, two, null);
        profile(a, three, null);

        assertThat(playerProfileRepository.findByPersonIdIn(Set.of(one.getId(), two.getId())))
                .extracting(PlayerProfile::getId).containsExactlyInAnyOrder(oneA.getId(), oneB.getId(), twoA.getId());
    }

    // ---- PersonLinkRepository ----

    @Test
    void activeLinkQueriesReturnOnlyActiveLinksForTheRightAccountSubjectAndClub() {
        Club club = club("Hillcrest");
        Club other = club("Beta");
        Person me = account("Pat", "Parent");
        Person agent2 = account("Sid", "Second");
        Person kid = playerPerson("Sam", "Smith", CHILD_DOB);
        Person kid2 = playerPerson("Zoe", "Zulu", CHILD_DOB);
        PersonLink mainLink = link(agent2, kid, club, true);
        PersonLink mine = link(me, kid, club, false);
        PersonLink atOther = link(me, kid, other, false);
        PersonLink revoked = link(me, kid2, club, false);
        revoked.setStatus(PersonLinkStatus.REVOKED);
        personLinkRepository.save(revoked);

        assertThat(personLinkRepository.findByAccountPersonIdAndStatus(me.getId(), PersonLinkStatus.ACTIVE))
                .extracting(PersonLink::getId).containsExactlyInAnyOrder(mine.getId(), atOther.getId());
        assertThat(personLinkRepository.findByAccountAndSubjects(me.getId(), PersonLinkStatus.ACTIVE, Set.of(kid.getId(), kid2.getId())))
                .extracting(PersonLink::getId).containsExactlyInAnyOrder(mine.getId(), atOther.getId());
        assertThat(personLinkRepository.findActiveMains(Set.of(kid.getId(), kid2.getId())))
                .extracting(PersonLink::getId).containsExactly(mainLink.getId());
        assertThat(personLinkRepository.findActiveBySubjectAndClub(kid.getId(), club.getId()))
                .extracting(PersonLink::getId).containsExactlyInAnyOrder(mainLink.getId(), mine.getId());
        assertThat(personLinkRepository.findActiveBySubjectsAndClub(Set.of(kid.getId(), kid2.getId()), club.getId()))
                .extracting(PersonLink::getId).containsExactlyInAnyOrder(mainLink.getId(), mine.getId());
        assertThat(personLinkRepository.findFirstByAccountPersonIdAndSubjectPersonIdAndClubIdAndStatusIn(
                        me.getId(), kid.getId(), club.getId(), List.of(PersonLinkStatus.ACTIVE, PersonLinkStatus.INVITED)))
                .map(PersonLink::getId).contains(mine.getId());
        assertThat(personLinkRepository.findFirstByAccountPersonIdAndSubjectPersonIdAndClubIdAndStatusIn(
                        me.getId(), kid2.getId(), club.getId(), List.of(PersonLinkStatus.ACTIVE, PersonLinkStatus.INVITED)))
                .isEmpty();
    }

    @Test
    void openInvitationQueriesMatchTheEmailIgnoringCaseAndSkipExpiredAndNonInvitedLinks() {
        Club club = club("Hillcrest");
        Person sender = account("Mary", "Main");
        Person kid = playerPerson("Sam", "Smith", CHILD_DOB);
        Person kid2 = playerPerson("Zoe", "Zulu", CHILD_DOB);
        PersonLink open = invitation(kid, club, "guest@example.com", sender, false);
        PersonLink openOtherPlayer = invitation(kid2, club, "GUEST@example.com", sender, true);
        PersonLink expired = invitation(kid, club, "guest@example.com", sender, false);
        expired.setExpiresAt(Instant.now().minus(1, ChronoUnit.MINUTES));
        personLinkRepository.save(expired);
        PersonLink declined = invitation(kid2, club, "guest@example.com", sender, false);
        declined.setStatus(PersonLinkStatus.DECLINED);
        personLinkRepository.save(declined);
        invitation(kid, club, "someone.else@example.com", sender, false);
        Instant now = Instant.now();

        assertThat(personLinkRepository.findOpenInvitationsForEmail("Guest@Example.com", now))
                .extracting(PersonLink::getId).containsExactly(open.getId(), openOtherPlayer.getId()); // oldest first
        assertThat(personLinkRepository.countOpenInvitationsForEmail("guest@example.com", now)).isEqualTo(2);
        assertThat(personLinkRepository.countOpenInvitationsForEmail("nobody@example.com", now)).isZero();
        assertThat(personLinkRepository.findOpenInvitationsBySubjectAndClub(kid.getId(), club.getId(), now))
                .extracting(PersonLink::getInvitedEmail).containsExactlyInAnyOrder("guest@example.com", "someone.else@example.com");
        // a moment before the expiry the same link is still open
        assertThat(personLinkRepository.findOpenInvitationsForEmail("guest@example.com", now.minus(1, ChronoUnit.HOURS)))
                .extracting(PersonLink::getId).contains(expired.getId());
    }

    // ---- polls ----

    @Test
    void openSquadPollsForAPlayerAreThoseOfTheirOwnSquadThatAreStillOpen() {
        Club club = club("Hillcrest");
        Section juniors = section(club, "Juniors");
        PlayerProfile in = profile(club, playerPerson("In", "Squad", CHILD_DOB), null);
        PlayerProfile out = profile(club, playerPerson("Not", "Squad", CHILD_DOB), null);
        SquadPoll open = squadPoll(club, juniors, in);
        SquadPoll closed = squadPoll(club, juniors, in);
        closed.poll().setOpen(false);
        pollRepository.save(closed.poll());
        squadPoll(club, juniors, out);

        assertThat(pollRepository.findOpenForPlayer(in.getId())).extracting(p -> p.getId()).containsExactly(open.poll().getId());
        assertThat(pollRepository.findOpenForPlayer(out.getId())).extracting(p -> p.getId()).hasSize(1).doesNotContain(open.poll().getId());
        assertThat(pollRepository.findOpenForPlayer(UUID.randomUUID())).isEmpty();
    }

    @Test
    void aSquadMembershipInAnotherSeasonDoesNotMakeAPollTheirs() {
        Club club = club("Hillcrest");
        Section juniors = section(club, "Juniors");
        PlayerProfile player = profile(club, playerPerson("Sam", "Smith", CHILD_DOB), null);
        SquadPoll poll = squadPoll(club, juniors); // nobody in this season's squad
        squadMemberRepository.save(com.cricketlegend.domain.TeamSquadMember.builder().teamId(poll.team().getId())
                .seasonId(seasonRepository.save(com.cricketlegend.domain.Season.builder().clubId(club.getId()).label("2025")
                        .startDate(java.time.LocalDate.of(2025, 1, 1)).endDate(java.time.LocalDate.of(2025, 12, 31)).active(false).build())
                        .getId())
                .playerProfileId(player.getId()).jerseyNumber(1).build());

        assertThat(pollRepository.findOpenForPlayer(player.getId())).isEmpty();
    }

    @Test
    void openGroupRoundsForAPlayerAreThoseOfTheirTaggedSectionsThatAreStillOpen() {
        Club club = club("Hillcrest");
        Section juniors = section(club, "Juniors");
        Section vets = section(club, "Vets");
        PlayerProfile player = profile(club, playerPerson("Sam", "Smith", CHILD_DOB), null);
        tag(player, juniors);
        GroupRound open = groupRound(club, juniors);
        GroupRound closed = groupRound(club, juniors, 8);
        closed.round().setOpen(false);
        roundRepository.save(closed.round());
        groupRound(club, vets);

        assertThat(roundRepository.findOpenForPlayer(player.getId())).extracting(r -> r.getId())
                .containsExactly(open.round().getId());
    }

    @Test
    void answersCanBeReadForManyPollsAtOnceForOnePlayerOnly() {
        Club club = club("Hillcrest");
        Section juniors = section(club, "Juniors");
        PlayerProfile me = profile(club, playerPerson("Sam", "Smith", CHILD_DOB), null);
        PlayerProfile teammate = profile(club, playerPerson("Tim", "Mate", CHILD_DOB), null);
        SquadPoll p1 = squadPoll(club, juniors, me, teammate);
        SquadPoll p2 = squadPoll(club, juniors, me, teammate);
        SquadPoll p3 = squadPoll(club, juniors, me, teammate);
        PlayerAvailability a1 = availabilityRepository.save(PlayerAvailability.builder().pollId(p1.poll().getId())
                .playerProfileId(me.getId()).status(AvailabilityStatus.AVAILABLE).build());
        PlayerAvailability a2 = availabilityRepository.save(PlayerAvailability.builder().pollId(p2.poll().getId())
                .playerProfileId(me.getId()).status(AvailabilityStatus.UNAVAILABLE).build());
        availabilityRepository.save(PlayerAvailability.builder().pollId(p1.poll().getId())
                .playerProfileId(teammate.getId()).status(AvailabilityStatus.AVAILABLE).build());

        assertThat(availabilityRepository.findByPollIdInAndPlayerProfileId(
                        List.of(p1.poll().getId(), p2.poll().getId(), p3.poll().getId()), me.getId()))
                .extracting(PlayerAvailability::getId).containsExactlyInAnyOrder(a1.getId(), a2.getId());
    }

    // ---- the partial unique indexes of migration 053, through the repository ----

    @Test
    void aSecondActiveMainAgentForTheSamePlayerAtTheSameClubIsRejectedByTheDatabase() {
        Club club = club("Hillcrest");
        Person kid = playerPerson("Sam", "Smith", CHILD_DOB);
        Person first = account("Mary", "Main");
        Person second = account("Sid", "Second");
        link(first, kid, club, true);

        assertThatThrownBy(() -> personLinkRepository.saveAndFlush(PersonLink.builder().accountPersonId(second.getId())
                .subjectPersonId(kid.getId()).clubId(club.getId()).status(PersonLinkStatus.ACTIVE).main(true)
                .grantedVia(LinkGrantedVia.EMAIL_MATCH).build()))
                .isInstanceOf(DataIntegrityViolationException.class);
    }
}
