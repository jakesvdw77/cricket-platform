package com.cricketlegend.service;

import com.cricketlegend.dto.AdminIdentityDto;
import org.springframework.security.oauth2.jwt.Jwt;

public interface AdminIdentityService {
    AdminIdentityDto getCurrentAdmin(Jwt jwt);
}
