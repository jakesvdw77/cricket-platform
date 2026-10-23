package com.cricketlegend.service.support;

import com.cricketlegend.domain.LinkGrantedVia;
import com.cricketlegend.domain.Person;
import com.cricketlegend.domain.PersonLink;
import com.cricketlegend.domain.PersonLinkStatus;
import com.cricketlegend.exception.ConflictException;
import com.cricketlegend.exception.ValidationException;
import com.cricketlegend.repository.PersonLinkRepository;
import com.cricketlegend.repository.PersonRepository;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import java.util.regex.Pattern;
import org.springframework.stereotype.Component;

/**
 * docs/specs/119, slice 4: the one place an {@code INVITED} person link is created, for both the main agent's invitation
 * and the club manager's "invite an email as main agent". An invitation is bound to a verified email, not to an account:
 * it waits (14 days) until someone logs in with that verified email and accepts.
 */
@Component
public class LinkInvitations {

    public static final Duration VALIDITY = Duration.ofDays(14);
    private static final Pattern EMAIL = Pattern.compile("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$");

    private final PersonLinkRepository personLinkRepository;
    private final PersonRepository personRepository;

    public LinkInvitations(PersonLinkRepository personLinkRepository, PersonRepository personRepository) {
        this.personLinkRepository = personLinkRepository;
        this.personRepository = personRepository;
    }

    /**
     * Saves the invitation. Refuses (400) a malformed address, the sender's own address or the player's own account, and
     * (409) an email that already holds or has been invited to an open link for this player at this club.
     */
    public PersonLink create(
            UUID subjectPersonId,
            UUID clubId,
            String rawEmail,
            boolean makeMain,
            LinkGrantedVia via,
            UUID invitedByPersonId,
            String senderEmail) {
        String email = rawEmail == null ? "" : rawEmail.trim().toLowerCase(Locale.ROOT);
        if (!EMAIL.matcher(email).matches()) {
            throw new ValidationException("Enter a valid email address.");
        }
        if (senderEmail != null && senderEmail.trim().equalsIgnoreCase(email)) {
            throw new ValidationException("You cannot invite your own email address.");
        }
        Person existing = personRepository.findByEmailIgnoreCase(email).orElse(null);
        if (existing != null) {
            if (existing.getId().equals(subjectPersonId)) {
                throw new ValidationException("A player cannot be their own agent.");
            }
            boolean alreadyLinked = personLinkRepository
                    .findFirstByAccountPersonIdAndSubjectPersonIdAndClubIdAndStatusIn(
                            existing.getId(), subjectPersonId, clubId, List.of(PersonLinkStatus.ACTIVE, PersonLinkStatus.INVITED))
                    .isPresent();
            if (alreadyLinked) {
                throw new ConflictException("That person is already an agent for this player.");
            }
        }
        Instant now = Instant.now();
        boolean alreadyInvited = personLinkRepository
                .findOpenInvitationsBySubjectAndClub(subjectPersonId, clubId, now).stream()
                .anyMatch(l -> email.equalsIgnoreCase(l.getInvitedEmail()));
        if (alreadyInvited) {
            throw new ConflictException("That email has already been invited for this player.");
        }
        return personLinkRepository.save(PersonLink.builder()
                .invitedEmail(email)
                .subjectPersonId(subjectPersonId)
                .clubId(clubId)
                .status(PersonLinkStatus.INVITED)
                .main(false)
                .makeMain(makeMain)
                .grantedVia(via)
                .grantedByPersonId(invitedByPersonId)
                .expiresAt(now.plus(VALIDITY))
                .build());
    }
}
