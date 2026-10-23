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
import java.util.UUID;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * "This account is an agent for this player at this club" (docs/specs/119). Club-scoped; only {@link
 * PersonLinkStatus#ACTIVE} grants anything. At most one active main agent per (subject, club), enforced by a partial
 * unique index.
 */
@Entity
@Table(name = "person_link")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PersonLink {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "account_person_id")
    private UUID accountPersonId;

    @Column(name = "invited_email")
    private String invitedEmail;

    @Column(name = "subject_person_id", nullable = false)
    private UUID subjectPersonId;

    @Column(name = "club_id", nullable = false)
    private UUID clubId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private PersonLinkStatus status;

    @Column(name = "is_main", nullable = false)
    private boolean main;

    @Column(name = "make_main", nullable = false)
    private boolean makeMain;

    @Enumerated(EnumType.STRING)
    @Column(name = "granted_via", nullable = false)
    private LinkGrantedVia grantedVia;

    @Column(name = "granted_by_person_id")
    private UUID grantedByPersonId;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "decided_at")
    private Instant decidedAt;

    @Column(name = "expires_at")
    private Instant expiresAt;

    @Column(name = "revoked_at")
    private Instant revokedAt;

    @Column(name = "revoked_by_person_id")
    private UUID revokedByPersonId;

    @PrePersist
    void prePersist() {
        if (createdAt == null) {
            createdAt = Instant.now();
        }
    }
}
