package com.cricketlegend.repository;

import com.cricketlegend.domain.ClubPlayingArea;
import com.cricketlegend.domain.PlayingArea;
import com.cricketlegend.domain.PlayingAreaCategory;
import com.cricketlegend.domain.PlayingAreaType;
import com.cricketlegend.domain.PlayingAreaVerificationStatus;
import jakarta.persistence.criteria.CriteriaBuilder;
import jakarta.persistence.criteria.Expression;
import jakarta.persistence.criteria.Root;
import jakarta.persistence.criteria.Subquery;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.domain.Specification;

/**
 * docs/specs/099-fields-directory.md: {@link Specification} factories for {@link PlayingArea}, in the shape of {@link
 * MatchSpecifications}. The directory list, its counters and its filter options are all composed here, so counters
 * equal lists.
 */
public final class PlayingAreaSpecifications {

    private PlayingAreaSpecifications() {}

    /** Not merged away and not rejected: what search and pickers show. */
    public static Specification<PlayingArea> visible() {
        return (root, query, cb) -> cb.and(
                cb.isNull(root.get("mergedIntoId")),
                cb.notEqual(root.get("verificationStatus"), PlayingAreaVerificationStatus.REJECTED));
    }

    public static Specification<PlayingArea> notMerged() {
        return (root, query, cb) -> cb.isNull(root.get("mergedIntoId"));
    }

    public static Specification<PlayingArea> areaType(PlayingAreaType areaType) {
        return (root, query, cb) -> cb.equal(root.get("areaType"), areaType);
    }

    public static Specification<PlayingArea> verification(PlayingAreaVerificationStatus status) {
        return (root, query, cb) -> cb.equal(root.get("verificationStatus"), status);
    }

    public static Specification<PlayingArea> categoryIn(Collection<PlayingAreaCategory> categories) {
        return (root, query, cb) -> root.get("category").in(categories);
    }

    /** Case-insensitive substring of the name or the city. */
    public static Specification<PlayingArea> search(String q) {
        return (root, query, cb) -> {
            String pattern = "%" + escapeLike(q.trim().toLowerCase()) + "%";
            return cb.or(
                    cb.like(cb.lower(root.get("name")), pattern, '\\'),
                    cb.like(cb.lower(root.get("address").get("city")), pattern, '\\'));
        };
    }

    public static Specification<PlayingArea> country(String country) {
        return (root, query, cb) -> cb.equal(cb.upper(root.get("address").get("country")), country.trim().toUpperCase());
    }

    public static Specification<PlayingArea> province(String province) {
        return (root, query, cb) ->
                cb.equal(cb.lower(root.get("address").get("provinceState")), province.trim().toLowerCase());
    }

    public static Specification<PlayingArea> city(String city) {
        return (root, query, cb) -> cb.equal(cb.lower(root.get("address").get("city")), city.trim().toLowerCase());
    }

    /** The club has a home link to the area. */
    public static Specification<PlayingArea> linkedHome(UUID clubId) {
        return (root, query, cb) -> cb.exists(homeLinks(query.subquery(UUID.class), root, cb, clubId));
    }

    private static Subquery<UUID> homeLinks(
            Subquery<UUID> sub, Root<PlayingArea> root, CriteriaBuilder cb, UUID clubId) {
        Root<ClubPlayingArea> link = sub.from(ClubPlayingArea.class);
        return sub.select(link.get("id"))
                .where(
                        cb.equal(link.get("playingAreaId"), root.get("id")),
                        cb.equal(link.get("clubId"), clubId),
                        cb.isTrue(link.get("home")));
    }

    /**
     * The filters the directory counters share with the list, minus {@code mine} and {@code verification} (each
     * counter applies its own): visible, one area type, and whichever of the text/category/place filters are set.
     * Any argument may be null/empty to skip it; a "skip" flag per place dimension lets filter-options ignore a
     * dimension's own pick.
     */
    public static Specification<PlayingArea> directoryBase(
            PlayingAreaType areaType,
            String q,
            Collection<PlayingAreaCategory> categories,
            String country,
            String province,
            String city) {
        Specification<PlayingArea> spec = Specification.where(visible()).and(areaType(areaType));
        if (q != null && !q.isBlank()) {
            spec = spec.and(search(q));
        }
        if (categories != null && !categories.isEmpty()) {
            spec = spec.and(categoryIn(categories));
        }
        if (country != null && !country.isBlank()) {
            spec = spec.and(country(country));
        }
        if (province != null && !province.isBlank()) {
            spec = spec.and(province(province));
        }
        if (city != null && !city.isBlank()) {
            spec = spec.and(city(city));
        }
        return spec;
    }

    /**
     * The directory list order: this club's home fields first, then name (descending when {@code nameDescending}),
     * then id for a stable page. Set as the query's own order-by for the content query only (Spring Data clears it
     * for the count query), so callers must pass an unsorted {@code Pageable}.
     */
    public static Specification<PlayingArea> homeFirstThenName(UUID clubId, boolean nameDescending) {
        return (root, query, cb) -> {
            if (!Long.class.equals(query.getResultType())) {
                Expression<Integer> homeRank = cb.<Integer>selectCase()
                        .when(cb.exists(homeLinks(query.subquery(UUID.class), root, cb, clubId)), 0)
                        .otherwise(1);
                Expression<String> name = cb.lower(root.get("name"));
                query.orderBy(
                        cb.asc(homeRank),
                        nameDescending ? cb.desc(name) : cb.asc(name),
                        cb.asc(root.get("id")));
            }
            return null;
        };
    }

    /**
     * "Did you mean": the not-merged, not-rejected areas of the same country whose normalised name (lowercase,
     * punctuation and whitespace stripped) contains the normalised input or is contained in it. {@code normalised}
     * must already be normalised (letters and digits only, lowercase) and non-empty. No extension (spec 099 Open
     * question 4); written so a trigram match can replace it later.
     */
    public static Specification<PlayingArea> similarName(String country, String normalised) {
        return (root, query, cb) -> {
            Expression<String> stripped = cb.lower(cb.function(
                    "regexp_replace",
                    String.class,
                    root.get("name"),
                    cb.literal("[^[:alnum:]]"),
                    cb.literal(""),
                    cb.literal("g")));
            return cb.and(
                    cb.equal(cb.upper(root.get("address").get("country")), country.trim().toUpperCase()),
                    cb.greaterThan(cb.length(stripped), 0),
                    cb.or(
                            cb.like(stripped, "%" + normalised + "%"),
                            cb.like(cb.literal(normalised), cb.concat(cb.concat("%", stripped), "%"))));
        };
    }

    /** Moderation list: not merged away, in the given states. */
    public static Specification<PlayingArea> moderation(
            PlayingAreaVerificationStatus status, String q, List<PlayingAreaCategory> categories, String country) {
        Specification<PlayingArea> spec = Specification.where(notMerged());
        if (status != null) {
            spec = spec.and(verification(status));
        }
        if (q != null && !q.isBlank()) {
            spec = spec.and(search(q));
        }
        if (categories != null && !categories.isEmpty()) {
            spec = spec.and(categoryIn(categories));
        }
        if (country != null && !country.isBlank()) {
            spec = spec.and(country(country));
        }
        return spec;
    }

    private static String escapeLike(String value) {
        return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
    }
}
