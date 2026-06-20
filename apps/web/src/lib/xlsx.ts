import * as XLSX from 'xlsx';

export interface Sheet {
  name: string;
  rows: Record<string, any>[];
}

/** Excel sheet names: max 31 chars, no : \ / ? * [ ] */
function safeSheetName(name: string): string {
  return name.replace(/[:\\/?*[\]]/g, ' ').slice(0, 31) || 'Sheet';
}

/**
 * Download one or more sheets as a native .xlsx workbook (SheetJS).
 * Pass multiple sheets to e.g. ship a "Summary" + "Data" tab in one file.
 */
export function downloadXLSX(filename: string, sheets: Sheet[]) {
  const wb = XLSX.utils.book_new();
  let added = 0;
  for (const s of sheets) {
    if (!s.rows || s.rows.length === 0) continue;
    const ws = XLSX.utils.json_to_sheet(s.rows);
    // Auto column widths from header + cell lengths.
    const headers = Object.keys(s.rows[0]);
    ws['!cols'] = headers.map((h) => {
      const maxLen = Math.max(
        h.length,
        ...s.rows.map((r) => (r[h] == null ? 0 : String(r[h]).length)),
      );
      return { wch: Math.min(48, Math.max(8, maxLen + 2)) };
    });
    XLSX.utils.book_append_sheet(wb, ws, safeSheetName(s.name));
    added++;
  }
  if (added === 0) return;
  XLSX.writeFile(wb, filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`);
}
