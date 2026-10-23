package com.cricketlegend.service.impl;

import com.cricketlegend.config.AccessService;
import com.cricketlegend.domain.Person;
import com.cricketlegend.domain.PersonOrigin;
import com.cricketlegend.domain.PersonStatus;
import com.cricketlegend.service.support.ProfileResolver;
import com.cricketlegend.service.support.VerifiedEmail;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import com.cricketlegend.domain.RoleAssignment;
import com.cricketlegend.domain.RoleAssignmentRole;
import com.cricketlegend.domain.ScopeType;
import com.cricketlegend.dto.MeAccessDto;
import com.cricketlegend.dto.ProfileDto;
import com.cricketlegend.repository.PersonRepository;
import com.cricketlegend.repository.RoleAssignmentRepository;
import com.cricketlegend.service.MeService;
import java.util.List;
import java.util.UUID;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Per docs/specs/016-keycloak-account-provisioning.md. Bridges a JWT to a Person by email
 * on first login only — the same "bridge by email" resolution
 * docs/specs/014-subscription-responsible-contact.md's PersonService.findOrCreatePerson already
 * established, reused here (not reimplemented) for identity rather than record de-duplication.
 * Safe to call on every login: once Person.keycloakUserId is set, the fast path is a single
 * indexed findByKeycloakUserId lookup with no write at all.
 */
@Service
public class MeServiceImpl implements MeService {

    private static final Logger log = LoggerFactory.getLogger(MeServiceImpl.class);

    private final PersonRepository personRepository;
    private final RoleAssignmentRepository roleAssignmentRepository;
    private final AccessService accessService;
    private final ProfileResolver profileResolver;

    public MeServiceImpl(
            PersonRepository personRepository,
            RoleAssignmentRepository roleAssignmentRepository,
            AccessService accessService,
            ProfileResolver profileResolver) {
        this.profileResolver = profileResolver;
        this.personRepository = personRepository;
        this.roleAssignmentRepository = roleAssignmentRepository;
        this.accessService = accessService;
    }

    @Override
    @Transactional
    public MeAccessDto activateAndResolveAccess(Authentication authentication, Jwt jwt) {
        boolean platformAdmin = accessService.isPlatformAdmin(authentication);
        String keycloakUserId = authentication.getName(); // JWT sub — see 013's same precedent

        Person person = personRepository.findByKeycloakUserId(keycloakUserId).orElse(null);
        if (person == null) {
            person = bridgeByEmail(
                    keycloakUserId, jwt.getClaimAsString("email"), Boolean.TRUE.equals(jwt.getClaimAsBoolean("email_verified")));
        }
        refuseSuspended(person);

        return toAccessDto(authentication, jwt, person, platformAdmin);
    }

    @Override
    @Transactional
    public MeAccessDto register(Authentication authentication, Jwt jwt) {
        String email = VerifiedEmail.require(jwt);
        boolean platformAdmin = accessService.isPlatformAdmin(authentication);
        String keycloakUserId = authentication.getName();

        Person person = personRepository.findByKeycloakUserId(keycloakUserId).orElse(null);
        if (person == null) {
            person = bridgeByEmail(keycloakUserId, email, true);
        }
        if (person == null) {
            String firstName = claim(jwt, "given_name");
            String lastName = claim(jwt, "family_name");
            if (firstName.isEmpty() && lastName.isEmpty()) {
                String[] parts = claim(jwt, "name").split("\\s+", 2);
                firstName = parts[0];
                lastName = parts.length > 1 ? parts[1] : "";
            }
            if (firstName.isEmpty()) {
                firstName = email.substring(0, email.indexOf('@') > 0 ? email.indexOf('@') : email.length());
            }
            person = personRepository.save(Person.builder()
                    .firstName(firstName)
                    .lastName(lastName)
                    .email(email)
                    .keycloakUserId(keycloakUserId)
                    .status(PersonStatus.ACTIVE)
                    .origin(PersonOrigin.SELF_REGISTERED)
                    .build());
            log.info("Self-registered person created: personId={}", person.getId());
        }
        refuseSuspended(person);
        return toAccessDto(authentication, jwt, person, platformAdmin);
    }

    /** docs/specs/119, scenario 12: a SUSPENDED person is refused with 403 (the rollback also undoes a just-made email bridge). */
    private static void refuseSuspended(Person person) {
        if (person != null && person.getStatus() == PersonStatus.SUSPENDED) {
            log.warn("Suspended person refused: personId={}", person.getId());
            throw new AccessDeniedException("This account is disabled.");
        }
    }

    @Override
    @Transactional(readOnly = true)
    public List<ProfileDto> profiles(Authentication authentication, Jwt jwt) {
        Person person = personRepository.findByKeycloakUserId(authentication.getName()).orElse(null);
        refuseSuspended(person);
        return profileResolver.resolve(authentication, jwt, person);
    }

    private static String claim(Jwt jwt, String name) {
        String value = jwt.getClaimAsString(name);
        return value == null ? "" : value.trim();
    }

    private MeAccessDto toAccessDto(Authentication authentication, Jwt jwt, Person person, boolean platformAdmin) {
        List<UUID> clubAdminClubIds = person == null
                ? List.of()
                : roleAssignmentRepository.findByPersonId(person.getId()).stream()
                        .filter(ra -> ra.getRole() == RoleAssignmentRole.CLUB_ADMIN
                                && ra.getScopeType() == ScopeType.CLUB)
                        .map(RoleAssignment::getScopeId)
                        .toList();

        return new MeAccessDto(
                person == null ? null : person.getId(),
                person == null ? null : person.getStatus(),
                platformAdmin,
                clubAdminClubIds,
                profileResolver.resolve(authentication, jwt, person));
    }

    // Requires email_verified on the JWT before binding keycloakUserId to a Person by email —
    // without this, anyone able to influence an unverified email claim (self-registration, a
    // social IdP, any future realm login option beyond today's admin-provisioned-only accounts)
    // could bind their own Keycloak account to someone else's still-PENDING Person and inherit
    // whatever RoleAssignment grant is waiting for that email, before the real invitee ever logs
    // in. KeycloakProvisioningServiceImpl.provisionAccount's invite email now requires VERIFY_EMAIL
    // alongside UPDATE_PASSWORD in the same link specifically so this check doesn't add friction
    // to the legitimate flow — email_verified is already true by the time a real invitee's first
    // login reaches here. Found during standards review before this spec's PR opened.
    private Person bridgeByEmail(String keycloakUserId, String email, boolean emailVerified) {
        if (email == null || !emailVerified) {
            return null;
        }
        Person person = personRepository.findByEmailIgnoreCase(email).orElse(null);
        if (person == null) {
            return null; // authenticated, but no Person record exists for this email at all
        }
        // docs/specs/119, Decision 16: never bind a login to a Person under 18 (a player's record that carries a parent's
        // email); that login falls through to the match step. A missing date of birth counts as adult.
        if (person.getDateOfBirth() != null
                && java.time.Period.between(person.getDateOfBirth(), java.time.LocalDate.now()).getYears() < 18) {
            log.info("Email bridge skipped: personId={} reason=under-18", person.getId());
            return null;
        }
        person.setKeycloakUserId(keycloakUserId);
        if (person.getStatus() == PersonStatus.PENDING) {
            person.setStatus(PersonStatus.ACTIVE);
        }
        return personRepository.save(person);
    }
}
