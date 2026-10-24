package com.cricketlegend.service.support;

import com.cricketlegend.domain.Person;
import com.cricketlegend.domain.PersonLink;
import com.cricketlegend.domain.PlayerProfile;
import java.time.LocalDate;
import java.time.Period;

/**
 * A player the caller may act for (docs/specs/119): the caller's own verified record ({@code link} null) or a player
 * held through an ACTIVE person link. Internal to the services; never leaves the controller boundary.
 */
public record HeldPlayer(String key, Person caller, Person subject, PlayerProfile profile, PersonLink link) {

    private static final int ADULT_AGE = 18;

    public boolean self() {
        return link == null;
    }

    public boolean main() {
        return link != null && link.isMain();
    }

    /** Owner decision (slice 4): the same people who may change the medical aid details may change the date of birth. */
    public boolean canEditDateOfBirth() {
        return canEditMedical();
    }

    /** Whether this account may invite, hand over, or cancel invitations: the main agent or the adult player. */
    public boolean canManageAgents() {
        return canEditMedical();
    }

    /** Decision 20: the main agent and the adult player themselves (a missing date of birth counts as adult). */
    public boolean canEditMedical() {
        if (link != null) {
            return link.isMain();
        }
        LocalDate dob = subject.getDateOfBirth();
        return dob == null || Period.between(dob, LocalDate.now()).getYears() >= ADULT_AGE;
    }
}
