package com.cricketlegend.service.support;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.cricketlegend.domain.ImportRowOrigin;
import com.cricketlegend.dto.ImportDecisionsDto;
import com.cricketlegend.dto.ImportDecisionsDto.RowValues;
import com.cricketlegend.dto.ImportRowDto;
import com.cricketlegend.dto.ImportTypeDto.EditableColumn;
import com.cricketlegend.dto.ImportTypeDto.Kind;
import com.cricketlegend.exception.ValidationException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

/** docs/specs/125: the one place edits and added rows are applied; pure, so no Spring. */
class ImportRowEditorTest {

    private static final List<EditableColumn> COLUMNS = List.of(
            new EditableColumn("date", "Date", Kind.DATE), new EditableColumn("time", "Time", Kind.TIME),
            new EditableColumn("home", "Home", Kind.TEXT));

    private static ImportRowDto fileRow(int number, String date, String time, String home) {
        Map<String, Object> values = new LinkedHashMap<>();
        values.put("date", date);
        values.put("time", time);
        values.put("home", home);
        return new ImportRowDto(number, "Schedule!A" + number, values, null, null, null, List.of(), null);
    }

    private static ImportDecisionsDto decisions(List<RowValues> edits, List<RowValues> added) {
        return new ImportDecisionsDto(null, null, null, null, false, null, null, edits, added);
    }

    private static RowValues values(int row, String... keyValues) {
        Map<String, String> map = new LinkedHashMap<>();
        for (int i = 0; i < keyValues.length; i += 2) {
            map.put(keyValues[i], keyValues[i + 1]);
        }
        return new RowValues(row, map);
    }

    private final List<ImportRowDto> file = List.of(fileRow(2, "2026-09-13", "08:00", "Police 1"),
            fileRow(3, "2026-09-13", "11:00", "Laudium 1"));

    @Test
    void noEditsReturnsTheFileRowsUntouched() {
        List<ImportRowDto> out = ImportRowEditor.apply(file, ImportDecisionsDto.empty(), COLUMNS);
        assertThat(out).isEqualTo(file);
        assertThat(out.get(0).origin()).isEqualTo(ImportRowOrigin.FILE);
    }

    @Test
    void anEditOverlaysTheValueMarksTheRowEditedAndKeepsTheFilesOriginal() {
        List<ImportRowDto> out = ImportRowEditor.apply(file,
                decisions(List.of(values(2, "time", "09:30")), List.of()), COLUMNS);
        ImportRowDto edited = out.get(0);
        assertThat(edited.values()).containsEntry("time", "09:30").containsEntry("home", "Police 1");
        assertThat(edited.origin()).isEqualTo(ImportRowOrigin.EDITED);
        assertThat(edited.fileValues()).containsOnly(Map.entry("time", "08:00"));
        assertThat(edited.rowNumber()).isEqualTo(2);
        assertThat(edited.sourceRef()).isEqualTo("Schedule!A2");
        assertThat(out.get(1)).isEqualTo(file.get(1));
    }

    @Test
    void anEditEqualToTheFilesValueIsDroppedAsANoOp() {
        List<ImportRowDto> out = ImportRowEditor.apply(file,
                decisions(List.of(values(2, "time", "08:00", "home", "Police 1")), List.of()), COLUMNS);
        assertThat(out.get(0)).isEqualTo(file.get(0));
        assertThat(out.get(0).origin()).isEqualTo(ImportRowOrigin.FILE);
        assertThat(out.get(0).fileValues()).isNull();
    }

    @Test
    void onlyTheChangedKeysAreRecordedAsFileValues() {
        ImportRowDto edited = ImportRowEditor.apply(file,
                decisions(List.of(values(2, "time", "08:00", "home", "Police One")), List.of()), COLUMNS).get(0);
        assertThat(edited.fileValues()).containsOnlyKeys("home");
    }

    @Test
    void clearingACellWithNullGivesAnEmptyString() {
        Map<String, String> clear = new LinkedHashMap<>();
        clear.put("home", null);
        ImportRowDto edited = ImportRowEditor.apply(file,
                decisions(List.of(new RowValues(2, clear)), List.of()), COLUMNS).get(0);
        assertThat(edited.values()).containsEntry("home", "");
        assertThat(edited.fileValues()).containsEntry("home", "Police 1");
    }

    @Test
    void addedRowsFollowTheFileRowsInNumberOrderWithEveryColumnPresentAndNoSourceRef() {
        List<ImportRowDto> out = ImportRowEditor.apply(file,
                decisions(List.of(), List.of(values(1002, "home", "B"), values(1001, "date", "2026-09-20"))), COLUMNS);
        assertThat(out).hasSize(4);
        assertThat(out.subList(2, 4)).extracting(ImportRowDto::rowNumber).containsExactly(1001, 1002);
        ImportRowDto added = out.get(2);
        assertThat(added.origin()).isEqualTo(ImportRowOrigin.ADDED);
        assertThat(added.sourceRef()).isNull();
        assertThat(added.values()).containsEntry("date", "2026-09-20").containsEntry("time", "")
                .containsEntry("home", "");
        assertThat(added.fileValues()).isNull();
    }

    @Test
    void validateAcceptsNothingToDoEvenForAnUneditableType() {
        ImportRowEditor.validate(file, ImportDecisionsDto.empty(), List.of());
    }

    @Test
    void anUneditableTypeRejectsEditsAndAddedRows() {
        assertThatThrownBy(() -> ImportRowEditor.validate(file, decisions(List.of(values(2, "time", "09:00")), List.of()), List.of()))
                .isInstanceOf(ValidationException.class).hasMessageContaining("cannot be edited");
        assertThatThrownBy(() -> ImportRowEditor.validate(file, decisions(List.of(), List.of(values(1001))), List.of()))
                .isInstanceOf(ValidationException.class);
    }

    @Test
    void anEditOfAMissingRowIsRejectedWithoutQuotingAValue() {
        assertThatThrownBy(() -> ImportRowEditor.validate(file,
                decisions(List.of(values(9, "time", "secret-value")), List.of()), COLUMNS))
                .isInstanceOf(ValidationException.class)
                .hasMessage("Row 9 does not exist in this import, so it cannot be edited.");
    }

    @Test
    void anEditOfAnAddedRowNumberIsRejectedAsMissing() {
        assertThatThrownBy(() -> ImportRowEditor.validate(file,
                decisions(List.of(values(1001, "time", "09:00")), List.of()), COLUMNS))
                .isInstanceOf(ValidationException.class).hasMessageContaining("New 1 does not exist");
    }

    @Test
    void twoEditsOfOneRowAreRejected() {
        assertThatThrownBy(() -> ImportRowEditor.validate(file,
                decisions(List.of(values(2, "time", "09:00"), values(2, "home", "X")), List.of()), COLUMNS))
                .isInstanceOf(ValidationException.class).hasMessageContaining("more than once");
    }

    @Test
    void anUnknownColumnIsRejected() {
        assertThatThrownBy(() -> ImportRowEditor.validate(file,
                decisions(List.of(values(2, "venue", "X")), List.of()), COLUMNS))
                .isInstanceOf(ValidationException.class).hasMessage("Row 2 has a column that cannot be edited.");
        assertThatThrownBy(() -> ImportRowEditor.validate(file,
                decisions(List.of(), List.of(values(1001, "bogus", "X"))), COLUMNS))
                .isInstanceOf(ValidationException.class).hasMessage("New 1 has a column that cannot be edited.");
    }

    @Test
    void aValueOverTheCellLimitIsRejected() {
        String tooLong = "x".repeat(ImportLimits.MAX_CELL_CHARACTERS + 1);
        assertThatThrownBy(() -> ImportRowEditor.validate(file,
                decisions(List.of(values(2, "home", tooLong)), List.of()), COLUMNS))
                .isInstanceOf(ValidationException.class).hasMessageContaining("longer than 1000");
        ImportRowEditor.validate(file, decisions(List.of(values(2, "home", "x".repeat(1000))), List.of()), COLUMNS);
    }

    @Test
    void addedRowsNumberFromOneThousandAndOneUpwardAndMustBeUnique() {
        assertThatThrownBy(() -> ImportRowEditor.validate(file,
                decisions(List.of(), List.of(values(1000, "home", "X"))), COLUMNS))
                .isInstanceOf(ValidationException.class).hasMessageContaining("numbered from 1001");
        assertThatThrownBy(() -> ImportRowEditor.validate(file,
                decisions(List.of(), List.of(values(1001, "home", "X"), values(1001, "home", "Y"))), COLUMNS))
                .isInstanceOf(ValidationException.class).hasMessageContaining("New 1 is listed more than once");
        ImportRowEditor.validate(file, decisions(List.of(), List.of(values(ImportRowEditor.FIRST_ADDED_ROW, "home", "X"))), COLUMNS);
        assertThat(ImportRowEditor.FIRST_ADDED_ROW).isGreaterThan(ImportLimits.MAX_ROWS);
    }

    @Test
    void theRowCapCountsFileAndAddedRowsTogether() {
        List<ImportRowDto> unique = new ArrayList<>();
        for (int i = 0; i < ImportLimits.MAX_ROWS; i++) {
            unique.add(fileRow(i + 1, "2026-09-13", "08:00", "T" + i));
        }
        assertThatThrownBy(() -> ImportRowEditor.validate(unique,
                decisions(List.of(), List.of(values(1001, "home", "X"))), COLUMNS))
                .isInstanceOf(ValidationException.class).hasMessageContaining("at most 1000 rows");
    }
}
