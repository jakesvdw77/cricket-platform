package com.cricketlegend.service.adaptor;

/** The working form of a text-based input: the decoded text (BOM removed). */
public record TextContent(String text) implements AdaptorContent {
}
