package com.cricketlegend.repository;

import com.cricketlegend.domain.Match;
import com.cricketlegend.domain.Team;
import jakarta.persistence.criteria.Subquery;
import java.time.Instant;
import java.util.Collection;
import java.util.UUID;
import org.springframework.data.jpa.domain.Specification;

/**
 * Static {@link Specification} factory methods for {@link Match}, composed by {@code
 * MatchServiceImpl} into one query per combination of active filters — see
 * docs/specs/042-match-list-filters-and-search.md. The first use of Spring Data JPA's
 * {@code Specification}/Criteria API anywhere in this backend; each method here is deliberately
 * small and single-purpose, matching this codebase's one-concept-per-file convention rather than
 * introducing a new abstraction layer.
 */
public final class MatchSpecifications {

    private MatchSpecifications() {}

    public static Specification<Match> clubId(UUID clubId) {
        return (root, query, cb) -> cb.equal(root.get("clubId"), clubId);
    }

    /**
     * Ports {@link MatchRepository#findByClubIdAndSectionIdIn}'s existing JPQL subquery-join
     * shape verbatim: a match is included when either its {@code homeTeamId} or {@code
     * awayTeamId} references a {@link Team} whose {@code sectionId} is in {@code sectionIds}.
     * Uses two separate {@link Subquery} instances (one per side) rather than reusing a single
     * {@code Subquery} across two {@code cb.in(...)} calls — a {@code Subquery} is consumed by
     * the query it's attached to and isn't safely reusable a second time in the same predicate
     * tree.
     */
    public static Specification<Match> sectionIn(Collection<UUID> sectionIds) {
        return (root, query, cb) -> {
            Subquery<UUID> homeTeamIds = query.subquery(UUID.class);
            var homeTeamRoot = homeTeamIds.from(Team.class);
            homeTeamIds.select(homeTeamRoot.get("id")).where(homeTeamRoot.get("sectionId").in(sectionIds));

            Subquery<UUID> awayTeamIds = query.subquery(UUID.class);
            var awayTeamRoot = awayTeamIds.from(Team.class);
            awayTeamIds.select(awayTeamRoot.get("id")).where(awayTeamRoot.get("sectionId").in(sectionIds));

            return cb.or(root.get("homeTeamId").in(homeTeamIds), root.get("awayTeamId").in(awayTeamIds));
        };
    }

    /**
     * Per docs/specs/037-match-improvements.md's {@code upcomingOnly}: {@code matchDate} on or
     * after the caller-computed start of the current local day.
     */
    public static Specification<Match> matchDateOnOrAfter(Instant startOfToday) {
        return (root, query, cb) -> cb.greaterThanOrEqualTo(root.get("matchDate"), startOfToday);
    }

    public static Specification<Match> leagueIdEquals(UUID leagueId) {
        return (root, query, cb) -> cb.equal(root.get("leagueId"), leagueId);
    }

    public static Specification<Match> seasonIdEquals(UUID seasonId) {
        return (root, query, cb) -> cb.equal(root.get("seasonId"), seasonId);
    }

    /**
     * Case-insensitive substring match against a match's home/away side — real {@link Team#getName()}
     * (via a join for whichever of {@code homeTeamId}/{@code awayTeamId} is set) OR the free-text
     * {@code homeTeamName}/{@code awayTeamName} opponent name. Nothing smarter (no fuzzy matching/
     * ranking) — see docs/specs/042-match-list-filters-and-search.md's Non-goals.
     */
    public static Specification<Match> searchMatches(String term) {
        String pattern = "%" + term.toLowerCase() + "%";
        return (root, query, cb) -> {
            Subquery<UUID> homeTeamIds = query.subquery(UUID.class);
            var homeTeamRoot = homeTeamIds.from(Team.class);
            homeTeamIds.select(homeTeamRoot.get("id")).where(cb.like(cb.lower(homeTeamRoot.get("name")), pattern));

            Subquery<UUID> awayTeamIds = query.subquery(UUID.class);
            var awayTeamRoot = awayTeamIds.from(Team.class);
            awayTeamIds.select(awayTeamRoot.get("id")).where(cb.like(cb.lower(awayTeamRoot.get("name")), pattern));

            return cb.or(
                    cb.like(cb.lower(root.get("homeTeamName")), pattern),
                    cb.like(cb.lower(root.get("awayTeamName")), pattern),
                    root.get("homeTeamId").in(homeTeamIds),
                    root.get("awayTeamId").in(awayTeamIds));
        };
    }
}
