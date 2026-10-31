package com.cricketlegend.service.support;

import com.cricketlegend.exception.ImportFileRejectedException;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.util.Locale;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

/**
 * Decides whether an upload may be read at all (docs/specs/097-import-framework.md, "Hardening"): size, extension
 * ({@code .xlsx} and {@code .csv} only; {@code .xls}, {@code .xlsm}, {@code .xlsb} are named and refused), the file's
 * magic bytes (not only its name), a macro marker and a zip-bomb guard (entry count and total uncompressed size) before
 * POI opens it. Messages are plain and never contain file content.
 */
public final class ImportFileSniffer {

    private static final long MAX_UNCOMPRESSED_BYTES = 50L * 1024 * 1024;
    private static final int MAX_ZIP_ENTRIES = 2_000;
    private static final int CSV_BINARY_PROBE = 8_192;

    private ImportFileSniffer() {
    }

    public static ImportFile sniff(String originalName, byte[] content) {
        if (content == null || content.length == 0) {
            throw new ImportFileRejectedException("The file is empty.");
        }
        if (content.length > ImportLimits.MAX_FILE_BYTES) {
            throw new ImportFileRejectedException("The file is larger than 2 MB. Remove unused sheets or split it.");
        }
        String name = cleanName(originalName);
        String lower = name.toLowerCase(Locale.ROOT);
        ImportFileKind kind;
        if (lower.endsWith(".xlsx")) {
            kind = ImportFileKind.XLSX;
        } else if (lower.endsWith(".csv")) {
            kind = ImportFileKind.CSV;
        } else if (lower.endsWith(".xls") || lower.endsWith(".xlsm") || lower.endsWith(".xlsb")) {
            throw new ImportFileRejectedException(
                    "Only .xlsx and .csv files are accepted. Save your file as .xlsx (Excel workbook) and try again.");
        } else {
            throw new ImportFileRejectedException("Only .xlsx and .csv files are accepted.");
        }
        if (kind == ImportFileKind.XLSX) {
            checkXlsx(content);
        } else {
            checkCsv(content);
        }
        return new ImportFile(name, content, kind);
    }

    private static void checkXlsx(byte[] content) {
        if (!(content.length > 4 && content[0] == 'P' && content[1] == 'K' && content[2] == 3 && content[3] == 4)) {
            throw new ImportFileRejectedException("This is not a valid .xlsx file. Save it as an Excel workbook (.xlsx).");
        }
        boolean workbook = false;
        long total = 0;
        int entries = 0;
        byte[] buffer = new byte[8192];
        try (ZipInputStream zip = new ZipInputStream(new ByteArrayInputStream(content))) {
            ZipEntry entry;
            while ((entry = zip.getNextEntry()) != null) {
                entries++;
                if (entries > MAX_ZIP_ENTRIES) {
                    throw new ImportFileRejectedException("This file cannot be read safely.");
                }
                String entryName = entry.getName().toLowerCase(Locale.ROOT);
                if (entryName.contains("vbaproject")) {
                    throw new ImportFileRejectedException("Files with macros are not accepted. Save a copy without macros as .xlsx.");
                }
                if (entryName.equals("xl/workbook.xml")) {
                    workbook = true;
                }
                int read;
                while ((read = zip.read(buffer)) != -1) {
                    total += read;
                    if (total > MAX_UNCOMPRESSED_BYTES) {
                        throw new ImportFileRejectedException("This file cannot be read safely.");
                    }
                }
            }
        } catch (IOException | RuntimeException ex) {
            if (ex instanceof ImportFileRejectedException rejected) {
                throw rejected;
            }
            throw new ImportFileRejectedException("This file could not be read. Check that it is a valid .xlsx file.");
        }
        if (!workbook) {
            throw new ImportFileRejectedException("This is not an Excel workbook. Save it as .xlsx and try again.");
        }
    }

    private static void checkCsv(byte[] content) {
        boolean zip = content.length > 4 && content[0] == 'P' && content[1] == 'K';
        boolean ole = content.length > 4 && (content[0] & 0xFF) == 0xD0 && (content[1] & 0xFF) == 0xCF;
        if (zip || ole) {
            throw new ImportFileRejectedException("This file is a spreadsheet, not a CSV. Rename it .xlsx or export it as CSV.");
        }
        int probe = Math.min(content.length, CSV_BINARY_PROBE);
        for (int i = 0; i < probe; i++) {
            if (content[i] == 0) {
                throw new ImportFileRejectedException("This does not look like a text CSV file.");
            }
        }
    }

    private static String cleanName(String originalName) {
        String name = originalName == null ? "" : originalName;
        int slash = Math.max(name.lastIndexOf('/'), name.lastIndexOf('\\'));
        name = slash >= 0 ? name.substring(slash + 1) : name;
        name = name.replaceAll("\\p{Cntrl}", "").trim();
        if (name.length() > 255) {
            String ext = name.contains(".") ? name.substring(name.lastIndexOf('.')) : "";
            name = name.substring(0, 255 - ext.length()) + ext;
        }
        return name;
    }
}
