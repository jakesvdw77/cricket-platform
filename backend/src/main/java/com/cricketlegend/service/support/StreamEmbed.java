package com.cricketlegend.service.support;

import com.cricketlegend.domain.StreamProvider;
import com.cricketlegend.dto.MyMatchStreamDto;
import java.net.URI;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * docs/specs/135: builds the embed URL of a stream link. The host is matched against an allow-list, an id is extracted
 * and validated, and the embed URL is CONSTRUCTED from a fixed template; nothing else from the link is copied (a
 * Facebook link is copied only url-encoded into {@code href}). A link that is not https yields null (no stream at
 * all); an https link that is not an allow-listed video yields provider OTHER and no embed. Pure.
 */
public final class StreamEmbed {

    private static final Set<String> YOUTUBE_HOSTS = Set.of("youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be");
    private static final Set<String> VIMEO_HOSTS = Set.of("vimeo.com", "www.vimeo.com", "player.vimeo.com");
    private static final Set<String> FACEBOOK_HOSTS = Set.of("facebook.com", "www.facebook.com", "m.facebook.com", "fb.watch");
    private static final Pattern YOUTUBE_ID = Pattern.compile("[A-Za-z0-9_-]{11}");
    private static final Pattern VIMEO_ID = Pattern.compile("[0-9]{1,12}");
    private static final Pattern YOUTUBE_PATH = Pattern.compile("^/(?:live|embed|shorts)/([^/?#]+)/?$");
    private static final Pattern VIMEO_PATH = Pattern.compile("^(?:/video)?/([0-9]+)/?$");
    private static final Pattern FACEBOOK_VIDEO_PATH = Pattern.compile("^/(?:[^/]+/)?(?:videos|reel)/[^/]+.*$|^/watch/?$");
    private static final Pattern FACEBOOK_SHORT = Pattern.compile("^/[A-Za-z0-9]{4,20}/?$");

    private StreamEmbed() {}

    /** The stream of a stored link, or null when it is not a valid https link. */
    public static MyMatchStreamDto of(String link) {
        URI uri = HttpsLink.parse(link);
        if (uri == null) {
            return null;
        }
        String host = HttpsLink.host(uri);
        String url = uri.toString();
        if (YOUTUBE_HOSTS.contains(host)) {
            String id = youtubeId(uri, host);
            return new MyMatchStreamDto(url, StreamProvider.YOUTUBE,
                    id == null ? null : "https://www.youtube-nocookie.com/embed/" + id);
        }
        if (VIMEO_HOSTS.contains(host)) {
            Matcher m = VIMEO_PATH.matcher(uri.getPath() == null ? "" : uri.getPath());
            String id = m.matches() && VIMEO_ID.matcher(m.group(1)).matches() ? m.group(1) : null;
            return new MyMatchStreamDto(url, StreamProvider.VIMEO, id == null ? null : "https://player.vimeo.com/video/" + id);
        }
        if (FACEBOOK_HOSTS.contains(host)) {
            String path = uri.getPath() == null ? "" : uri.getPath();
            boolean video = "fb.watch".equals(host)
                    ? FACEBOOK_SHORT.matcher(path).matches()
                    : FACEBOOK_VIDEO_PATH.matcher(path).matches()
                            && (!"/watch".equals(path.replaceAll("/$", "")) || hasQueryKey(uri, "v"));
            return new MyMatchStreamDto(url, StreamProvider.FACEBOOK, video
                    ? "https://www.facebook.com/plugins/video.php?href="
                            + URLEncoder.encode(url, StandardCharsets.UTF_8) + "&show_text=false"
                    : null);
        }
        return new MyMatchStreamDto(url, StreamProvider.OTHER, null);
    }

    private static String youtubeId(URI uri, String host) {
        String path = uri.getPath() == null ? "" : uri.getPath();
        String candidate = null;
        if ("youtu.be".equals(host)) {
            Matcher m = Pattern.compile("^/([^/?#]+)/?$").matcher(path);
            candidate = m.matches() ? m.group(1) : null;
        } else if ("/watch".equals(path)) {
            candidate = queryValue(uri, "v");
        } else {
            Matcher m = YOUTUBE_PATH.matcher(path);
            candidate = m.matches() ? m.group(1) : null;
        }
        return candidate != null && YOUTUBE_ID.matcher(candidate).matches() ? candidate : null;
    }

    private static boolean hasQueryKey(URI uri, String key) {
        return queryValue(uri, key) != null;
    }

    private static String queryValue(URI uri, String key) {
        String query = uri.getRawQuery();
        if (query == null) {
            return null;
        }
        for (String pair : query.split("&")) {
            int eq = pair.indexOf('=');
            if (eq > 0 && pair.substring(0, eq).equals(key)) {
                return pair.substring(eq + 1);
            }
        }
        return null;
    }
}
