package com.cricketlegend.service.support;

import java.net.URI;
import java.net.URISyntaxException;
import java.util.Locale;

/**
 * docs/specs/135: manager-entered links are re-validated on every read. Only an absolute {@code https} URL with a host,
 * no user info and the default port is accepted; {@code javascript:}, {@code data:}, {@code http} and anything
 * unparsable yield null. Pure.
 */
public final class HttpsLink {

    private HttpsLink() {}

    public static URI parse(String link) {
        if (link == null || link.isBlank()) {
            return null;
        }
        try {
            URI uri = new URI(link.trim());
            if (!"https".equals(uri.getScheme() == null ? null : uri.getScheme().toLowerCase(Locale.ROOT))
                    || uri.getHost() == null
                    || uri.getUserInfo() != null
                    || (uri.getPort() != -1 && uri.getPort() != 443)) {
                return null;
            }
            return uri;
        } catch (URISyntaxException e) {
            return null;
        }
    }

    public static String host(URI uri) {
        return uri.getHost().toLowerCase(Locale.ROOT);
    }
}
