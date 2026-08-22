package com.cricketlegend.service.impl;

import com.cricketlegend.dto.EmailSettingsDto;
import com.cricketlegend.service.EmailSettingsService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class EmailSettingsServiceImpl implements EmailSettingsService {

    private final String host;
    private final int port;
    private final boolean authEnabled;
    private final boolean starttlsEnabled;
    private final String fromAddress;
    private final String fromName;
    private final String supportAddress;

    public EmailSettingsServiceImpl(
            @Value("${spring.mail.host}") String host,
            @Value("${spring.mail.port}") int port,
            @Value("${spring.mail.properties.mail.smtp.auth}") boolean authEnabled,
            @Value("${spring.mail.properties.mail.smtp.starttls.enable}") boolean starttlsEnabled,
            @Value("${app.mail.from-address}") String fromAddress,
            @Value("${app.mail.from-name}") String fromName,
            @Value("${app.mail.support-address}") String supportAddress) {
        this.host = host;
        this.port = port;
        this.authEnabled = authEnabled;
        this.starttlsEnabled = starttlsEnabled;
        this.fromAddress = fromAddress;
        this.fromName = fromName;
        this.supportAddress = supportAddress;
    }

    @Override
    public EmailSettingsDto getSettings() {
        return new EmailSettingsDto(host, port, authEnabled, starttlsEnabled, fromAddress, fromName, supportAddress);
    }
}
