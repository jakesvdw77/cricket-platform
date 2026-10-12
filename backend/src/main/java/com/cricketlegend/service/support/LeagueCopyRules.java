package com.cricketlegend.service.support;

import com.cricketlegend.domain.Contact;
import com.cricketlegend.domain.League;
import com.cricketlegend.domain.LeagueContact;
import com.cricketlegend.domain.LeaguePlayingConditions;
import com.cricketlegend.domain.LeagueSource;
import com.cricketlegend.domain.SocialLink;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * The pure copy rules for duplicating a league (docs/specs/096-duplicate-league.md): what a copy carries and what it
 * resets. Never copies affiliations, league teams or matches. Ids and audit timestamps are left for the entities'
 * own persist hooks; {@code updatedBy} stays null, as on create.
 */
public final class LeagueCopyRules {

    private LeagueCopyRules() {}

    /** The requested name with surrounding whitespace removed; null becomes the empty string. */
    public static String normaliseName(String rawName) {
        return rawName == null ? "" : rawName.trim();
    }

    /** The league profile under {@code name}: always INTERNAL and active, with new social link instances. */
    public static League copyOfLeague(League source, String name, UUID clubId) {
        List<SocialLink> socialLinks = new ArrayList<>();
        for (SocialLink link : source.getSocialLinks()) {
            socialLinks.add(new SocialLink(link.getPlatform(), link.getUrl()));
        }
        return League.builder()
                .clubId(clubId)
                .name(name)
                .source(LeagueSource.INTERNAL)
                .maxPlayingXiSize(source.getMaxPlayingXiSize())
                .minAge(source.getMinAge())
                .maxAge(source.getMaxAge())
                .ageCutoffDate(source.getAgeCutoffDate())
                .format(source.getFormat())
                .logoUrl(source.getLogoUrl())
                .phone(source.getPhone())
                .website(source.getWebsite())
                .email(source.getEmail())
                .socialLinks(socialLinks)
                .active(true)
                .build();
    }

    /** Every structured field plus the PDF reference; bonus thresholds are null when bonus points are off. */
    public static LeaguePlayingConditions copyOfPlayingConditions(LeaguePlayingConditions source, UUID newLeagueId) {
        boolean bonus = source.isBonusPointsEnabled();
        return LeaguePlayingConditions.builder()
                .leagueId(newLeagueId)
                .seasonId(source.getSeasonId())
                .documentUrl(source.getDocumentUrl())
                .uploadedAt(source.getUploadedAt())
                .uploadedBy(source.getUploadedBy())
                .maxOversPerInnings(source.getMaxOversPerInnings())
                .powerplayOvers(source.getPowerplayOvers())
                .maxOversPerBowler(source.getMaxOversPerBowler())
                .fieldingRestrictionsNotes(source.getFieldingRestrictionsNotes())
                .allowSubstitutions(source.isAllowSubstitutions())
                .pointsForWin(source.getPointsForWin())
                .pointsForLoss(source.getPointsForLoss())
                .pointsForDraw(source.getPointsForDraw())
                .pointsForNoResult(source.getPointsForNoResult())
                .pointsForForfeitWin(source.getPointsForForfeitWin())
                .bonusPointsEnabled(bonus)
                .bonusBattingOversThreshold(bonus ? source.getBonusBattingOversThreshold() : null)
                .bonusBowlingRestrictionPercentage(bonus ? source.getBonusBowlingRestrictionPercentage() : null)
                .additionalNotes(source.getAdditionalNotes())
                .build();
    }

    /** A new, active contact with a new embedded {@link Contact}; role and primary flag are kept. */
    public static LeagueContact copyOfContact(LeagueContact source, UUID newLeagueId) {
        Contact original = source.getContact();
        Contact contact = original == null
                ? null
                : new Contact(original.getFirstName(), original.getLastName(), original.getEmail(), original.getPhone());
        return LeagueContact.builder()
                .leagueId(newLeagueId)
                .contact(contact)
                .role(source.getRole())
                .isPrimary(source.isPrimary())
                .active(true)
                .build();
    }
}
