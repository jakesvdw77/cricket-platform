package com.cricketlegend.service.support;

/** An accepted upload: a cleaned display name, the bytes and the sniffed kind. Never logged. */
public record ImportFile(String name, byte[] content, ImportFileKind kind) {
}
