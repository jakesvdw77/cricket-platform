package com.cricketlegend.service.support;

import com.cricketlegend.dto.LeaderboardTableDto.LeaderboardCell;
import com.cricketlegend.dto.LeaderboardTableDto.LeaderboardCoverage;
import com.cricketlegend.dto.LeaderboardTableDto.LeaderboardTableRow;
import com.cricketlegend.service.support.LeaderboardBoard.Direction;
import com.cricketlegend.service.support.LeaderboardBoard.Group;
import com.cricketlegend.service.support.LeaderboardBoard.MinimumKind;
import com.cricketlegend.service.support.LeaderboardQualification.Defaults;
import com.cricketlegend.service.support.LeaderboardRanker.Candidate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * docs/specs/103-player-stats.md, "Standings tables (decision 26)": for one group and one sort column, which players are
 * listed (everyone with the group's data), in what order, with what rank. Pure (no Spring, no repository, no entity).
 *
 * <p>A column with a board uses that board's ordering and tie-breaks from {@link LeaderboardRanker} (the "Boards" table);
 * any other column sorts by its value, then the group's volume figure (runs, wickets or total), then fewer innings or
 * matches. Ranking is competition ranking (1, 2, 2, 4); equal players are listed by name, then id. Players with no defined
 * value in the sort column come last with a null rank, ordered by volume (runs, or overs) then name. The optional minimum
 * applies to rate sorts only.
 */
public final class LeaderboardTableRanker {

    /** The whole ordered table: ranked players, then the unranked group. */
    public record Table(
            List<LeaderboardTableRow> rows, long listed, long ranked, long belowMinimum, LeaderboardCoverage coverage) {

        /** One page of the list (empty past the end). */
        public List<LeaderboardTableRow> page(int page, int size) {
            long from = (long) page * size;
            if (from >= rows.size()) {
                return List.of();
            }
            return rows.subList((int) from, (int) Math.min(rows.size(), from + size));
        }
    }

    private LeaderboardTableRanker() {}

    /**
     * @param direction the effective direction: the column's natural one, or the opposite when the sort is reversed
     * @param minimum the optional minimum (innings or overs by the sort's kind), null for none; ignored unless the sort
     *     is a rate
     * @param teamNames each player's most frequent team in scope (a missing entry is a null team name)
     * @param innings best-innings facts (balls faced), used only to break ties on the highest score sort
     */
    public static Table rank(
            Group group,
            LeaderboardColumn sort,
            Direction direction,
            List<Candidate> candidates,
            Integer minimum,
            Defaults defaults,
            Map<UUID, String> teamNames,
            Map<UUID, LeaderboardInningsFact> innings) {
        List<Candidate> included =
                candidates.stream().filter(c -> LeaderboardColumn.appearsIn(group, c)).toList();
        LeaderboardBoard board = sort.getBoard();
        boolean rate = sort.getMinimumKind() != MinimumKind.NONE;
        List<Candidate> kept = included;
        long below = 0;
        if (minimum != null && rate) {
            kept = included.stream().filter(c -> LeaderboardRanker.meetsMinimum(board, c, minimum)).toList();
            below = included.size() - kept.size();
        }

        List<Candidate> rankedGroup = new ArrayList<>();
        List<Candidate> unrankedGroup = new ArrayList<>();
        for (Candidate c : kept) {
            (sort.isDefined(c) ? rankedGroup : unrankedGroup).add(c);
        }
        Comparator<Candidate> criteria = criteria(group, sort, innings);
        if (direction != sort.getDirection()) {
            // reversed: flip the first sort key only, then the tie-breaks in their stated order
            Comparator<Candidate> primary = direction == Direction.LOWEST
                    ? LeaderboardRanker.ascD(sort::primaryValue)
                    : LeaderboardRanker.descD(sort::primaryValue);
            criteria = primary.thenComparing(criteria);
        }
        Comparator<Candidate> finalCriteria = criteria;
        rankedGroup.sort(finalCriteria.thenComparing(LeaderboardRanker.BY_NAME));
        unrankedGroup.sort(volumeDescending(group).thenComparing(LeaderboardRanker.BY_NAME));

        List<LeaderboardTableRow> rows = new ArrayList<>(kept.size());
        int rank = 0;
        Candidate previous = null;
        for (int i = 0; i < rankedGroup.size(); i++) {
            Candidate current = rankedGroup.get(i);
            if (previous == null || finalCriteria.compare(previous, current) != 0) {
                rank = i + 1;
            }
            rows.add(toRow(group, sort, current, rank, defaults, teamNames));
            previous = current;
        }
        for (Candidate current : unrankedGroup) {
            rows.add(toRow(group, sort, current, null, defaults, teamNames));
        }
        LeaderboardCoverage coverage = board == null ? null : LeaderboardRanker.coverage(board, included);
        return new Table(List.copyOf(rows), rows.size(), rankedGroup.size(), below, coverage);
    }

    private static Comparator<Candidate> criteria(
            Group group, LeaderboardColumn sort, Map<UUID, LeaderboardInningsFact> innings) {
        if (sort.getBoard() != null) {
            return LeaderboardRanker.criteria(sort.getBoard(), innings);
        }
        Comparator<Candidate> byValue = sort.getDirection() == Direction.LOWEST
                ? LeaderboardRanker.ascD(sort::numericValue)
                : LeaderboardRanker.descD(sort::numericValue);
        return switch (group) {
            case BATTING -> byValue.thenComparing(LeaderboardRanker.descL(LeaderboardRanker::runs))
                    .thenComparing(LeaderboardRanker.ascL(LeaderboardRanker::battingInnings));
            case BOWLING -> byValue.thenComparing(LeaderboardRanker.descL(c -> c.figures().bowling().wickets()))
                    .thenComparing(LeaderboardRanker.ascL(c -> c.figures().bowling().inningsBowled()));
            case FIELDING, AWARDS -> byValue.thenComparing(LeaderboardRanker.descL(c -> c.figures().fielding().dismissals()))
                    .thenComparing(LeaderboardRanker.ascL(c -> c.counters().matches()));
        };
    }

    /** The unranked group: by volume (runs on batting, overs on bowling), highest first. */
    private static Comparator<Candidate> volumeDescending(Group group) {
        return group == Group.BATTING
                ? LeaderboardRanker.descL(LeaderboardRanker::runs)
                : LeaderboardRanker.descD(LeaderboardRanker::overs);
    }

    private static LeaderboardTableRow toRow(
            Group group,
            LeaderboardColumn sort,
            Candidate c,
            Integer rank,
            Defaults defaults,
            Map<UUID, String> teamNames) {
        Map<String, LeaderboardCell> values = new LinkedHashMap<>();
        for (LeaderboardColumn column : LeaderboardColumn.of(group)) {
            values.put(column.getCode(), column.cell(c));
        }
        boolean small = sort.getMinimumKind() != MinimumKind.NONE
                && LeaderboardRanker.isSmallSample(sort.getBoard(), c, defaults);
        return new LeaderboardTableRow(
                rank,
                c.playerId(),
                c.firstName(),
                c.lastName(),
                c.active(),
                teamNames.get(c.playerId()),
                small,
                values);
    }
}
