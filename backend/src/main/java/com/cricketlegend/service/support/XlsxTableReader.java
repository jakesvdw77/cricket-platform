package com.cricketlegend.service.support;

import com.cricketlegend.exception.ImportFileRejectedException;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellType;
import org.apache.poi.ss.usermodel.DateUtil;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.ss.util.CellReference;
import org.apache.poi.openxml4j.util.ZipSecureFile;
import org.apache.poi.util.IOUtils;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;

/**
 * The one {@code .xlsx} reader every import handler uses (docs/specs/097-import-framework.md, "Parsing"): the data
 * sheet's header row (aliases, case-insensitive), data rows with every cell read by its type to trimmed text, a formula's
 * cached result and never the formula, fully blank rows dropped, merged cells refused, and the hidden {@code _meta} sheet
 * read as key and value. Dates and times come out as {@code yyyy-MM-dd}, {@code HH:mm} or {@code yyyy-MM-dd'T'HH:mm}.
 * POI's {@link ZipSecureFile} limits are on; external entities are off by POI's default; nothing is evaluated.
 * Problems with the file are {@link ImportFileRejectedException}s that never contain cell content.
 */
public final class XlsxTableReader {

    public static final String META_SHEET = "_meta";

    private static final DateTimeFormatter DATE = DateTimeFormatter.ISO_LOCAL_DATE;
    private static final DateTimeFormatter TIME = DateTimeFormatter.ofPattern("HH:mm");
    private static final DateTimeFormatter DATE_TIME = DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm");

    static {
        ZipSecureFile.setMinInflateRatio(0.01);
        ZipSecureFile.setMaxEntrySize(20L * 1024 * 1024);
        ZipSecureFile.setMaxTextSize(5L * 1024 * 1024);
        IOUtils.setByteArrayMaxOverride(20 * 1024 * 1024);
    }

    private XlsxTableReader() {
    }

    /**
     * @param dataSheetName the preferred data sheet (matched case-insensitively), or null for the first visible sheet
     * @param columnAliases canonical column name to the other spellings accepted for it
     */
    public static TableData read(byte[] content, String dataSheetName, Map<String, List<String>> columnAliases) {
        try (XSSFWorkbook workbook = new XSSFWorkbook(new ByteArrayInputStream(content))) {
            Map<String, String> meta = readMeta(workbook);
            Sheet sheet = pickSheet(workbook, dataSheetName);
            if (sheet.getNumMergedRegions() > 0) {
                throw new ImportFileRejectedException(
                        "Merged cells are not supported. Unmerge them so every row is one record, then upload again.");
            }
            return readSheet(sheet, workbook.isDate1904(), new TableHeaders(columnAliases), meta);
        } catch (ImportFileRejectedException ex) {
            throw ex;
        } catch (IOException | RuntimeException ex) {
            throw new ImportFileRejectedException("The Excel file could not be read. Check it is a valid .xlsx file.");
        }
    }

    /** Only the hidden {@code _meta} entries, for a handler that must check the template before reading rows. */
    public static Map<String, String> readMetaOnly(byte[] content) {
        try (XSSFWorkbook workbook = new XSSFWorkbook(new ByteArrayInputStream(content))) {
            return readMeta(workbook);
        } catch (IOException | RuntimeException ex) {
            throw new ImportFileRejectedException("The Excel file could not be read. Check it is a valid .xlsx file.");
        }
    }

    private static Sheet pickSheet(Workbook workbook, String dataSheetName) {
        if (dataSheetName != null) {
            for (int i = 0; i < workbook.getNumberOfSheets(); i++) {
                if (workbook.getSheetName(i).equalsIgnoreCase(dataSheetName) && !workbook.isSheetHidden(i)) {
                    return workbook.getSheetAt(i);
                }
            }
        }
        for (int i = 0; i < workbook.getNumberOfSheets(); i++) {
            if (!workbook.isSheetHidden(i) && !workbook.isSheetVeryHidden(i)
                    && !META_SHEET.equalsIgnoreCase(workbook.getSheetName(i))) {
                return workbook.getSheetAt(i);
            }
        }
        throw new ImportFileRejectedException("The workbook has no visible sheet with data.");
    }

    private static Map<String, String> readMeta(Workbook workbook) {
        Map<String, String> meta = new LinkedHashMap<>();
        Sheet sheet = workbook.getSheet(META_SHEET);
        if (sheet == null) {
            return meta;
        }
        List<String> ignored = new ArrayList<>();
        boolean date1904 = workbook instanceof XSSFWorkbook x && x.isDate1904();
        for (Row row : sheet) {
            String first = cellText(row.getCell(0), date1904, ignored, "");
            String second = cellText(row.getCell(1), date1904, ignored, "");
            if (!second.isEmpty() && !first.isEmpty()) {
                meta.put(first, second);
            } else if (first.contains("=")) {
                int eq = first.indexOf('=');
                meta.put(first.substring(0, eq).trim(), first.substring(eq + 1).trim());
            }
        }
        return meta;
    }

    private static TableData readSheet(Sheet sheet, boolean date1904, TableHeaders headers, Map<String, String> meta) {
        List<String> warnings = new ArrayList<>();
        Row headerRow = null;
        int headerIndex = -1;
        for (int r = sheet.getFirstRowNum(); r <= sheet.getLastRowNum(); r++) {
            Row row = sheet.getRow(r);
            if (row != null && !isBlank(row, date1904)) {
                headerRow = row;
                headerIndex = r;
                break;
            }
        }
        if (headerRow == null) {
            throw new ImportFileRejectedException("The sheet is empty: the header row was not found.");
        }
        Map<Integer, String> columnByIndex = new LinkedHashMap<>();
        List<String> found = new ArrayList<>();
        List<String> unknown = new ArrayList<>();
        Map<String, Integer> seen = TableHeaders.newSeen();
        for (Cell cell : headerRow) {
            String text = cellText(cell, date1904, warnings, "");
            if (text.isEmpty()) {
                continue;
            }
            String canonical = headers.canonical(text);
            if (canonical == null) {
                unknown.add(text);
                continue;
            }
            TableHeaders.rejectDuplicate(seen, canonical);
            seen.put(canonical, cell.getColumnIndex());
            columnByIndex.put(cell.getColumnIndex(), canonical);
            found.add(canonical);
        }
        List<TableRow> rows = new ArrayList<>();
        String sheetName = sheet.getSheetName();
        for (int r = headerIndex + 1; r <= sheet.getLastRowNum(); r++) {
            Row row = sheet.getRow(r);
            if (row == null || isBlank(row, date1904)) {
                continue;
            }
            Map<String, String> values = new LinkedHashMap<>();
            Map<String, String> refs = new LinkedHashMap<>();
            String firstRef = null;
            for (Map.Entry<Integer, String> column : columnByIndex.entrySet()) {
                Cell cell = row.getCell(column.getKey());
                String ref = sheetName + "!" + new CellReference(r, column.getKey()).formatAsString();
                String text = cellText(cell, date1904, warnings, ref);
                values.put(column.getValue(), text);
                refs.put(column.getValue(), ref);
                if (firstRef == null && !text.isEmpty()) {
                    firstRef = ref;
                }
            }
            if (rows.size() >= ImportLimits.MAX_ROWS) {
                throw new ImportFileRejectedException("The file has more than 1,000 data rows. Split it into smaller files.");
            }
            rows.add(new TableRow(r + 1, firstRef == null ? sheetName + "!A" + (r + 1) : firstRef, values, refs));
        }
        return new TableData(found, unknown, rows, meta, warnings);
    }

    private static boolean isBlank(Row row, boolean date1904) {
        List<String> ignored = new ArrayList<>();
        for (Cell cell : row) {
            if (!cellText(cell, date1904, ignored, "").isEmpty()) {
                return false;
            }
        }
        return true;
    }

    private static String cellText(Cell cell, boolean date1904, List<String> warnings, String ref) {
        if (cell == null) {
            return "";
        }
        CellType type = cell.getCellType() == CellType.FORMULA ? cell.getCachedFormulaResultType() : cell.getCellType();
        String text;
        switch (type) {
            case STRING -> text = cell.getStringCellValue();
            case NUMERIC -> text = numeric(cell, date1904);
            case BOOLEAN -> text = Boolean.toString(cell.getBooleanCellValue());
            default -> text = "";
        }
        text = text == null ? "" : text.trim();
        if (text.length() > ImportLimits.MAX_CELL_CHARACTERS) {
            text = text.substring(0, ImportLimits.MAX_CELL_CHARACTERS);
            warnings.add((ref.isEmpty() ? "A cell" : "Cell " + ref) + " was longer than 1,000 characters and was cut short.");
        }
        return text;
    }

    private static String numeric(Cell cell, boolean date1904) {
        double value = cell.getNumericCellValue();
        if (DateUtil.isCellDateFormatted(cell) && DateUtil.isValidExcelDate(value)) {
            if (value >= 0 && value < 1) {
                long seconds = Math.round(value * 86_400d) % 86_400L;
                return LocalTime.ofSecondOfDay(seconds).format(TIME);
            }
            LocalDateTime dateTime = DateUtil.getLocalDateTime(value, date1904);
            if (dateTime.toLocalTime().equals(LocalTime.MIDNIGHT)) {
                return LocalDate.from(dateTime).format(DATE);
            }
            return dateTime.format(DATE_TIME);
        }
        BigDecimal number = BigDecimal.valueOf(value).stripTrailingZeros();
        return number.scale() < 0 ? number.setScale(0).toPlainString() : number.toPlainString();
    }
}
