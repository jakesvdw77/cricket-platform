package com.cricketlegend.repository;

import com.cricketlegend.domain.NameAlias;
import com.cricketlegend.domain.NameAliasKind;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/** docs/specs/104-match-results-import-adaptors.md: remembered name mappings, always scoped to one club. */
public interface NameAliasRepository extends JpaRepository<NameAlias, UUID> {

    /** The active aliases of the club of this kind among {@code aliasNormalised}. */
    List<NameAlias> findByClubIdAndKindAndActiveTrueAndAliasNormalisedIn(
            UUID clubId, NameAliasKind kind, Collection<String> aliasNormalised);

    Optional<NameAlias> findByClubIdAndKindAndAliasNormalisedAndActiveTrue(
            UUID clubId, NameAliasKind kind, String aliasNormalised);
}
