package com.cricketlegend.domain;

import java.util.EnumSet;
import java.util.Set;

/**
 * The fixed list of things a role can allow, per docs/specs/150-managers-and-access-grants.md. The list lives in code
 * because the code that checks a permission must know it at compile time; which permissions a role carries is data
 * ({@code access_role_permission}), so custom roles need no schema change.
 *
 * <p>{@link Reach#SECTION} permissions apply to data tied to sections and are narrowed by the place of the grant.
 * {@link Reach#CLUB} permissions apply to data with no section (docs/specs/035: leagues and the like), so they count
 * only when the role is granted club-wide and are inert on a section grant. An Edit or Manage permission implies the
 * matching View permission.
 */
public enum Permission {
    PLAYERS_VIEW("See players and their records", Level.VIEW, Reach.SECTION, null),
    PLAYERS_EDIT("Add, edit, tag and deactivate players", Level.EDIT, Reach.SECTION, "PLAYERS_VIEW"),
    TEAMS_VIEW("See teams and squads", Level.VIEW, Reach.SECTION, null),
    TEAMS_EDIT("Add and edit teams and squads", Level.EDIT, Reach.SECTION, "TEAMS_VIEW"),
    MATCHES_VIEW("See fixtures and matches", Level.VIEW, Reach.SECTION, null),
    MATCHES_EDIT("Create, edit and delete matches", Level.EDIT, Reach.SECTION, "MATCHES_VIEW"),
    RESULTS_VIEW("See results and scorecards", Level.VIEW, Reach.SECTION, null),
    RESULTS_EDIT("Capture and correct results and scorecards, share results", Level.EDIT, Reach.SECTION, "RESULTS_VIEW"),
    SELECTION_VIEW("See team selection and the playing XI", Level.VIEW, Reach.SECTION, null),
    SELECTION_MANAGE("Pick teams and the playing XI", Level.EDIT, Reach.SECTION, "SELECTION_VIEW"),
    AVAILABILITY_VIEW("See availability polls and rounds", Level.VIEW, Reach.SECTION, null),
    AVAILABILITY_MANAGE("Run availability polls and rounds", Level.EDIT, Reach.SECTION, "AVAILABILITY_VIEW"),
    STATS_VIEW("See stats, leaderboards and form", Level.VIEW, Reach.SECTION, null),
    ACCESS_VIEW("See who has access", Level.VIEW, Reach.SECTION, null),
    ACCESS_MANAGE("Add, change and remove access", Level.EDIT, Reach.SECTION, "ACCESS_VIEW"),
    LEAGUES_EDIT("Leagues, seasons and affiliations", Level.EDIT, Reach.CLUB, null),
    CLUB_SETUP_EDIT("Club profile, structure, sponsors, contacts and Hub settings", Level.EDIT, Reach.CLUB, null),
    IMPORTS_RUN("Run schedule and result imports", Level.EDIT, Reach.CLUB, null),
    PLAYER_ACCOUNTS_MANAGE("Link requests and player accounts", Level.EDIT, Reach.SECTION, null);

    public enum Level {
        VIEW,
        EDIT
    }

    public enum Reach {
        SECTION,
        CLUB
    }

    private final String label;
    private final Level level;
    private final Reach reach;
    private final String impliedName;

    Permission(String label, Level level, Reach reach, String impliedName) {
        this.label = label;
        this.level = level;
        this.reach = reach;
        this.impliedName = impliedName;
    }

    public String label() {
        return label;
    }

    public Level level() {
        return level;
    }

    public Reach reach() {
        return reach;
    }

    /** This permission plus the View permission it implies, if any. */
    public Set<Permission> withImplied() {
        return impliedName == null ? EnumSet.of(this) : EnumSet.of(this, valueOf(impliedName));
    }

    /** The permissions that carry {@link Reach#SECTION}: the ones a section grant can actually exercise. */
    public static Set<Permission> sectionReach() {
        EnumSet<Permission> result = EnumSet.noneOf(Permission.class);
        for (Permission permission : values()) {
            if (permission.reach == Reach.SECTION) {
                result.add(permission);
            }
        }
        return result;
    }
}
