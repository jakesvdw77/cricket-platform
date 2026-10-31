package com.cricketlegend.service.support;

import java.util.Locale;

/** The file format of a downloadable template; CSV carries the header only. */
public enum TemplateFormat {
    XLSX("xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
    CSV("csv", "text/csv");

    private final String extension;
    private final String contentType;

    TemplateFormat(String extension, String contentType) {
        this.extension = extension;
        this.contentType = contentType;
    }

    public String extension() {
        return extension;
    }

    public String contentType() {
        return contentType;
    }

    /** Case-insensitive parse of the {@code format} query parameter; null when unknown. */
    public static TemplateFormat parse(String value) {
        if (value == null) {
            return null;
        }
        try {
            return valueOf(value.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException ex) {
            return null;
        }
    }
}
