package com.cricketlegend.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

import com.cricketlegend.domain.Lead;
import com.cricketlegend.domain.LeadStatus;
import com.cricketlegend.dto.CreateLeadRequest;
import com.cricketlegend.dto.LeadDto;
import com.cricketlegend.dto.UpdateLeadStatusRequest;
import com.cricketlegend.exception.InvalidLeadFieldException;
import com.cricketlegend.exception.InvalidStatusTransitionException;
import com.cricketlegend.exception.NotFoundException;
import com.cricketlegend.mapper.LeadMapper;
import com.cricketlegend.repository.LeadRepository;
import com.cricketlegend.service.impl.LeadServiceImpl;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;

/**
 * Unit tests for LeadServiceImpl's business rules — the allowed-transition table from
 * docs/specs/004-landing-page.md. Per docs/standards/backend.md, every @Service method carrying
 * a business rule ships a unit test in the same change.
 */
@ExtendWith(MockitoExtension.class)
class LeadServiceImplTest {

    @Mock
    private LeadRepository leadRepository;

    @Mock
    private LeadMapper leadMapper;

    private LeadServiceImpl leadService;

    @BeforeEach
    void setUp() {
        leadService = new LeadServiceImpl(leadRepository, leadMapper);
    }

    @Test
    void createSavesLeadWithNewStatus() {
        CreateLeadRequest request = new CreateLeadRequest("Ada", "ada@example.com", "Riverside CC", null, null);
        Lead entity = new Lead();
        when(leadMapper.toEntity(request)).thenReturn(entity);
        when(leadRepository.save(entity)).thenReturn(entity);
        when(leadMapper.toDto(entity)).thenReturn(
                new LeadDto(UUID.randomUUID(), "Ada", "ada@example.com", "Riverside CC", null, null,
                        LeadStatus.NEW, null, null, null, null));

        leadService.create(request);

        assertThat(entity.getStatus()).isEqualTo(LeadStatus.NEW);
    }

    @Test
    void listWithNoFilterReturnsAllPageDefaultingToNewestFirstSort() {
        Pageable requested = PageRequest.of(0, 20);
        Pageable expectedEffective = PageRequest.of(0, 20, Sort.by("createdAt").descending());
        when(leadRepository.findAll(expectedEffective)).thenReturn(new PageImpl<>(List.of(new Lead())));
        when(leadMapper.toDto(any(Lead.class))).thenReturn(
                new LeadDto(UUID.randomUUID(), "n", "e", "c", null, null, LeadStatus.NEW, null, null, null, null));

        Page<LeadDto> result = leadService.list(null, requested);

        assertThat(result.getContent()).hasSize(1);
    }

    @Test
    void listWithFilterDelegatesToStatusQuery() {
        Pageable requested = PageRequest.of(0, 20);
        Pageable expectedEffective = PageRequest.of(0, 20, Sort.by("createdAt").descending());
        when(leadRepository.findByStatus(LeadStatus.CONTACTED, expectedEffective))
                .thenReturn(new PageImpl<>(List.of(new Lead())));
        when(leadMapper.toDto(any(Lead.class))).thenReturn(
                new LeadDto(UUID.randomUUID(), "n", "e", "c", null, null, LeadStatus.CONTACTED, null, null, null, null));

        Page<LeadDto> result = leadService.list(LeadStatus.CONTACTED, requested);

        assertThat(result.getContent()).hasSize(1);
    }

    @Test
    void listPreservesCallerSuppliedSort() {
        Pageable requested = PageRequest.of(0, 20, Sort.by("name").ascending());
        when(leadRepository.findAll(requested)).thenReturn(new PageImpl<>(List.of(new Lead())));
        when(leadMapper.toDto(any(Lead.class))).thenReturn(
                new LeadDto(UUID.randomUUID(), "n", "e", "c", null, null, LeadStatus.NEW, null, null, null, null));

        Page<LeadDto> result = leadService.list(null, requested);

        assertThat(result.getContent()).hasSize(1);
    }

    @Test
    void newToContactedIsAllowed() {
        UUID id = UUID.randomUUID();
        Lead lead = new Lead();
        lead.setStatus(LeadStatus.NEW);
        when(leadRepository.findById(id)).thenReturn(Optional.of(lead));
        when(leadRepository.save(lead)).thenReturn(lead);
        when(leadMapper.toDto(lead)).thenReturn(
                new LeadDto(id, "n", "e", "c", null, null, LeadStatus.CONTACTED, null, null, null, null));

        leadService.transitionStatus(id, new UpdateLeadStatusRequest(LeadStatus.CONTACTED, null));

        assertThat(lead.getStatus()).isEqualTo(LeadStatus.CONTACTED);
        assertThat(lead.getContactedAt()).isNotNull();
    }

    @Test
    void newToDismissedIsAllowed() {
        UUID id = UUID.randomUUID();
        Lead lead = new Lead();
        lead.setStatus(LeadStatus.NEW);
        when(leadRepository.findById(id)).thenReturn(Optional.of(lead));
        when(leadRepository.save(lead)).thenReturn(lead);
        when(leadMapper.toDto(lead)).thenReturn(
                new LeadDto(id, "n", "e", "c", null, null, LeadStatus.DISMISSED, null, null, null, null));

        leadService.transitionStatus(id, new UpdateLeadStatusRequest(LeadStatus.DISMISSED, null));

        assertThat(lead.getStatus()).isEqualTo(LeadStatus.DISMISSED);
    }

    @Test
    void contactedToConvertedIsAllowedAndRecordsConvertedClubId() {
        UUID id = UUID.randomUUID();
        UUID clubId = UUID.randomUUID();
        Lead lead = new Lead();
        lead.setStatus(LeadStatus.CONTACTED);
        when(leadRepository.findById(id)).thenReturn(Optional.of(lead));
        when(leadRepository.save(lead)).thenReturn(lead);
        when(leadMapper.toDto(lead)).thenReturn(
                new LeadDto(id, "n", "e", "c", null, null, LeadStatus.CONVERTED, clubId, null, null, null));

        leadService.transitionStatus(id, new UpdateLeadStatusRequest(LeadStatus.CONVERTED, clubId));

        assertThat(lead.getStatus()).isEqualTo(LeadStatus.CONVERTED);
        assertThat(lead.getConvertedClubId()).isEqualTo(clubId);
    }

    @Test
    void contactedToDismissedIsAllowed() {
        UUID id = UUID.randomUUID();
        Lead lead = new Lead();
        lead.setStatus(LeadStatus.CONTACTED);
        when(leadRepository.findById(id)).thenReturn(Optional.of(lead));
        when(leadRepository.save(lead)).thenReturn(lead);
        when(leadMapper.toDto(lead)).thenReturn(
                new LeadDto(id, "n", "e", "c", null, null, LeadStatus.DISMISSED, null, null, null, null));

        leadService.transitionStatus(id, new UpdateLeadStatusRequest(LeadStatus.DISMISSED, null));

        assertThat(lead.getStatus()).isEqualTo(LeadStatus.DISMISSED);
    }

    @Test
    void newToConvertedIsRejected() {
        UUID id = UUID.randomUUID();
        Lead lead = new Lead();
        lead.setStatus(LeadStatus.NEW);
        when(leadRepository.findById(id)).thenReturn(Optional.of(lead));

        assertThatThrownBy(() ->
                leadService.transitionStatus(id, new UpdateLeadStatusRequest(LeadStatus.CONVERTED, null)))
                .isInstanceOf(InvalidStatusTransitionException.class);
    }

    @Test
    void transitionOutOfConvertedIsRejected() {
        UUID id = UUID.randomUUID();
        Lead lead = new Lead();
        lead.setStatus(LeadStatus.CONVERTED);
        when(leadRepository.findById(id)).thenReturn(Optional.of(lead));

        assertThatThrownBy(() ->
                leadService.transitionStatus(id, new UpdateLeadStatusRequest(LeadStatus.CONTACTED, null)))
                .isInstanceOf(InvalidStatusTransitionException.class);
    }

    @Test
    void transitionOutOfDismissedIsRejected() {
        UUID id = UUID.randomUUID();
        Lead lead = new Lead();
        lead.setStatus(LeadStatus.DISMISSED);
        when(leadRepository.findById(id)).thenReturn(Optional.of(lead));

        assertThatThrownBy(() ->
                leadService.transitionStatus(id, new UpdateLeadStatusRequest(LeadStatus.CONTACTED, null)))
                .isInstanceOf(InvalidStatusTransitionException.class);
    }

    @Test
    void convertedClubIdOnlyValidWhenTransitioningToConverted() {
        UUID id = UUID.randomUUID();
        Lead lead = new Lead();
        lead.setStatus(LeadStatus.NEW);
        when(leadRepository.findById(id)).thenReturn(Optional.of(lead));

        assertThatThrownBy(() -> leadService.transitionStatus(
                id, new UpdateLeadStatusRequest(LeadStatus.CONTACTED, UUID.randomUUID())))
                .isInstanceOf(InvalidLeadFieldException.class);
    }

    @Test
    void transitioningUnknownLeadThrowsNotFound() {
        UUID id = UUID.randomUUID();
        when(leadRepository.findById(id)).thenReturn(Optional.empty());

        assertThatThrownBy(() ->
                leadService.transitionStatus(id, new UpdateLeadStatusRequest(LeadStatus.CONTACTED, null)))
                .isInstanceOf(NotFoundException.class);
    }
}
