package com.cricketlegend.service.support;

import com.cricketlegend.dto.TeamStatsTableDto.TeamStatsCell;
import com.cricketlegend.dto.TeamStatsTableDto.TeamStatsTableRow;
import com.cricketlegend.service.support.LeaderboardBoard.Direction;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * docs/specs/116-team-stats.md, "The table": for one sort column, which teams are listed (every team with a counted result),
 * in what order and with what rank. Pure (no Spring, no repository, no entity), following {@link LeaderboardTableRanker}'s
 * rules: competition ranking (1, 2, 2, 4); equal teams are listed by name, then id; teams with no defined value in the sort
 * column come last with a null rank, ordered by name; reversing the sort flips the first key only; the optional minimum
 * (matches played) applies to rate sorts only.
 */
public final class TeamTableRanker {

    /** One team with its calculated figures. */
    public record Candidate(
            UUID teamId, String teamName, String sectionName, boolean active, TeamStatsCalculator.Figures figures) {
    }

    /** The whole ordered table: ranked teams, then the unranked group. */
    public record Table(List<TeamStatsTableRow> rows, long listed, long ranked, long belowMinimum) {

        /** One page of the list (empty past the end). */
        public List<TeamStatsTableRow> page(int page, int size) {
            long from = (long) page * size;
            if (from >= rows.size()) {
                return List.of();
            }
            return rows.subList((int) from, (int) Math.min(rows.size(), from + size));
        }
    }

    private static final Comparator<Candidate> BY_NAME = Comparator.comparing(
                    (Candidate c) -> c.teamName() == null ? "" : c.teamName(), String.CASE_INSENSITIVE_ORDER)
            .thenComparing(c -> c.teamName() == null ? "" : c.teamName())
            .thenComparing(Candidate::teamId);

    private TeamTableRanker() {}

    /**
     * @param direction the effective direction: the column's natural one, or the opposite when the sort is reversed
     * @param minimum the optional Minimum matches (played), null for none; ignored unless the sort is a rate
     */
    public static Table rank(TeamStatsColumn sort, Direction direction, List<Candidate> candidates, Integer minimum) {
        List<Candidate> kept = candidates;
        long below = 0;
        if (minimum != null && sort.getMinimumKind() != TeamStatsColumn.MinimumKind.NONE) {
            kept = candidates.stream().filter(c -> c.figures().record().played() >= minimum).toList();
            below = candidates.size() - kept.size();
        }

        List<Candidate> rankedGroup = new ArrayList<>();
        List<Candidate> unrankedGroup = new ArrayList<>();
        for (Candidate c : kept) {
            (sort.isDefined(c) ? rankedGroup : unrankedGroup).add(c);
        }
        Comparator<Candidate> criteria = sort.criteria();
        if (direction != sort.getDirection()) {
            // reversed: flip the first sort key only, then the tie-breaks in their stated order
            criteria = sort.primary(direction).thenComparing(criteria);
        }
        Comparator<Candidate> finalCriteria = criteria;
        rankedGroup.sort(finalCriteria.thenComparing(BY_NAME));
        unrankedGroup.sort(BY_NAME);

        List<TeamStatsTableRow> rows = new ArrayList<>(kept.size());
        int rank = 0;
        Candidate previous = null;
        for (int i = 0; i < rankedGroup.size(); i++) {
            Candidate current = rankedGroup.get(i);
            if (previous == null || finalCriteria.compare(previous, current) != 0) {
                rank = i + 1;
            }
            rows.add(toRow(current, rank));
            previous = current;
        }
        for (Candidate current : unrankedGroup) {
            rows.add(toRow(current, null));
        }
        return new Table(List.copyOf(rows), rows.size(), rankedGroup.size(), below);
    }

    private static TeamStatsTableRow toRow(Candidate c, Integer rank) {
        Map<String, TeamStatsCell> values = new LinkedHashMap<>();
        for (TeamStatsColumn column : TeamStatsColumn.values()) {
            values.put(column.getCode(), column.cell(c));
        }
        return new TeamStatsTableRow(rank, c.teamId(), c.teamName(), c.sectionName(), c.active(), values);
    }
}
