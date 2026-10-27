package com.cricketlegend.service;

import com.cricketlegend.dto.CreateLinkRequestRequest;
import com.cricketlegend.dto.LinkRequestReceivedDto;
import com.cricketlegend.dto.MyLinkRequestDto;
import com.cricketlegend.dto.SectionOptionDto;
import java.util.List;
import java.util.UUID;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.jwt.Jwt;

/** The requester's side of link requests (docs/specs/119): create, list and cancel their own. */
public interface MyLinkRequestService {

    /**
     * Records a request for the club to review and always answers the same way, whatever the club holds. Needs a verified
     * email (403 EMAIL_NOT_VERIFIED). Limits: 10 requests per account per day (429) and 3 waiting per club (409).
     */
    LinkRequestReceivedDto create(Authentication authentication, Jwt jwt, CreateLinkRequestRequest request);

    /**
     * The club's ACTIVE sections for the request form's section picker, by name. Needs a verified email (403
     * EMAIL_NOT_VERIFIED); 404 for an unknown or non-ACTIVE club.
     */
    List<SectionOptionDto> sectionOptions(Jwt jwt, UUID clubId);

    /** The caller's own requests, newest first, with the club's decision note once decided. */
    List<MyLinkRequestDto> list(Authentication authentication);

    /** Cancels one of the caller's own PENDING requests; 404 for any other id, 409 once decided. */
    void cancel(Authentication authentication, UUID requestId);
}
