package com.cricketlegend.service.support;

import com.cricketlegend.domain.MatchResultStatus;
import com.cricketlegend.repository.MatchAvailabilityPollRepository;
import com.cricketlegend.repository.MatchSideRepository;
import com.cricketlegend.repository.MatchSquadMemberRepository;
import com.cricketlegend.repository.SectionAvailabilityWindowMatchRepository;
import java.util.Collection;
import java.util.EnumSet;
import java.util.HashMap;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.springframework.stereotype.Component;

/**
 * docs/specs/109-delete-empty-match.md: the one place that answers "what is recorded against these matches?". A match
 * is empty (deletable) exactly when none of {@link Attachment} exists for it. One query per kind for any number of
 * matches, so a list page never costs a query per row.
 */
@Component
public class MatchEmptiness {

    /** What can be attached to a match, in the order the refusal message names the first. */
    public enum Attachment {
        DRAFT_RESULT("a draft result"),
        PUBLISHED_RESULT("a published result"),
        POLL("an availability poll"),
        SQUAD("a squad"),
        TEAM_SELECTION("a team selection"),
        AVAILABILITY_WINDOW("an availability window");

        private final String description;

        Attachment(String description) {
            this.description = description;
        }

        public String description() {
            return description;
        }
    }

    private final ResultStatusResolver resultStatusResolver;
    private final MatchAvailabilityPollRepository pollRepository;
    private final MatchSquadMemberRepository squadMemberRepository;
    private final MatchSideRepository matchSideRepository;
    private final SectionAvailabilityWindowMatchRepository windowMatchRepository;

    public MatchEmptiness(
            ResultStatusResolver resultStatusResolver,
            MatchAvailabilityPollRepository pollRepository,
            MatchSquadMemberRepository squadMemberRepository,
            MatchSideRepository matchSideRepository,
            SectionAvailabilityWindowMatchRepository windowMatchRepository) {
        this.resultStatusResolver = resultStatusResolver;
        this.pollRepository = pollRepository;
        this.squadMemberRepository = squadMemberRepository;
        this.matchSideRepository = matchSideRepository;
        this.windowMatchRepository = windowMatchRepository;
    }

    /** Every attachment of each match; a match with none has no entry. */
    public Map<UUID, Set<Attachment>> attachmentsFor(Collection<UUID> matchIds) {
        if (matchIds.isEmpty()) {
            return new HashMap<>();
        }
        return attachmentsFor(matchIds, resultStatusResolver.statusesFor(matchIds));
    }

    /**
     * As {@link #attachmentsFor(Collection)}, for a caller that has already fetched the result statuses of
     * {@code matchIds}, so the match_result query is not run a second time.
     */
    public Map<UUID, Set<Attachment>> attachmentsFor(
            Collection<UUID> matchIds, Map<UUID, MatchResultStatus> resultStatuses) {
        Map<UUID, Set<Attachment>> byMatch = new HashMap<>();
        if (matchIds.isEmpty()) {
            return byMatch;
        }
        resultStatuses.forEach((matchId, status) -> add(
                byMatch, matchId,
                status == MatchResultStatus.PUBLISHED ? Attachment.PUBLISHED_RESULT : Attachment.DRAFT_RESULT));
        pollRepository.findMatchIdsWithPollByMatchIdIn(matchIds).forEach(id -> add(byMatch, id, Attachment.POLL));
        squadMemberRepository.findMatchIdsWithSquadMemberByMatchIdIn(matchIds)
                .forEach(id -> add(byMatch, id, Attachment.SQUAD));
        matchSideRepository.findMatchIdsWithSideByMatchIdIn(matchIds)
                .forEach(id -> add(byMatch, id, Attachment.TEAM_SELECTION));
        windowMatchRepository.findMatchIdsWithWindowLinkByMatchIdIn(matchIds)
                .forEach(id -> add(byMatch, id, Attachment.AVAILABILITY_WINDOW));
        return byMatch;
    }

    /** The matches among {@code matchIds} that have nothing attached. */
    public Set<UUID> emptyAmong(Collection<UUID> matchIds) {
        return emptyAmong(matchIds, matchIds.isEmpty() ? Map.of() : resultStatusResolver.statusesFor(matchIds));
    }

    /** As {@link #emptyAmong(Collection)}, reusing result statuses the caller has already fetched. */
    public Set<UUID> emptyAmong(Collection<UUID> matchIds, Map<UUID, MatchResultStatus> resultStatuses) {
        Map<UUID, Set<Attachment>> attached = attachmentsFor(matchIds, resultStatuses);
        Set<UUID> empty = new java.util.HashSet<>(matchIds);
        empty.removeAll(attached.keySet());
        return empty;
    }

    private static void add(Map<UUID, Set<Attachment>> byMatch, UUID matchId, Attachment attachment) {
        byMatch.computeIfAbsent(matchId, id -> EnumSet.noneOf(Attachment.class)).add(attachment);
    }
}
