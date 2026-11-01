package com.cricketlegend.service.support;

import static org.assertj.core.api.Assertions.assertThat;

import com.cricketlegend.domain.StreamProvider;
import com.cricketlegend.dto.MyMatchStreamDto;
import java.net.URI;
import java.util.List;
import org.junit.jupiter.api.Test;

/** docs/specs/135: embed URLs are constructed from fixed templates; anything unsafe yields no stream or no embed. */
class StreamEmbedTest {

    private static final String YT = "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ";

    @Test
    void youtubeShapesBuildTheNoCookieEmbed() {
        for (String link : List.of(
                "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
                "https://youtube.com/watch?v=dQw4w9WgXcQ&t=5",
                "https://youtu.be/dQw4w9WgXcQ",
                "https://www.youtube.com/live/dQw4w9WgXcQ",
                "https://m.youtube.com/embed/dQw4w9WgXcQ")) {
            MyMatchStreamDto s = StreamEmbed.of(link);
            assertThat(s.provider()).as(link).isEqualTo(StreamProvider.YOUTUBE);
            assertThat(s.embedUrl()).as(link).isEqualTo(YT);
        }
    }

    @Test
    void vimeoBuildsThePlayerEmbed() {
        assertThat(StreamEmbed.of("https://vimeo.com/123456789").embedUrl()).isEqualTo("https://player.vimeo.com/video/123456789");
        assertThat(StreamEmbed.of("https://vimeo.com/123456789").provider()).isEqualTo(StreamProvider.VIMEO);
    }

    @Test
    void facebookVideoBuildsThePluginWithTheEncodedHref() {
        MyMatchStreamDto s = StreamEmbed.of("https://www.facebook.com/club/videos/12345/");
        assertThat(s.provider()).isEqualTo(StreamProvider.FACEBOOK);
        assertThat(s.embedUrl()).isEqualTo("https://www.facebook.com/plugins/video.php?href="
                + "https%3A%2F%2Fwww.facebook.com%2Fclub%2Fvideos%2F12345%2F&show_text=false");
    }

    @Test
    void aFacebookPageThatIsNotAVideoHasNoEmbed() {
        assertThat(StreamEmbed.of("https://www.facebook.com/club").embedUrl()).isNull();
        assertThat(StreamEmbed.of("https://www.facebook.com/watch").embedUrl()).isNull();
    }

    @Test
    void anUnknownHttpsHostIsOtherWithNoEmbed() {
        MyMatchStreamDto s = StreamEmbed.of("https://streams.example.org/live/1");
        assertThat(s.provider()).isEqualTo(StreamProvider.OTHER);
        assertThat(s.embedUrl()).isNull();
        assertThat(s.url()).isEqualTo("https://streams.example.org/live/1");
    }

    @Test
    void unsafeOrMalformedLinksYieldNoStream() {
        for (String link : new String[] {
                "http://www.youtube.com/watch?v=dQw4w9WgXcQ", "javascript:alert(1)", "data:text/html,<script>1</script>",
                "ftp://youtube.com/watch?v=dQw4w9WgXcQ", "//youtube.com/watch?v=dQw4w9WgXcQ", "not a url", "", "   ", null,
                "https://user@www.youtube.com/watch?v=dQw4w9WgXcQ", "https://www.youtube.com:8443/watch?v=dQw4w9WgXcQ"}) {
            assertThat(StreamEmbed.of(link)).as(String.valueOf(link)).isNull();
        }
    }

    @Test
    void hostSpoofingNeverEmbeds() {
        for (String link : new String[] {
                "https://youtube.com.evil.example/watch?v=dQw4w9WgXcQ", "https://evilyoutube.com/watch?v=dQw4w9WgXcQ",
                "https://www.youtube.com@evil.example/watch?v=dQw4w9WgXcQ", "https://vimeo.com.evil.example/123",
                "https://facebook.com.evil.example/club/videos/1"}) {
            MyMatchStreamDto s = StreamEmbed.of(link);
            assertThat(s == null || s.embedUrl() == null).as(link).isTrue();
        }
    }

    @Test
    void malformedIdsNeverEmbed() {
        for (String link : new String[] {
                "https://www.youtube.com/watch?v=short", "https://www.youtube.com/watch?v=dQw4w9WgXcQ%22onload%3D1",
                "https://www.youtube.com/watch?v=\"><script>", "https://youtu.be/a/b", "https://www.youtube.com/watch",
                "https://vimeo.com/abc", "https://vimeo.com/1234567890123"}) {
            MyMatchStreamDto s = StreamEmbed.of(link);
            assertThat(s == null || s.embedUrl() == null).as(link).isTrue();
        }
    }

    @Test
    void everyEmbedUrlIsHttpsOnAnAllowListedHost() {
        for (String link : List.of("https://youtu.be/dQw4w9WgXcQ", "https://vimeo.com/42",
                "https://www.facebook.com/a/videos/1", "https://fb.watch/abcd1234/")) {
            URI embed = URI.create(StreamEmbed.of(link).embedUrl());
            assertThat(embed.getScheme()).isEqualTo("https");
            assertThat(embed.getHost()).isIn("www.youtube-nocookie.com", "player.vimeo.com", "www.facebook.com");
        }
    }
}
