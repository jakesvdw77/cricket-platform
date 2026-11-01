package com.cricketlegend.service.support.schedule;

import com.cricketlegend.domain.Team;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * What {@code MatchScheduleRules} compares a candidate match against (docs/specs/132): the club's active matches in
 * the window, the ids that stand for earlier candidates of a batch (they have no real id to link), and the teams read
 * for names.
 */
public final class MatchScheduleWorld {

    public final List<ExistingMatch> matches = new ArrayList<>();
    public final Set<UUID> virtual = new HashSet<>();
    public final Map<UUID, Team> teams = new HashMap<>();
}
