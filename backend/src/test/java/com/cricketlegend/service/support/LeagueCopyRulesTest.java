package com.cricketlegend.service.support;

import static org.assertj.core.api.Assertions.assertThat;

import com.cricketlegend.domain.Contact;
import com.cricketlegend.domain.League;
import com.cricketlegend.domain.LeagueContact;
import com.cricketlegend.domain.LeagueFormat;
import com.cricketlegend.domain.LeaguePlayingConditions;
import com.cricketlegend.domain.LeagueSource;
import com.cricketlegend.domain.SocialLink;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

/** Unit tests for the pure copy rules of docs/specs/096-duplicate-league.md. */
class LeagueCopyRulesTest {

    private final UUID clubId = UUID.randomUUID();

    private League source() {
        return League.builder().id(UUID.randomUUID()).clubId(clubId).name("Division 1").source(LeagueSource.EXTERNAL)
                .maxPlayingXiSize(9).minAge(12).maxAge(15).ageCutoffDate(LocalDate.of(2031, 9, 1))
                .format(LeagueFormat.T20).logoUrl("/media/l.png").phone("0123").website("https://l.example")
                .email("a@l.example")
                .socialLinks(new ArrayList<>(List.of(SocialLink.builder().platform("facebook").url("https://fb").build())))
                .active(false).createdAt(Instant.parse("2020-01-01T00:00:00Z"))
                .updatedAt(Instant.parse("2020-01-02T00:00:00Z")).updatedBy(UUID.randomUUID()).build();
    }

    private LeaguePlayingConditions conditions(boolean bonus) {
        return LeaguePlayingConditions.builder().id(UUID.randomUUID()).leagueId(UUID.randomUUID())
                .seasonId(UUID.randomUUID()).documentUrl("/media/pc.pdf").uploadedAt(Instant.parse("2031-02-01T10:00:00Z"))
                .uploadedBy(UUID.randomUUID()).maxOversPerInnings(40).powerplayOvers(10).maxOversPerBowler(8)
                .fieldingRestrictionsNotes("notes").allowSubstitutions(true).pointsForWin(4).pointsForLoss(0)
                .pointsForDraw(2).pointsForNoResult(1).pointsForForfeitWin(4).bonusPointsEnabled(bonus)
                .bonusBattingOversThreshold(30).bonusBowlingRestrictionPercentage(50).additionalNotes("more").build();
    }

    @Test
    void normaliseNameTrimsAndTurnsNullIntoEmpty() {
        assertThat(LeagueCopyRules.normaliseName("  Division 2  ")).isEqualTo("Division 2");
        assertThat(LeagueCopyRules.normaliseName(null)).isEmpty();
    }

    @Test
    void copyOfLeagueCarriesTheProfileButIsAlwaysInternalActiveAndNew() {
        League source = source();

        League copy = LeagueCopyRules.copyOfLeague(source, "Division 2", clubId);

        assertThat(copy.getId()).isNull();
        assertThat(copy.getName()).isEqualTo("Division 2");
        assertThat(copy.getClubId()).isEqualTo(clubId);
        assertThat(copy.getSource()).isEqualTo(LeagueSource.INTERNAL);
        assertThat(copy.isActive()).isTrue();
        assertThat(copy.getMaxPlayingXiSize()).isEqualTo(9);
        assertThat(copy.getMinAge()).isEqualTo(12);
        assertThat(copy.getMaxAge()).isEqualTo(15);
        assertThat(copy.getAgeCutoffDate()).isEqualTo(LocalDate.of(2031, 9, 1));
        assertThat(copy.getFormat()).isEqualTo(LeagueFormat.T20);
        assertThat(copy.getLogoUrl()).isEqualTo("/media/l.png");
        assertThat(copy.getPhone()).isEqualTo("0123");
        assertThat(copy.getWebsite()).isEqualTo("https://l.example");
        assertThat(copy.getEmail()).isEqualTo("a@l.example");
        assertThat(copy.getCreatedAt()).isNull();
        assertThat(copy.getUpdatedAt()).isNull();
        assertThat(copy.getUpdatedBy()).isNull();
    }

    @Test
    void copyOfLeagueBuildsNewSocialLinkInstancesWithTheSameValues() {
        League source = source();

        League copy = LeagueCopyRules.copyOfLeague(source, "Division 2", clubId);

        assertThat(copy.getSocialLinks()).isNotSameAs(source.getSocialLinks());
        assertThat(copy.getSocialLinks()).hasSize(1);
        assertThat(copy.getSocialLinks().get(0)).isNotSameAs(source.getSocialLinks().get(0));
        assertThat(copy.getSocialLinks().get(0).getPlatform()).isEqualTo("facebook");
        assertThat(copy.getSocialLinks().get(0).getUrl()).isEqualTo("https://fb");
    }

    @Test
    void copyOfPlayingConditionsCarriesEveryFieldAndThePdfReference() {
        LeaguePlayingConditions source = conditions(true);
        UUID newLeagueId = UUID.randomUUID();

        LeaguePlayingConditions copy = LeagueCopyRules.copyOfPlayingConditions(source, newLeagueId);

        assertThat(copy.getId()).isNull();
        assertThat(copy.getLeagueId()).isEqualTo(newLeagueId);
        assertThat(copy.getSeasonId()).isEqualTo(source.getSeasonId());
        assertThat(copy.getDocumentUrl()).isEqualTo("/media/pc.pdf");
        assertThat(copy.getUploadedAt()).isEqualTo(source.getUploadedAt());
        assertThat(copy.getUploadedBy()).isEqualTo(source.getUploadedBy());
        assertThat(copy).usingRecursiveComparison()
                .ignoringFields("id", "leagueId")
                .isEqualTo(source);
    }

    @Test
    void copyOfPlayingConditionsNullsBonusThresholdsWhenBonusIsOff() {
        LeaguePlayingConditions copy = LeagueCopyRules.copyOfPlayingConditions(conditions(false), UUID.randomUUID());

        assertThat(copy.isBonusPointsEnabled()).isFalse();
        assertThat(copy.getBonusBattingOversThreshold()).isNull();
        assertThat(copy.getBonusBowlingRestrictionPercentage()).isNull();
    }

    @Test
    void copyOfContactBuildsANewEmbeddedContactKeepingRoleAndPrimaryAndIsActive() {
        UUID newLeagueId = UUID.randomUUID();
        LeagueContact source = LeagueContact.builder().id(UUID.randomUUID()).leagueId(UUID.randomUUID())
                .contact(Contact.builder().firstName("Sam").lastName("Fixer").email("s@x.example").phone("07").build())
                .role("Secretary").isPrimary(true).active(true).updatedBy(UUID.randomUUID()).build();

        LeagueContact copy = LeagueCopyRules.copyOfContact(source, newLeagueId);

        assertThat(copy.getId()).isNull();
        assertThat(copy.getLeagueId()).isEqualTo(newLeagueId);
        assertThat(copy.getContact()).isNotSameAs(source.getContact());
        assertThat(copy.getContact()).usingRecursiveComparison().isEqualTo(source.getContact());
        assertThat(copy.getRole()).isEqualTo("Secretary");
        assertThat(copy.isPrimary()).isTrue();
        assertThat(copy.isActive()).isTrue();
        assertThat(copy.getUpdatedBy()).isNull();
    }
}
