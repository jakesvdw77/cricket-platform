package com.cricketlegend.service.impl;

import com.cricketlegend.dto.AdminIdentityDto;
import com.cricketlegend.service.AdminIdentityService;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;

@Service
public class AdminIdentityServiceImpl implements AdminIdentityService {

    @Override
    public AdminIdentityDto getCurrentAdmin(Jwt jwt) {
        return new AdminIdentityDto(
                jwt.getSubject(),
                jwt.getClaimAsString("preferred_username"),
                jwt.getClaimAsString("email"));
    }
}
