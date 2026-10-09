package com.cricketlegend.repository;

import com.cricketlegend.domain.Match;
import com.cricketlegend.domain.MatchAvailabilityPoll;
import com.cricketlegend.domain.MatchListFocus;
import com.cricketlegend.domain.MatchSide;
import com.cricketlegend.domain.SectionAvailabilityWindowMatch;
import com.cricketlegend.domain.Team;
import jakarta.persistence.criteria.CriteriaBuilder;
import jakarta.persistence.criteria.CriteriaQuery;
import jakarta.persistence.criteria.Path;
import jakarta.persistence.criteria.Predicate;
import jakarta.persistence.criteria.Root;
import jakarta.persistence.criteria.Subquery;
import java.time.Instant;
import java.util.Collection;
import java.util.Optional;
import java.util.Set;
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

    /** The match is active (not deactivated). */
    public static Specification<Match> active() {
        return (root, query, cb) -> cb.isTrue(root.get("active"));
    }

    /** {@code matchDate} strictly before {@code end} (the exclusive upper bound of a window). */
    public static Specification<Match> matchDateBefore(Instant end) {
        return (root, query, cb) -> cb.lessThan(root.get("matchDate"), end);
    }

    /**
     * Composes one {@link Specification} from {@code clubId} plus whichever of the optional
     * filters are active — {@code sectionIds} only when present (an unrestricted caller with no
     * explicit {@code sectionId} adds no section predicate at all), {@code upcomingFrom} (the start of today, for
     * "upcoming only") only when non-null, {@code leagueId}/{@code seasonId}/{@code search} only when set/non-blank.
     * Shared by {@code MatchServiceImpl} (list, filter options) and the manager overview so both
     * scope matches identically (docs/specs/079-manager-shell-and-overview.md).
     */
    public static Specification<Match> forList(
            UUID clubId,
            Optional<Set<UUID>> sectionIds,
            Instant upcomingFrom,
            UUID leagueId,
            UUID seasonId,
            String search) {
        return forList(clubId, sectionIds, upcomingFrom, leagueId, seasonId, null, search);
    }

    /** As above, plus {@code teamId} (docs/specs/087): the match has that team as its home or away side. */
    public static Specification<Match> forList(
            UUID clubId,
            Optional<Set<UUID>> sectionIds,
            Instant upcomingFrom,
            UUID leagueId,
            UUID seasonId,
            UUID teamId,
            String search) {
        Specification<Match> spec = Specification.where(clubId(clubId));
        if (sectionIds.isPresent()) {
            spec = spec.and(sectionIn(sectionIds.get()));
        }
        if (upcomingFrom != null) {
            spec = spec.and(matchDateOnOrAfter(upcomingFrom));
        }
        if (leagueId != null) {
            spec = spec.and(leagueIdEquals(leagueId));
        }
        if (seasonId != null) {
            spec = spec.and(seasonIdEquals(seasonId));
        }
        if (teamId != null) {
            spec = spec.and(teamIdEquals(teamId));
        }
        if (search != null && !search.isBlank()) {
            spec = spec.and(searchMatches(search));
        }
        return spec;
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

    /** The match has {@code teamId} as its home or away team (docs/specs/068-player-availability-grid.md). */
    public static Specification<Match> teamIdEquals(UUID teamId) {
        return (root, query, cb) -> cb.or(cb.equal(root.get("homeTeamId"), teamId), cb.equal(root.get("awayTeamId"), teamId));
    }
    // ---- docs/specs/087-matches-polls-alignment.md: the Matches counters' quick filters ----

    /**
     * The one definition of each Matches quick filter, shared by the list ({@code focus} parameter) and the summary
     * counters so the two cannot drift. All three cover <em>active, upcoming</em> matches only (the Overview's rule:
     * an inactive or past match is not something to act on): this week is today's start up to (not including) {@code
     * weekEnd}; the other two are every upcoming match with the stated condition on an own-club side.
     *
     * @param sections the caller's section restriction (empty Optional = unrestricted): an own-club side counts only
     *     when its team's section is one of these, the manager Overview's rule
     */
    public static Specification<Match> focus(
            MatchListFocus focus,
            UUID clubId,
            Optional<Set<UUID>> sections,
            Instant startOfToday,
            Instant weekEnd) {
        Specification<Match> upcoming = Specification.where(active()).and(matchDateOnOrAfter(startOfToday));
        return switch (focus) {
            case THIS_WEEK -> upcoming.and(matchDateBefore(weekEnd));
            case NOT_ANNOUNCED -> upcoming.and(hasUnannouncedOwnSide(clubId, sections));
            case NO_POLL -> upcoming.and(hasOwnSideWithoutPoll(clubId, sections));
        };
    }

    /**
     * At least one own-club side (home or away team of {@code clubId}, within {@code sections} when restricted) that
     * has no announced {@link MatchSide} for this match.
     */
    public static Specification<Match> hasUnannouncedOwnSide(UUID clubId, Optional<Set<UUID>> sections) {
        return (root, query, cb) ->
                cb.or(unannouncedOwnSide(root, query, cb, root.get("homeTeamId"), clubId, sections),
                        unannouncedOwnSide(root, query, cb, root.get("awayTeamId"), clubId, sections));
    }

    /**
     * Has an own-club side and no availability poll: no group-poll window link, and no squad poll for the home or
     * away team (open or closed both count as a poll; this is the match card's "No poll" badge rule).
     */
    public static Specification<Match> hasOwnSideWithoutPoll(UUID clubId, Optional<Set<UUID>> sections) {
        return (root, query, cb) -> {
            Subquery<UUID> groupLinks = query.subquery(UUID.class);
            Root<SectionAvailabilityWindowMatch> link = groupLinks.from(SectionAvailabilityWindowMatch.class);
            groupLinks.select(link.get("id")).where(cb.equal(link.get("matchId"), root.get("id")));

            Subquery<UUID> squadPolls = query.subquery(UUID.class);
            Root<MatchAvailabilityPoll> poll = squadPolls.from(MatchAvailabilityPoll.class);
            squadPolls
                    .select(poll.get("id"))
                    .where(
                            cb.equal(poll.get("matchId"), root.get("id")),
                            cb.or(
                                    cb.equal(poll.get("teamId"), root.get("homeTeamId")),
                                    cb.equal(poll.get("teamId"), root.get("awayTeamId"))));

            return cb.and(
                    cb.or(
                            ownSide(query, cb, root.get("homeTeamId"), clubId, sections),
                            ownSide(query, cb, root.get("awayTeamId"), clubId, sections)),
                    cb.not(cb.exists(groupLinks)),
                    cb.not(cb.exists(squadPolls)));
        };
    }

    /** The side's team is a real team of {@code clubId} (and in {@code sections} when the caller is restricted). */
    private static Predicate ownSide(
            CriteriaQuery<?> query,
            CriteriaBuilder cb,
            Path<UUID> sideTeamId,
            UUID clubId,
            Optional<Set<UUID>> sections) {
        Subquery<UUID> teamIds = query.subquery(UUID.class);
        Root<Team> team = teamIds.from(Team.class);
        Predicate inClub = cb.equal(team.get("clubId"), clubId);
        teamIds.select(team.get("id"))
                .where(sections.isPresent() ? cb.and(inClub, team.get("sectionId").in(sections.get())) : inClub);
        return sideTeamId.in(teamIds);
    }

    private static Predicate unannouncedOwnSide(
            Root<Match> root,
            CriteriaQuery<?> query,
            CriteriaBuilder cb,
            Path<UUID> sideTeamId,
            UUID clubId,
            Optional<Set<UUID>> sections) {
        Subquery<UUID> announced = query.subquery(UUID.class);
        Root<MatchSide> side = announced.from(MatchSide.class);
        announced
                .select(side.get("id"))
                .where(
                        cb.equal(side.get("matchId"), root.get("id")),
                        cb.equal(side.get("teamId"), sideTeamId),
                        cb.isTrue(side.get("announced")));
        return cb.and(ownSide(query, cb, sideTeamId, clubId, sections), cb.not(cb.exists(announced)));
    }
}
