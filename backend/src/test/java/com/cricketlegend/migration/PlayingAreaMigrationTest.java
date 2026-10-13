package com.cricketlegend.migration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.cricketlegend.domain.PlayingArea;
import com.cricketlegend.domain.PlayingAreaCategory;
import com.cricketlegend.domain.PlayingAreaVerificationStatus;
import com.cricketlegend.support.AbstractPlayingAreaIntegrationTest;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataIntegrityViolationException;

/**
 * Migrations 041 and 042 (docs/specs/099-fields-directory.md): they applied (the context booted against Liquibase), the
 * identity index is case-insensitive on name and city and allows the same name in another city or country, a
 * merged-away row no longer holds the identity, MUNICIPAL is an allowed category and a bogus one is not, and a club
 * can link a field once.
 */
class PlayingAreaMigrationTest extends AbstractPlayingAreaIntegrationTest {

    @Test
    void tablesAndMatchColumnExist() {
        Integer columns = jdbc.queryForObject(
                "select count(*) from information_schema.columns where (table_name = 'match' and column_name = 'playing_area_id')"
                        + " or (table_name = 'playing_area' and column_name in ('area_type', 'ground_id', 'merged_into_id'))",
                Integer.class);
        assertThat(columns).isEqualTo(4);
        assertThat(jdbc.queryForObject("select count(*) from club_playing_area", Integer.class)).isZero();
    }

    @Test
    void identityIndexRejectsAnExactDuplicateIgnoringCase() {
        area("Irene Oval", "Pretoria", "ZA", PlayingAreaVerificationStatus.UNVERIFIED);

        assertThatThrownBy(() -> area("IRENE OVAL", "pretoria", "ZA", PlayingAreaVerificationStatus.UNVERIFIED))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void identityIndexAllowsTheSameNameInAnotherCityOrCountry() {
        area("Irene Oval", "Pretoria", "ZA", PlayingAreaVerificationStatus.UNVERIFIED);

        area("Irene Oval", "Cape Town", "ZA", PlayingAreaVerificationStatus.UNVERIFIED);
        area("Irene Oval", "Pretoria", "GB", PlayingAreaVerificationStatus.UNVERIFIED);

        assertThat(playingAreaRepository.count()).isEqualTo(3);
    }

    @Test
    void aMergedAwayRowNoLongerHoldsTheIdentity() {
        PlayingArea survivor = area("Survivor", "Pretoria", "ZA", PlayingAreaVerificationStatus.VERIFIED);
        PlayingArea old = area("Irene Oval", "Pretoria", "ZA", PlayingAreaVerificationStatus.UNVERIFIED);
        old.setMergedIntoId(survivor.getId());
        playingAreaRepository.saveAndFlush(old);

        area("Irene Oval", "Pretoria", "ZA", PlayingAreaVerificationStatus.UNVERIFIED);

        assertThat(playingAreaRepository.count()).isEqualTo(3);
    }

    @Test
    void municipalCategoryIsAllowedAndAnUnknownOneIsNot() {
        PlayingArea municipal = area(
                "Council Park", "Durban", "ZA", null, PlayingAreaCategory.MUNICIPAL,
                PlayingAreaVerificationStatus.UNVERIFIED, null);
        assertThat(playingAreaRepository.findById(municipal.getId()).orElseThrow().getCategory())
                .isEqualTo(PlayingAreaCategory.MUNICIPAL);

        assertThatThrownBy(() -> jdbc.update(
                        "update playing_area set category = 'BOGUS' where id = ?", municipal.getId()))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void aClubCanLinkTheSameFieldOnlyOnce() {
        UUID clubId = club("Riverside CC").getId();
        PlayingArea field = area("Irene Oval", "Pretoria", "ZA", PlayingAreaVerificationStatus.VERIFIED);
        home(clubId, field.getId());

        assertThatThrownBy(() -> home(clubId, field.getId())).isInstanceOf(DataIntegrityViolationException.class);
    }
}
