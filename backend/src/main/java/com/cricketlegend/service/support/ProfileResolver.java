package com.cricketlegend.service.support;

import com.cricketlegend.config.AccessService;
import com.cricketlegend.domain.Club;
import com.cricketlegend.domain.Person;
import com.cricketlegend.domain.ProfileKind;
import com.cricketlegend.domain.RoleAssignment;
import com.cricketlegend.domain.RoleAssignmentRole;
import com.cricketlegend.domain.ScopeType;
import com.cricketlegend.domain.Section;
import com.cricketlegend.dto.ProfileDto;
import com.cricketlegend.mapper.LinkRequestMapper;
import com.cricketlegend.repository.ClubRepository;
import com.cricketlegend.repository.PersonLinkRepository;
import com.cricketlegend.repository.RoleAssignmentRepository;
import com.cricketlegend.repository.SectionRepository;
import com.cricketlegend.service.LinkRequestManagementService;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Component;

/**
 * docs/specs/119, Decision 29: the chooser cards, computed on read from the caller's real rows (nothing stores "the user's
 * profiles"). At most one My players card (own record counts), one manager card per club the person manages (any
 * CLUB_ADMIN grant at that club, however many sections) and the platform admin card. The card never grants anything.
 */
@Component
public class ProfileResolver {

    private final AccessService accessService;
    private final RoleAssignmentRepository roleAssignmentRepository;
    private final SectionRepository sectionRepository;
    private final ClubRepository clubRepository;
    private final PersonLinkRepository personLinkRepository;
    private final MyPlayerAccess myPlayerAccess;
    private final LinkRequestManagementService linkRequestManagementService;

    public ProfileResolver(
            AccessService accessService,
            RoleAssignmentRepository roleAssignmentRepository,
            SectionRepository sectionRepository,
            ClubRepository clubRepository,
            PersonLinkRepository personLinkRepository,
            MyPlayerAccess myPlayerAccess,
            LinkRequestManagementService linkRequestManagementService) {
        this.accessService = accessService;
        this.roleAssignmentRepository = roleAssignmentRepository;
        this.sectionRepository = sectionRepository;
        this.clubRepository = clubRepository;
        this.personLinkRepository = personLinkRepository;
        this.myPlayerAccess = myPlayerAccess;
        this.linkRequestManagementService = linkRequestManagementService;
    }

    /** The caller's cards: My players, then manager cards by club name, then the platform admin card. */
    public List<ProfileDto> resolve(Authentication authentication, Jwt jwt, Person person) {
        List<ProfileDto> profiles = new ArrayList<>();
        if (person != null) {
            ProfileDto mine = myPlayers(authentication, jwt);
            if (mine != null) {
                profiles.add(mine);
            }
            profiles.addAll(managers(authentication, person));
        }
        if (accessService.isPlatformAdmin(authentication)) {
            profiles.add(new ProfileDto(ProfileKind.PLATFORM_ADMIN, "Platform admin", null, null, null, null, "/admin", 0));
        }
        return profiles;
    }

    private ProfileDto myPlayers(Authentication authentication, Jwt jwt) {
        List<HeldPlayer> held = myPlayerAccess.list(authentication);
        long invitations = 0;
        String email = verifiedEmail(jwt);
        if (email != null) {
            invitations = personLinkRepository.countOpenInvitationsForEmail(email, Instant.now());
        }
        if (held.isEmpty() && invitations == 0) {
            return null;
        }
        String subtitle = null;
        if (!held.isEmpty()) {
            String first = LinkRequestMapper.fullName(held.get(0).subject());
            subtitle = held.size() == 1 ? first : first + " and " + (held.size() - 1) + " more";
        }
        return new ProfileDto(ProfileKind.MY_PLAYERS, "My players", subtitle, null, null, null, "/account", (int) invitations);
    }

    private List<ProfileDto> managers(Authentication authentication, Person person) {
        List<RoleAssignment> grants = roleAssignmentRepository.findByPersonId(person.getId()).stream()
                .filter(g -> g.getRole() == RoleAssignmentRole.CLUB_ADMIN)
                .toList();
        if (grants.isEmpty()) {
            return List.of();
        }
        Set<UUID> sectionIds = grants.stream()
                .filter(g -> g.getScopeType() == ScopeType.SECTION && g.getScopeId() != null)
                .map(RoleAssignment::getScopeId)
                .collect(Collectors.toSet());
        Map<UUID, Section> sections = sectionRepository.findAllById(sectionIds).stream()
                .collect(Collectors.toMap(Section::getId, s -> s));

        Set<UUID> clubWide = new HashSet<>();
        Map<UUID, List<String>> sectionNamesByClub = new HashMap<>();
        for (RoleAssignment g : grants) {
            if (g.getScopeType() == ScopeType.CLUB && g.getScopeId() != null) {
                clubWide.add(g.getScopeId());
            } else if (g.getScopeType() == ScopeType.SECTION) {
                Section s = sections.get(g.getScopeId());
                if (s != null) {
                    sectionNamesByClub.computeIfAbsent(s.getClubId(), k -> new ArrayList<>()).add(s.getName());
                }
            }
        }
        Set<UUID> clubIds = new HashSet<>(clubWide);
        clubIds.addAll(sectionNamesByClub.keySet());
        if (clubIds.isEmpty()) {
            return List.of();
        }
        List<Club> clubs = clubRepository.findAllById(clubIds).stream()
                .sorted(Comparator.comparing(Club::getName, String.CASE_INSENSITIVE_ORDER))
                .toList();
        List<ProfileDto> result = new ArrayList<>();
        for (Club club : clubs) {
            String subtitle = clubWide.contains(club.getId())
                    ? null
                    : joinNames(sectionNamesByClub.getOrDefault(club.getId(), List.of()));
            int waiting = linkRequestManagementService.summary(authentication, club.getId()).waiting();
            result.add(new ProfileDto(
                    ProfileKind.MANAGER, "Manager of " + club.getName(), subtitle,
                    club.getId(), club.getName(), club.getSlug(), "/manage", waiting));
        }
        return result;
    }

    /** "Juniors", "Juniors and Vets", "Juniors, Seniors and Vets". */
    private static String joinNames(List<String> names) {
        List<String> sorted = names.stream().distinct().sorted(String.CASE_INSENSITIVE_ORDER).toList();
        if (sorted.isEmpty()) {
            return null;
        }
        if (sorted.size() == 1) {
            return sorted.get(0);
        }
        return String.join(", ", sorted.subList(0, sorted.size() - 1)) + " and " + sorted.get(sorted.size() - 1);
    }

    private static String verifiedEmail(Jwt jwt) {
        if (jwt == null || !Boolean.TRUE.equals(jwt.getClaimAsBoolean("email_verified"))) {
            return null;
        }
        String email = jwt.getClaimAsString("email");
        return email == null || email.isBlank() ? null : email.trim();
    }
}
