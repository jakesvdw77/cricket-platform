package com.cricketlegend.service.support;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.util.List;
import java.util.Map;
import org.apache.poi.ss.usermodel.CellStyle;
import org.apache.poi.ss.usermodel.DataValidation;
import org.apache.poi.ss.usermodel.DataValidationConstraint;
import org.apache.poi.ss.usermodel.DataValidationHelper;
import org.apache.poi.ss.usermodel.DataValidation.ErrorStyle;
import org.apache.poi.ss.usermodel.DataValidationConstraint.OperatorType;
import org.apache.poi.ss.usermodel.Font;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.SheetVisibility;
import org.apache.poi.ss.util.CellRangeAddressList;
import org.apache.poi.ss.util.CellReference;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;

/**
 * Workbook helpers for a handler's template (docs/specs/097-import-framework.md, "Generation"): the data sheet (bold
 * header, frozen), an Instructions sheet with an example row, a Lookups sheet, warn-only list validation (an unknown
 * name can still be typed and then resolved) and the hidden {@code _meta} sheet. The framework itself builds no real
 * template; handlers call this. Values are always written as text, never as formulas.
 */
public final class XlsxTemplateWriter {

    private static final int MAX_SHEET_NAME = 31;

    private final XSSFWorkbook workbook = new XSSFWorkbook();
    private final CellStyle headerStyle;

    private XlsxTemplateWriter() {
        Font bold = workbook.createFont();
        bold.setBold(true);
        headerStyle = workbook.createCellStyle();
        headerStyle.setFont(bold);
    }

    public static XlsxTemplateWriter create() {
        return new XlsxTemplateWriter();
    }

    /** The data sheet: put it first. */
    public XlsxTemplateWriter dataSheet(String name, List<String> headers) {
        Sheet sheet = workbook.createSheet(safeName(name));
        Row row = sheet.createRow(0);
        for (int i = 0; i < headers.size(); i++) {
            row.createCell(i).setCellValue(headers.get(i));
            row.getCell(i).setCellStyle(headerStyle);
            sheet.setColumnWidth(i, 22 * 256);
        }
        sheet.createFreezePane(0, 1);
        return this;
    }

    /**
     * Formats {@code dataColumn} of the data sheet (rows 2 to {@code lastRow}) with a date pattern such as {@code
     * yyyy-mm-dd}, so a date typed or pasted there is a real date cell. Values stay text elsewhere.
     */
    public XlsxTemplateWriter dateColumn(String dataSheetName, int dataColumn, int lastRow, String pattern) {
        Sheet sheet = workbook.getSheet(safeName(dataSheetName));
        CellStyle style = workbook.createCellStyle();
        style.setDataFormat(workbook.createDataFormat().getFormat(pattern));
        sheet.setDefaultColumnStyle(dataColumn, style);
        return this;
    }

    /**
     * A warn-only DATE validation on {@code dataColumn} (rows 2 to {@code lastRow}, between 2000-01-01 and 2100-12-31)
     * with an informational prompt, so Excel treats the cells as dates and offers its date handling. A value that is not
     * a date only warns; it can still be typed and is read by the importer.
     */
    public XlsxTemplateWriter warnOnlyDate(String dataSheetName, int dataColumn, int lastRow, String prompt) {
        Sheet sheet = workbook.getSheet(safeName(dataSheetName));
        DataValidationHelper helper = sheet.getDataValidationHelper();
        DataValidationConstraint constraint =
                helper.createDateConstraint(OperatorType.BETWEEN, "DATE(2000,1,1)", "DATE(2100,12,31)", null);
        return addWarnOnly(sheet, helper, constraint, dataColumn, lastRow, prompt,
                "That does not look like a date. It can still be used; it is checked in the next step.");
    }

    /** Formats {@code dataColumn} (rows 2 to {@code lastRow}) with a time pattern such as {@code hh:mm}. */
    public XlsxTemplateWriter timeColumn(String dataSheetName, int dataColumn, int lastRow, String pattern) {
        return dateColumn(dataSheetName, dataColumn, lastRow, pattern);
    }

    /** A warn-only time validation (a day fraction from 0 to 0.99999) with an informational prompt. */
    public XlsxTemplateWriter warnOnlyTime(String dataSheetName, int dataColumn, int lastRow, String prompt) {
        Sheet sheet = workbook.getSheet(safeName(dataSheetName));
        DataValidationHelper helper = sheet.getDataValidationHelper();
        DataValidationConstraint constraint = helper.createDecimalConstraint(OperatorType.BETWEEN, "0", "0.99999");
        return addWarnOnly(sheet, helper, constraint, dataColumn, lastRow, prompt,
                "That does not look like a time. It can still be used; it is checked in the next step.");
    }

    private XlsxTemplateWriter addWarnOnly(Sheet sheet, DataValidationHelper helper, DataValidationConstraint constraint,
            int dataColumn, int lastRow, String prompt, String warning) {
        DataValidation validation =
                helper.createValidation(constraint, new CellRangeAddressList(1, lastRow, dataColumn, dataColumn));
        validation.setErrorStyle(ErrorStyle.WARNING);
        validation.setShowErrorBox(true);
        validation.createErrorBox("Check this value", warning);
        validation.setShowPromptBox(true);
        validation.createPromptBox("", prompt);
        sheet.addValidationData(validation);
        return this;
    }

    /** Purpose paragraphs, then a worked example row under its header. */
    public XlsxTemplateWriter instructions(
            String name, List<String> paragraphs, List<String> exampleHeaders, List<String> exampleValues) {
        Sheet sheet = workbook.createSheet(safeName(name));
        sheet.setColumnWidth(0, 110 * 256);
        int r = 0;
        for (String paragraph : paragraphs) {
            sheet.createRow(r++).createCell(0).setCellValue(paragraph);
        }
        if (!exampleHeaders.isEmpty()) {
            r++;
            sheet.createRow(r++).createCell(0).setCellValue("Example row");
            Row header = sheet.createRow(r++);
            Row values = sheet.createRow(r);
            for (int i = 0; i < exampleHeaders.size(); i++) {
                header.createCell(i).setCellValue(exampleHeaders.get(i));
                header.getCell(i).setCellStyle(headerStyle);
                values.createCell(i).setCellValue(i < exampleValues.size() ? exampleValues.get(i) : "");
            }
        }
        return this;
    }

    /** One column per entry, header in row 1, values below. Returns the number of values per column for ranges. */
    public XlsxTemplateWriter lookups(String name, Map<String, List<String>> columns) {
        Sheet sheet = workbook.createSheet(safeName(name));
        int c = 0;
        for (Map.Entry<String, List<String>> column : columns.entrySet()) {
            Row header = sheet.getRow(0) == null ? sheet.createRow(0) : sheet.getRow(0);
            header.createCell(c).setCellValue(column.getKey());
            header.getCell(c).setCellStyle(headerStyle);
            sheet.setColumnWidth(c, 30 * 256);
            int r = 1;
            for (String value : column.getValue()) {
                Row row = sheet.getRow(r) == null ? sheet.createRow(r) : sheet.getRow(r);
                row.createCell(c).setCellValue(value);
                r++;
            }
            c++;
        }
        return this;
    }

    /**
     * A drop-down on {@code dataColumn} of the data sheet (rows 2 to {@code lastRow}) listing the lookup column's
     * {@code valueCount} values. The error style is WARNING so an unknown name can still be typed. No-op for no values.
     */
    public XlsxTemplateWriter warnOnlyList(
            String dataSheetName, int dataColumn, int lastRow, String lookupSheetName, int lookupColumn, int valueCount) {
        if (valueCount <= 0) {
            return this;
        }
        Sheet sheet = workbook.getSheet(safeName(dataSheetName));
        DataValidationHelper helper = sheet.getDataValidationHelper();
        String column = CellReference.convertNumToColString(lookupColumn);
        String range = "'" + safeName(lookupSheetName) + "'!$" + column + "$2:$" + column + "$" + (valueCount + 1);
        DataValidationConstraint constraint = helper.createFormulaListConstraint(range);
        DataValidation validation = helper.createValidation(constraint, new CellRangeAddressList(1, lastRow, dataColumn, dataColumn));
        validation.setErrorStyle(DataValidation.ErrorStyle.WARNING);
        validation.setShowErrorBox(true);
        validation.setSuppressDropDownArrow(true);
        sheet.addValidationData(validation);
        return this;
    }

    /** The hidden {@code _meta} sheet: key in column A, value in column B. */
    public XlsxTemplateWriter meta(Map<String, String> entries) {
        Sheet sheet = workbook.createSheet(XlsxTableReader.META_SHEET);
        int r = 0;
        for (Map.Entry<String, String> entry : entries.entrySet()) {
            Row row = sheet.createRow(r++);
            row.createCell(0).setCellValue(entry.getKey());
            row.createCell(1).setCellValue(entry.getValue());
        }
        workbook.setSheetVisibility(workbook.getSheetIndex(sheet), SheetVisibility.HIDDEN);
        return this;
    }

    public byte[] toBytes() {
        try (workbook; ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            workbook.write(out);
            return out.toByteArray();
        } catch (IOException ex) {
            throw new UncheckedIOException(ex);
        }
    }

    private static String safeName(String name) {
        String cleaned = name.replaceAll("[\\\\/?*\\[\\]:]", " ").trim();
        return cleaned.length() > MAX_SHEET_NAME ? cleaned.substring(0, MAX_SHEET_NAME) : cleaned;
    }
}
