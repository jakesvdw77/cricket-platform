package com.cricketlegend.service.support;

import com.cricketlegend.domain.NameAlias;
import com.cricketlegend.domain.NameAliasKind;
import com.cricketlegend.repository.NameAliasRepository;
import java.util.Collection;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.stereotype.Component;

/**
 * docs/specs/104-match-results-import-adaptors.md, "Aliases": the one place remembered name mappings are normalised,
 * read and written. An alias belongs to one club and is never read across clubs. The normal form is case-insensitive
 * (case never matters): each word through {@link PlayerNameMatcher#canonical} (lower case, no accents, no dots or
 * hyphens), joined by single spaces in the order written, so word-order variants are a matcher tier, not an alias hit.
 * Writing is called from inside a save (the caller owns the transaction); a correction deactivates the previous row.
 */
@Component
public class NameAliases {

    private static final int MAX_LENGTH = 255;

    private final NameAliasRepository repository;

    public NameAliases(NameAliasRepository repository) {
        this.repository = repository;
    }

    /** The shared normal form of a written name, or an empty string when nothing remains. */
    public static String normalise(String name) {
        if (name == null) {
            return "";
        }
        NameTokens tokens = NameTokens.of(name);
        String joined = tokens.words().stream().map(PlayerNameMatcher::canonical).collect(Collectors.joining(" "));
        if (joined.isEmpty()) {
            joined = name.trim().replaceAll("\\s+", " ").toLowerCase(Locale.ROOT);
        }
        return joined.length() > MAX_LENGTH ? joined.substring(0, MAX_LENGTH) : joined;
    }

    /** The club's active aliases of this kind for these written names, keyed by the normalised spelling. */
    public Map<String, NameAlias> activeFor(UUID clubId, NameAliasKind kind, Collection<String> writtenNames) {
        Set<String> keys = new HashSet<>();
        writtenNames.forEach(name -> {
            String key = normalise(name);
            if (!key.isEmpty()) {
                keys.add(key);
            }
        });
        Map<String, NameAlias> byKey = new HashMap<>();
        if (!keys.isEmpty()) {
            for (NameAlias alias : repository.findByClubIdAndKindAndActiveTrueAndAliasNormalisedIn(clubId, kind, keys)) {
                byKey.put(alias.getAliasNormalised(), alias);
            }
        }
        return byKey;
    }

    /**
     * Remembers {@code written} for {@code kind} as {@code targetId} (a player profile or one of our teams). A repeat
     * of the same pair changes nothing; a different target replaces the active alias (the old row is deactivated, not
     * deleted). {@code createdBy} is null for a platform admin with no person.
     */
    public void remember(UUID clubId, NameAliasKind kind, String written, UUID targetId, UUID createdBy) {
        String key = normalise(written);
        if (key.isEmpty() || targetId == null) {
            return;
        }
        NameAlias current = repository
                .findByClubIdAndKindAndAliasNormalisedAndActiveTrue(clubId, kind, key)
                .orElse(null);
        if (current != null) {
            UUID currentTarget =
                    kind == NameAliasKind.PLAYER ? current.getTargetPlayerProfileId() : current.getTargetTeamId();
            if (targetId.equals(currentTarget)) {
                return;
            }
            current.setActive(false);
            repository.saveAndFlush(current);
        }
        String original = written.trim().replaceAll("\\s+", " ");
        repository.save(NameAlias.builder()
                .clubId(clubId)
                .kind(kind)
                .aliasNormalised(key)
                .aliasOriginal(original.length() > MAX_LENGTH ? original.substring(0, MAX_LENGTH) : original)
                .targetPlayerProfileId(kind == NameAliasKind.PLAYER ? targetId : null)
                .targetTeamId(kind == NameAliasKind.TEAM ? targetId : null)
                .createdBy(createdBy)
                .active(true)
                .build());
    }
}
