package com.cricketlegend.repository;

import com.cricketlegend.domain.ImportAlias;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/** docs/specs/097-import-framework.md: remembered reference matches. Only active aliases are ever read for matching. */
public interface ImportAliasRepository extends JpaRepository<ImportAlias, UUID> {

    List<ImportAlias> findByClubIdAndKindAndScopeKeyAndActiveTrue(UUID clubId, String kind, String scopeKey);

    Optional<ImportAlias> findByClubIdAndKindAndScopeKeyAndAliasNormalisedAndActiveTrue(
            UUID clubId, String kind, String scopeKey, String aliasNormalised);

    List<ImportAlias> findByCreatedByBatch(UUID batchId);

    /** Deactivates every alias a deleted batch remembered (R14); returns the number changed. */
    @Modifying
    @Query("update ImportAlias a set a.active = false where a.createdByBatch = :batchId and a.active = true")
    int deactivateByBatch(@Param("batchId") UUID batchId);
}
