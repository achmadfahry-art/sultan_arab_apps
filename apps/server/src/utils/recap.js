const db = require('../db');

const MONTH_NAMES = [
  '', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

const SHORT_MONTHS = [
  '', 'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
  'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'
];

const DAY_NAMES_SHORT = ['Ahad', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

const DAY_MAP = {
  'ahad': 0, 'minggu': 0,
  'senin': 1,
  'selasa': 2,
  'rabu': 3,
  'kamis': 4,
  'jumat': 5, "jum'at": 5,
  'sabtu': 6
};

/** Mengembalikan tanggal YYYY-MM-DD pada zona waktu Asia/Jakarta. */
function getJakartaDateStr(d = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(d);
}

/** Mengecek apakah YYYY-MM-DD termasuk hari libur rutin atau jadwal libur khusus karyawan. */
function isEmployeeDayOff(dateStr, dayOffName, specificDatesSet = null) {
  if (specificDatesSet && specificDatesSet.has(dateStr)) return true;
  if (!dateStr || !dayOffName) return false;
  const parts = String(dateStr).slice(0, 10).split('-').map(Number);
  if (parts.length !== 3 || !parts[0]) return false;
  const dow = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2])).getUTCDay();
  const targetDow = DAY_MAP[String(dayOffName).toLowerCase().trim()];
  return targetDow !== undefined && dow === targetDow;
}

/** Mengubah Date/string database menjadi string YYYY-MM-DD yang stabil. */
function normalizeDateStr(val) {
  if (!val) return '';
  if (val instanceof Date) return getJakartaDateStr(val);
  return String(val).slice(0, 10);
}

/** Memformat YYYY-MM-DD menjadi "27 Okt 2026". */
function formatIndoDate(dateStr, includeDay = false) {
  if (!dateStr || dateStr.length < 10) return dateStr || '-';
  const [y, m, d] = dateStr.slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return dateStr;
  const base = `${d} ${SHORT_MONTHS[m] || m} ${y}`;
  if (!includeDay) return base;
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return `${DAY_NAMES_SHORT[dow]}, ${base}`;
}

/** Memformat timestamp ke jam HH:mm WIB. */
function formatJakartaTime(ts) {
  if (!ts) return '-';
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(new Date(ts));
}

/** Menghitung rentang cut-off bulanan (tanggal 27 bulan sebelumnya s.d. tanggal 26 bulan target). */
function resolveCutoffPeriod(rawYear, rawMonth, rawPeriod) {
  const todayStr = getJakartaDateStr(new Date());
  const [tYear, tMonth, tDay] = todayStr.split('-').map(Number);

  // Jika hari ini tanggal 27 ke atas, periode berjalan secara kalender adalah bulan berikutnya
  let defaultYear = tYear;
  let defaultMonth = tMonth;
  if (tDay >= 27) {
    defaultMonth = tMonth === 12 ? 1 : tMonth + 1;
    defaultYear = tMonth === 12 ? tYear + 1 : tYear;
  }

  let year = parseInt(rawYear, 10);
  let month = parseInt(rawMonth, 10);

  if (typeof rawMonth === 'string' && rawMonth.includes('-')) {
    const parts = rawMonth.split('-');
    year = parseInt(parts[0], 10);
    month = parseInt(parts[1], 10);
  } else if (typeof rawPeriod === 'string' && rawPeriod.includes('-')) {
    const parts = rawPeriod.split('-');
    year = parseInt(parts[0], 10);
    month = parseInt(parts[1], 10);
  }

  if (isNaN(year)) year = defaultYear;
  if (isNaN(month) || month < 1 || month > 12) month = defaultMonth;

  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  const monthStr = String(month).padStart(2, '0');
  const prevMonthStr = String(prevMonth).padStart(2, '0');

  const startDate = `${prevYear}-${prevMonthStr}-27`;
  const endDate = `${year}-${monthStr}-26`;

  return {
    year,
    month,
    prevYear,
    prevMonth,
    monthName: MONTH_NAMES[month] || `Bulan ${month}`,
    startDate,
    endDate,
    startLabel: formatIndoDate(startDate),
    endLabel: formatIndoDate(endDate),
    todayStr
  };
}

/** Menghasilkan analisa per karyawan dari metrik periode cut-off. */
function buildEmployeeAnalysis({ totalKehadiran, totalTerlambat, totalLembur, workingDaysElapsed, absentElapsedDays, totalJamKerja }) {
  const onTimeCount = Math.max(0, totalKehadiran - totalTerlambat);
  const onTimeRatePct = totalKehadiran > 0 ? Math.round((onTimeCount / totalKehadiran) * 100) : 100;
  const attendanceRatePct = workingDaysElapsed > 0
    ? Math.min(100, Math.round((totalKehadiran / workingDaysElapsed) * 100))
    : 0;
  const avgHoursPerShift = totalKehadiran > 0 ? Number((totalJamKerja / totalKehadiran).toFixed(1)) : 0;

  let analysisLevel = 'normal';
  let analysisNote = 'Belum ada catatan absen pada periode ini.';

  if (totalKehadiran > 0) {
    if (totalTerlambat >= 3 || absentElapsedDays >= 3) {
      analysisLevel = 'attention';
      const reasons = [];
      if (totalTerlambat >= 3) reasons.push(`${totalTerlambat}x terlambat`);
      if (absentElapsedDays >= 3) reasons.push(`${absentElapsedDays} hr belum tercatat`);
      analysisNote = `Perlu perhatian (${reasons.join(', ')})`;
    } else if (totalLembur >= 3 && totalTerlambat <= 1) {
      analysisLevel = 'good';
      analysisNote = `Kontribusi tinggi (${totalLembur} shift lembur, ${onTimeRatePct}% tepat waktu)`;
    } else if (totalTerlambat === 0) {
      analysisLevel = 'good';
      analysisNote = `Disiplin baik (100% tepat waktu, ${totalKehadiran} hr hadir)`;
    } else {
      analysisLevel = 'normal';
      analysisNote = `Stabil (${totalTerlambat}x terlambat, ${onTimeRatePct}% tepat waktu)`;
    }
  } else if (workingDaysElapsed > 0) {
    analysisLevel = 'attention';
    analysisNote = `Belum ada absen (${absentElapsedDays} hr kerja berjalan)`;
  }

  return {
    onTimeCount,
    onTimeRatePct,
    attendanceRatePct,
    avgHoursPerShift,
    analysisLevel,
    analysisNote
  };
}

/** Membangun data rekapitulasi & analisa bulanan (cut-off 27 bulan lalu s.d. 26 bulan ini). */
async function buildMonthlyRecapData({ rawYear, rawMonth, rawPeriod, branchId, user }) {
  const periodInfo = resolveCutoffPeriod(rawYear, rawMonth, rawPeriod);
  const { year, month, prevYear, prevMonth, monthName, startDate, endDate, startLabel, endLabel, todayStr } = periodInfo;

  let empQuery = `
    SELECT e.id as employee_id, e.employee_code, e.name as employee_name, e.job_title,
           COALESCE(e.day_off, 'Ahad') as day_off,
           b.id as branch_id, b.name as branch_name
    FROM employees e
    LEFT JOIN employee_assignments ea ON e.id = ea.employee_id AND ea.is_primary = true
    LEFT JOIN branches b ON ea.branch_id = b.id
    WHERE e.active = true
  `;
  const empParams = [];
  if (branchId) {
    empQuery += ` AND b.id = $1`;
    empParams.push(branchId);
  } else if (user && !user.isOwner && user.accessibleBranchIds && user.accessibleBranchIds.length > 0) {
    empQuery += ` AND b.id = ANY($1)`;
    empParams.push(user.accessibleBranchIds);
  }
  empQuery += ` ORDER BY b.name ASC, e.name ASC`;

  const employeesRes = await db.query(empQuery, empParams);
  const employees = employeesRes.rows;

  const attQuery = `
    SELECT s.id as session_id, s.employee_id, s.work_date, s.status, s.attendance_type, s.is_meal_allowance_eligible,
           COALESCE(s.overtime_hours, 0) as overtime_hours, COALESCE(s.overtime_pay, 0) as overtime_pay, s.overtime_note,
           sh.id as shift_id, sh.name as shift_name, sh.start_time as shift_start, sh.end_time as shift_end,
           MIN(CASE WHEN ev.event_type = 'check_in' THEN ev.server_time END) as check_in_time,
           MAX(CASE WHEN ev.event_type = 'check_out' THEN ev.server_time END) as check_out_time,
           BOOL_AND(ev.is_within_radius) as is_location_valid
    FROM attendance_sessions s
    LEFT JOIN shifts sh ON s.shift_id = sh.id
    LEFT JOIN attendance_events ev ON s.id = ev.session_id
    WHERE s.work_date >= $1 AND s.work_date <= $2
    GROUP BY s.id, sh.id
    ORDER BY s.work_date ASC
  `;
  const attRes = await db.query(attQuery, [startDate, endDate]);
  const allSessions = attRes.rows;

  const daysOffRes = await db.query(
    `SELECT employee_id, off_date FROM days_off WHERE off_date >= $1 AND off_date <= $2`,
    [startDate, endDate]
  );
  const specificDaysOffByEmp = {};
  for (const d of daysOffRes.rows) {
    const dStr = normalizeDateStr(d.off_date);
    if (!specificDaysOffByEmp[d.employee_id]) specificDaysOffByEmp[d.employee_id] = new Set();
    specificDaysOffByEmp[d.employee_id].add(dStr);
  }

  const sessionsByEmp = {};
  for (const s of allSessions) {
    if (!sessionsByEmp[s.employee_id]) sessionsByEmp[s.employee_id] = [];
    sessionsByEmp[s.employee_id].push(s);
  }

  // Bangun daftar tanggal kalender dalam periode cut-off (27..26) sekali saja
  const periodDates = [];
  const curDate = new Date(Date.UTC(prevYear, prevMonth - 1, 27));
  const endDateUtc = new Date(Date.UTC(year, month - 1, 26));
  while (curDate <= endDateUtc) {
    periodDates.push({
      dateStr: curDate.toISOString().slice(0, 10),
      dow: curDate.getUTCDay()
    });
    curDate.setUTCDate(curDate.getUTCDate() + 1);
  }

  const recap = employees.map(emp => {
    const empSessions = sessionsByEmp[emp.employee_id] || [];

    let totalHadirFisik = 0;
    let totalKunjunganLuar = 0;
    let totalLembur = 0;
    let totalOvertimeHours = 0;
    let totalOvertimePay = 0;
    let totalShiftPagi = 0;
    let totalShiftSiang = 0;
    let totalTerlambat = 0;
    let totalUangMakan = 0;
    let totalMenitKerja = 0;
    const attendedDates = new Set();

    const dailyRecords = empSessions.map(s => {
      const workDateStr = normalizeDateStr(s.work_date);
      if (workDateStr) attendedDates.add(workDateStr);

      const isHadir = (s.status === 'present' || s.status === 'late') && (s.attendance_type === 'hadir' || !s.attendance_type);
      const isKunjungan = s.attendance_type === 'kunjungan_luar';
      const overtimeHours = Number(s.overtime_hours || 0);
      const overtimePay = Number(s.overtime_pay || 0);
      const isShiftLembur = Boolean(s.shift_name && /lembur/i.test(s.shift_name));
      const isLembur = overtimeHours > 0 || isShiftLembur;
      const isPagi = Boolean(s.shift_name && /pagi/i.test(s.shift_name));
      const isSiang = Boolean(s.shift_name && /siang/i.test(s.shift_name));

      if (isHadir) totalHadirFisik++;
      if (isKunjungan) totalKunjunganLuar++;
      if (isLembur) totalLembur++;
      totalOvertimeHours += overtimeHours;
      totalOvertimePay += overtimePay;
      if (isPagi) totalShiftPagi++;
      if (isSiang) totalShiftSiang++;
      if (s.status === 'late') totalTerlambat++;
      if (s.is_meal_allowance_eligible && isHadir) totalUangMakan += 10000;

      let durasiMenit = 0;
      const isWorkedStatus = s.status === 'present' || s.status === 'late';
      if (s.check_in_time && s.check_out_time) {
        const diffMs = new Date(s.check_out_time) - new Date(s.check_in_time);
        durasiMenit = Math.max(0, Math.round(diffMs / 60000));
      } else if (isWorkedStatus && isShiftLembur) {
        durasiMenit = 13 * 60;
      } else if (isWorkedStatus && (isPagi || isSiang)) {
        durasiMenit = (9 + overtimeHours) * 60;
      } else if (isWorkedStatus && overtimeHours > 0) {
        durasiMenit = overtimeHours * 60;
      }
      totalMenitKerja += durasiMenit;

      const dateParts = workDateStr ? workDateStr.split('-').map(Number) : [];
      const dayName = dateParts.length === 3
        ? DAY_NAMES_SHORT[new Date(Date.UTC(dateParts[0], dateParts[1] - 1, dateParts[2])).getUTCDay()]
        : '';

      const mealAmount = (s.is_meal_allowance_eligible && isHadir) ? 10000 : 0;

      return {
        session_id: s.session_id,
        date: workDateStr,
        work_date: workDateStr,
        date_formatted: formatIndoDate(workDateStr, true),
        day_name: dayName,
        status: s.status,
        attendance_type: s.attendance_type || 'hadir',
        isKunjungan,
        shift_id: s.shift_id || null,
        shift_name: s.shift_name || '-',
        overtime_hours: overtimeHours,
        overtime_pay: overtimePay,
        overtime_note: s.overtime_note || null,
        is_lembur: isLembur,
        isLembur,
        check_in_time: s.check_in_time,
        check_out_time: s.check_out_time,
        check_in_label: formatJakartaTime(s.check_in_time),
        check_out_label: formatJakartaTime(s.check_out_time),
        uang_makan: mealAmount,
        uangMakan: mealAmount,
        durasi_menit: durasiMenit,
        durasiMenit
      };
    });

    // Hitung total hari libur pada rentang cut-off 27..26
    const targetDayOfWeek = emp.day_off ? DAY_MAP[emp.day_off.toLowerCase().trim()] : 0;
    const empSpecificDaysOff = specificDaysOffByEmp[emp.employee_id] || new Set();
    const dayOffDates = new Set();
    let workingDaysTotal = 0;
    let workingDaysElapsed = 0;
    let absentElapsedDays = 0;

    for (const pd of periodDates) {
      const isWeeklyOff = targetDayOfWeek !== undefined && pd.dow === targetDayOfWeek;
      const isSpecificOff = empSpecificDaysOff.has(pd.dateStr);
      const isOff = isWeeklyOff || isSpecificOff;
      if (isOff) {
        dayOffDates.add(pd.dateStr);
      } else {
        workingDaysTotal++;
        if (pd.dateStr <= todayStr) {
          workingDaysElapsed++;
          if (!attendedDates.has(pd.dateStr)) {
            absentElapsedDays++;
          }
        }
      }
    }

    const totalLibur = dayOffDates.size;
    const totalKehadiran = totalHadirFisik + totalKunjunganLuar;
    const totalJamKerja = Math.round(totalMenitKerja / 60);
    const empAnalysis = buildEmployeeAnalysis({
      totalKehadiran,
      totalTerlambat,
      totalLembur,
      workingDaysElapsed,
      absentElapsedDays,
      totalJamKerja
    });

    return {
      employee_id: emp.employee_id,
      employee_code: emp.employee_code,
      employee_name: emp.employee_name,
      job_title: emp.job_title || 'Staff',
      day_off: emp.day_off || 'Ahad',
      branch_id: emp.branch_id,
      branch_name: emp.branch_name || 'Kantor Pusat',
      total_kehadiran: totalKehadiran,
      total_hadir_fisik: totalHadirFisik,
      total_kunjungan_luar: totalKunjunganLuar,
      total_lembur: totalLembur,
      total_overtime_hours: totalOvertimeHours,
      total_overtime_pay: totalOvertimePay,
      total_shift_pagi: totalShiftPagi,
      total_shift_siang: totalShiftSiang,
      total_terlambat: totalTerlambat,
      total_tepat_waktu: empAnalysis.onTimeCount,
      total_libur: totalLibur,
      total_uang_makan: totalUangMakan,
      total_jam_kerja: totalJamKerja,
      working_days_total: workingDaysTotal,
      working_days_elapsed: workingDaysElapsed,
      absent_elapsed_days: absentElapsedDays,
      on_time_rate_pct: empAnalysis.onTimeRatePct,
      attendance_rate_pct: empAnalysis.attendanceRatePct,
      avg_hours_per_shift: empAnalysis.avgHoursPerShift,
      analysis_level: empAnalysis.analysisLevel,
      analysis_note: empAnalysis.analysisNote,
      daily_records: dailyRecords,
      // CamelCase aliases
      totalHadirFisik,
      totalKunjunganLuar,
      totalLembur,
      totalOvertimeHours,
      totalOvertimePay,
      totalShiftPagi,
      totalShiftSiang,
      totalTerlambat,
      totalTepatWaktu: empAnalysis.onTimeCount,
      totalLibur,
      totalUangMakan,
      totalJamKerja,
      dailyRecords
    };
  });

  const totalHadirFisik = recap.reduce((acc, r) => acc + r.total_hadir_fisik, 0);
  const totalKunjunganLuar = recap.reduce((acc, r) => acc + r.total_kunjungan_luar, 0);
  const totalLembur = recap.reduce((acc, r) => acc + r.total_lembur, 0);
  const totalOvertimeHours = recap.reduce((acc, r) => acc + r.total_overtime_hours, 0);
  const totalOvertimePay = recap.reduce((acc, r) => acc + r.total_overtime_pay, 0);
  const totalShiftPagi = recap.reduce((acc, r) => acc + r.total_shift_pagi, 0);
  const totalShiftSiang = recap.reduce((acc, r) => acc + r.total_shift_siang, 0);
  const totalTerlambat = recap.reduce((acc, r) => acc + r.total_terlambat, 0);
  const totalLibur = recap.reduce((acc, r) => acc + r.total_libur, 0);
  const totalUangMakan = recap.reduce((acc, r) => acc + r.total_uang_makan, 0);
  const totalJamKerja = recap.reduce((acc, r) => acc + r.total_jam_kerja, 0);
  const totalKehadiranAll = totalHadirFisik + totalKunjunganLuar;
  const totalTepatWaktu = Math.max(0, totalKehadiranAll - totalTerlambat);

  const onTimeRatePct = totalKehadiranAll > 0 ? Math.round((totalTepatWaktu / totalKehadiranAll) * 100) : 100;
  const avgHadirPerStaff = recap.length > 0 ? Number((totalKehadiranAll / recap.length).toFixed(1)) : 0;
  const avgJamPerStaff = recap.length > 0 ? Number((totalJamKerja / recap.length).toFixed(1)) : 0;

  const activeAttendees = recap.filter(r => r.total_kehadiran > 0);
  const topHadir = [...activeAttendees].sort((a, b) => b.total_kehadiran - a.total_kehadiran || a.total_terlambat - b.total_terlambat)[0] || null;
  const mostLate = [...recap].filter(r => r.total_terlambat > 0).sort((a, b) => b.total_terlambat - a.total_terlambat)[0] || null;
  const mostOvertime = [...recap].filter(r => r.total_lembur > 0).sort((a, b) => b.total_lembur - a.total_lembur)[0] || null;
  const punctualCount = activeAttendees.filter(r => r.total_terlambat === 0).length;
  const attentionList = recap.filter(r => r.analysis_level === 'attention').map(r => ({
    employee_name: r.employee_name,
    note: r.analysis_note
  }));

  const insights = [];
  insights.push(`Periode cut-off ${startLabel} s.d. ${endLabel} (${periodDates.length} hari kalender): tercatat ${totalKehadiranAll} total presensi (${totalHadirFisik} hadir toko, ${totalKunjunganLuar} kunjungan luar).`);
  if (totalKehadiranAll > 0) {
    insights.push(`Tingkat ketepatan waktu tim mencapai ${onTimeRatePct}% (${totalTepatWaktu} tepat waktu, ${totalTerlambat} terlambat; ${punctualCount} dari ${activeAttendees.length} staf aktif 100% tepat waktu).`);
  } else {
    insights.push('Belum ada data kehadiran yang tercatat pada rentang tanggal periode ini.');
  }
  if (topHadir) {
    insights.push(`Kehadiran tertinggi: ${topHadir.employee_name} (${topHadir.total_kehadiran} hari, ${topHadir.total_jam_kerja} jam kerja).`);
  }
  if (mostLate) {
    insights.push(`Keterlambatan terbanyak: ${mostLate.employee_name} (${mostLate.total_terlambat} kali terlambat).`);
  }
  if (mostOvertime) {
    insights.push(`Shift lembur terbanyak: ${mostOvertime.employee_name} (${mostOvertime.total_lembur} shift lembur).`);
  }
  insights.push(`Distribusi shift periode ini: Shift Pagi ${totalShiftPagi}x, Shift Siang ${totalShiftSiang}x, Lembur ${totalOvertimeHours} jam (${totalLembur} hari, Rp ${totalOvertimePay.toLocaleString('id-ID')}); estimasi total uang makan Rp ${totalUangMakan.toLocaleString('id-ID')}.`);

  const grandTotal = {
    totalKaryawan: recap.length,
    totalEmployees: recap.length,
    grandHadir: totalHadirFisik,
    totalHadirFisik,
    grandKunjungan: totalKunjunganLuar,
    totalKunjunganLuar,
    grandLembur: totalLembur,
    totalLembur,
    totalOvertimeHours,
    totalOvertimePay,
    grandTerlambat: totalTerlambat,
    totalTerlambat,
    totalTepatWaktu,
    grandLibur: totalLibur,
    totalLibur,
    grandUangMakan: totalUangMakan,
    totalUangMakan,
    totalJamKerja
  };

  return {
    success: true,
    period: {
      year,
      month,
      month_name: monthName,
      label: `${monthName} ${year}`,
      cutoff_label: `${startLabel} - ${endLabel}`,
      start_date: startDate,
      startDate,
      end_date: endDate,
      endDate,
      today_str: todayStr,
      todayStr,
      start_label: startLabel,
      end_label: endLabel,
      days_in_month: periodDates.length,
      total_days: periodDates.length
    },
    summary: grandTotal,
    analytics: {
      on_time_rate_pct: onTimeRatePct,
      total_kehadiran: totalKehadiranAll,
      total_tepat_waktu: totalTepatWaktu,
      total_terlambat: totalTerlambat,
      avg_hadir_per_staff: avgHadirPerStaff,
      avg_jam_per_staff: avgJamPerStaff,
      punctual_staff_count: punctualCount,
      active_staff_count: activeAttendees.length,
      shift_breakdown: {
        pagi: totalShiftPagi,
        siang: totalShiftSiang,
        lembur: totalLembur
      },
      top_hadir: topHadir ? { name: topHadir.employee_name, count: topHadir.total_kehadiran, hours: topHadir.total_jam_kerja } : null,
      most_late: mostLate ? { name: mostLate.employee_name, count: mostLate.total_terlambat } : null,
      most_overtime: mostOvertime ? { name: mostOvertime.employee_name, count: mostOvertime.total_lembur } : null,
      attention_list: attentionList,
      insights
    },
    recap
  };
}

module.exports = {
  buildMonthlyRecapData,
  resolveCutoffPeriod,
  getJakartaDateStr,
  normalizeDateStr,
  isEmployeeDayOff
};
