import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface PdfMeta {
  /** Report title, e.g. "Visits". */
  title: string;
  /** Optional subtitle line, e.g. "Monthly · Last 30 days". */
  subtitle?: string;
  /** Range / filter chips shown under the title. */
  filters?: { label: string; value: string }[];
  /** KPI strip rendered above the table — limited to ~8 entries. */
  kpis?: { label: string; value: string | number }[];
  /** Free-text user / org name to print in the footer. */
  generatedBy?: string;
  /** Brand line printed bottom-right of every page. */
  brand?: string;
  /**
   * If comparison mode is active, the prior-period totals and
   * computed pct deltas are rendered as a strip under the KPIs.
   */
  comparison?: {
    priorRange?: { from: string; to: string };
    priorTotals?: Record<string, any>;
    deltas?: Record<string, number>;
  };
}

const BRAND_PRIMARY: [number, number, number] = [124, 58, 237]; // #7C3AED (brand-600)
const BRAND_INK: [number, number, number] = [15, 23, 42]; // slate-900
const MUTED: [number, number, number] = [100, 116, 139]; // slate-500
const HAIRLINE: [number, number, number] = [203, 213, 225]; // slate-300

/**
 * Premium PDF: branded header, applied-filters chips, KPI strip, table,
 * footer with page numbers + timestamp + generated-by. Designed to look
 * close to what enterprise tooling (Power BI, Zoho Analytics) ships.
 */
export function downloadPDF(
  filename: string,
  titleOrMeta: string | PdfMeta,
  rows: Record<string, any>[],
) {
  const meta: PdfMeta = typeof titleOrMeta === 'string' ? { title: titleOrMeta } : titleOrMeta;
  const headers = rows.length ? Object.keys(rows[0]) : [];
  const body = rows.map((r) =>
    headers.map((h) => {
      const v = r[h];
      if (v === null || v === undefined) return '';
      if (typeof v === 'object') return JSON.stringify(v);
      return String(v);
    }),
  );

  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const M = 32; // page margin

  // ── Header strip (brand bar) ─────────────────────────────────────
  doc.setFillColor(...BRAND_PRIMARY);
  doc.rect(0, 0, pageW, 4, 'F');

  doc.setTextColor(...BRAND_INK);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(meta.title, M, M + 6);

  if (meta.subtitle) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(...MUTED);
    doc.text(meta.subtitle, M, M + 22);
  }

  // Brand block top-right
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...BRAND_PRIMARY);
  const brand = meta.brand || 'AEGIS';
  doc.text(brand, pageW - M, M + 6, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text('Gem Aromatics Group', pageW - M, M + 18, { align: 'right' });

  let cursorY = M + 38;

  // ── Filters block ────────────────────────────────────────────────
  if (meta.filters?.length) {
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text('APPLIED FILTERS', M, cursorY);
    cursorY += 12;

    doc.setFontSize(9);
    let x = M;
    const chipPad = 6;
    for (const f of meta.filters) {
      const text = `${f.label}: ${f.value}`;
      const w = doc.getTextWidth(text) + chipPad * 2;
      if (x + w > pageW - M) {
        x = M;
        cursorY += 18;
      }
      doc.setFillColor(241, 245, 249);
      doc.setDrawColor(...HAIRLINE);
      doc.roundedRect(x, cursorY - 10, w, 14, 3, 3, 'FD');
      doc.setTextColor(...BRAND_INK);
      doc.text(text, x + chipPad, cursorY);
      x += w + 6;
    }
    cursorY += 14;
  }

  // ── KPI strip ────────────────────────────────────────────────────
  if (meta.kpis?.length) {
    const kpis = meta.kpis.slice(0, 8);
    const cellW = (pageW - 2 * M) / kpis.length;
    doc.setDrawColor(...HAIRLINE);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(M, cursorY, pageW - 2 * M, 44, 4, 4, 'FD');
    for (let i = 0; i < kpis.length; i++) {
      const k = kpis[i];
      const cx = M + cellW * i + cellW / 2;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.setTextColor(...BRAND_INK);
      doc.text(String(k.value), cx, cursorY + 22, { align: 'center' });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(...MUTED);
      doc.text(k.label.toUpperCase(), cx, cursorY + 36, { align: 'center' });
    }
    cursorY += 56;
  }

  // ── Comparison block ────────────────────────────────────────────
  if (meta.comparison && (meta.comparison.priorTotals || meta.comparison.deltas)) {
    const c = meta.comparison;
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    const rangeText = c.priorRange ? ` (${c.priorRange.from} → ${c.priorRange.to})` : '';
    doc.text(`VS PRIOR PERIOD${rangeText}`, M, cursorY);
    cursorY += 12;

    if (c.deltas) {
      doc.setFontSize(9);
      let x = M;
      const chipPad = 6;
      for (const [k, pct] of Object.entries(c.deltas)) {
        const arrow = pct > 0 ? '▲' : pct < 0 ? '▼' : '–';
        const text = `${k.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase()).trim()}: ${arrow} ${Math.abs(pct)}%`;
        const w = doc.getTextWidth(text) + chipPad * 2;
        if (x + w > pageW - M) {
          x = M;
          cursorY += 16;
        }
        // Green if change is positive, red if negative, gray if flat.
        const fill: [number, number, number] = pct > 0 ? [220, 252, 231] : pct < 0 ? [254, 226, 226] : [241, 245, 249];
        const ink: [number, number, number] = pct > 0 ? [21, 128, 61] : pct < 0 ? [185, 28, 28] : MUTED;
        doc.setFillColor(...fill);
        doc.setDrawColor(...HAIRLINE);
        doc.roundedRect(x, cursorY - 9, w, 13, 3, 3, 'FD');
        doc.setTextColor(...ink);
        doc.text(text, x + chipPad, cursorY);
        x += w + 5;
      }
      cursorY += 14;
    }
  }

  // ── Table ────────────────────────────────────────────────────────
  if (rows.length) {
    autoTable(doc, {
      head: [headers.map((h) =>
        h.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase()).trim(),
      )],
      body,
      startY: cursorY,
      styles: { fontSize: 8, cellPadding: 4, overflow: 'linebreak', textColor: BRAND_INK },
      headStyles: { fillColor: BRAND_PRIMARY, textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      margin: { left: M, right: M, bottom: 50 },
      theme: 'grid',
      tableLineColor: HAIRLINE,
      tableLineWidth: 0.5,
    });
  } else {
    doc.setFontSize(11);
    doc.setTextColor(...MUTED);
    doc.text('No rows to display for the selected filters.', pageW / 2, cursorY + 30, { align: 'center' });
  }

  // ── Footer on every page ─────────────────────────────────────────
  const total = (doc as any).getNumberOfPages ? (doc as any).getNumberOfPages() : doc.internal.pages.length - 1;
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    doc.setDrawColor(...HAIRLINE);
    doc.line(M, pageH - 28, pageW - M, pageH - 28);
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    const ts = new Date().toLocaleString();
    const generatedBy = meta.generatedBy ? ` · By ${meta.generatedBy}` : '';
    doc.text(`Generated ${ts}${generatedBy} · ${rows.length} rows`, M, pageH - 14);
    doc.text(`${brand} · Page ${p} of ${total}`, pageW - M, pageH - 14, { align: 'right' });
  }

  doc.save(filename);
}
