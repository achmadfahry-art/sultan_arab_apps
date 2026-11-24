/**
 * Pure Node.js PDF 1.4 generator untuk laporan Rekapitulasi & Analisa Bulanan.
 * Tanpa dependensi eksternal agar ringan dan portabel di server produksi.
 */

function toAscii(str) {
  return String(str ?? '')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/[^\x20-\x7E]/g, ' ');
}

function pdfEscape(str) {
  return toAscii(str).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function truncateText(str, maxLen) {
  const s = toAscii(str).trim();
  if (s.length <= maxLen) return s;
  return s.slice(0, Math.max(1, maxLen - 2)) + '..';
}

function wrapText(str, maxChars) {
  const words = toAscii(str).trim().split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const w of words) {
    const candidate = line ? `${line} ${w}` : w;
    if (candidate.length > maxChars && line) {
      lines.push(line);
      line = w;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines.length > 0 ? lines : [''];
}

function formatRp(num) {
  return 'Rp ' + Number(num || 0).toLocaleString('id-ID');
}

/** Kelas kecil untuk menyusun PDF A4 multi-halaman dengan koordinat top-down. */
class SimplePdfDoc {
  constructor() {
    this.width = 595;
    this.height = 842;
    this.marginX = 36;
    this.marginBottom = 42;
    this.pages = [];
    this.cmds = [];
    this.y = 40;
    this.newPage();
  }

  newPage() {
    if (this.cmds.length > 0) {
      this.pages.push(this.cmds.join('\n'));
    }
    this.cmds = [];
    this.y = 40;
  }

  ensureSpace(neededHeight) {
    if (this.y + neededHeight > this.height - this.marginBottom) {
      this.newPage();
      return true;
    }
    return false;
  }

  py(topY) {
    return (this.height - topY).toFixed(2);
  }

  rect(x, topY, w, h, fillRgb) {
    const [r, g, b] = fillRgb;
    const bottomY = (this.height - (topY + h)).toFixed(2);
    this.cmds.push(`${r} ${g} ${b} rg ${x.toFixed(2)} ${bottomY} ${w.toFixed(2)} ${h.toFixed(2)} re f`);
  }

  hline(topY, x1 = this.marginX, x2 = this.width - this.marginX, rgb = [0.85, 0.87, 0.90], lw = 0.6) {
    const y = this.py(topY);
    this.cmds.push(`q ${lw} w ${rgb[0]} ${rgb[1]} ${rgb[2]} RG ${x1.toFixed(2)} ${y} m ${x2.toFixed(2)} ${y} l S Q`);
  }

  text(str, x, baselineTopY, { size = 9, bold = false, rgb = [0.1, 0.12, 0.16], align = 'left' } = {}) {
    const clean = toAscii(str);
    const font = bold ? 'F2' : 'F1';
    let drawX = x;
    if (align === 'right') {
      const approxWidth = clean.length * size * 0.50;
      drawX = x - approxWidth;
    } else if (align === 'center') {
      const approxWidth = clean.length * size * 0.50;
      drawX = x - approxWidth / 2;
    }
    this.cmds.push(
      `BT /${font} ${size} Tf ${rgb[0]} ${rgb[1]} ${rgb[2]} rg ${drawX.toFixed(2)} ${this.py(baselineTopY)} Td (${pdfEscape(clean)}) Tj ET`
    );
  }

  buildBuffer() {
    if (this.cmds.length > 0) {
      this.pages.push(this.cmds.join('\n'));
      this.cmds = [];
    }

    // Tambahkan nomor halaman pada footer setiap halaman
    const totalPages = this.pages.length;
    const finalizedPages = this.pages.map((stream, i) => {
      const footer = `BT /F1 8 Tf 0.45 0.48 0.54 rg ${this.marginX} 22 Td (SULTAN ARAB APP - Laporan Rekap & Analisa Absensi Bulanan) Tj ET\n`
        + `BT /F1 8 Tf 0.45 0.48 0.54 rg ${this.width - 95} 22 Td (Halaman ${i + 1} / ${totalPages}) Tj ET`;
      return stream + '\n' + footer;
    });

    const objects = [];
    const addObj = (content) => {
      objects.push(content);
      return objects.length;
    };

    const fontRegId = addObj('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
    const fontBoldId = addObj('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>');
    const pagesId = addObj(''); // placeholder
    const pageIds = [];

    for (const stream of finalizedPages) {
      const bufLen = Buffer.byteLength(stream, 'latin1');
      const contentId = addObj(`<< /Length ${bufLen} >>\nstream\n${stream}\nendstream`);
      const pageId = addObj(
        `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${this.width} ${this.height}] `
        + `/Resources << /Font << /F1 ${fontRegId} 0 R /F2 ${fontBoldId} 0 R >> >> /Contents ${contentId} 0 R >>`
      );
      pageIds.push(pageId);
    }

    objects[pagesId - 1] = `<< /Type /Pages /Kids [${pageIds.map(id => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`;
    const catalogId = addObj(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`);

    const chunks = ['%PDF-1.4\n'];
    const offsets = [0];
    let byteCursor = Buffer.byteLength(chunks[0], 'latin1');

    for (let i = 0; i < objects.length; i++) {
      offsets.push(byteCursor);
      const entry = `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
      chunks.push(entry);
      byteCursor += Buffer.byteLength(entry, 'latin1');
    }

    const xrefOffset = byteCursor;
    chunks.push(`xref\n0 ${objects.length + 1}\n`);
    chunks.push('0000000000 65535 f \n');
    for (let i = 1; i <= objects.length; i++) {
      chunks.push(`${String(offsets[i]).padStart(10, '0')} 00000 n \n`);
    }
    chunks.push(`trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`);

    return Buffer.from(chunks.join(''), 'latin1');
  }
}

/** Menghasilkan Buffer PDF laporan Rekapitulasi & Analisa Bulanan lengkap dengan rincian tanggal per karyawan. */
function generateMonthlyRecapPdf(data, branchFilterLabel = 'Semua Cabang') {
  const doc = new SimplePdfDoc();
  const period = data.period || {};
  const summary = data.summary || {};
  const analytics = data.analytics || {};
  const recap = data.recap || [];
  const printedAt = new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date());

  // 1. Header Banner
  doc.rect(36, 30, 523, 52, [0.78, 0.05, 0.05]);
  doc.text('SULTAN ARAB APP - REKAP & ANALISA ABSENSI BULANAN', 48, 50, { size: 13, bold: true, rgb: [1, 1, 1] });
  doc.text(`Periode Cut-off: ${period.cutoff_label || ''} (${period.label || ''}) | Cabang: ${branchFilterLabel}`, 48, 66, { size: 8.5, rgb: [0.99, 0.92, 0.72] });
  doc.text(`Dicetak: ${printedAt} WIB`, 548, 66, { size: 8, align: 'right', rgb: [1, 1, 1] });
  doc.y = 98;

  // 2. Ringkasan KPI
  doc.rect(36, doc.y, 523, 38, [0.97, 0.98, 0.99]);
  const kpiY1 = doc.y + 13;
  const kpiY2 = doc.y + 27;
  doc.text('Total Staf Aktif', 48, kpiY1, { size: 7.5, rgb: [0.4, 0.45, 0.52] });
  doc.text(`${summary.totalEmployees || 0} orang`, 48, kpiY2, { size: 10, bold: true });
  doc.text('Hadir Toko / Kunjungan', 142, kpiY1, { size: 7.5, rgb: [0.4, 0.45, 0.52] });
  doc.text(`${summary.totalHadirFisik || 0} / ${summary.totalKunjunganLuar || 0}`, 142, kpiY2, { size: 10, bold: true });
  doc.text('Lembur / Terlambat', 265, kpiY1, { size: 7.5, rgb: [0.4, 0.45, 0.52] });
  doc.text(`${summary.totalOvertimeHours || 0}j (${formatRp(summary.totalOvertimePay || 0)}) / ${summary.totalTerlambat || 0}x`, 265, kpiY2, { size: 9, bold: true });
  doc.text('Disiplin Tepat Waktu', 370, kpiY1, { size: 7.5, rgb: [0.4, 0.45, 0.52] });
  doc.text(`${analytics.on_time_rate_pct ?? 100}%`, 370, kpiY2, { size: 10, bold: true, rgb: [0.06, 0.5, 0.25] });
  doc.text('Total Uang Makan', 548, kpiY1, { size: 7.5, align: 'right', rgb: [0.4, 0.45, 0.52] });
  doc.text(formatRp(summary.totalUangMakan || 0), 548, kpiY2, { size: 10, bold: true, align: 'right', rgb: [0.78, 0.05, 0.05] });
  doc.y += 50;

  // 3. Analisa Rekap Bulanan
  doc.text('ANALISA REKAPITULASI BULANAN', 36, doc.y, { size: 10, bold: true, rgb: [0.78, 0.05, 0.05] });
  doc.y += 14;
  for (const insight of (analytics.insights || [])) {
    const wrapped = wrapText(`- ${insight}`, 96);
    doc.ensureSpace(wrapped.length * 12 + 4);
    for (const line of wrapped) {
      doc.text(line, 40, doc.y, { size: 8.5, rgb: [0.18, 0.22, 0.28] });
      doc.y += 11.5;
    }
  }
  doc.y += 8;

  // 4. Tabel Ringkasan Per Karyawan
  const drawSummaryHeader = () => {
    doc.rect(36, doc.y, 523, 18, [0.93, 0.95, 0.97]);
    const ty = doc.y + 12;
    doc.text('Karyawan', 42, ty, { size: 8, bold: true });
    doc.text('Cabang', 175, ty, { size: 8, bold: true });
    doc.text('Hadir', 282, ty, { size: 8, bold: true, align: 'right' });
    doc.text('Kunj.', 318, ty, { size: 8, bold: true, align: 'right' });
    doc.text('Lmb', 352, ty, { size: 8, bold: true, align: 'right' });
    doc.text('Telat', 386, ty, { size: 8, bold: true, align: 'right' });
    doc.text('Libur', 422, ty, { size: 8, bold: true, align: 'right' });
    doc.text('Jam', 456, ty, { size: 8, bold: true, align: 'right' });
    doc.text('Uang Makan', 553, ty, { size: 8, bold: true, align: 'right' });
    doc.y += 22;
  };

  doc.ensureSpace(50);
  doc.text('RINGKASAN KEHADIRAN PER KARYAWAN', 36, doc.y, { size: 10, bold: true, rgb: [0.78, 0.05, 0.05] });
  doc.y += 10;
  drawSummaryHeader();

  for (const emp of recap) {
    if (doc.ensureSpace(18)) {
      drawSummaryHeader();
    }
    const ry = doc.y + 8;
    doc.text(truncateText(`${emp.employee_name}`, 25), 42, ry, { size: 8.2, bold: true });
    doc.text(truncateText(emp.branch_name || '-', 17), 175, ry, { size: 7.8, rgb: [0.35, 0.4, 0.48] });
    doc.text(String(emp.total_hadir_fisik || 0), 282, ry, { size: 8.2, align: 'right' });
    doc.text(String(emp.total_kunjungan_luar || 0), 318, ry, { size: 8.2, align: 'right' });
    doc.text(emp.total_overtime_hours > 0 ? `${emp.total_overtime_hours}j` : String(emp.total_lembur || 0), 352, ry, { size: 8.2, align: 'right' });
    doc.text(String(emp.total_terlambat || 0), 386, ry, { size: 8.2, align: 'right' });
    doc.text(String(emp.total_libur || 0), 422, ry, { size: 8.2, align: 'right' });
    doc.text(`${emp.total_jam_kerja || 0}j`, 456, ry, { size: 8.2, align: 'right' });
    doc.text(formatRp(emp.total_uang_makan || 0), 553, ry, { size: 8.2, bold: true, align: 'right' });
    doc.y += 14;
    doc.hline(doc.y);
    doc.y += 3;
  }

  // 5. Rincian Kehadiran Bertanggal Per Karyawan
  doc.y += 12;
  doc.ensureSpace(45);
  doc.text('RINCIAN TANGGAL KEHADIRAN PER KARYAWAN', 36, doc.y, { size: 10, bold: true, rgb: [0.78, 0.05, 0.05] });
  doc.y += 14;

  const drawDetailHeader = () => {
    doc.rect(36, doc.y, 523, 15, [0.94, 0.95, 0.97]);
    const dy = doc.y + 10.5;
    doc.text('Tanggal', 42, dy, { size: 7.5, bold: true });
    doc.text('Shift', 142, dy, { size: 7.5, bold: true });
    doc.text('Tipe', 268, dy, { size: 7.5, bold: true });
    doc.text('Masuk - Pulang', 345, dy, { size: 7.5, bold: true });
    doc.text('Status', 430, dy, { size: 7.5, bold: true });
    doc.text('Durasi', 492, dy, { size: 7.5, bold: true, align: 'right' });
    doc.text('Makan', 553, dy, { size: 7.5, bold: true, align: 'right' });
    doc.y += 18;
  };

  for (const emp of recap) {
    doc.ensureSpace(52);
    doc.rect(36, doc.y, 523, 24, [0.98, 0.96, 0.94]);
    doc.text(`${truncateText(emp.employee_name, 34)} (${emp.employee_code || '-'}) - ${truncateText(emp.branch_name || '-', 22)}`, 42, doc.y + 10, { size: 8.5, bold: true });
    doc.text(`Libur: ${emp.day_off || '-'} | Analisa: ${truncateText(emp.analysis_note || '-', 55)}`, 42, doc.y + 20, { size: 7.5, rgb: [0.35, 0.38, 0.45] });
    doc.y += 28;

    const records = emp.daily_records || [];
    if (records.length === 0) {
      doc.text('- Tidak ada data absensi pada periode cut-off ini.', 44, doc.y + 6, { size: 8, rgb: [0.5, 0.53, 0.58] });
      doc.y += 18;
      continue;
    }

    drawDetailHeader();
    for (const r of records) {
      if (doc.ensureSpace(16)) {
        drawDetailHeader();
      }
      const ry = doc.y + 7;
      const statusText = r.status === 'late' ? 'Terlambat' : 'Tepat Waktu';
      const typeText = r.isKunjungan ? 'Kunjungan' : 'Hadir Toko';
      const hoursText = `${((r.durasiMenit || 0) / 60).toFixed(1)}j`;
      const mealText = r.uangMakan > 0 ? formatRp(r.uangMakan) : '-';

      doc.text(truncateText(r.date_formatted || r.work_date || r.date || '-', 18), 42, ry, { size: 7.6, bold: true });
      doc.text(truncateText(r.shift_name || '-', 24), 142, ry, { size: 7.5 });
      doc.text(typeText, 268, ry, { size: 7.5 });
      doc.text(`${r.check_in_label || '-'} - ${r.check_out_label || '-'}`, 345, ry, { size: 7.5 });
      doc.text(statusText, 430, ry, { size: 7.5, rgb: r.status === 'late' ? [0.75, 0.1, 0.1] : [0.06, 0.5, 0.25] });
      doc.text(hoursText, 492, ry, { size: 7.5, align: 'right' });
      doc.text(mealText, 553, ry, { size: 7.5, align: 'right' });
      doc.y += 12;
      doc.hline(doc.y, 36, 559, [0.91, 0.92, 0.94], 0.4);
      doc.y += 2;
    }
    doc.y += 8;
  }

  return doc.buildBuffer();
}

module.exports = {
  generateMonthlyRecapPdf
};
