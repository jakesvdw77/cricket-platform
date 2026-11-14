package com.cricketlegend.service.impl;

import com.cricketlegend.config.AccessService;
import com.cricketlegend.domain.AccessRole;
import com.cricketlegend.domain.Permission;
import com.cricketlegend.domain.Person;
import com.cricketlegend.domain.PersonStatus;
import com.cricketlegend.domain.RoleAssignment;
import com.cricketlegend.domain.RoleAssignmentRole;
import com.cricketlegend.domain.ScopeType;
import com.cricketlegend.domain.Section;
import com.cricketlegend.dto.AccessGrantDto;
import com.cricketlegend.dto.AccessGrantListDto;
import com.cricketlegend.dto.AddAccessGrantRequest;
import com.cricketlegend.dto.AddAccessGrantResultDto;
import com.cricketlegend.dto.ChangeAccessGrantRoleRequest;
import com.cricketlegend.dto.RoleGrantabilityDto;
import com.cricketlegend.exception.ConflictException;
import com.cricketlegend.exception.KeycloakProvisioningException;
import com.cricketlegend.exception.LinkRateLimitedException;
import com.cricketlegend.exception.NotFoundException;
import com.cricketlegend.exception.ValidationException;
import com.cricketlegend.mapper.LinkRequestMapper;
import com.cricketlegend.repository.AccessRoleRepository;
import com.cricketlegend.repository.PersonRepository;
import com.cricketlegend.repository.RoleAssignmentRepository;
import com.cricketlegend.repository.SectionRepository;
import com.cricketlegend.service.AccessGrantEmailService;
import com.cricketlegend.service.AccessGrantService;
import com.cricketlegend.service.AccessRoleService;
import com.cricketlegend.service.KeycloakProvisioningService;
import com.cricketlegend.service.PersonService;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumSet;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * docs/specs/150-managers-and-access-grants.md. One small private method per rule so the unit tests map one to one. A place is
 * a club-wide grant (a null section id in the private helpers) or one section and everything beneath it (docs/specs/035). The
 * permissions a role carries <em>at a place</em> are all of them for a club-wide place and only the section reach ones for a
 * section, because the club reach ones are inert there (rule 2). Every grant, change and removal logs one INFO line with ids only.
 */
@Service
public class AccessGrantServiceImpl implements AccessGrantService {

    private static final Logger log = LoggerFactory.getLogger(AccessGrantServiceImpl.class);

    private final AccessService accessService;
    private final RoleAssignmentRepository grantRepository;
    private final AccessRoleRepository roleRepository;
    private final AccessRoleService roleService;
    private final PersonRepository personRepository;
    private final PersonService personService;
    private final SectionRepository sectionRepository;
    private final KeycloakProvisioningService keycloakProvisioningService;
    private final AccessGrantEmailService emailService;
    private final int invitationsPerClubPerDay;

    public AccessGrantServiceImpl(
            AccessService accessService,
            RoleAssignmentRepository grantRepository,
            AccessRoleRepository roleRepository,
            AccessRoleService roleService,
            PersonRepository personRepository,
            PersonService personService,
            SectionRepository sectionRepository,
            KeycloakProvisioningService keycloakProvisioningService,
            AccessGrantEmailService emailService,
            @Value("${app.access.invitations-per-club-per-day:20}") int invitationsPerClubPerDay) {
        this.accessService = accessService;
        this.grantRepository = grantRepository;
        this.roleRepository = roleRepository;
        this.roleService = roleService;
        this.personRepository = personRepository;
        this.personService = personService;
        this.sectionRepository = sectionRepository;
        this.keycloakProvisioningService = keycloakProvisioningService;
        this.emailService = emailService;
        this.invitationsPerClubPerDay = invitationsPerClubPerDay;
    }

    // ------------------------------------------------------------------ list

    @Override
    @Transactional(readOnly = true)
    public AccessGrantListDto list(Authentication authentication, UUID clubId) {
        UUID me = accessService.resolveCurrentPersonId(authentication);
        List<Section> sections = sectionRepository.findByClubId(clubId);
        List<RoleAssignment> all = clubGrants(clubId, sections);
        Context context = context(clubId, all, sections, me);
        all.removeIf(grant -> context.roleOf(grant) == null);

        Optional<Set<UUID>> viewable = accessService.sectionIdsFor(authentication, clubId, Permission.ACCESS_VIEW);
        List<RoleAssignment> visible = new ArrayList<>();
        int clubWideCount = 0;
        for (RoleAssignment grant : all) {
            if (viewable.isEmpty()) {
                visible.add(grant);
                continue;
            }
            boolean own = grant.getPersonId().equals(me);
            boolean inReach = grant.getScopeType() == ScopeType.SECTION && viewable.get().contains(grant.getScopeId());
            if (own || inReach) {
                visible.add(grant);
            } else if (grant.getScopeType() == ScopeType.CLUB) {
                clubWideCount++; // rule 8: a section viewer learns that club-wide holders exist, never who
            }
        }
        visible.sort(Comparator.comparing((RoleAssignment grant) -> context.nameOf(grant), String.CASE_INSENSITIVE_ORDER));
        List<AccessGrantDto> items = visible.stream().map(grant -> toDto(authentication, clubId, grant, context)).toList();

        boolean canGrantClubWide = accessService.canClubWide(authentication, clubId, Permission.ACCESS_MANAGE);
        List<UUID> grantableSections = grantableSectionIds(authentication, clubId, sections);
        List<RoleGrantabilityDto> roles = new ArrayList<>();
        for (AccessRole role : roleRepository.findByClubIdIsNull()) {
            if (!roleService.isAssignable(role)) {
                continue;
            }
            boolean clubWide = canGrantClubWide
                    && holdsAtPlace(authentication, clubId, permissionsAt(role, true), null);
            List<UUID> roleSections = grantableSections.stream()
                    .filter(sectionId -> holdsAtPlace(authentication, clubId, permissionsAt(role, false), sectionId))
                    .toList();
            roles.add(new RoleGrantabilityDto(role.getId(), clubWide, roleSections));
        }
        boolean canManage = accessService.can(authentication, clubId, Permission.ACCESS_MANAGE);
        return new AccessGrantListDto(items, clubWideCount, canManage, canGrantClubWide, grantableSections, roles);
    }

    // ------------------------------------------------------------------- add

    @Override
    @Transactional
    public AddAccessGrantResultDto add(Authentication authentication, UUID clubId, AddAccessGrantRequest request) {
        UUID sectionId = placeOf(clubId, request.scope(), request.sectionId());
        AccessRole role = assignableRole(request.roleId());
        assertCanGive(authentication, clubId, role, sectionId);
        assertWithinInvitationLimit(clubId);

        String email = request.email().trim().toLowerCase();
        Person person = personService.findOrCreatePerson(request.firstName().trim(), request.lastName().trim(), email, null);
        assertNotRedundant(clubId, person, role, sectionId);

        boolean accountExisted = person.getKeycloakUserId() != null || person.getKeycloakProvisionedAt() != null;
        RoleAssignment grant = grantRepository.save(RoleAssignment.builder()
                .personId(person.getId())
                .role(legacyRoleFor(role))
                .accessRoleId(role.getId())
                .scopeType(sectionId == null ? ScopeType.CLUB : ScopeType.SECTION)
                .scopeId(sectionId == null ? clubId : sectionId)
                .grantedByPersonId(accessService.resolveCurrentPersonId(authentication))
                .build());

        boolean invitationSent = false;
        boolean invitationFailed = false;
        if (accountExisted) {
            emailService.sendAfterCommit(grant.getId()); // never throws; the grant stands either way
        } else {
            try {
                keycloakProvisioningService.provisionAccount(person);
                person.setKeycloakProvisionedAt(Instant.now());
                personRepository.save(person);
                grant.setInvitationSentAt(Instant.now());
                grantRepository.save(grant);
                invitationSent = true;
            } catch (KeycloakProvisioningException e) {
                // the posture docs/specs/016 set: the grant is kept, the failure is logged and shown, Resend retries it
                invitationFailed = true;
                log.error("Keycloak provisioning failed for person {} (grant {}, club {}): {}",
                        person.getId(), grant.getId(), clubId, e.getMessage(), e);
            }
        }
        log.info("Access granted: grant={} person={} role={} place={} club={} by={}",
                grant.getId(), person.getId(), role.getKey(), sectionId == null ? "CLUB" : sectionId, clubId,
                grant.getGrantedByPersonId());

        Context context = context(clubId, List.of(grant), sectionRepository.findByClubId(clubId),
                accessService.resolveCurrentPersonId(authentication));
        return new AddAccessGrantResultDto(
                toDto(authentication, clubId, grant, context), accountExisted, invitationSent, invitationFailed);
    }

    // ---------------------------------------------------------- change / resend / remove

    @Override
    @Transactional
    public AccessGrantDto changeRole(
            Authentication authentication, UUID clubId, UUID grantId, ChangeAccessGrantRoleRequest request) {
        RoleAssignment grant = grantInClub(clubId, grantId);
        Context context = context(clubId, List.of(grant), sectionRepository.findByClubId(clubId),
                accessService.resolveCurrentPersonId(authentication));
        AccessRole current = context.roleOf(grant);
        UUID sectionId = sectionOf(grant);
        assertMayTouch(authentication, clubId, grant, current, context.me());

        AccessRole target = assignableRole(request.roleId());
        assertCanGive(authentication, clubId, target, sectionId);
        if (target.getId().equals(current.getId())) {
            return toDto(authentication, clubId, grant, context);
        }
        if (isLastClubWideManager(grant, current, clubId)) {
            throw new ConflictException("The club must keep at least one club-wide Manager");
        }
        grant.setAccessRoleId(target.getId());
        grant.setRole(legacyRoleFor(target));
        grantRepository.save(grant);
        log.info("Access role changed: grant={} from={} to={} club={} by={}",
                grantId, current.getKey(), target.getKey(), clubId, context.me());

        Context fresh = context(clubId, List.of(grant), sectionRepository.findByClubId(clubId), context.me());
        return toDto(authentication, clubId, grant, fresh);
    }

    @Override
    @Transactional
    public void resend(Authentication authentication, UUID clubId, UUID grantId) {
        RoleAssignment grant = grantInClub(clubId, grantId);
        UUID me = accessService.resolveCurrentPersonId(authentication);
        Context context = context(clubId, List.of(grant), sectionRepository.findByClubId(clubId), me);
        assertMayTouch(authentication, clubId, grant, context.roleOf(grant), me);
        Person person = context.persons().get(grant.getPersonId());
        if (person == null || person.getStatus() != PersonStatus.PENDING) {
            throw new ConflictException("This person has already signed in");
        }
        assertWithinInvitationLimit(clubId);
        try {
            keycloakProvisioningService.resendInvitation(person);
        } catch (KeycloakProvisioningException e) {
            log.error("Resending invitation failed for person {} (grant {}, club {}): {}",
                    person.getId(), grantId, clubId, e.getMessage(), e);
            throw new ConflictException("The invitation could not be sent. Please try again later.");
        }
        if (person.getKeycloakProvisionedAt() == null) {
            person.setKeycloakProvisionedAt(Instant.now());
            personRepository.save(person);
        }
        grant.setInvitationSentAt(Instant.now());
        grantRepository.save(grant);
        log.info("Access invitation resent: grant={} person={} club={} by={}", grantId, person.getId(), clubId, me);
    }

    @Override
    @Transactional
    public void remove(Authentication authentication, UUID clubId, UUID grantId) {
        RoleAssignment grant = grantInClub(clubId, grantId);
        UUID me = accessService.resolveCurrentPersonId(authentication);
        Context context = context(clubId, List.of(grant), sectionRepository.findByClubId(clubId), me);
        AccessRole role = context.roleOf(grant);
        assertMayTouch(authentication, clubId, grant, role, me);
        if (isLastClubWideManager(grant, role, clubId)) {
            throw new ConflictException("The club must keep at least one club-wide Manager");
        }
        grantRepository.delete(grant);
        log.info("Access removed: grant={} person={} role={} club={} by={}",
                grantId, grant.getPersonId(), role.getKey(), clubId, me);
    }

    // ------------------------------------------------------------------ rules

    /** Rule 1: a club-wide place has no section; a section place must be a section of this club (404 otherwise). */
    private UUID placeOf(UUID clubId, ScopeType scope, UUID sectionId) {
        if (scope == ScopeType.CLUB) {
            if (sectionId != null) {
                throw new ValidationException("A club-wide grant has no section");
            }
            return null;
        }
        if (scope != ScopeType.SECTION || sectionId == null) {
            throw new ValidationException("Choose the whole club or one section");
        }
        Section section = sectionRepository
                .findById(sectionId)
                .filter(found -> found.getClubId().equals(clubId))
                .orElseThrow(() -> new NotFoundException("Section not found: " + sectionId));
        return section.getId();
    }

    private AccessRole assignableRole(UUID roleId) {
        AccessRole role = roleRepository
                .findById(roleId)
                .orElseThrow(() -> new NotFoundException("Role not found: " + roleId));
        if (!roleService.isAssignable(role)) {
            throw new ValidationException("This role cannot be given yet");
        }
        return role;
    }

    /** Rules 1 to 4: needs Access Manage at the place, and every permission the role carries at that place. */
    private void assertCanGive(Authentication authentication, UUID clubId, AccessRole role, UUID sectionId) {
        if (!holdsAtPlace(authentication, clubId, EnumSet.of(Permission.ACCESS_MANAGE), sectionId)) {
            throw new AccessDeniedException("Not authorized to manage access here");
        }
        if (!holdsAtPlace(authentication, clubId, permissionsAt(role, sectionId == null), sectionId)) {
            throw new AccessDeniedException("Not authorized to give a role with permissions you do not hold here");
        }
    }

    /** Rules 3 to 5: in reach, never your own grant, and nothing bigger than what you hold at that place. */
    private void assertMayTouch(
            Authentication authentication, UUID clubId, RoleAssignment grant, AccessRole role, UUID me) {
        if (grant.getPersonId().equals(me)) {
            throw new AccessDeniedException("Not authorized to change your own access");
        }
        if (!mayTouch(authentication, clubId, grant, role, me)) {
            throw new AccessDeniedException("Not authorized to change this access");
        }
    }

    private boolean mayTouch(Authentication authentication, UUID clubId, RoleAssignment grant, AccessRole role, UUID me) {
        if (grant.getPersonId().equals(me)) {
            return false;
        }
        UUID sectionId = sectionOf(grant);
        return holdsAtPlace(authentication, clubId, EnumSet.of(Permission.ACCESS_MANAGE), sectionId)
                && holdsAtPlace(authentication, clubId, permissionsAt(role, sectionId == null), sectionId);
    }

    /** Rule 6. */
    private boolean isLastClubWideManager(RoleAssignment grant, AccessRole role, UUID clubId) {
        return grant.getScopeType() == ScopeType.CLUB
                && AccessRole.MANAGER_ID.equals(role.getId())
                && grantRepository.countClubWideManagers(clubId, AccessRole.MANAGER_ID) <= 1;
    }

    /** Rule 7: refuse a grant the person's existing grants at this club already cover. */
    private void assertNotRedundant(UUID clubId, Person person, AccessRole role, UUID sectionId) {
        Set<Permission> needed = permissionsAt(role, sectionId == null);
        Map<UUID, AccessRole> roles = new HashMap<>();
        List<RoleAssignment> existing = grantRepository.findByPersonId(person.getId());
        roleRepository.findAllById(roleIdsOf(existing)).forEach(found -> roles.put(found.getId(), found));
        Map<UUID, Section> sections = new HashMap<>();
        sectionRepository.findByClubId(clubId).forEach(section -> sections.put(section.getId(), section));
        for (RoleAssignment grant : existing) {
            AccessRole held = roles.get(roleIdOf(grant));
            if (held == null || grant.getScopeId() == null) {
                continue;
            }
            boolean coversPlace;
            Set<Permission> heldHere;
            if (grant.getScopeType() == ScopeType.CLUB && grant.getScopeId().equals(clubId)) {
                coversPlace = true;
                heldHere = permissionsAt(held, true);
            } else if (grant.getScopeType() == ScopeType.SECTION && sectionId != null
                    && sections.containsKey(grant.getScopeId())) {
                coversPlace = accessService.sectionAndDescendantIds(clubId, grant.getScopeId()).contains(sectionId);
                heldHere = permissionsAt(held, false);
            } else {
                continue;
            }
            if (coversPlace && heldHere.containsAll(needed)) {
                String where = grant.getScopeType() == ScopeType.CLUB
                        ? "the whole club"
                        : sections.get(grant.getScopeId()).getName();
                throw new ConflictException(LinkRequestMapper.fullName(person) + " already has "
                        + held.getName() + " for " + where);
            }
        }
    }

    /** Rule 10. */
    private void assertWithinInvitationLimit(UUID clubId) {
        long sent = grantRepository.countInvitationsSince(clubId, Instant.now().minus(Duration.ofDays(1)));
        if (sent >= invitationsPerClubPerDay) {
            throw new LinkRateLimitedException(3600);
        }
    }

    // ---------------------------------------------------------------- helpers

    /** What a role carries at a place: everything club-wide, only the section reach permissions on a section (rule 2). */
    private static Set<Permission> permissionsAt(AccessRole role, boolean clubWide) {
        Set<Permission> all = role.permissions();
        if (clubWide) {
            return all;
        }
        Set<Permission> section = EnumSet.noneOf(Permission.class);
        for (Permission permission : all) {
            if (permission.reach() == Permission.Reach.SECTION) {
                section.add(permission);
            }
        }
        return section;
    }

    private boolean holdsAtPlace(Authentication authentication, UUID clubId, Set<Permission> needed, UUID sectionId) {
        for (Permission permission : needed) {
            boolean holds = sectionId == null
                    ? accessService.canClubWide(authentication, clubId, permission)
                    : accessService.can(authentication, clubId, permission, sectionId);
            if (!holds) {
                return false;
            }
        }
        return true;
    }

    private static UUID sectionOf(RoleAssignment grant) {
        return grant.getScopeType() == ScopeType.SECTION ? grant.getScopeId() : null;
    }

    /**
     * The old role column no longer decides what anyone may do (the permission checks do, docs/specs/150). It still marks
     * "holds a manager grant here" for the profile switcher and {@code me/access}, so every role written through this
     * screen carries CLUB_ADMIN, whichever access role it is.
     */
    private static RoleAssignmentRole legacyRoleFor(AccessRole role) {
        return RoleAssignmentRole.CLUB_ADMIN;
    }

    private static UUID roleIdOf(RoleAssignment grant) {
        if (grant.getAccessRoleId() != null) {
            return grant.getAccessRoleId();
        }
        return grant.getRole() == RoleAssignmentRole.CLUB_ADMIN ? AccessRole.MANAGER_ID : null;
    }

    private static Set<UUID> roleIdsOf(List<RoleAssignment> grants) {
        Set<UUID> ids = new HashSet<>();
        for (RoleAssignment grant : grants) {
            UUID id = roleIdOf(grant);
            if (id != null) {
                ids.add(id);
            }
        }
        return ids;
    }

    private List<RoleAssignment> clubGrants(UUID clubId, List<Section> sections) {
        List<RoleAssignment> all = new ArrayList<>(grantRepository.findByScopeTypeAndScopeId(ScopeType.CLUB, clubId));
        if (!sections.isEmpty()) {
            all.addAll(grantRepository.findByScopeTypeAndScopeIdIn(
                    ScopeType.SECTION, sections.stream().map(Section::getId).toList()));
        }
        return all;
    }

    /** A grant that belongs to this club (404 otherwise, so another club's id is never revealed) and carries a role. */
    private RoleAssignment grantInClub(UUID clubId, UUID grantId) {
        RoleAssignment grant = grantRepository
                .findById(grantId)
                .orElseThrow(() -> new NotFoundException("Access not found: " + grantId));
        boolean inClub = (grant.getScopeType() == ScopeType.CLUB && clubId.equals(grant.getScopeId()))
                || (grant.getScopeType() == ScopeType.SECTION && grant.getScopeId() != null
                        && sectionRepository.findById(grant.getScopeId())
                                .map(section -> section.getClubId().equals(clubId))
                                .orElse(false));
        if (!inClub || roleIdOf(grant) == null) {
            throw new NotFoundException("Access not found: " + grantId);
        }
        return grant;
    }

    private List<UUID> grantableSectionIds(Authentication authentication, UUID clubId, List<Section> sections) {
        Optional<Set<UUID>> reach = accessService.sectionIdsFor(authentication, clubId, Permission.ACCESS_MANAGE);
        return sections.stream()
                .filter(Section::isActive)
                .map(Section::getId)
                .filter(id -> reach.isEmpty() || reach.get().contains(id))
                .toList();
    }

    private AccessGrantDto toDto(Authentication authentication, UUID clubId, RoleAssignment grant, Context context) {
        AccessRole role = context.roleOf(grant);
        Person person = context.persons().get(grant.getPersonId());
        Person addedBy = grant.getGrantedByPersonId() == null ? null : context.persons().get(grant.getGrantedByPersonId());
        UUID sectionId = sectionOf(grant);
        boolean self = grant.getPersonId().equals(context.me());
        boolean touch = mayTouch(authentication, clubId, grant, role, context.me());
        boolean last = isLastClubWideManager(grant, role, clubId);
        boolean invited = person != null && person.getStatus() == PersonStatus.PENDING;
        return new AccessGrantDto(
                grant.getId(),
                grant.getPersonId(),
                person == null ? "" : person.getFirstName(),
                person == null ? "" : person.getLastName(),
                person == null ? null : person.getEmail(),
                role.getId(),
                role.getName(),
                grant.getScopeType(),
                sectionId,
                sectionId == null ? null : context.sections().get(sectionId).getName(),
                invited ? "INVITED" : "ACTIVE",
                addedBy == null ? null : LinkRequestMapper.fullName(addedBy),
                grant.getInvitationSentAt(),
                self,
                touch && !last,
                touch && !last,
                touch && invited);
    }

    private Context context(UUID clubId, List<RoleAssignment> grants, List<Section> sections, UUID me) {
        Map<UUID, AccessRole> roles = new HashMap<>();
        roleRepository.findAllById(roleIdsOf(grants)).forEach(role -> roles.put(role.getId(), role));
        Set<UUID> personIds = new HashSet<>();
        for (RoleAssignment grant : grants) {
            personIds.add(grant.getPersonId());
            if (grant.getGrantedByPersonId() != null) {
                personIds.add(grant.getGrantedByPersonId());
            }
        }
        Map<UUID, Person> persons = new HashMap<>();
        personRepository.findAllById(personIds).forEach(person -> persons.put(person.getId(), person));
        Map<UUID, Section> sectionsById = new HashMap<>();
        sections.forEach(section -> sectionsById.put(section.getId(), section));
        return new Context(roles, persons, sectionsById, me);
    }

    private record Context(
            Map<UUID, AccessRole> roles, Map<UUID, Person> persons, Map<UUID, Section> sections, UUID me) {

        AccessRole roleOf(RoleAssignment grant) {
            return roles.get(roleIdOf(grant));
        }

        String nameOf(RoleAssignment grant) {
            Person person = persons.get(grant.getPersonId());
            return person == null ? "" : LinkRequestMapper.fullName(person);
        }
    }
}
