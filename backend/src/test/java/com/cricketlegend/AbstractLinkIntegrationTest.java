package com.cricketlegend;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;

import com.cricketlegend.domain.Club;
import com.cricketlegend.domain.ClubStatus;
import com.cricketlegend.domain.DayPart;
import com.cricketlegend.domain.LinkGrantedVia;
import com.cricketlegend.domain.Match;
import com.cricketlegend.domain.MatchAvailabilityPoll;
import com.cricketlegend.domain.Person;
import com.cricketlegend.domain.PersonLink;
import com.cricketlegend.domain.PersonLinkStatus;
import com.cricketlegend.domain.PersonStatus;
import com.cricketlegend.domain.PlayerProfile;
import com.cricketlegend.domain.PlayerSection;
import com.cricketlegend.domain.RoleAssignment;
import com.cricketlegend.domain.RoleAssignmentRole;
import com.cricketlegend.domain.ScopeType;
import com.cricketlegend.domain.Season;
import com.cricketlegend.domain.Section;
import com.cricketlegend.domain.SectionAvailabilityRound;
import com.cricketlegend.domain.SectionAvailabilityWindow;
import com.cricketlegend.domain.SectionAvailabilityWindowMatch;
import com.cricketlegend.domain.Team;
import com.cricketlegend.domain.TeamSquadMember;
import com.cricketlegend.repository.ClubRepository;
import com.cricketlegend.repository.MatchAvailabilityPollRepository;
import com.cricketlegend.repository.MatchRepository;
import com.cricketlegend.repository.PersonLinkRepository;
import com.cricketlegend.repository.PersonRepository;
import com.cricketlegend.repository.PlayerProfileRepository;
import com.cricketlegend.repository.PlayerSectionRepository;
import com.cricketlegend.repository.RoleAssignmentRepository;
import com.cricketlegend.repository.SeasonRepository;
import com.cricketlegend.repository.SectionAvailabilityRoundRepository;
import com.cricketlegend.repository.SectionAvailabilityWindowMatchRepository;
import com.cricketlegend.repository.SectionAvailabilityWindowRepository;
import com.cricketlegend.repository.SectionRepository;
import com.cricketlegend.repository.TeamRepository;
import com.cricketlegend.repository.TeamSquadMemberRepository;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.JwtRequestPostProcessor;

/**
 * Fixtures for the docs/specs/119 integration tests (links, requests, invitations, My players). Every helper makes unique
 * data (random slugs, subjects and emails) so tests never depend on each other and the non-transactional ones can leave
 * their rows behind. Subclasses declare their own Spring Boot test annotations (as the other integration tests do).
 */
public abstract class AbstractLinkIntegrationTest {

    protected static final LocalDate CHILD_DOB = LocalDate.of(2012, 6, 15);

    @Autowired protected ClubRepository clubRepository;
    @Autowired protected SectionRepository sectionRepository;
    @Autowired protected PersonRepository personRepository;
    @Autowired protected PlayerProfileRepository playerProfileRepository;
    @Autowired protected PlayerSectionRepository playerSectionRepository;
    @Autowired protected PersonLinkRepository personLinkRepository;
    @Autowired protected RoleAssignmentRepository roleAssignmentRepository;
    @Autowired protected TeamRepository teamRepository;
    @Autowired protected SeasonRepository seasonRepository;
    @Autowired protected MatchRepository matchRepository;
    @Autowired protected MatchAvailabilityPollRepository pollRepository;
    @Autowired protected TeamSquadMemberRepository squadMemberRepository;
    @Autowired protected SectionAvailabilityRoundRepository roundRepository;
    @Autowired protected SectionAvailabilityWindowRepository windowRepository;
    @Autowired protected SectionAvailabilityWindowMatchRepository windowMatchRepository;

    protected static String unique(String prefix) {
        return prefix + "-" + UUID.randomUUID().toString().substring(0, 8);
    }

    protected Club club(String name) {
        String slug = unique("club");
        return clubRepository.save(Club.builder().name(name + " " + slug).slug(slug).status(ClubStatus.ACTIVE).build());
    }

    protected Section section(Club club, String name) {
        return sectionRepository.save(Section.builder().clubId(club.getId()).name(name).active(true).build());
    }

    /** A logged-in account: an ACTIVE person with a Keycloak subject and a unique email. */
    protected Person account(String first, String last) {
        return account(first, last, unique(first.toLowerCase()) + "@example.com");
    }

    protected Person account(String first, String last, String email) {
        return personRepository.save(Person.builder().firstName(first).lastName(last).email(email)
                .keycloakUserId(unique("sub")).status(PersonStatus.ACTIVE).build());
    }

    /** A player's own Person: no login, no email, a date of birth. */
    protected Person playerPerson(String first, String last, LocalDate dob) {
        return personRepository.save(Person.builder().firstName(first).lastName(last).dateOfBirth(dob)
                .status(PersonStatus.ACTIVE).build());
    }

    protected PlayerProfile profile(Club club, Person person, String contactEmail) {
        return playerProfileRepository.save(PlayerProfile.builder().personId(person.getId()).clubId(club.getId())
                .email(contactEmail).phone("0821234567").medicalAidProvider("Discovery").medicalAidMemberNumber("MED-9Q")
                .photoUrl("https://img.example.com/photo.png").active(true).build());
    }

    protected void tag(PlayerProfile profile, Section section) {
        playerSectionRepository.save(PlayerSection.builder().playerProfileId(profile.getId()).sectionId(section.getId()).build());
    }

    protected PersonLink link(Person account, Person subject, Club club, boolean main) {
        return personLinkRepository.save(PersonLink.builder().accountPersonId(account.getId())
                .subjectPersonId(subject.getId()).clubId(club.getId()).status(PersonLinkStatus.ACTIVE).main(main)
                .grantedVia(LinkGrantedVia.EMAIL_MATCH).decidedAt(Instant.now()).build());
    }

    protected PersonLink invitation(Person subject, Club club, String email, Person invitedBy, boolean makeMain) {
        return personLinkRepository.save(PersonLink.builder().invitedEmail(email).subjectPersonId(subject.getId())
                .clubId(club.getId()).status(PersonLinkStatus.INVITED).makeMain(makeMain)
                .grantedVia(LinkGrantedVia.AGENT_INVITE).grantedByPersonId(invitedBy.getId())
                .expiresAt(Instant.now().plus(14, ChronoUnit.DAYS)).build());
    }

    /** The token of a logged-in person with a verified email. */
    protected static JwtRequestPostProcessor as(Person person) {
        return token(person, true);
    }

    protected static JwtRequestPostProcessor asUnverified(Person person) {
        return token(person, false);
    }

    private static JwtRequestPostProcessor token(Person person, boolean verified) {
        return jwt().jwt(b -> b.subject(person.getKeycloakUserId()).claim("email", person.getEmail())
                .claim("email_verified", verified));
    }

    protected Person clubAdmin(Club club) {
        Person admin = account("Club", "Admin");
        roleAssignmentRepository.save(RoleAssignment.builder().personId(admin.getId())
                .role(RoleAssignmentRole.CLUB_ADMIN).scopeType(ScopeType.CLUB).scopeId(club.getId()).build());
        return admin;
    }

    protected Person sectionAdmin(Section section) {
        Person admin = account("Section", "Admin");
        roleAssignmentRepository.save(RoleAssignment.builder().personId(admin.getId())
                .role(RoleAssignmentRole.CLUB_ADMIN).scopeType(ScopeType.SECTION).scopeId(section.getId()).build());
        return admin;
    }

    /** A squad poll fixture: a team with the player in its squad for a season and an open poll on a future match. */
    protected record SquadPoll(Team team, Season season, Match match, MatchAvailabilityPoll poll) {}

    protected SquadPoll squadPoll(Club club, Section section, PlayerProfile... squad) {
        Team team = teamRepository.save(Team.builder().clubId(club.getId()).sectionId(section.getId()).name("U13 Colts")
                .active(true).build());
        Season season = seasonRepository.save(Season.builder().clubId(club.getId()).label("2026")
                .startDate(LocalDate.of(2026, 1, 1)).endDate(LocalDate.of(2026, 12, 31)).active(true).build());
        Match match = matchRepository.save(Match.builder().clubId(club.getId()).homeTeamId(team.getId())
                .awayTeamName("Occasionals").seasonId(season.getId()).matchDate(Instant.now().plus(7, ChronoUnit.DAYS))
                .venue("The Oval").active(true).build());
        MatchAvailabilityPoll poll = pollRepository.save(MatchAvailabilityPoll.builder().matchId(match.getId())
                .teamId(team.getId()).open(true).scheduledCloseAt(Instant.now().plus(3, ChronoUnit.DAYS)).build());
        int jersey = 0;
        for (PlayerProfile member : squad) {
            squadMemberRepository.save(TeamSquadMember.builder().teamId(team.getId()).seasonId(season.getId())
                    .playerProfileId(member.getId()).jerseyNumber(++jersey).build());
        }
        return new SquadPoll(team, season, match, poll);
    }

    protected record GroupRound(SectionAvailabilityRound round, SectionAvailabilityWindow window) {}

    /** An open section (group) availability round with one window, for the players tagged to the section. */
    protected GroupRound groupRound(Club club, Section section) {
        return groupRound(club, section, 7);
    }

    /** As above, on a chosen day (a section may have only one window per date and part). */
    protected GroupRound groupRound(Club club, Section section, int daysAhead) {
        LocalDate day = LocalDate.now().plusDays(daysAhead);
        SectionAvailabilityRound round = roundRepository.save(SectionAvailabilityRound.builder().clubId(club.getId())
                .sectionId(section.getId()).description("Saturday fixtures").firstMatchDate(day).lastMatchDate(day)
                .autoClose(true).scheduledCloseAt(Instant.now().plus(3, ChronoUnit.DAYS)).open(true).build());
        SectionAvailabilityWindow window = windowRepository.save(SectionAvailabilityWindow.builder().clubId(club.getId())
                .sectionId(section.getId()).roundId(round.getId()).windowDate(day).dayPart(DayPart.MORNING).open(true).build());
        return new GroupRound(round, window);
    }

    /** Links the window to a match so the round form has a fixture to show (optional for answering). */
    protected void windowMatch(SectionAvailabilityWindow window, Match match) {
        windowMatchRepository.save(SectionAvailabilityWindowMatch.builder().windowId(window.getId()).matchId(match.getId()).build());
    }
}
