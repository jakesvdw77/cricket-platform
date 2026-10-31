package com.cricketlegend.service.support;

import com.cricketlegend.domain.ImportEntityAction;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * What a handler's commit wrote (docs/specs/097-import-framework.md): every entity it created or updated (the framework
 * records them in {@code import_batch_entity}) and the aliases the user asked to remember (the framework writes them,
 * handlers never touch {@code import_alias}).
 */
public record CommitOutcome(List<Committed> entities, List<RememberedAlias> aliases, Map<String, Object> summary) {

    public CommitOutcome {
        entities = entities == null ? List.of() : entities;
        aliases = aliases == null ? List.of() : aliases;
        summary = summary == null ? Map.of() : summary;
    }

    /** {@code previous} is the old values of an UPDATED entity; {@code detail} is free type data (copiedFrom, ...). */
    public record Committed(
            String entityType,
            UUID entityId,
            ImportEntityAction action,
            Integer rowNumber,
            Map<String, Object> previous,
            Map<String, Object> detail) {
    }

    /** A reference match to remember; {@code kind} and {@code scopeKey} follow the alias table's meaning. */
    public record RememberedAlias(
            String kind,
            String scopeKey,
            String aliasNormalised,
            String aliasOriginal,
            String targetKind,
            UUID targetTeamId,
            String targetName) {
    }
}
