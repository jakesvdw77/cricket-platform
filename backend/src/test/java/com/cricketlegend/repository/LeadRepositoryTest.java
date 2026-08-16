package com.cricketlegend.repository;

import static org.assertj.core.api.Assertions.assertThat;

import com.cricketlegend.AbstractIntegrationTest;
import com.cricketlegend.domain.Lead;
import com.cricketlegend.domain.LeadStatus;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.transaction.annotation.Transactional;

/**
 * Integration test for LeadRepository's custom queries — per docs/standards/backend.md, every
 * custom repository query ships a Testcontainers-backed integration test. Each test runs in its
 * own rolled-back transaction for isolation, since all tests share one Testcontainers Postgres
 * instance for the whole class.
 */
@SpringBootTest
@Import(AbstractIntegrationTest.class)
@Transactional
class LeadRepositoryTest {

    @Autowired
    private LeadRepository leadRepository;

    @Test
    void findByStatusReturnsOnlyMatchingStatusNewestFirst() {
        Instant now = Instant.now();
        leadRepository.save(newLead("Older New", LeadStatus.NEW, now.minus(2, ChronoUnit.DAYS)));
        leadRepository.save(newLead("Newer New", LeadStatus.NEW, now.minus(1, ChronoUnit.DAYS)));
        leadRepository.save(newLead("Contacted", LeadStatus.CONTACTED, now));

        Pageable pageable = PageRequest.of(0, 20, Sort.by("createdAt").descending());
        Page<Lead> result = leadRepository.findByStatus(LeadStatus.NEW, pageable);

        assertThat(result.getContent()).extracting(Lead::getName).containsExactly("Newer New", "Older New");
        assertThat(result.getTotalElements()).isEqualTo(2);
    }

    @Test
    void findAllReturnsNewestFirstAndRespectsPageSize() {
        Instant now = Instant.now();
        leadRepository.save(newLead("Oldest", LeadStatus.NEW, now.minus(3, ChronoUnit.DAYS)));
        leadRepository.save(newLead("Middle", LeadStatus.CONTACTED, now.minus(2, ChronoUnit.DAYS)));
        leadRepository.save(newLead("Newest", LeadStatus.DISMISSED, now.minus(1, ChronoUnit.DAYS)));

        Pageable pageable = PageRequest.of(0, 2, Sort.by("createdAt").descending());
        Page<Lead> result = leadRepository.findAll(pageable);

        assertThat(result.getContent()).extracting(Lead::getName).containsExactly("Newest", "Middle");
        assertThat(result.getTotalElements()).isEqualTo(3);
        assertThat(result.getTotalPages()).isEqualTo(2);
    }

    private Lead newLead(String name, LeadStatus status, Instant createdAt) {
        Lead lead = new Lead();
        lead.setName(name);
        lead.setEmail(name.toLowerCase().replace(" ", ".") + "@example.com");
        lead.setClubName("Some CC");
        lead.setStatus(status);
        lead.setCreatedAt(createdAt);
        return lead;
    }
}
