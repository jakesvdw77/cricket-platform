package com.cricketlegend.service.impl;

import com.cricketlegend.config.AccessService;
import com.cricketlegend.domain.Person;
import com.cricketlegend.domain.PersonStatus;
import com.cricketlegend.domain.RoleAssignment;
import com.cricketlegend.domain.RoleAssignmentRole;
import com.cricketlegend.domain.ScopeType;
import com.cricketlegend.dto.MeAccessDto;
import com.cricketlegend.repository.PersonRepository;
import com.cricketlegend.repository.RoleAssignmentRepository;
import com.cricketlegend.service.MeService;
import java.util.List;
import java.util.UUID;
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

    private final PersonRepository personRepository;
    private final RoleAssignmentRepository roleAssignmentRepository;
    private final AccessService accessService;

    public MeServiceImpl(
            PersonRepository personRepository,
            RoleAssignmentRepository roleAssignmentRepository,
            AccessService accessService) {
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
            person = bridgeByEmail(keycloakUserId, jwt.getClaimAsString("email"));
        }

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
                clubAdminClubIds);
    }

    private Person bridgeByEmail(String keycloakUserId, String email) {
        if (email == null) {
            return null; // no email claim on this token — nothing to bridge against
        }
        Person person = personRepository.findByEmailIgnoreCase(email).orElse(null);
        if (person == null) {
            return null; // authenticated, but no Person record exists for this email at all
        }
        person.setKeycloakUserId(keycloakUserId);
        if (person.getStatus() == PersonStatus.PENDING) {
            person.setStatus(PersonStatus.ACTIVE);
        }
        return personRepository.save(person);
    }
}
