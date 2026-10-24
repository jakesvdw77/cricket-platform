package com.cricketlegend.service.support;

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
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Component;

/**
 * The only authorisation for {@code /api/v1/me/players/**} (docs/specs/119, Decision 6): everything is decided from the
 * caller's own rows, never from a role or a header. A player is held when it is the caller's own verified, active
 * record ({@code self:<profileId>}) or the subject of one of the caller's ACTIVE person links ({@code <linkId>}) whose
 * club record is active and not rejected. Any other key, including a malformed one and one a suspended or rejected
 * player drops out of, is a 404, never a 403, so nothing about other people is revealed. A SUSPENDED caller is 403.
 * Order: the own record first, then linked players by name, then link id.
 */
@Component
public class MyPlayerAccess {

    public static final String SELF_PREFIX = "self:";
    private static final Logger log = LoggerFactory.getLogger(MyPlayerAccess.class);

    private final PersonRepository personRepository;
    private final PersonLinkRepository personLinkRepository;
    private final PlayerProfileRepository playerProfileRepository;

    public MyPlayerAccess(
            PersonRepository personRepository,
            PersonLinkRepository personLinkRepository,
            PlayerProfileRepository playerProfileRepository) {
        this.personRepository = personRepository;
        this.personLinkRepository = personLinkRepository;
        this.playerProfileRepository = playerProfileRepository;
    }

    /** Every player the caller holds, in display order; empty for a login with no person. */
    public List<HeldPlayer> list(Authentication authentication) {
        Person caller = personRepository.findByKeycloakUserId(authentication.getName()).orElse(null);
        if (caller == null) {
            return List.of();
        }
        if (caller.getStatus() == PersonStatus.SUSPENDED) {
            log.warn("Suspended person refused on the player hub: personId={}", caller.getId());
            throw new AccessDeniedException("This account is disabled.");
        }
        List<PersonLink> links = personLinkRepository.findByAccountPersonIdAndStatus(caller.getId(), PersonLinkStatus.ACTIVE);
        Set<UUID> personIds = new HashSet<>();
        personIds.add(caller.getId());
        links.forEach(l -> personIds.add(l.getSubjectPersonId()));
        List<PlayerProfile> profiles = playerProfileRepository.findByPersonIdIn(personIds);
        Map<UUID, Person> people = personRepository.findAllById(personIds).stream()
                .collect(Collectors.toMap(Person::getId, p -> p));

        List<HeldPlayer> own = new ArrayList<>();
        for (PlayerProfile profile : profiles) {
            if (profile.getPersonId().equals(caller.getId())
                    && profile.isActive()
                    && profile.getVerificationStatus() == PlayerVerificationStatus.VERIFIED) {
                own.add(new HeldPlayer(SELF_PREFIX + profile.getId(), caller, caller, profile, null));
            }
        }
        own.sort(Comparator.comparing((HeldPlayer h) -> h.profile().getClubId()).thenComparing(h -> h.profile().getId()));

        List<HeldPlayer> linked = new ArrayList<>();
        for (PersonLink link : links) {
            Person subject = people.get(link.getSubjectPersonId());
            profiles.stream()
                    .filter(p -> p.getPersonId().equals(link.getSubjectPersonId())
                            && p.getClubId().equals(link.getClubId())
                            && p.isActive()
                            && p.getVerificationStatus() != PlayerVerificationStatus.REJECTED)
                    .findFirst()
                    .filter(p -> subject != null)
                    .ifPresent(p -> linked.add(new HeldPlayer(link.getId().toString(), caller, subject, p, link)));
        }
        linked.sort(Comparator.comparing((HeldPlayer h) -> nullToEmpty(h.subject().getFirstName()).toLowerCase())
                .thenComparing(h -> nullToEmpty(h.subject().getLastName()).toLowerCase())
                .thenComparing(HeldPlayer::key));

        List<HeldPlayer> all = new ArrayList<>(own);
        all.addAll(linked);
        return all;
    }

    /** The held player for this key, or a 404 (the same for a key that is not the caller's, malformed or dropped out). */
    public HeldPlayer resolve(Authentication authentication, String key) {
        if (key == null || key.isBlank()) {
            throw notFound();
        }
        return list(authentication).stream()
                .filter(h -> h.key().equals(key))
                .findFirst()
                .orElseThrow(MyPlayerAccess::notFound);
    }

    private static NotFoundException notFound() {
        return new NotFoundException("Player not found");
    }

    private static String nullToEmpty(String s) {
        return s == null ? "" : s;
    }
}
