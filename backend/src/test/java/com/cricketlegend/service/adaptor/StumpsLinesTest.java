package com.cricketlegend.service.adaptor;

import static org.assertj.core.api.Assertions.assertThat;

import com.cricketlegend.service.adaptor.StumpsLines.Line;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

/** The numbered lines of a report: white space of every kind is trimmed and collapsed, blank lines are dropped but counted. */
class StumpsLinesTest {

    @ParameterizedTest
    @ValueSource(strings = {" ", " ", " "})
    void aNoBreakSpaceOfAnyKindIsTrimmedAndCollapsedLikeASpace(String space) {
        List<Line> lines = StumpsLines.ofText(space + "Player" + space + space + "1" + space + "\n" + space + " \t" + space);

        assertThat(lines).extracting(Line::text).containsExactly("Player 1");
    }

    @Test
    void blankLinesAreDroppedButTheNumbersAreOfTheNonBlankLinesOnThePage() {
        List<Line> lines = StumpsLines.ofText("one\n\n  two  \n\f\nthree");

        assertThat(lines).extracting(Line::page, Line::number, Line::text).containsExactly(
                org.assertj.core.groups.Tuple.tuple(1, 1, "one"),
                org.assertj.core.groups.Tuple.tuple(1, 2, "two"),
                org.assertj.core.groups.Tuple.tuple(2, 1, "three"));
    }
}
