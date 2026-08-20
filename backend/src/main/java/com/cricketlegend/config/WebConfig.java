package com.cricketlegend.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * Serves uploaded media (logos, banners) back over a public static path — see
 * docs/specs/012-club-profile.md. Club-facing assets meant to be visible pre-login, same posture
 * docs/specs/001-tenancy-identity-model.md's {@code ClubBranding.logo_url} already has;
 * {@link SecurityConfig} pairs this with a {@code /media/**} {@code permitAll} matcher.
 */
@Configuration
public class WebConfig implements WebMvcConfigurer {

    private final String mediaStoragePath;

    public WebConfig(@Value("${app.media.storage-path}") String mediaStoragePath) {
        this.mediaStoragePath = mediaStoragePath;
    }

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        String location = mediaStoragePath.endsWith("/") ? mediaStoragePath : mediaStoragePath + "/";
        registry.addResourceHandler("/media/**").addResourceLocations("file:" + location);
    }
}
