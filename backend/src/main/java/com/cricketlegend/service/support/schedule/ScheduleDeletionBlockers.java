package com.cricketlegend.service.support.schedule;

import com.cricketlegend.domain.Match;
import com.cricketlegend.domain.Team;
import com.cricketlegend.dto.DeletionBlockerDto;
import com.cricketlegend.service.support.MatchEmptiness;
import com.cricketlegend.service.support.MatchEmptiness.Attachment;
import com.cricketlegend.service.support.MatchSideNames;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.EnumSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.stereotype.Component;

/**
 * docs/specs/098-league-schedule-import.md, "Deleting an imported schedule": the blockers of a batch's matches, over the
 * existing {@link MatchEmptiness} (one batched read per kind for any number of matches), with the spec's reason codes.
 * The result guard is {@code MatchEmptiness} itself, so this class never touches the result tables.
 */
@Component
public class ScheduleDeletionBlockers {

    public static final String MATCH = "MATCH";
    private static final DateTimeFormatter LABEL = DateTimeFormatter.ofPattern("d MMM yyyy, HH:mm", Locale.ENGLISH);

    private final MatchEmptiness emptiness;

    public ScheduleDeletionBlockers(MatchEmptiness emptiness) {
        this.emptiness = emptiness;
    }

    /** The spec's reason code of one attachment (an announced team and a selection are both {@code SELECTION}). */
    public static String reason(Attachment attachment) {
        return switch (attachment) {
            case POLL -> "POLL";
            case AVAILABILITY_WINDOW -> "GROUP_POLL";
            case SQUAD -> "SQUAD_POOL";
            case TEAM_SELECTION -> "SELECTION";
            case DRAFT_RESULT, PUBLISHED_RESULT -> "RESULT";
        };
    }

    private static String phrase(String reason) {
        return switch (reason) {
            case "POLL" -> "an availability poll";
            case "GROUP_POLL" -> "a group availability window";
            case "SQUAD_POOL" -> "a squad pool";
            case "SELECTION" -> "a team selection or an announced team";
            default -> "a result";
        };
    }

    /** The attachments of each match as reason codes; a match with none has no entry. */
    public Map<UUID, Set<String>> reasonsFor(Collection<UUID> matchIds) {
        Map<UUID, Set<Attachment>> attached = emptiness.attachmentsFor(matchIds);
        Map<UUID, Set<String>> out = new java.util.HashMap<>();
        attached.forEach((id, set) -> out.put(id,
                set.stream().map(ScheduleDeletionBlockers::reason).collect(Collectors.toCollection(TreeSet::new))));
        return out;
    }

    /** One blocker per blocked match, in date order. */
    public List<DeletionBlockerDto> blockers(Collection<Match> matches, Map<UUID, Team> teamsById, ZoneId zone) {
        if (matches.isEmpty()) {
            return List.of();
        }
        Map<UUID, Set<String>> reasons = reasonsFor(matches.stream().map(Match::getId).toList());
        List<DeletionBlockerDto> out = new ArrayList<>();
        matches.stream()
                .sorted(Comparator.comparing(Match::getMatchDate).thenComparing(Match::getId))
                .forEach(match -> {
                    Set<String> codes = reasons.get(match.getId());
                    if (codes != null && !codes.isEmpty()) {
                        out.add(new DeletionBlockerDto(MATCH, match.getId(), label(match, teamsById, zone),
                                List.copyOf(codes), "Has " + codes.stream().map(ScheduleDeletionBlockers::phrase)
                                        .collect(Collectors.joining("; ")) + ".",
                                "/manage/fixtures/matches/" + match.getId()));
                    }
                });
        return out;
    }

    /** "13 Sep 2026, 08:00, Home v Away". */
    public static String label(Match match, Map<UUID, Team> teamsById, ZoneId zone) {
        return LABEL.format(match.getMatchDate().atZone(zone)) + ", " + MatchSideNames.home(match, teamsById)
                + " v " + MatchSideNames.away(match, teamsById);
    }

    static Set<String> allReasons() {
        return EnumSet.allOf(Attachment.class).stream().map(ScheduleDeletionBlockers::reason)
                .collect(Collectors.toCollection(TreeSet::new));
    }
}
