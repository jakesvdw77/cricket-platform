package com.cricketlegend.repository;

import static org.assertj.core.api.Assertions.assertThat;

import com.cricketlegend.domain.ResultStatus;
import org.junit.jupiter.api.Test;

/** The native SQL literal for the publish gate must not drift from the enum the JPA specifications use. */
class ResultVisibilityTest {

    @Test
    void publishedStatusLiteralEqualsTheEnumName() {
        assertThat(ResultVisibility.PUBLISHED_STATUS).isEqualTo(ResultStatus.PUBLISHED.name());
    }
}
