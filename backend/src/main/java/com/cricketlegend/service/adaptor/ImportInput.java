package com.cricketlegend.service.adaptor;

/**
 * docs/specs/104-match-results-import-adaptors.md: what an import was given: an uploaded file ({@code bytes}) or pasted
 * text ({@code text}, text-based formats only), never both. {@code fileName} is optional and informational.
 */
public record ImportInput(ImportInputFormat format, String fileName, byte[] bytes, String text) {

    public static ImportInput file(ImportInputFormat format, String fileName, byte[] bytes) {
        return new ImportInput(format, fileName, bytes, null);
    }

    public static ImportInput paste(ImportInputFormat format, String text) {
        return new ImportInput(format, null, null, text);
    }

    public boolean isPaste() {
        return bytes == null;
    }

    /** The size of an upload in bytes; for pasted text the UTF-8 size. */
    public long byteSize() {
        if (bytes != null) {
            return bytes.length;
        }
        return text == null ? 0 : text.getBytes(java.nio.charset.StandardCharsets.UTF_8).length;
    }
}
