package com.cricketlegend.service.impl;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.cricketlegend.domain.Club;
import com.cricketlegend.domain.ClubStatus;
import com.cricketlegend.domain.LinkRequest;
import com.cricketlegend.domain.LinkRequestStatus;
import com.cricketlegend.domain.Person;
import com.cricketlegend.repository.ClubRepository;
import com.cricketlegend.repository.LinkRequestRepository;
import com.cricketlegend.repository.PersonRepository;
import com.cricketlegend.service.EmailService;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.thymeleaf.context.IContext;
import org.thymeleaf.spring6.SpringTemplateEngine;

/**
 * docs/specs/119: the outcome email goes through EmailService only after the decision has committed, sets
 * requester_notified_at on success, and a thrown send failure is caught and logged without undoing anything.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class LinkRequestOutcomeEmailServiceImplTest {

    @Mock private LinkRequestRepository linkRequestRepository;
    @Mock private PersonRepository personRepository;
    @Mock private ClubRepository clubRepository;
    @Mock private EmailService emailService;
    @Mock private SpringTemplateEngine templateEngine;
    @Mock private PlatformTransactionManager transactionManager;

    private LinkRequestOutcomeEmailServiceImpl service;
    private LinkRequest request;

    @BeforeEach
    void setUp() {
        service = new LinkRequestOutcomeEmailServiceImpl(linkRequestRepository, personRepository, clubRepository,
                emailService, templateEngine, transactionManager, "http://localhost:5173", "support@example.com");
        Person requester = Person.builder().id(UUID.randomUUID()).firstName("Pat").lastName("Parent")
                .email("pat@example.com").build();
        Club club = Club.builder().id(UUID.randomUUID()).name("Hillcrest CC").slug("hillcrest")
                .status(ClubStatus.ACTIVE).build();
        request = LinkRequest.builder().id(UUID.randomUUID()).accountPersonId(requester.getId()).clubId(club.getId())
                .typedFirstName("Sam").typedLastName("Smith").status(LinkRequestStatus.APPROVED).build();
        when(linkRequestRepository.findById(request.getId())).thenReturn(Optional.of(request));
        when(personRepository.findById(requester.getId())).thenReturn(Optional.of(requester));
        when(clubRepository.findById(club.getId())).thenReturn(Optional.of(club));
        when(templateEngine.process(anyString(), any(IContext.class))).thenReturn("<html>ok</html>");
    }

    @AfterEach
    void clearSynchronisation() {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.clearSynchronization();
        }
    }

    private void commit() {
        List<TransactionSynchronization> syncs = TransactionSynchronizationManager.getSynchronizations();
        syncs.forEach(TransactionSynchronization::afterCommit);
    }

    @Test
    void nothingIsSentUntilTheSurroundingTransactionCommitsAndNothingIfItRollsBack() {
        TransactionSynchronizationManager.initSynchronization();

        service.sendAfterCommit(request.getId());

        verify(emailService, never()).send(any(), any(), any(), any());
        commit();
        verify(emailService).send(eq("pat@example.com"), eq("Pat Parent"), contains("accepted"), eq("<html>ok</html>"));
    }

    @Test
    void aRolledBackDecisionSendsNothing() {
        TransactionSynchronizationManager.initSynchronization();

        service.sendAfterCommit(request.getId());
        TransactionSynchronizationManager.getSynchronizations()
                .forEach(s -> s.afterCompletion(TransactionSynchronization.STATUS_ROLLED_BACK));

        verify(emailService, never()).send(any(), any(), any(), any());
    }

    @Test
    void aSuccessfulSendStampsRequesterNotifiedAt() {
        service.sendAfterCommit(request.getId()); // no transaction: runs immediately

        assertThat(request.getRequesterNotifiedAt()).isNotNull();
        verify(linkRequestRepository).save(request);
    }

    @Test
    void aThrownSendFailureIsSwallowedAndLeavesTheDecisionAndTheStampUntouched() {
        doThrow(new IllegalStateException("smtp down")).when(emailService).send(any(), any(), any(), any());

        service.sendAfterCommit(request.getId()); // must not throw

        assertThat(request.getRequesterNotifiedAt()).isNull();
        assertThat(request.getStatus()).isEqualTo(LinkRequestStatus.APPROVED);
        verify(linkRequestRepository, never()).save(any());
    }

    @Test
    void aDeclinedRequestSaysDeclined() {
        request.setStatus(LinkRequestStatus.DECLINED);

        service.sendAfterCommit(request.getId());

        verify(emailService).send(eq("pat@example.com"), anyString(), contains("declined"), anyString());
    }

    @Test
    void aStillPendingOrCancelledRequestSendsNothing() {
        request.setStatus(LinkRequestStatus.PENDING);
        service.sendAfterCommit(request.getId());
        request.setStatus(LinkRequestStatus.CANCELLED);
        service.sendAfterCommit(request.getId());

        verify(emailService, never()).send(any(), any(), any(), any());
    }
}
