package com.cricketlegend.service.support;

import com.cricketlegend.dto.PublicPickCandidateDto;
import com.cricketlegend.dto.PublicVerifyRequest;
import com.cricketlegend.dto.PublicVerifyResponseDto;
import com.cricketlegend.exception.PublicRateLimitedException;
import com.cricketlegend.exception.PublicVerificationFailedException;
import com.cricketlegend.exception.PublicVerificationLockedException;
import com.cricketlegend.repository.PlayerDateOfBirthView;
import com.cricketlegend.repository.PlayerProfileRepository;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Supplier;
import org.springframework.stereotype.Component;

/**
 * The verify step shared by both public poll kinds (docs/specs/077): throttles by address, checks
 * the per-name lock, finds lenient name matches among the players who BELONG to the poll, loads
 * their dates of birth in one batch and lets the date decide. Deliberately not transactional:
 * attempt counters commit on their own so a failed verification keeps its count.
 */
@Component
public class PublicAvailabilityVerifier {

    public static final int MAX_FAILED_PER_NAME = 5;
    public static final int MAX_CALLS_PER_ADDRESS = 30;

    private final PlayerProfileRepository playerProfileRepository;
    private final PublicAttemptTracker attemptTracker;
    private final PublicAvailabilityToken tokens;

    public PublicAvailabilityVerifier(
            PlayerProfileRepository playerProfileRepository,
            PublicAttemptTracker attemptTracker,
            PublicAvailabilityToken tokens) {
        this.playerProfileRepository = playerProfileRepository;
        this.attemptTracker = attemptTracker;
        this.tokens = tokens;
    }

    /** The lock-counter key: poll kind, poll id and the canonical particle-stripped typed name (hashed). */
    public static String nameKey(PublicPollKind kind, UUID pollId, String firstName, String lastName) {
        return "name:" + kind + ":" + pollId + ":" + sha256(PlayerNameMatcher.lockForm(firstName, lastName));
    }

    public static String addressKey(String clientAddress) {
        return "ip:" + clientAddress;
    }

    public PublicVerifyResponseDto verify(
            PublicPollKind kind,
            UUID pollId,
            List<PublicAudienceMember> audience,
            PublicVerifyRequest request,
            String clientAddress,
            Supplier<String> teamLabel) {
        AttemptState address = attemptTracker.increment(addressKey(clientAddress), MAX_CALLS_PER_ADDRESS + 1);
        if (address.count() > MAX_CALLS_PER_ADDRESS) {
            throw new PublicRateLimitedException(
                    attemptTracker.secondsUntil(address.windowStartedAt().plus(PublicAttemptTracker.WINDOW)));
        }
        String nameKey = nameKey(kind, pollId, request.firstName(), request.lastName());
        Instant lockedUntil = attemptTracker.lockedUntil(nameKey).orElse(null);
        if (lockedUntil != null) {
            throw new PublicVerificationLockedException(attemptTracker.secondsUntil(lockedUntil));
        }

        List<PublicAudienceMember> nameMatches = audience.stream()
                .filter(member -> PlayerNameMatcher.matches(
                        request.firstName(), request.lastName(), member.firstName(), member.lastName()))
                .toList();
        Map<UUID, LocalDate> dateOfBirthById = new HashMap<>();
        if (!nameMatches.isEmpty()) {
            for (PlayerDateOfBirthView view : playerProfileRepository.findActiveDatesOfBirth(
                    nameMatches.stream().map(PublicAudienceMember::playerProfileId).toList())) {
                dateOfBirthById.put(view.getPlayerProfileId(), view.getDateOfBirth());
            }
        }
        // An inactive player is not in dateOfBirthById at all, so counts as unknown.
        List<PublicAudienceMember> active =
                nameMatches.stream().filter(m -> dateOfBirthById.containsKey(m.playerProfileId())).toList();
        List<PublicAudienceMember> dateMatches = active.stream()
                .filter(m -> request.dateOfBirth().equals(dateOfBirthById.get(m.playerProfileId())))
                .toList();

        if (dateMatches.isEmpty() && active.stream().anyMatch(m -> dateOfBirthById.get(m.playerProfileId()) == null)) {
            return PublicVerifyResponseDto.noDateOfBirth();
        }
        List<PublicAudienceMember> chosen = request.playerId() == null
                ? dateMatches
                : dateMatches.stream().filter(m -> m.playerProfileId().equals(request.playerId())).toList();
        if (chosen.isEmpty()) {
            AttemptState name = attemptTracker.increment(nameKey, MAX_FAILED_PER_NAME);
            throw new PublicVerificationFailedException(Math.max(0, MAX_FAILED_PER_NAME - name.count()));
        }
        if (chosen.size() > 1) {
            String label = teamLabel.get();
            return PublicVerifyResponseDto.pick(chosen.stream()
                    .map(m -> new PublicPickCandidateDto(m.playerProfileId(), m.shirtNumber(), label))
                    .toList());
        }
        PublicAudienceMember player = chosen.get(0);
        attemptTracker.clear(nameKey);
        PublicAvailabilityToken.Issued issued = tokens.issue(kind, pollId, player.playerProfileId());
        return PublicVerifyResponseDto.verified(
                player.playerProfileId(), player.firstName(), player.lastName(), issued.token(), issued.expiresAt());
    }

    private static String sha256(String value) {
        try {
            return HexFormat.of().formatHex(
                    MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException ex) {
            throw new IllegalStateException("SHA-256 is unavailable", ex);
        }
    }
}
