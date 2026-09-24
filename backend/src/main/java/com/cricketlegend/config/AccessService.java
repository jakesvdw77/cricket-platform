package com.cricketlegend.config;

import com.cricketlegend.domain.Person;
import com.cricketlegend.domain.RoleAssignment;
import com.cricketlegend.domain.RoleAssignmentRole;
import com.cricketlegend.domain.ScopeType;
import com.cricketlegend.domain.Section;
import com.cricketlegend.domain.Team;
import com.cricketlegend.exception.NotFoundException;
import com.cricketlegend.repository.PersonRepository;
import com.cricketlegend.repository.RoleAssignmentRepository;
import com.cricketlegend.repository.SectionRepository;
import com.cricketlegend.repository.TeamRepository;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Deque;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.stereotype.Component;

/**
 * Per docs/specs/015-person-status-and-role-assignment.md: the flat {@code platform_admin} check
 * this method has carried since docs/specs/012-club-profile.md stays exactly as-is — it's the
 * vendor/system-operator persona, still checked directly against a Keycloak realm role, still a
 * superset/override of everything else this method checks. What's new is the second branch: a real
 * {@code RoleAssignment} lookup, resolving the caller's {@link com.cricketlegend.domain.Person} by
 * the JWT's {@code sub} claim (via {@code Authentication.getName()}, the same JWT-subject-as-name
 * precedent docs/specs/013-centralized-logging.md's {@code RequestCorrelationFilter} already
 * relies on) and checking for a {@code CLUB_ADMIN} grant scoped to this {@code clubId}.
 *
 * <p>As of docs/specs/016-keycloak-account-provisioning.md, the {@code RoleAssignment} branch
 * below is genuinely reachable in production: {@code SubscriptionServiceImpl.create()} now
 * provisions a real Keycloak account and grants a {@code CLUB_ADMIN} {@code RoleAssignment} for a
 * Subscription's responsible {@link com.cricketlegend.domain.Person}, and {@code MeServiceImpl}
 * sets {@link com.cricketlegend.domain.Person#getKeycloakUserId()} on that person's first login —
 * closing the gap this class's Javadoc previously flagged as "correct but effectively unreachable."
 *
 * <p>Per docs/specs/035-section-scoped-access.md: this class grows real {@code SECTION}-scope
 * resolution on top of the {@code CLUB}-scope check above — a person holding a {@code SECTION}
 * -scope {@code CLUB_ADMIN} grant (docs/specs/001-tenancy-identity-model.md's "Juniors admin",
 * resolved as {@code RoleAssignmentRole.CLUB_ADMIN} at a narrower {@code scope_type}, not a new
 * role value — see 035's Data Model Changes drift note) administers exactly that section and every
 * section beneath it, computed as a downward descendant closure over {@link
 * Section#getParentSectionId()}. {@link #assertCanAdministerSection}/{@link
 * #assertCanAdministerAnySection} are a deliberate, new pattern for this codebase — the first
 * {@code AccessService} methods consulted directly from service-layer code (not only {@code
 * @PreAuthorize} SpEL), throwing Spring Security's own {@link AccessDeniedException} directly
 * rather than one of {@code docs/standards/backend.md}'s {@code NotFoundException}/{@code
 * ConflictException}/{@code ValidationException} business-exception base classes — see 035's API
 * Contract section for why.
 */
@Component("access")
public class AccessService {

    private final PersonRepository personRepository;
    private final RoleAssignmentRepository roleAssignmentRepository;
    private final SectionRepository sectionRepository;
    private final TeamRepository teamRepository;

    public AccessService(
            PersonRepository personRepository,
            RoleAssignmentRepository roleAssignmentRepository,
            SectionRepository sectionRepository,
            TeamRepository teamRepository) {
        this.personRepository = personRepository;
        this.roleAssignmentRepository = roleAssignmentRepository;
        this.sectionRepository = sectionRepository;
        this.teamRepository = teamRepository;
    }

    /**
     * Resolves the calling {@link Person}'s own {@code id} from {@code authentication} (via the
     * JWT-subject-as-name lookup, {@code personRepository.findByKeycloakUserId(authentication
     * .getName())} — the same mechanism {@link #canAdministerClub}/{@link #accessibleSectionIds}
     * already use internally to resolve "who is calling"), or {@code null} when there's no
     * authenticated caller or no matching {@link Person} row. Per
     * docs/specs/050-league-schedule-and-fixtures.md: no service in this codebase populates an
     * {@code updatedBy}/{@code createdBy}/{@code uploadedBy} audit column from the current
     * principal today (every such column exists on its entity but stays {@code null} — confirmed
     * by inspection across {@code League}/{@code Match}/{@code LeagueAffiliation}/{@code
     * PublicAvailabilityPollServiceImpl}'s own Javadoc, "no authenticated identity on this write
     * path"); this is the first real wiring, reusing {@code PersonRepository}'s existing lookup
     * rather than duplicating it or reaching into the repository layer from a controller (which
     * docs/standards/backend.md disallows).
     */
    public UUID resolveCurrentPersonId(Authentication authentication) {
        if (authentication == null) {
            return null;
        }
        return personRepository.findByKeycloakUserId(authentication.getName()).map(Person::getId).orElse(null);
    }

    public boolean isPlatformAdmin(Authentication authentication) {
        if (authentication == null) {
            return false;
        }
        return authentication.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .anyMatch("ROLE_platform_admin"::equals);
    }

    public boolean canAdministerClub(Authentication authentication, UUID clubId) {
        if (authentication == null) {
            return false;
        }
        if (isPlatformAdmin(authentication)) {
            return true; // superset/override — platform_admin is untouched by this spec
        }
        return personRepository
                .findByKeycloakUserId(authentication.getName())
                .map(person -> roleAssignmentRepository.existsByPersonIdAndRoleAndScopeTypeAndScopeId(
                        person.getId(), RoleAssignmentRole.CLUB_ADMIN, ScopeType.CLUB, clubId))
                .orElse(false);
    }

    /**
     * The closed set of {@code Section} ids (self + every descendant) the caller can administer
     * within this club, computed as a downward closure over {@code Section.parentSectionId}.
     * {@code Optional.empty()} is the "unrestricted" sentinel — the caller is {@code
     * platform_admin} or already holds a {@code CLUB}-scope {@code CLUB_ADMIN} grant, so every
     * section in the club is implicitly covered and no filtering should be applied at all. A
     * present-but-possibly-empty {@code Set} is the real, closed accessible-section list for a
     * caller who is NOT club-wide — empty means "holds no {@code SECTION}-scope grant in this club
     * either." See docs/specs/035-section-scoped-access.md's Data Model Changes.
     */
    public Optional<Set<UUID>> accessibleSectionIds(Authentication authentication, UUID clubId) {
        if (canAdministerClub(authentication, clubId)) {
            return Optional.empty();
        }
        if (authentication == null) {
            return Optional.of(Set.of());
        }
        Optional<Person> personOpt = personRepository.findByKeycloakUserId(authentication.getName());
        if (personOpt.isEmpty()) {
            return Optional.of(Set.of());
        }
        Person person = personOpt.get();
        List<RoleAssignment> sectionGrants = roleAssignmentRepository.findByPersonIdAndRoleAndScopeType(
                person.getId(), RoleAssignmentRole.CLUB_ADMIN, ScopeType.SECTION);
        if (sectionGrants.isEmpty()) {
            return Optional.of(Set.of());
        }

        List<Section> clubSections = sectionRepository.findByClubId(clubId);
        Set<UUID> clubSectionIds = new HashSet<>();
        for (Section section : clubSections) {
            clubSectionIds.add(section.getId());
        }
        Map<UUID, List<UUID>> childrenByParent = buildChildrenByParent(clubSections);

        Set<UUID> accessible = new HashSet<>();
        for (RoleAssignment grant : sectionGrants) {
            UUID rootId = grant.getScopeId();
            // A grant rooted at a section belonging to a different club never widens this club's
            // own accessible set — only roots that are real sections of THIS club contribute.
            if (rootId == null || !clubSectionIds.contains(rootId)) {
                continue;
            }
            collectSelfAndDescendants(rootId, childrenByParent, accessible);
        }
        return Optional.of(accessible);
    }

    private Map<UUID, List<UUID>> buildChildrenByParent(List<Section> sections) {
        Map<UUID, List<UUID>> childrenByParent = new HashMap<>();
        for (Section section : sections) {
            if (section.getParentSectionId() != null) {
                childrenByParent
                        .computeIfAbsent(section.getParentSectionId(), key -> new ArrayList<>())
                        .add(section.getId());
            }
        }
        return childrenByParent;
    }

    /**
     * Self + every descendant {@code Section} id within {@code clubId}, rooted at an arbitrary
     * {@code sectionId} — the shared closure computation reused by every endpoint's explicit
     * {@code sectionId} query-param narrowing (Players/Teams/Matches/Availability list filters),
     * where the narrow must be closure-inclusive the same way a {@code SECTION}-scope grant's own
     * reach is (035's Teams table: "sectionId param narrows further, closure-inclusive"). Does
     * NOT itself check access — callers validate {@code sectionId} via {@link
     * #assertCanAdministerSection} first. Extracted alongside {@link #accessibleSectionIds}'s own
     * closure walk (same {@link #buildChildrenByParent}/{@link #collectSelfAndDescendants}
     * helpers) rather than duplicated per call site, per docs/standards/backend.md's "shared logic
     * lives in one place" rule.
     */
    public Set<UUID> sectionAndDescendantIds(UUID clubId, UUID sectionId) {
        Map<UUID, List<UUID>> childrenByParent = buildChildrenByParent(sectionRepository.findByClubId(clubId));
        Set<UUID> result = new HashSet<>();
        collectSelfAndDescendants(sectionId, childrenByParent, result);
        return result;
    }

    private void collectSelfAndDescendants(
            UUID rootId, Map<UUID, List<UUID>> childrenByParent, Set<UUID> accumulator) {
        Deque<UUID> queue = new ArrayDeque<>();
        queue.add(rootId);
        while (!queue.isEmpty()) {
            UUID current = queue.poll();
            if (!accumulator.add(current)) {
                continue; // already visited, avoids re-walking a shared subtree
            }
            queue.addAll(childrenByParent.getOrDefault(current, List.of()));
        }
    }

    /**
     * The broader entry gate for endpoints a section-scoped admin must be able to reach at all —
     * {@code true} if {@link #canAdministerClub} already passes, OR {@link #accessibleSectionIds}
     * is non-empty. Does NOT replace {@link #canAdministerClub} anywhere it's used today for a
     * genuinely club-wide-only surface (Club Profile, Club Structure, Sponsors, Club Contacts,
     * Seasons, Leagues). See docs/specs/035-section-scoped-access.md's API Contract.
     */
    public boolean canAccessClub(Authentication authentication, UUID clubId) {
        if (canAdministerClub(authentication, clubId)) {
            return true;
        }
        return accessibleSectionIds(authentication, clubId).map(sections -> !sections.isEmpty()).orElse(true);
    }

    /**
     * {@code true} if {@link #canAdministerClub} already passes, OR {@code sectionId} is a member
     * of {@link #accessibleSectionIds}. Throws {@link NotFoundException} (404) first if {@code
     * sectionId} doesn't belong to {@code clubId} at all — matching this codebase's existing
     * cross-club isolation convention — before ever reaching the access question, so a wrong-club
     * id and a right-club-wrong-section id are never confused with each other. See
     * docs/specs/035-section-scoped-access.md's API Contract.
     */
    public boolean canAdministerSection(Authentication authentication, UUID clubId, UUID sectionId) {
        Section section = sectionRepository
                .findById(sectionId)
                .orElseThrow(() -> new NotFoundException("Section not found: " + sectionId));
        if (!section.getClubId().equals(clubId)) {
            throw new NotFoundException("Section not found: " + sectionId);
        }
        if (canAdministerClub(authentication, clubId)) {
            return true;
        }
        return accessibleSectionIds(authentication, clubId)
                .map(sections -> sections.contains(sectionId))
                .orElse(false);
    }

    /**
     * Void form of {@link #canAdministerSection} — throws {@link AccessDeniedException} (Spring
     * Security's own type, the same one {@code @PreAuthorize} throws internally on a false SpEL
     * expression) when {@link #canAdministerSection} would return false. Used from service-layer
     * code where the target section can only be known after loading a resource, so it can't be
     * expressed as a {@code #pathVariable} in {@code @PreAuthorize}'s own SpEL. Deliberately NOT a
     * {@code docs/standards/backend.md} business exception — see
     * docs/specs/035-section-scoped-access.md's API Contract for why.
     */
    public void assertCanAdministerSection(Authentication authentication, UUID clubId, UUID sectionId) {
        if (!canAdministerSection(authentication, clubId, sectionId)) {
            throw new AccessDeniedException("Not authorized to administer section: " + sectionId);
        }
    }

    /**
     * Same as {@link #assertCanAdministerSection}, but passes if ANY of {@code sectionIds} is
     * accessible — for a resource that can carry more than one section (a {@code Player}'s {@code
     * PlayerSection} tags, a {@code Match}'s resolved home/away sections). An empty {@code
     * sectionIds} collection always fails for a non-club-wide caller (an untagged/unresolved
     * resource is administerable only by a {@code CLUB}-scope admin — a deliberate, conservative
     * default). See docs/specs/035-section-scoped-access.md's API Contract.
     */
    public void assertCanAdministerAnySection(
            Authentication authentication, UUID clubId, Collection<UUID> sectionIds) {
        if (canAdministerClub(authentication, clubId)) {
            return;
        }
        if (sectionIds == null || sectionIds.isEmpty()) {
            throw new AccessDeniedException(
                    "Not authorized: no section on this resource is administerable by a section-scoped caller");
        }
        Set<UUID> accessible = accessibleSectionIds(authentication, clubId).orElse(Set.of());
        boolean anyAccessible = sectionIds.stream().anyMatch(accessible::contains);
        if (!anyAccessible) {
            throw new AccessDeniedException(
                    "Not authorized to administer any of this resource's sections: " + sectionIds);
        }
    }

    /**
     * A {@code Match}'s "own section(s)" — {@code Match} has no {@code sectionId} column (029), so
     * this resolves whichever of {@code homeTeamId}/{@code awayTeamId} references a real {@code
     * Team} belonging to THIS club (029's own cross-club-team-reference allowance means the other
     * side may not resolve to any of this club's own sections at all — an empty result here is the
     * "zero resolved sections" fallback case docs/specs/035-section-scoped-access.md names
     * explicitly, where only a {@code CLUB}-scope admin can reach the match). Shared by {@code
     * MatchServiceImpl}, {@code MatchSideServiceImpl}, and {@code
     * MatchAvailabilityPollServiceImpl} rather than duplicated per call site.
     */
    public Set<UUID> resolveMatchSectionIds(UUID clubId, UUID homeTeamId, UUID awayTeamId) {
        Set<UUID> sectionIds = new HashSet<>();
        addOwnClubTeamSection(clubId, homeTeamId, sectionIds);
        addOwnClubTeamSection(clubId, awayTeamId, sectionIds);
        return sectionIds;
    }

    private void addOwnClubTeamSection(UUID clubId, UUID teamId, Set<UUID> sectionIds) {
        if (teamId == null) {
            return;
        }
        Optional<Team> team = teamRepository.findById(teamId);
        team.filter(t -> t.getClubId().equals(clubId)).ifPresent(t -> sectionIds.add(t.getSectionId()));
    }
}
