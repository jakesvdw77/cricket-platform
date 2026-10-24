package com.cricketlegend.service.support;

import com.cricketlegend.domain.LinkRequest;
import com.cricketlegend.domain.Person;
import com.cricketlegend.domain.PlayerProfile;
import com.cricketlegend.repository.PersonRepository;
import com.cricketlegend.repository.PlayerIdentityView;
import com.cricketlegend.repository.PlayerProfileRepository;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.stereotype.Component;

/**
 * docs/specs/119: the one place that suggests which of a club's own players a link request refers to. A suggestion is
 * the player the requester was shown ({@code targetPlayerProfileId}, when it is an active player of the club) or else
 * the club's active players whose name and date of birth equal what was typed. It is only ever a suggestion for a
 * human to confirm, and a request with none is "unresolved" (club-wide managers only).
 */
@Component
public class LinkRequestSuggester {

    /** A suggested player with the section tags used for section-scoped visibility. */
    public record Suggestion(PlayerProfile profile, Person person, Set<UUID> sectionIds, boolean exactMatch) {}

    private final PlayerProfileRepository playerProfileRepository;
    private final PersonRepository personRepository;
    private final PlayerSectionNames playerSectionNames;

    public LinkRequestSuggester(
            PlayerProfileRepository playerProfileRepository,
            PersonRepository personRepository,
            PlayerSectionNames playerSectionNames) {
        this.playerProfileRepository = playerProfileRepository;
        this.personRepository = personRepository;
        this.playerSectionNames = playerSectionNames;
    }

    /**
     * A suggestion per request id, for requests of {@code clubId}. For a section-scoped caller ({@code accessible}
     * present) only a player inside the accessible sections counts, so a request with none is absent from the result
     * and is not theirs to see. A fixed number of statements however many requests there are.
     */
    public Map<UUID, Suggestion> suggest(
            UUID clubId, Collection<LinkRequest> requests, Optional<Set<UUID>> accessible) {
        Map<UUID, Suggestion> result = new HashMap<>();
        if (requests.isEmpty()) {
            return result;
        }
        Map<UUID, PlayerProfile> targets = new HashMap<>();
        Set<UUID> targetIds = requests.stream()
                .map(LinkRequest::getTargetPlayerProfileId)
                .filter(java.util.Objects::nonNull)
                .collect(Collectors.toSet());
        if (!targetIds.isEmpty()) {
            playerProfileRepository.findAllById(targetIds).stream()
                    .filter(p -> p.getClubId().equals(clubId) && p.isActive())
                    .forEach(p -> targets.put(p.getId(), p));
        }
        // lenient name matching cannot be done in SQL: one query of the club's active identities, matched in memory
        List<PlayerIdentityView> identities = playerProfileRepository.findActiveIdentitiesByClub(clubId);
        Map<UUID, Set<UUID>> exactIds = new HashMap<>();

        // candidate profile ids per request, in a stable order
        Map<UUID, List<UUID>> candidates = new HashMap<>();
        Set<UUID> profileIds = new HashSet<>(targets.keySet());
        for (LinkRequest request : requests) {
            List<UUID> ids = new ArrayList<>();
            if (request.getTargetPlayerProfileId() != null && targets.containsKey(request.getTargetPlayerProfileId())) {
                ids.add(request.getTargetPlayerProfileId());
                exactIds.computeIfAbsent(request.getId(), k -> new HashSet<>()).add(request.getTargetPlayerProfileId());
            } else {
                List<PlayerIdentityView> named = identities.stream()
                        .filter(i -> PlayerNameMatcher.matches(
                                request.getTypedFirstName(), request.getTypedLastName(), i.getFirstName(), i.getLastName()))
                        .sorted(Comparator.comparing((PlayerIdentityView i) -> !canonicallyEqual(request, i))
                                .thenComparing(PlayerIdentityView::getPlayerProfileId))
                        .toList();
                // exact tier: lenient name and the same date of birth; fallback tier: lenient name, other date of birth
                named.stream()
                        .filter(i -> request.getTypedDateOfBirth().equals(i.getDateOfBirth()))
                        .map(PlayerIdentityView::getPlayerProfileId)
                        .forEach(ids::add);
                exactIds.computeIfAbsent(request.getId(), k -> new HashSet<>()).addAll(ids);
                named.stream()
                        .filter(i -> !request.getTypedDateOfBirth().equals(i.getDateOfBirth()))
                        .map(PlayerIdentityView::getPlayerProfileId)
                        .forEach(ids::add);
            }
            candidates.put(request.getId(), ids);
            profileIds.addAll(ids);
        }
        if (profileIds.isEmpty()) {
            return result;
        }
        Map<UUID, PlayerProfile> profiles = new HashMap<>(targets);
        playerProfileRepository.findAllById(profileIds).forEach(p -> profiles.putIfAbsent(p.getId(), p));
        Map<UUID, Person> persons = personRepository
                .findAllById(profiles.values().stream().map(PlayerProfile::getPersonId).collect(Collectors.toSet()))
                .stream()
                .collect(Collectors.toMap(Person::getId, p -> p));
        Map<UUID, Set<UUID>> sections = playerSectionNames.sectionIds(profileIds);

        for (LinkRequest request : requests) {
            for (UUID profileId : candidates.get(request.getId())) {
                Set<UUID> tagged = sections.getOrDefault(profileId, Set.of());
                boolean inScope = accessible.isEmpty() || tagged.stream().anyMatch(accessible.get()::contains);
                PlayerProfile profile = profiles.get(profileId);
                Person person = profile == null ? null : persons.get(profile.getPersonId());
                if (inScope && person != null) {
                    result.put(request.getId(), new Suggestion(profile, person, tagged,
                            exactIds.getOrDefault(request.getId(), Set.of()).contains(profileId)));
                    break;
                }
            }
        }
        return result;
    }

    private static boolean canonicallyEqual(LinkRequest request, PlayerIdentityView i) {
        return PlayerNameMatcher.canonical(request.getTypedFirstName()).equals(PlayerNameMatcher.canonical(i.getFirstName()))
                && PlayerNameMatcher.canonicalSurname(request.getTypedLastName())
                        .equals(PlayerNameMatcher.canonicalSurname(i.getLastName()));
    }
}
