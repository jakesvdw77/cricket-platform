package com.cricketlegend.service.support.schedule;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import org.junit.jupiter.api.Test;

/** docs/specs/125: file rows are "Row 14", added rows "New 1", one rule for every message. */
class ScheduleRowsTest {

    @Test
    void fileRowsAreRowsAndAddedRowsAreNew() {
        assertThat(ScheduleRows.label(14)).isEqualTo("Row 14");
        assertThat(ScheduleRows.label(1000)).isEqualTo("Row 1000");
        assertThat(ScheduleRows.label(1001)).isEqualTo("New 1");
        assertThat(ScheduleRows.label(1003)).isEqualTo("New 3");
    }

    @Test
    void anAllFileListReadsAsRowsAndAMixedListNamesEachRow() {
        assertThat(ScheduleRows.labels(List.of(3))).isEqualTo("row 3");
        assertThat(ScheduleRows.labels(List.of(7, 3))).isEqualTo("rows 3 and 7");
        assertThat(ScheduleRows.labels(List.of(3, 7, 9))).isEqualTo("rows 3, 7 and 9");
        assertThat(ScheduleRows.labels(List.of(1001, 3))).isEqualTo("Row 3 and New 1");
        assertThat(ScheduleRows.labels(List.of(3, 1001, 1002))).isEqualTo("Row 3, New 1 and New 2");
        assertThat(ScheduleRows.labels(List.of(1002))).isEqualTo("New 2");
        assertThat(ScheduleRows.labels(List.of(3, 3))).isEqualTo("row 3");
    }
}
