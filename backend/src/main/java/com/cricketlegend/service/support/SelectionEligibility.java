package com.cricketlegend.service.support;

import com.cricketlegend.config.AccessService;
import com.cricketlegend.domain.League;
import com.cricketlegend.domain.Match;
import com.cricketlegend.domain.Person;
import com.cricketlegend.domain.PlayerProfile;
import com.cricketlegend.domain.PlayerSection;
import com.cricketlegend.domain.Season;
import com.cricketlegend.domain.Team;
import com.cricketlegend.domain.TeamSquadMember;
import com.cricketlegend.exception.NotFoundException;
import com.cricketlegend.repository.LeagueRepository;
import com.cricketlegend.repository.PersonRepository;
import com.cricketlegend.repository.PlayerProfileRepository;
import com.cricketlegend.repository.PlayerSectionRepository;
import com.cricketlegend.repository.SeasonRepository;
import com.cricketlegend.repository.TeamSquadMemberRepository;
import java.time.LocalDate;
import java.time.Period;
import java.util.Collection;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.stereotype.Component;

/**
 * Who may be selected for a team in a match, and the age rule, both batch-capable so the pool read
 * and every write path cannot disagree (docs/specs/076-team-selection.md section 6). The pool of a
 * team is its roster for the match's season plus, for a team of the match's own club, every player
 * tagged to the team's section or any descendant; a player must also be an active profile of the
 * match's club. The age rule is the {@code 029} rule unchanged (the league's {@code minAge}/{@code
 * maxAge} against the cutoff date or season start, a missing date of birth failing where an age
 * rule exists).
 */
@Component
public class SelectionEligibility {

    /** A player as the selection needs to know him, loaded in one batch. */
    public record PlayerInfo(
            UUID playerProfileId,
            UUID clubId,
            boolean active,
            String firstName,
            String lastName,
            Integer profileJerseyNumber,
            LocalDate dateOfBirth) {

        public String fullName() {
            return firstName + " " + lastName;
        }
    }

    private final PlayerProfileRepository playerProfileRepository;
    private final PersonRepository personRepository;
    private final TeamSquadMemberRepository teamSquadMemberRepository;
    private final PlayerSectionRepository playerSectionRepository;
    private final LeagueRepository leagueRepository;
    private final SeasonRepository seasonRepository;
    private final AccessService accessService;

    public SelectionEligibility(
            PlayerProfileRepository playerProfileRepository,
            PersonRepository personRepository,
            TeamSquadMemberRepository teamSquadMemberRepository,
            PlayerSectionRepository playerSectionRepository,
            LeagueRepository leagueRepository,
            SeasonRepository seasonRepository,
            AccessService accessService) {
        this.playerProfileRepository = playerProfileRepository;
        this.personRepository = personRepository;
        this.teamSquadMemberRepository = teamSquadMemberRepository;
        this.playerSectionRepository = playerSectionRepository;
        this.leagueRepository = leagueRepository;
        this.seasonRepository = seasonRepository;
        this.accessService = accessService;
    }

    /** One profiles query and one persons query for any number of ids; unknown ids are absent. */
    public Map<UUID, PlayerInfo> loadPlayers(Collection<UUID> playerIds) {
        Map<UUID, PlayerInfo> result = new HashMap<>();
        if (playerIds.isEmpty()) {
            return result;
        }
        List<PlayerProfile> profiles = playerProfileRepository.findAllById(new HashSet<>(playerIds));
        Map<UUID, Person> persons = personRepository
                .findAllById(profiles.stream().map(PlayerProfile::getPersonId).collect(Collectors.toSet()))
                .stream()
                .collect(Collectors.toMap(Person::getId, person -> person));
        for (PlayerProfile profile : profiles) {
            Person person = persons.get(profile.getPersonId());
            if (person == null) {
                continue;
            }
            result.put(profile.getId(), new PlayerInfo(
                    profile.getId(), profile.getClubId(), profile.isActive(),
                    person.getFirstName(), person.getLastName(), profile.getJerseyNumber(),
                    person.getDateOfBirth()));
        }
        return result;
    }

    /** The team's roster for the match's season. */
    public List<TeamSquadMember> roster(Match match, Team team) {
        return teamSquadMemberRepository.findByTeamIdAndSeasonId(team.getId(), match.getSeasonId());
    }

    /**
     * Every player tagged to the team's section or a descendant. A team of another club (029's
     * cross-club allowance) has no section tree in the match's club, so it contributes nobody.
     */
    public Set<UUID> sectionTaggedIds(Match match, Team team) {
        if (!match.getClubId().equals(team.getClubId())) {
            return Set.of();
        }
        Set<UUID> sectionIds = accessService.sectionAndDescendantIds(match.getClubId(), team.getSectionId());
        return playerSectionRepository.findBySectionIdIn(sectionIds).stream()
                .map(PlayerSection::getPlayerProfileId)
                .collect(Collectors.toSet());
    }

    /** Roster plus section-tagged: the whole pool a team may select from, before the active check. */
    public Set<UUID> poolMemberIds(Match match, Team team) {
        Set<UUID> members = new HashSet<>(sectionTaggedIds(match, team));
        roster(match, team).forEach(member -> members.add(member.getPlayerProfileId()));
        return members;
    }

    /**
     * The given players who are NOT selectable for this team: unknown, another club's, inactive, or
     * neither on the roster nor in the section tree.
     */
    public Set<UUID> notInPool(Match match, Team team, Collection<UUID> playerIds, Map<UUID, PlayerInfo> players) {
        if (playerIds.isEmpty()) {
            return Set.of();
        }
        Set<UUID> members = poolMemberIds(match, team);
        Set<UUID> outside = new HashSet<>();
        for (UUID playerId : playerIds) {
            if (!inPool(match.getClubId(), players.get(playerId), playerId, members)) {
                outside.add(playerId);
            }
        }
        return outside;
    }

    /**
     * The pool test for one player given the team's already resolved member ids: a known, active
     * profile of the match's club who is a member. Shared with the batch overview.
     */
    public boolean inPool(UUID matchClubId, PlayerInfo info, UUID playerId, Set<UUID> members) {
        return info != null && info.active() && matchClubId.equals(info.clubId()) && members.contains(playerId);
    }

    /**
     * The age-rule message for each player who fails it ({@code 029}'s wording); players who pass,
     * and every player when the match has no league or its league has no age rule, are absent.
     */
    public Map<UUID, String> ageProblems(Match match, Collection<UUID> playerIds, Map<UUID, PlayerInfo> players) {
        Map<UUID, String> problems = new HashMap<>();
        if (match.getLeagueId() == null || playerIds.isEmpty()) {
            return problems;
        }
        League league = leagueRepository
                .findById(match.getLeagueId())
                .orElseThrow(() -> new NotFoundException("League not found: " + match.getLeagueId()));
        if (league.getMinAge() == null && league.getMaxAge() == null) {
            return problems;
        }
        Season season = league.getAgeCutoffDate() != null ? null : seasonRepository
                .findById(match.getSeasonId())
                .orElseThrow(() -> new NotFoundException("Season not found: " + match.getSeasonId()));
        return ageProblems(league, season, playerIds, players);
    }

    /**
     * The age rule for already loaded rows: {@code season} is only read (for its start date) when
     * the league has no cutoff date of its own, so the caller may pass null otherwise. Shared with
     * the batch overview, which loads every league and season in one query each.
     */
    public Map<UUID, String> ageProblems(
            League league, Season season, Collection<UUID> playerIds, Map<UUID, PlayerInfo> players) {
        Map<UUID, String> problems = new HashMap<>();
        if (league.getMinAge() == null && league.getMaxAge() == null) {
            return problems;
        }
        LocalDate cutoffDate = league.getAgeCutoffDate() != null ? league.getAgeCutoffDate() : season.getStartDate();
        for (UUID playerId : playerIds) {
            PlayerInfo info = players.get(playerId);
            if (info == null) {
                continue;
            }
            String problem = ageProblem(league, cutoffDate, info);
            if (problem != null) {
                problems.put(playerId, problem);
            }
        }
        return problems;
    }

    private String ageProblem(League league, LocalDate cutoffDate, PlayerInfo info) {
        LocalDate dateOfBirth = info.dateOfBirth();
        if (dateOfBirth == null) {
            return info.fullName() + " has no recorded date of birth; required for this league's age rule";
        }
        int age = Period.between(dateOfBirth, cutoffDate).getYears();
        if (league.getMinAge() != null && age < league.getMinAge()) {
            return info.fullName() + " is " + age + ", below this league's minAge of " + league.getMinAge();
        }
        if (league.getMaxAge() != null && age > league.getMaxAge()) {
            return info.fullName() + " is " + age + ", above this league's maxAge of " + league.getMaxAge();
        }
        return null;
    }
}
