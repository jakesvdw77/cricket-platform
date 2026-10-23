package com.cricketlegend.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** Untrusted input waiting for a human at the club to decide (docs/specs/119). Written from slice 3B. */
@Entity
@Table(name = "link_request")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class LinkRequest {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "account_person_id", nullable = false)
    private UUID accountPersonId;

    @Column(name = "club_id", nullable = false)
    private UUID clubId;

    @Column(name = "typed_first_name", nullable = false)
    private String typedFirstName;

    @Column(name = "typed_last_name", nullable = false)
    private String typedLastName;

    @Column(name = "typed_date_of_birth", nullable = false)
    private LocalDate typedDateOfBirth;

    @Column(name = "target_player_profile_id")
    private UUID targetPlayerProfileId;

    @Column(length = 500)
    private String message;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private LinkRequestStatus status;

    @Column(name = "resolved_subject_person_id")
    private UUID resolvedSubjectPersonId;

    @Column(name = "decided_by_person_id")
    private UUID decidedByPersonId;

    @Column(name = "decided_at")
    private Instant decidedAt;

    @Column(name = "decision_note", length = 500)
    private String decisionNote;

    @Column(name = "requester_notified_at")
    private Instant requesterNotifiedAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @PrePersist
    void prePersist() {
        if (createdAt == null) {
            createdAt = Instant.now();
        }
        if (status == null) {
            status = LinkRequestStatus.PENDING;
        }
    }
}
