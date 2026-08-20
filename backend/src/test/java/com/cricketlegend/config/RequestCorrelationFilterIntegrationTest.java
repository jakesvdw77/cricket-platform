package com.cricketlegend.config;

import static com.cricketlegend.PlatformRoleJwtPostProcessors.platformAdmin;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;

import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.LoggerContext;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import com.cricketlegend.AbstractIntegrationTest;
import com.cricketlegend.domain.Club;
import com.cricketlegend.domain.ClubStatus;
import com.cricketlegend.repository.ClubRepository;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

/**
 * Full-filter-chain slice for {@link RequestCorrelationFilter} — per
 * docs/plans/013-centralized-logging.md's Tests section: proves the filter ordering inside
 * {@link SecurityConfig#filterChain} actually resolves as intended (Authentication is populated
 * before this filter runs) by capturing real log output via a Logback {@link ListAppender}
 * attached to the root logger, rather than only unit-testing the filter in isolation.
 *
 * <p>Uses {@code @Import(AbstractIntegrationTest.class)} rather than {@code extends}, matching
 * this repo's existing controller-tier integration tests.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(AbstractIntegrationTest.class)
@Transactional
class RequestCorrelationFilterIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ClubRepository clubRepository;

    private ListAppender<ILoggingEvent> listAppender;

    @BeforeEach
    void attachListAppender() {
        listAppender = new ListAppender<>();
        listAppender.start();
        rootLogger().addAppender(listAppender);
    }

    @AfterEach
    void detachListAppender() {
        rootLogger().detachAppender(listAppender);
    }

    @Test
    void authenticatedRequestAgainstAClubRouteLogsRequestIdUsernameAndClubIdTogether() throws Exception {
        Club club = clubRepository.save(
                Club.builder().name("Riverside CC").slug("riverside-cc").status(ClubStatus.ACTIVE).build());

        var result = mockMvc.perform(get("/api/v1/platform/clubs/{id}", club.getId())
                        .with(platformAdmin(builder -> builder.subject("jake"))))
                .andReturn();

        String requestId = result.getResponse().getHeader("X-Request-Id");
        assertThat(requestId).isNotBlank();

        List<ILoggingEvent> matching = listAppender.list.stream()
                .filter(event -> requestId.equals(event.getMDCPropertyMap().get("requestId")))
                .toList();

        assertThat(matching).isNotEmpty();
        assertThat(matching).allSatisfy(event -> {
            assertThat(event.getMDCPropertyMap().get("requestId")).isEqualTo(requestId);
            assertThat(event.getMDCPropertyMap().get("username")).isEqualTo("jake");
            assertThat(event.getMDCPropertyMap().get("clubId")).isEqualTo(club.getId().toString());
        });
    }

    @Test
    void unauthenticatedRequestAgainstPublicRouteLogsRequestIdOnly() throws Exception {
        var result = mockMvc.perform(get("/api/v1/public/clubs").queryParam("query", "river")).andReturn();

        String requestId = result.getResponse().getHeader("X-Request-Id");
        assertThat(requestId).isNotBlank();

        List<ILoggingEvent> matching = listAppender.list.stream()
                .filter(event -> requestId.equals(event.getMDCPropertyMap().get("requestId")))
                .toList();

        assertThat(matching).isNotEmpty();
        assertThat(matching).allSatisfy(event -> {
            assertThat(event.getMDCPropertyMap()).doesNotContainKey("username");
            assertThat(event.getMDCPropertyMap()).doesNotContainKey("clubId");
        });
    }

    private Logger rootLogger() {
        LoggerContext context = (LoggerContext) LoggerFactory.getILoggerFactory();
        return context.getLogger(org.slf4j.Logger.ROOT_LOGGER_NAME);
    }
}
