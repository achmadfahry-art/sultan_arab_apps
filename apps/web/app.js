/**
 * SULTAN ARAB APP — Frontend Application (Single Page Application)
 * Mendukung tampilan Ponsel dan PC secara responsif.
 * Diperbarui dengan keputusan bisnis Q01 - Q11:
 * - Cabang: HQ Bekasi & Cabang Cikarang
 * - Shift: Staff & Admin (Non-Shift 08-17), Crew Toko (Pagi 08-17, Siang 12:00-21), Toleransi 15 Menit
 * - Aturan Absen: Wajib hanya masuk, pulang tidak wajib
 * - Uang Makan: Rp10.000 saat hadir toko; tombol Kunjungan Luar tidak dapat uang makan
 * - Manager PDF Payslip Upload per anggota staf
 * - Integrasi WhatsApp reminder
 */

const state = {
  user: null,
  route: window.location.hash || '#home',
  branches: [],
  shifts: [],
  todaySession: null,
  attendanceHistory: [],
  myPayslips: [],
  uploadedSlips: [],
  activeManagementTab: 'monitoring',
  recapMonth: new Date().getMonth() + 1,
  recapYear: new Date().getFullYear(),
  recapBranchId: '',
  recapData: null,
  payslipViewMode: 'staff', // 'me' atau 'staff' (Q06)
  clockInterval: null,
  cameraStream: null,
  capturedPhotoBase64: null,
  attendanceType: 'hadir', // 'hadir' atau 'kunjungan_luar' (Q05)
  selectedShiftId: null,
  currentGps: { lat: null, lon: null, accuracy: null, distance: null, isWithinRadius: false }
};

// --- System SVG Icons (Enterprise Lucide / Heroicons Standard) ---
function uiIcon(name, extraClass = '', size = 18) {
  const icons = {
    home: `<svg class="ui-icon ${extraClass}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`,
    camera: `<svg class="ui-icon ${extraClass}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>`,
    calendar: `<svg class="ui-icon ${extraClass}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>`,
    'file-text': `<svg class="ui-icon ${extraClass}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" x2="8" y1="13" y2="13"/><line x1="16" x2="8" y1="17" y2="17"/><line x1="10" x2="8" y1="9" y2="9"/></svg>`,
    chart: `<svg class="ui-icon ${extraClass}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" x2="18" y1="20" y2="10"/><line x1="12" x2="12" y1="20" y2="4"/><line x1="6" x2="6" y1="20" y2="14"/></svg>`,
    key: `<svg class="ui-icon ${extraClass}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6"/><path d="m15.5 7.5 3 3L22 7l-2-2"/></svg>`,
    users: `<svg class="ui-icon ${extraClass}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
    building: `<svg class="ui-icon ${extraClass}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="16" height="20" x="4" y="2" rx="2" ry="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01"/><path d="M16 6h.01"/><path d="M12 6h.01"/><path d="M12 10h.01"/><path d="M12 14h.01"/><path d="M16 10h.01"/><path d="M16 14h.01"/><path d="M8 10h.01"/><path d="M8 14h.01"/></svg>`,
    car: `<svg class="ui-icon ${extraClass}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/></svg>`,
    clock: `<svg class="ui-icon ${extraClass}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
    'map-pin': `<svg class="ui-icon ${extraClass}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>`,
    zap: `<svg class="ui-icon ${extraClass}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`,
    check: `<svg class="ui-icon ${extraClass}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
    'check-circle': `<svg class="ui-icon ${extraClass}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
    'alert-circle': `<svg class="ui-icon ${extraClass}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>`,
    refresh: `<svg class="ui-icon ${extraClass}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg>`,
    search: `<svg class="ui-icon ${extraClass}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" x2="16.65" y1="21" y2="16.65"/></svg>`,
    printer: `<svg class="ui-icon ${extraClass}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect width="12" height="8" x="6" y="14"/></svg>`,
    plus: `<svg class="ui-icon ${extraClass}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" x2="12" y1="5" y2="19"/><line x1="5" x2="19" y1="12" y2="12"/></svg>`,
    edit: `<svg class="ui-icon ${extraClass}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>`,
    upload: `<svg class="ui-icon ${extraClass}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>`,
    download: `<svg class="ui-icon ${extraClass}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>`,
    dollar: `<svg class="ui-icon ${extraClass}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" x2="12" y1="2" y2="22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>`,
    close: `<svg class="ui-icon ${extraClass}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" x2="6" y1="6" y2="18"/><line x1="6" x2="18" y1="6" y2="18"/></svg>`,
    eye: `<svg class="ui-icon ${extraClass}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>`,
    eyeOff: `<svg class="ui-icon ${extraClass}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" x2="22" y1="2" y2="22"/></svg>`,
    smartphone: `<svg class="ui-icon ${extraClass}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="20" x="5" y="2" rx="2" ry="2"/><line x1="12" x2="12.01" y1="18" y2="18"/></svg>`,
    folder: `<svg class="ui-icon ${extraClass}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/></svg>`,
    logout: `<svg class="ui-icon ${extraClass}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></svg>`,
    shield: `<svg class="ui-icon ${extraClass}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
    palmtree: `<svg class="ui-icon ${extraClass}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 8c0-2.76-2.46-5-5.5-5S2 5.24 2 8h11Z"/><path d="M13 7.14A5.82 5.82 0 0 1 16.5 6c3.04 0 5.5 2.24 5.5 5h-11"/><path d="M5.8 15.5c1.5 1.5 3.2 2.5 5.2 3.1V22"/><path d="M11 22v-6.5a6.5 6.5 0 0 1 2-4.5"/></svg>`,
    crown: `<svg class="ui-icon ${extraClass}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m2 4 3 12h14l3-12-6 7-4-7-4 7-6-7zm3 16h14"/></svg>`,
    phone: `<svg class="ui-icon ${extraClass}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>`,
    external: `<svg class="ui-icon ${extraClass}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" x2="21" y1="14" y2="3"/></svg>`,
    settings: `<svg class="ui-icon ${extraClass}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>`
  };
  return icons[name] || '';
}

// --- HTTP Client Helper ---
async function api(path, options = {}) {
  options.headers = options.headers || {};
  if (!(options.body instanceof FormData)) {
    options.headers['Content-Type'] = 'application/json';
  }
  options.credentials = 'include';

  try {
    const res = await fetch(path, options);
    const json = await res.json();
    return { ok: res.ok, status: res.status, data: json };
  } catch (err) {
    console.error('[API Fetch Error]', err);
    return { ok: false, status: 0, data: { success: false, error: 'Gagal terhubung ke server aplikasi.' } };
  }
}

// --- Toast Notification ---
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.style.padding = '12px 18px';
  toast.style.borderRadius = '8px';
  toast.style.fontSize = '0.9rem';
  toast.style.fontWeight = '600';
  toast.style.color = '#FFFFFF';
  toast.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
  toast.style.transition = 'all 0.3s ease';

  if (type === 'success') toast.style.backgroundColor = '#137333';
  else if (type === 'error') toast.style.backgroundColor = '#C90000';
  else if (type === 'warning') toast.style.backgroundColor = '#B06000';
  else toast.style.backgroundColor = '#202124';

  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// --- Digital Clock ---
function startClock() {
  if (state.clockInterval) clearInterval(state.clockInterval);
  const update = () => {
    const clockEl = document.getElementById('live-digital-clock');
    const dateEl = document.getElementById('live-digital-date');
    if (clockEl) {
      const now = new Date();
      clockEl.textContent = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      if (dateEl) {
        dateEl.textContent = now.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
      }
    }
  };
  update();
  state.clockInterval = setInterval(update, 1000);
}

// --- Router & Init ---
async function initApp() {
  window.addEventListener('hashchange', () => {
    let hash = window.location.hash || '#home';
    if (hash === '#upload-slip') {
      state.route = '#management';
      state.activeManagementTab = 'payroll';
    } else {
      state.route = hash;
    }
    render();
  });

  const meRes = await api('/api/v1/auth/me');
  if (meRes.ok && meRes.data.success && meRes.data.user) {
    state.user = meRes.data.user;
    await loadInitialData();
  } else {
    state.user = null;
    state.route = '#login';
  }

  render();
}

async function loadInitialData() {
  if (!state.user) return;
  const [bRes, aRes, sRes] = await Promise.all([
    api('/api/v1/branches'),
    api('/api/v1/attendance/me'),
    api('/api/v1/schedules/shifts')
  ]);
  if (bRes.ok && bRes.data.branches) state.branches = bRes.data.branches;
  if (sRes.ok && sRes.data.shifts) state.shifts = sRes.data.shifts;
  if (aRes.ok && aRes.data) {
    state.todaySession = aRes.data.todaySession;
    state.attendanceHistory = aRes.data.history || [];
  }
}

// --- Main Render Function ---
function render() {
  stopCamera();
  const root = document.getElementById('app-root');
  if (!root) return;

  if (!state.user || state.route === '#login') {
    root.innerHTML = renderLogin();
    attachLoginEvents();
    return;
  }

  root.innerHTML = `
    <div class="app-shell">
      ${renderSidebar()}
      <div class="app-main">
        ${renderHeader()}
        <main class="content-container">
          ${renderMainContent()}
        </main>
      </div>
    </div>
    ${renderBottomNav()}
  `;

  attachShellEvents();
  attachViewEvents();
  startClock();
}

// --- VIEW 1: LOGIN SCREEN ---
function renderLogin() {
  return `
    <div class="login-view">
      <div class="login-card">
        <div class="login-brand-header">
          <img src="/assets/logo_sultan_arab.jpg" alt="Logo Sultan Arab" class="login-logo" onerror="this.style.display='none'">
          <h1 class="login-title">SULTAN ARAB</h1>
          <p class="login-subtitle">Absensi &amp; Payroll Multi-Cabang</p>
        </div>
        <div class="login-body">
          <form id="login-form">
            <div class="form-group">
              <label class="form-label" for="login-username">Username / Akun</label>
              <input type="text" id="login-username" class="form-control" placeholder="Masukkan username" autocomplete="username" autocapitalize="none" required autofocus>
            </div>
            <div class="form-group">
              <label class="form-label" for="login-password">Password</label>
              <div style="position: relative;">
                <input type="password" id="login-password" class="form-control" placeholder="Masukkan password" autocomplete="current-password" required>
                <button type="button" id="btn-toggle-password" style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; color: var(--text-muted); display: flex; align-items: center;" title="Lihat/Sembunyikan Password">
                  ${uiIcon('eye', '', 16)}
                </button>
              </div>
            </div>
            <button type="submit" id="btn-submit-login" class="btn btn-primary btn-block btn-large" style="margin-top: 20px;">
              MASUK KE APLIKASI
            </button>
          </form>
        </div>
      </div>
    </div>
  `;
}

function isManagerOrOwner(user) {
  if (!user) return false;
  if (user.isOwner || user.isManager) return true;
  if (Array.isArray(user.roles)) {
    return user.roles.includes('owner') || user.roles.includes('manager');
  }
  return false;
}

// --- Render Shell Parts ---
function renderSidebar() {
  const isMgrOrOwner = isManagerOrOwner(state.user);
  return `
    <aside class="app-sidebar">
      <div class="sidebar-brand">
        <img src="/assets/logo_sultan_arab.jpg" alt="Logo" class="sidebar-logo">
        <div class="sidebar-brand-text">
          <h2>SULTAN ARAB</h2>
          <span>Absensi &amp; Payroll</span>
        </div>
      </div>
      <ul class="sidebar-menu">
        <li class="sidebar-item ${state.route === '#home' ? 'active' : ''}">
          <a href="#home">${uiIcon('home', '', 18)} <span>Beranda Karyawan</span></a>
        </li>
        <li class="sidebar-item ${state.route === '#attendance' ? 'active' : ''}">
          <a href="#attendance">${uiIcon('camera', '', 18)} <span>Absen Masuk</span></a>
        </li>
        <li class="sidebar-item ${state.route === '#history' ? 'active' : ''}">
          <a href="#history">${uiIcon('calendar', '', 18)} <span>Riwayat Absensi</span></a>
        </li>
        <li class="sidebar-item ${state.route === '#payslips' ? 'active' : ''}">
          <a href="#payslips">${uiIcon('file-text', '', 18)} <span>Slip Gaji</span></a>
        </li>
        ${isMgrOrOwner ? `
        <li class="sidebar-item ${state.route === '#management' ? 'active' : ''}">
          <a href="#management">${uiIcon('chart', '', 18)} <span>Dashboard Pengelola</span></a>
        </li>
        ` : ''}
      </ul>
    </aside>
  `;
}

function renderHeader() {
  return `
    <header class="app-header">
      <div class="header-title-area">
        <img src="/assets/logo_sultan_arab.jpg" alt="Logo" class="header-logo-mobile">
        <div>
          <h2 style="font-size: 1.05rem; font-weight: 800; color: var(--primary-red);">SULTAN ARAB</h2>
          <p style="font-size: 0.72rem; color: var(--text-muted); line-height: 1;">Absensi &amp; Payroll</p>
        </div>
      </div>
      <div class="header-user-info">
        <div class="user-avatar-badge">${escapeHtml(state.user.displayName ? state.user.displayName.charAt(0).toUpperCase() : 'U')}</div>
        <div class="header-user-meta">
          <div style="font-size: 0.85rem; font-weight: 700; color: var(--text-main);">${escapeHtml(state.user.displayName)}</div>
          <div style="font-size: 0.72rem; color: var(--accent-gold); font-weight: 600;">${escapeHtml(state.user.roles.join(', '))}</div>
        </div>
        <button id="btn-header-change-pwd" class="btn btn-secondary btn-header-action" title="Ubah Password Akun" style="margin-right: 6px;">
          ${uiIcon('key', '', 15)} <span class="hide-on-mobile">Password</span>
        </button>
        <button id="btn-header-logout" class="btn btn-secondary btn-header-logout">
          ${uiIcon('logout', '', 15)} <span>Keluar</span>
        </button>
      </div>
    </header>
  `;
}

function renderBottomNav() {
  const isMgrOrOwner = isManagerOrOwner(state.user);
  return `
    <nav class="bottom-nav">
      <a href="#home" class="bottom-nav-item ${state.route === '#home' ? 'active' : ''}">
        ${uiIcon('home', '', 20)}
        <span>Beranda</span>
      </a>
      <a href="#attendance" class="bottom-nav-item ${state.route === '#attendance' ? 'active' : ''}">
        ${uiIcon('camera', '', 20)}
        <span>Absen</span>
      </a>
      <a href="#history" class="bottom-nav-item ${state.route === '#history' ? 'active' : ''}">
        ${uiIcon('calendar', '', 20)}
        <span>Riwayat</span>
      </a>
      <a href="#payslips" class="bottom-nav-item ${state.route === '#payslips' ? 'active' : ''}">
        ${uiIcon('file-text', '', 20)}
        <span>Slip</span>
      </a>
      ${isMgrOrOwner ? `
      <a href="#management" class="bottom-nav-item ${state.route === '#management' ? 'active' : ''}">
        ${uiIcon('chart', '', 20)}
        <span>Kelola</span>
      </a>
      ` : ''}
    </nav>
  `;
}

// --- Main Content Router ---
function renderMainContent() {
  switch (state.route) {
    case '#home':
      return renderHome();
    case '#attendance':
      return renderAttendance();
    case '#history':
      return renderHistory();
    case '#payslips':
      return renderPayslips();
    case '#management':
      return renderManagement();
    default:
      return renderHome();
  }
}

// --- VIEW 2: DASHBOARD KARYAWAN ---
function renderHome() {
  const todayEvents = (state.todaySession && state.todaySession.events) || [];
  const checkInEvent = todayEvents.find(e => e.event_type === 'check_in');
  const checkOutEvent = todayEvents.find(e => e.event_type === 'check_out');
  const isKunjunganLuar = state.todaySession && state.todaySession.attendance_type === 'kunjungan_luar';

  let statusBadge = `<span class="badge badge-warning">${uiIcon('alert-circle', '', 13)} Belum Absen Masuk Hari Ini</span>`;
  let heroButtonsHtml = '';

  if (checkInEvent) {
    const inTime = new Date(checkInEvent.server_time).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    const outTime = checkOutEvent ? new Date(checkOutEvent.server_time).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : null;

    if (checkOutEvent) {
      statusBadge = `<span class="badge badge-success">${uiIcon('check-circle', '', 13)} Hadir (${inTime}) • Pulang (${outTime})</span>`;
      heroButtonsHtml = `
        <div style="display:flex; flex-direction:column; gap:8px; width:100%;">
          <a href="#attendance?mode=out" class="btn-absen-hero" style="background: linear-gradient(135deg, #059669, #10B981);">
            ${uiIcon('check-circle', '', 20)}
            <span>SUDAH ABSEN PULANG (${outTime}) — ABSEN PULANG LAGI?</span>
          </a>
          <div style="text-align:center;">
            <a href="#attendance?mode=in" style="font-size:0.82rem; color:rgba(255,255,255,0.9); text-decoration:underline;">Absen Masuk Kembali / Koreksi</a>
          </div>
        </div>
      `;
    } else {
      if (isKunjunganLuar) {
        statusBadge = `<span class="badge badge-info">${uiIcon('car', '', 13)} Kunjungan Luar (${inTime}) • Belum Pulang</span>`;
      } else {
        statusBadge = `<span class="badge badge-success">${uiIcon('check-circle', '', 13)} Sudah Hadir (${inTime}) • Belum Pulang</span>`;
      }
      heroButtonsHtml = `
        <div style="display:flex; flex-direction:column; gap:8px; width:100%;">
          <a href="#attendance?mode=out" class="btn-absen-hero" style="background: linear-gradient(135deg, #1E3A8A, #2563EB); box-shadow: 0 4px 14px rgba(37,99,235,0.4);">
            ${uiIcon('log-out', '', 20)}
            <span>ABSEN PULANG SEKARANG (OPSIONAL)</span>
          </a>
          <div style="text-align:center;">
            <a href="#attendance?mode=in" style="font-size:0.82rem; color:rgba(255,255,255,0.9); text-decoration:underline;">Absen Masuk Lagi / Koreksi</a>
          </div>
        </div>
      `;
    }
  } else {
    heroButtonsHtml = `
      <div style="display:flex; flex-direction:column; gap:8px; width:100%;">
        <a href="#attendance?mode=in" class="btn-absen-hero">
          ${uiIcon('camera', '', 20)}
          <span>ABSEN MASUK SEKARANG</span>
        </a>
        <div style="text-align:center;">
          <a href="#attendance?mode=out" style="font-size:0.82rem; color:rgba(255,255,255,0.9); text-decoration:underline;">Langsung Absen Pulang</a>
        </div>
      </div>
    `;
  }

  const branchName = state.user.assignedBranchName || (state.branches[0] ? state.branches[0].name : 'Head Quarter Bekasi');

  return `
    <div class="employee-hero-card">
      <div class="employee-hero-top">
        <div>
          <span class="badge badge-test" style="margin-bottom: 8px;">SULTAN ARAB OPERASIONAL</span>
          <h2 class="employee-hero-name">${escapeHtml(state.user.displayName)}</h2>
          <div class="employee-hero-branch">
            ${uiIcon('map-pin', '', 14)} ${escapeHtml(branchName)} • ${escapeHtml(state.user.jobTitle || 'Staff')}
          </div>
        </div>
        <div class="employee-clock-box">
          <div id="live-digital-clock" class="clock-time">00:00:00</div>
          <div id="live-digital-date" class="clock-date">Memuat tanggal...</div>
        </div>
      </div>

      <div style="background: rgba(255,255,255,0.14); border-radius: var(--radius-sm); padding: 12px 16px; display: flex; flex-direction: column; gap: 6px; border: 1px solid rgba(255,255,255,0.12);">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
          <span style="font-weight: 600; font-size: 0.88rem; color: #FFFFFF;">Status Absensi Hari Ini:</span>
          ${statusBadge}
        </div>
        <div style="font-size: 0.76rem; color: #FDE68A; display: flex; align-items: center; gap: 6px;">
          ${uiIcon('shield', '', 13)} Aturan Q02: Wajib hanya absen masuk, pulang tidak wajib.
        </div>
      </div>
    </div>

    <!-- Tombol Utama Absensi -->
    <div class="action-box-main">
      ${heroButtonsHtml}
    </div>

    <!-- Menu Cepat Navigasi -->
    <div class="quick-grid">
      <div class="quick-card" onclick="window.location.hash='#attendance?mode=in'">
        ${uiIcon('camera', '', 26)}
        <div class="quick-label">Absen Masuk</div>
      </div>
      <div class="quick-card" onclick="window.location.hash='#attendance?mode=out'">
        ${uiIcon('log-out', '', 26)}
        <div class="quick-label">Absen Pulang</div>
      </div>
      <div class="quick-card" onclick="window.location.hash='#history'">
        ${uiIcon('calendar', '', 26)}
        <div class="quick-label">Riwayat Absensi</div>
      </div>
      <div class="quick-card" onclick="window.location.hash='#payslips'">
        ${uiIcon('file-text', '', 26)}
        <div class="quick-label">Slip Gaji</div>
      </div>
      ${isManagerOrOwner(state.user) ? `
      <div class="quick-card" onclick="window.location.hash='#management'">
        ${uiIcon('chart', '', 26)}
        <div class="quick-label">Dashboard Kelola</div>
      </div>
      ` : ''}
      <div class="quick-card" id="quick-card-change-pwd">
        ${uiIcon('key', '', 26)}
        <div class="quick-label">Ubah Password</div>
      </div>
    </div>

    <!-- Aturan Shift & Jadwal Pribadi -->
    <div class="card" style="margin-bottom: 20px;">
      <div class="card-header">
        <h3 class="card-title">${uiIcon('clock', '', 18)} Jadwal Shift &amp; Libur Anda (Q02 &amp; Q04)</h3>
        <span class="badge badge-info">Toleransi 15 Menit</span>
      </div>
      <div style="display: flex; flex-direction: column; gap: 12px; font-size: 0.9rem;">
        <div style="display: flex; gap: 14px; align-items: flex-start;">
          <div style="width: 36px; height: 36px; border-radius: 8px; background: #EFF6FF; color: #1D4ED8; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
            ${uiIcon('clock', '', 18)}
          </div>
          <div>
            <strong>Pilihan Shift:</strong> Staff/Admin (08:00 - 17:00) • Crew Pagi (08:00 - 17:00) • Crew Siang (12:00 - 21:00) • Lembur (08:00 - 21:00).
            <div style="color: var(--text-muted); font-size: 0.8rem; margin-top: 2px;">Pemilihan shift diserahkan kepada masing-masing personal saat absen masuk.</div>
          </div>
        </div>
        <div style="display: flex; gap: 14px; align-items: flex-start; border-top: 1px solid var(--border-subtle); padding-top: 10px;">
          <div style="width: 36px; height: 36px; border-radius: 8px; background: #FFFBEB; color: #B45309; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
            ${uiIcon('palmtree', '', 18)}
          </div>
          <div>
            <strong>Ketentuan Libur:</strong> Staff Kantor (Libur Ahad), Admin Eka (Selasa), Crew Bekasi (Adit: Senin, Mufti: Kamis, Kamal: Rabu), Crew Cikarang (Milkan: Kamis, Refan: Selasa).
          </div>
        </div>
      </div>
    </div>
  `;
}

// --- VIEW 3: PROSES ABSENSI (CAMERA & GPS & SHIFT SELECTOR) ---
function renderAttendance() {
  const isModeOut = window.location.hash.includes('mode=out');
  state.attendanceMode = isModeOut ? 'out' : 'in';
  const targetBranch = state.branches.find(b => b.id === state.user.assignedBranchId) || state.branches[0] || {};

  return `
    <div class="attendance-process-card">
      <!-- Navigasi Tab Mode: Absen Masuk vs Absen Pulang -->
      <div style="display: flex; gap: 8px; margin-bottom: 16px; background: #F1F5F9; padding: 4px; border-radius: var(--radius-md);">
        <button type="button" id="tab-mode-in" class="btn ${isModeOut ? 'btn-secondary' : 'btn-primary'}" style="flex: 1; padding: 10px; font-weight: 700; border: none; font-size: 0.85rem;">
          ${uiIcon('camera', '', 16)} 1. Absen Masuk
        </button>
        <button type="button" id="tab-mode-out" class="btn ${isModeOut ? 'btn-primary' : 'btn-secondary'}" style="flex: 1; padding: 10px; font-weight: 700; border: none; font-size: 0.85rem;">
          ${uiIcon('check-circle', '', 16)} 2. Absen Pulang
        </button>
      </div>

      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
        <h2 id="attendance-title-text" style="font-size: 1.3rem; font-weight: 800; color: var(--primary-red); margin: 0;">
          ${isModeOut ? 'Absen Pulang Karyawan' : 'Absen Masuk Karyawan'}
        </h2>
        <a href="#home" class="btn btn-secondary" style="padding: 6px 12px; font-size: 0.8rem;">Kembali</a>
      </div>

      <!-- Banner Info Absen Pulang (Hanya Kamera & GPS) -->
      <div id="banner-absen-pulang" style="display: ${isModeOut ? 'flex' : 'none'}; background: #EFF6FF; border: 1px solid #BFDBFE; color: #1E40AF; padding: 12px 14px; border-radius: var(--radius-sm); font-size: 0.83rem; margin-bottom: 16px; align-items: flex-start; gap: 8px;">
        ${uiIcon('shield', '', 18)}
        <div>
          <strong>Ketentuan Absen Pulang:</strong> Hanya kamera dan GPS yang aktif. Shift kerja dan jenis kehadiran otomatis mengikuti sesi kerja Anda hari ini.
        </div>
      </div>

      <!-- Form Khusus Absen Masuk (Shift, Tipe Hadir, Cabang) - Sembunyi saat Mode Absen Pulang -->
      <div id="section-absen-masuk-only" style="display: ${isModeOut ? 'none' : 'block'};">
        <!-- Tipe Absensi: Hadir Toko vs Kunjungan Luar (Q05) -->
        <div style="background: var(--bg-main); border: 1px solid var(--border-color); padding: 14px; border-radius: var(--radius-md); margin-bottom: 18px;">
          <label class="form-label" style="font-weight: 700; color: var(--text-main); margin-bottom: 8px;">Pilih Jenis Kehadiran Hari Ini (Q05):</label>
          <div style="display: flex; gap: 10px;">
            <button type="button" id="btn-type-hadir" class="btn btn-primary" style="flex: 1; padding: 10px 12px; font-size: 0.85rem; flex-direction: column; gap: 2px;">
              <div style="display: flex; align-items: center; gap: 6px; font-weight: 700;">
                ${uiIcon('building', '', 16)} Hadir di Toko / Kantor
              </div>
              <small style="font-weight: 500; font-size: 0.74rem; opacity: 0.9;">(Dapat Uang Makan Rp10.000)</small>
            </button>
            <button type="button" id="btn-type-kunjungan" class="btn btn-secondary" style="flex: 1; padding: 10px 12px; font-size: 0.85rem; flex-direction: column; gap: 2px;">
              <div style="display: flex; align-items: center; gap: 6px; font-weight: 700;">
                ${uiIcon('car', '', 16)} Kunjungan Luar
              </div>
              <small style="font-weight: 500; font-size: 0.74rem; color: var(--text-muted);">(Tanpa Uang Makan)</small>
            </button>
          </div>
        </div>

        <!-- Pemilihan Shift Sendiri (Q02) -->
        <div class="form-group">
          <label class="form-label" for="attendance-shift-select">Pilih Shift Kerja Anda (Toleransi 15 Menit):</label>
          <select id="attendance-shift-select" class="form-control">
            ${renderShiftOptions(targetBranch.id)}
          </select>
        </div>

        <!-- Pemilihan Cabang -->
        <div class="form-group" id="group-branch-select">
          <label class="form-label" for="attendance-branch-select">Cabang Penugasan:</label>
          <select id="attendance-branch-select" class="form-control">
            ${state.branches.map(b => `
              <option value="${b.id}" ${b.id === targetBranch.id ? 'selected' : ''}>
                ${escapeHtml(b.name)} (Radius: ${b.radius_m || 150}m)
              </option>
            `).join('')}
          </select>
        </div>
      </div>

      <!-- Kamera Preview & Capture (Aktif untuk Absen Masuk & Absen Pulang) -->
      <div class="camera-container" id="camera-box">
        <video id="camera-video" class="camera-video" autoplay playsinline muted></video>
        <img id="camera-photo-preview" class="camera-photo-preview" alt="Pratinjau Foto Bukti">
        
        <!-- Live Viewfinder Controls -->
        <div class="camera-overlay" id="camera-controls">
          <button type="button" id="btn-switch-camera" class="btn btn-secondary" style="padding: 6px 14px; font-size: 0.8rem; border-radius: var(--radius-pill); background: rgba(15, 23, 42, 0.75); color: #fff; border: 1px solid rgba(255,255,255,0.3); backdrop-filter: blur(4px);" title="Balik Kamera Depan / Belakang">
            ${uiIcon('refresh', '', 14)} Balik Kamera
          </button>
          <button type="button" id="btn-take-photo" class="btn-capture" title="Ambil Foto Wajah/Toko">
            <div class="btn-capture-inner"></div>
          </button>
        </div>

        <!-- Fallback Container if Live Stream is not available / HTTP -->
        <div id="camera-fallback-card" style="display: none; text-align: center; padding: 24px 16px; color: #fff; z-index: 5;">
          <div style="display: flex; justify-content: center; margin-bottom: 12px; color: #F59E0B;">
            ${uiIcon('camera', '', 40)}
          </div>
          <div style="font-weight: 700; font-size: 1.05rem; margin-bottom: 6px;">Kamera Siap Digunakan</div>
          <p style="font-size: 0.82rem; color: #E2E8F0; margin-bottom: 16px; max-width: 320px; margin-left: auto; margin-right: auto;">
            Tekan tombol di bawah untuk mengambil foto langsung menggunakan kamera HP Anda:
          </p>
          <button type="button" id="btn-open-native-camera" class="btn btn-primary" style="font-size: 0.95rem; font-weight: 700; padding: 10px 22px; border-radius: 30px; box-shadow: 0 4px 14px rgba(201,0,0,0.5);">
            ${uiIcon('camera', '', 18)} Buka Kamera HP Sekarang
          </button>
        </div>
      </div>
      <canvas id="camera-canvas" style="display: none;"></canvas>

      <!-- Native Inputs for Direct Mobile Camera Capture -->
      <input type="file" id="camera-native-input" accept="image/*" capture="user" style="display: none;">
      <input type="file" id="camera-native-rear" accept="image/*" capture="environment" style="display: none;">
      <input type="file" id="file-photo-fallback" accept="image/*" style="display: none;">

      <!-- Tombol Aksi Kamera & Foto -->
      <div style="display: flex; gap: 8px; margin-bottom: 14px; flex-wrap: wrap;">
        <button type="button" id="btn-retake-photo" class="btn btn-secondary" style="flex: 1; display: none; font-size: 0.85rem;">
          ${uiIcon('refresh', '', 15)} Ambil Foto Ulang
        </button>
        <button type="button" id="btn-trigger-front-cam" class="btn btn-secondary" style="flex: 1; font-size: 0.82rem; font-weight: 600;">
          ${uiIcon('smartphone', '', 15)} Kamera Depan (Selfie)
        </button>
        <button type="button" id="btn-trigger-rear-cam" class="btn btn-secondary" style="flex: 1; font-size: 0.82rem; font-weight: 600;">
          ${uiIcon('building', '', 15)} Kamera Belakang (Toko)
        </button>
        <button type="button" id="btn-trigger-file" class="btn btn-secondary" style="padding: 6px 14px; font-size: 0.82rem;">
          ${uiIcon('folder', '', 15)} Galeri
        </button>
      </div>

      <!-- Tip HTTPS -->
      <div id="camera-https-tip" style="display: none; background: #EFF6FF; border: 1px solid #BFDBFE; border-radius: var(--radius-sm); padding: 10px 14px; margin-bottom: 16px; font-size: 0.8rem; color: #1D4ED8;">
        💡 <strong>Tips Kamera HP:</strong> Preview kamera langsung hanya tersedia melalui alamat <strong>HTTPS</strong>. Gunakan tombol kamera di atas untuk memotret langsung.
      </div>

      <!-- GPS Status Box (Aktif untuk Absen Masuk & Absen Pulang) -->
      <div class="location-status-box" id="gps-status-box">
        <div class="location-icon" style="color: var(--primary-red);">${uiIcon('map-pin', '', 22)}</div>
        <div style="flex: 1;">
          <div style="font-weight: 700; font-size: 0.92rem; color: var(--text-main);" id="gps-status-title">Memeriksa GPS Perangkat...</div>
          <div style="font-size: 0.8rem; color: var(--text-muted);" id="gps-coords-text">Mencari koordinat akurat...</div>
        </div>
      </div>

      <div style="background: var(--bg-main); border: 1px solid var(--border-color); padding: 10px 14px; border-radius: var(--radius-sm); margin-bottom: 20px; font-size: 0.82rem; color: var(--text-muted);">
        <div style="display: flex; align-items: center; gap: 6px;">
          ${uiIcon('clock', '', 14)} Waktu Kirim: <span id="device-time-display" style="font-weight: 600; color: var(--text-main);">${new Date().toLocaleTimeString('id-ID')} WIB</span>
        </div>
        <div style="margin-top: 4px; display: flex; align-items: center; gap: 6px;">
          ${uiIcon('shield', '', 14)} Anti Duplikasi Idempotency: Aktif
        </div>
      </div>

      <button type="button" id="btn-submit-attendance" class="btn btn-primary btn-block btn-large">
        ${isModeOut ? `${uiIcon('check', '', 18)} KIRIM ABSEN PULANG SEKARANG` : `${uiIcon('check', '', 18)} KIRIM ABSEN MASUK SEKARANG`}
      </button>
    </div>
  `;
}

function renderDynamicDayOffRules(employees = []) {
  if (!employees || employees.length === 0) {
    return `<span style="color: var(--text-muted);">Memuat ketentuan libur staf terkini...</span>`;
  }
  const groups = {};
  for (const emp of employees) {
    let grp = 'Staff';
    const job = (emp.job_title || '').toLowerCase();
    const branch = emp.branch_name || 'Head Quarter';
    if (job.includes('staff') || job.includes('staf') || job.includes('manager')) {
      grp = 'Staff Kantor';
    } else if (job.includes('admin')) {
      grp = 'Admin';
    } else if (job.includes('crew') || job.includes('toko')) {
      grp = `Crew Toko (${branch})`;
    } else if (emp.job_title) {
      grp = `${emp.job_title} (${branch})`;
    }

    if (!groups[grp]) groups[grp] = [];
    groups[grp].push(`${emp.name}: Libur ${emp.day_off || 'Ahad'}`);
  }

  return Object.entries(groups).map(([grpName, items]) => {
    return `<div>• <strong style="color: var(--text-main);">${escapeHtml(grpName)}:</strong> <span style="color: var(--text-muted);">${escapeHtml(items.join(', '))}</span></div>`;
  }).join('');
}

// --- VIEW 4: DASHBOARD OWNER & MANAGER ---
function renderManagement() {
  return `
    <div style="margin-bottom: 20px;">
      <div class="mgmt-header">
        <div>
          <span class="badge badge-test">${uiIcon('shield', '', 12)} PENGELOLA SULTAN ARAB</span>
          <h2 class="mgmt-title">Dashboard Pengelola</h2>
          <p class="mgmt-subtitle">Khusus Owner dan Manager Sultan Arab.</p>
        </div>
        <button id="btn-refresh-monitoring" class="btn btn-secondary btn-refresh-mgmt" title="Muat ulang data">
          ${uiIcon('refresh', '', 16)} <span>Muat Ulang</span>
        </button>
      </div>

      <!-- KPI Summary Cards -->
      <div class="kpi-grid">
        <div class="kpi-card">
          <div class="kpi-icon kpi-icon-red">${uiIcon('building', '', 20)}</div>
          <div>
            <div class="kpi-value" id="kpi-total-cabang">${state.branches.length}</div>
            <div class="kpi-label">Cabang Toko</div>
          </div>
        </div>
        <div class="kpi-card">
          <div class="kpi-icon kpi-icon-gold">${uiIcon('users', '', 20)}</div>
          <div>
            <div class="kpi-value" id="kpi-total-karyawan">-</div>
            <div class="kpi-label">Total Staf &amp; Crew</div>
          </div>
        </div>
        <div class="kpi-card">
          <div class="kpi-icon kpi-icon-green">${uiIcon('check-circle', '', 20)}</div>
          <div>
            <div class="kpi-value" id="kpi-total-hadir">-</div>
            <div class="kpi-label">Hadir di Toko</div>
          </div>
        </div>
        <div class="kpi-card">
          <div class="kpi-icon kpi-icon-blue">${uiIcon('car', '', 20)}</div>
          <div>
            <div class="kpi-value" id="kpi-kunjungan-luar">-</div>
            <div class="kpi-label">Kunjungan Luar</div>
          </div>
        </div>
      </div>

      <!-- Tabs Navigasi Pengelola -->
      <div class="nav-tabs">
        <button class="nav-tab-btn ${state.activeManagementTab === 'monitoring' ? 'active' : ''}" data-tab="monitoring">
          ${uiIcon('map-pin', '', 16)} Monitoring
        </button>
        <button class="nav-tab-btn ${state.activeManagementTab === 'recap' ? 'active' : ''}" data-tab="recap">
          ${uiIcon('chart', '', 16)} Rekap Bulanan
        </button>
        <button class="nav-tab-btn ${state.activeManagementTab === 'payroll' ? 'active' : ''}" data-tab="payroll">
          ${uiIcon('file-text', '', 16)} Slip Gaji
        </button>
        <button class="nav-tab-btn ${state.activeManagementTab === 'master' ? 'active' : ''}" data-tab="master">
          ${uiIcon('users', '', 16)} Karyawan &amp; Cabang
        </button>
        <button class="nav-tab-btn ${state.activeManagementTab === 'schedules' ? 'active' : ''}" data-tab="schedules">
          ${uiIcon('calendar', '', 16)} Jadwal &amp; Libur
        </button>
      </div>

      <div id="management-tab-content">
        ${renderManagementTabContent()}
      </div>
    </div>
  `;
}

function renderManagementTabContent() {
  switch (state.activeManagementTab) {
    case 'monitoring':
      return `
        <div class="card">
          <div class="card-header">
            <div>
              <h3 class="card-title">${uiIcon('map-pin', '', 18)} Monitoring Absensi Hari Ini</h3>
              <p class="card-subtitle">Pemantauan real-time status check-in staf seluruh cabang toko.</p>
            </div>
            <span class="badge badge-info">Semua Cabang</span>
          </div>
          <div class="table-responsive">
            <table class="table table-stack" id="table-monitoring">
              <thead>
                <tr>
                  <th>Nama Staf</th>
                  <th>Cabang</th>
                  <th>Shift</th>
                  <th>Jam Masuk</th>
                  <th>Jam Pulang</th>
                  <th>Tipe Hadir</th>
                  <th>Uang Makan</th>
                  <th>Lokasi GPS</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody id="monitoring-table-body">
                <tr><td colspan="9" class="cell-empty">Memuat monitoring...</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      `;
    case 'recap':
      return renderManagementRecapTab();
    case 'payroll':
      return `
        <!-- Unggah Slip Gaji PDF Masing-Masing Anggota Staf (Q06) -->
        <div class="card" style="margin-bottom: 20px; border-left: 4px solid var(--primary-red);">
          <div class="card-header">
            <div>
              <h3 class="card-title">${uiIcon('file-text', '', 20)} Slip Gaji PDF Staf</h3>
              <p class="card-subtitle">Unggah slip gaji PDF untuk masing-masing anggota staf.</p>
            </div>
            <div class="card-actions">
              <button id="btn-upload-pdf-modal" class="btn btn-primary">
                ${uiIcon('upload', '', 16)} Unggah PDF
              </button>
              <button id="btn-refresh-staff-slips-payroll" class="btn btn-secondary" title="Segarkan">
                ${uiIcon('refresh', '', 16)}
              </button>
            </div>
          </div>
          <div class="table-responsive">
            <table class="table table-stack">
              <thead>
                <tr>
                  <th>Anggota Staf</th>
                  <th>Cabang / Jabatan</th>
                  <th>Slip PDF Terakhir</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody id="payroll-staff-slips-tbody">
                <tr><td colspan="4" class="cell-empty">Memuat daftar staf...</td></tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Riwayat Kalkulasi & Proses Payroll Periode 27–26 -->
        <div class="card" style="margin-bottom: 20px;">
          <div class="card-header">
            <div>
              <h3 class="card-title">${uiIcon('settings', '', 20)} Draft Payroll Periode 27–26</h3>
              <p class="card-subtitle">Uang makan Rp10.000 hanya untuk hadir fisik toko. Finalisasi oleh Owner.</p>
            </div>
            <div class="card-actions">
              <button id="btn-input-commission-modal" class="btn btn-secondary">
                ${uiIcon('plus', '', 16)} Komisi
              </button>
              <button id="btn-calculate-payroll" class="btn btn-secondary">
                ${uiIcon('zap', '', 16)} Hitung Draft
              </button>
            </div>
          </div>
          <div id="payroll-runs-container">
            <p style="color: var(--text-muted); font-size: 0.9rem;">Memuat daftar proses payroll...</p>
          </div>
        </div>
      `;
    case 'master':
      return `
        <div class="card" style="margin-bottom: 20px;">
          <div class="card-header">
            <div>
              <h3 class="card-title">${uiIcon('users', '', 20)} Daftar Karyawan</h3>
              <p class="card-subtitle">Kelola staf, jabatan, cabang penempatan, dan kredensial akun.</p>
            </div>
            <button id="btn-add-employee-modal" class="btn btn-secondary">
              ${uiIcon('plus', '', 16)} Karyawan
            </button>
          </div>
          <div class="table-responsive">
            <table class="table table-stack">
              <thead>
                <tr>
                  <th>Nama Staf</th>
                  <th>Jabatan</th>
                  <th>Cabang</th>
                  <th>Status</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody id="master-employee-body">
                <tr><td colspan="5" class="cell-empty">Memuat karyawan...</td></tr>
              </tbody>
            </table>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <div>
              <h3 class="card-title">${uiIcon('building', '', 20)} Daftar Cabang</h3>
              <p class="card-subtitle">Titik lokasi toko, radius absensi, dan jam operasional shift.</p>
            </div>
            <button id="btn-add-branch-modal" class="btn btn-primary">
              ${uiIcon('plus', '', 16)} Cabang
            </button>
          </div>
          <div class="table-responsive">
            <table class="table table-stack">
              <thead>
                <tr>
                  <th>Nama Cabang</th>
                  <th>Radius</th>
                  <th>Koordinat</th>
                  <th>Alamat</th>
                </tr>
              </thead>
              <tbody id="master-branch-body">
                ${renderBranchRows()}
              </tbody>
            </table>
          </div>
        </div>
      `;
    case 'schedules':
      return `
        <div class="card">
          <div class="card-header">
            <div>
              <h3 class="card-title">${uiIcon('calendar', '', 20)} Jadwal Shift &amp; Libur Tim</h3>
              <p class="card-subtitle">Pengaturan jadwal shift kerja mingguan dan pendaftaran libur staf.</p>
            </div>
          </div>
          <div style="background: var(--bg-main); border: 1px solid var(--border-color); padding: 14px 16px; border-radius: var(--radius-sm); margin-bottom: 20px; font-size: 0.85rem; line-height: 1.6;">
            <div style="font-weight: 700; color: var(--text-main); margin-bottom: 4px; display: flex; align-items: center; gap: 6px;">
              ${uiIcon('shield', '', 14)} Ketentuan Libur Tetap Sultan Arab:
            </div>
            <div id="dynamic-day-off-rules-list">
              ${renderDynamicDayOffRules(state.employees || [])}
            </div>
          </div>
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 20px;">
            <div style="background: #ffffff; border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 16px;">
              <h4 style="font-size: 0.95rem; font-weight: 700; margin-bottom: 12px; display: flex; align-items: center; gap: 6px;">
                ${uiIcon('clock', '', 16)} Tetapkan Shift Manual
              </h4>
              <form id="form-assign-schedule">
                <div class="form-group">
                  <label class="form-label">Pilih Karyawan:</label>
                  <select id="schedule-emp-select" class="form-control" required></select>
                </div>
                <div class="form-group">
                  <label class="form-label">Tanggal:</label>
                  <input type="date" id="schedule-date-input" class="form-control" value="${new Date().toISOString().split('T')[0]}" required>
                </div>
                <div class="form-group">
                  <label class="form-label">Pilih Shift:</label>
                  <select id="schedule-shift-select" class="form-control"></select>
                </div>
                <button type="submit" class="btn btn-primary btn-block">
                  ${uiIcon('check', '', 16)} Simpan Jadwal
                </button>
              </form>
            </div>
            <div style="background: #ffffff; border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 16px;">
              <h4 style="font-size: 0.95rem; font-weight: 700; margin-bottom: 12px; display: flex; align-items: center; gap: 6px;">
                ${uiIcon('palmtree', '', 16)} Pendaftaran Libur Khusus
              </h4>
              <form id="form-assign-dayoff">
                <div class="form-group">
                  <label class="form-label">Pilih Karyawan:</label>
                  <select id="dayoff-emp-select" class="form-control" required></select>
                </div>
                <div class="form-group">
                  <label class="form-label">Tanggal Libur:</label>
                  <input type="date" id="dayoff-date-input" class="form-control" value="${new Date().toISOString().split('T')[0]}" required>
                </div>
                <div class="form-group">
                  <label class="form-label">Alasan Libur:</label>
                  <input type="text" id="dayoff-reason-input" class="form-control" value="Libur Mingguan" required>
                </div>
                <button type="submit" class="btn btn-secondary btn-block">
                  ${uiIcon('check', '', 16)} Simpan Libur
                </button>
              </form>
            </div>
          </div>
        </div>
      `;
    default:
      return '';
  }
}

function renderManagementRecapTab() {
  const currentMonth = state.recapMonth || (new Date().getMonth() + 1);
  const currentYear = state.recapYear || new Date().getFullYear();
  const branchOptions = (state.branches || []).map(b => 
    `<option value="${b.id}" ${state.recapBranchId === b.id ? 'selected' : ''}>${escapeHtml(b.name)}</option>`
  ).join('');

  const months = [
    { value: 1, name: 'Januari' },
    { value: 2, name: 'Februari' },
    { value: 3, name: 'Maret' },
    { value: 4, name: 'April' },
    { value: 5, name: 'Mei' },
    { value: 6, name: 'Juni' },
    { value: 7, name: 'Juli' },
    { value: 8, name: 'Agustus' },
    { value: 9, name: 'September' },
    { value: 10, name: 'Oktober' },
    { value: 11, name: 'November' },
    { value: 12, name: 'Desember' }
  ];

  const monthOptions = months.map(m =>
    `<option value="${m.value}" ${currentMonth === m.value ? 'selected' : ''}>${m.name}</option>`
  ).join('');

  return `
    <div class="card" style="margin-bottom: 20px;">
      <div class="card-header" style="flex-wrap: wrap; gap: 12px;">
        <div>
          <h3 class="card-title">${uiIcon('chart', '', 20)} Rekapitulasi Kehadiran Bulanan Staf</h3>
          <p class="card-subtitle">Akumulasi kehadiran, lembur (08:00–21:00), keterlambatan, dan uang makan terhitung per bulan.</p>
        </div>
        <div class="card-actions" style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
          <button type="button" class="btn btn-secondary" onclick="window.print()" title="Cetak Tabel Rekapitulasi">
            ${uiIcon('printer', '', 16)} Cetak
          </button>
          <button id="btn-refresh-recap" class="btn btn-secondary" title="Muat Ulang">
            ${uiIcon('refresh', '', 16)} Segarkan
          </button>
        </div>
      </div>

      <!-- Filter Periode & Cabang -->
      <div style="background: var(--bg-main); border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 14px 16px; margin-bottom: 16px;">
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; align-items: flex-end;">
          <div class="form-group" style="margin-bottom: 0;">
            <label class="form-label" style="font-size: 0.82rem; font-weight: 600;">Bulan:</label>
            <select id="recap-filter-month" class="form-control">
              ${monthOptions}
            </select>
          </div>
          <div class="form-group" style="margin-bottom: 0;">
            <label class="form-label" style="font-size: 0.82rem; font-weight: 600;">Tahun:</label>
            <select id="recap-filter-year" class="form-control">
              <option value="${currentYear - 1}" ${currentYear === currentYear - 1 ? 'selected' : ''}>${currentYear - 1}</option>
              <option value="${currentYear}" ${currentYear === currentYear ? 'selected' : ''}>${currentYear}</option>
              <option value="${currentYear + 1}" ${currentYear === currentYear + 1 ? 'selected' : ''}>${currentYear + 1}</option>
            </select>
          </div>
          <div class="form-group" style="margin-bottom: 0;">
            <label class="form-label" style="font-size: 0.82rem; font-weight: 600;">Cabang:</label>
            <select id="recap-filter-branch" class="form-control">
              <option value="">Semua Cabang</option>
              ${branchOptions}
            </select>
          </div>
          <div>
            <button id="btn-apply-recap-filter" class="btn btn-primary btn-block">
              ${uiIcon('search', '', 16)} Tampilkan Rekap
            </button>
          </div>
        </div>
      </div>

      <!-- Summary KPI Bulanan -->
      <div class="kpi-grid" style="margin-bottom: 18px;">
        <div class="kpi-card">
          <div class="kpi-icon kpi-icon-blue">${uiIcon('users', '', 20)}</div>
          <div>
            <div class="kpi-value" id="recap-kpi-employees">-</div>
            <div class="kpi-label">Total Staf Aktif</div>
          </div>
        </div>
        <div class="kpi-card">
          <div class="kpi-icon kpi-icon-green">${uiIcon('building', '', 20)}</div>
          <div>
            <div class="kpi-value" id="recap-kpi-hadir">-</div>
            <div class="kpi-label">Hadir Fisik Toko</div>
          </div>
        </div>
        <div class="kpi-card">
          <div class="kpi-icon kpi-icon-blue">${uiIcon('car', '', 20)}</div>
          <div>
            <div class="kpi-value" id="recap-kpi-kunjungan">-</div>
            <div class="kpi-label">Kunjungan Luar</div>
          </div>
        </div>
        <div class="kpi-card">
          <div class="kpi-icon kpi-icon-gold">${uiIcon('zap', '', 20)}</div>
          <div>
            <div class="kpi-value" id="recap-kpi-lembur">-</div>
            <div class="kpi-label">Shift Lembur (08-21)</div>
          </div>
        </div>
        <div class="kpi-card">
          <div class="kpi-icon kpi-icon-blue">${uiIcon('calendar', '', 20)}</div>
          <div>
            <div class="kpi-value" id="recap-kpi-libur">-</div>
            <div class="kpi-label">Total Hari Libur</div>
          </div>
        </div>
        <div class="kpi-card">
          <div class="kpi-icon kpi-icon-green">${uiIcon('dollar', '', 20)}</div>
          <div>
            <div class="kpi-value" id="recap-kpi-uangmakan">-</div>
            <div class="kpi-label">Total Uang Makan</div>
          </div>
        </div>
      </div>

      <!-- Tabel Rekap Per Karyawan -->
      <div class="table-responsive">
        <table class="table table-stack" id="table-monthly-recap">
          <thead>
            <tr>
              <th style="min-width: 130px;">Staf</th>
              <th style="min-width: 95px;">Cabang</th>
              <th title="Kehadiran fisik di toko">Hadir</th>
              <th title="Kunjungan luar / dinas">Kunjungan</th>
              <th title="Shift Lembur 08:00 - 21:00">Lembur</th>
              <th title="Jumlah hari libur rutin & terjadwal bulan ini">Libur</th>
              <th title="Estimasi jam kerja">Jam Kerja</th>
              <th title="Uang makan Rp 10.000 / hari hadir fisik">Uang Makan</th>
              <th style="text-align: right;">Aksi</th>
            </tr>
          </thead>
          <tbody id="monthly-recap-table-body">
            <tr><td colspan="9" class="cell-empty">Memuat data rekapitulasi bulanan...</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// --- VIEW 5: RIWAYAT & SLIP GAJI ---
function renderHistory() {
  const items = state.attendanceHistory;
  return `
    <div class="card">
      <div class="card-header">
        <div>
          <h3 class="card-title">${uiIcon('calendar', '', 20)} Riwayat Absensi</h3>
          <p class="card-subtitle">Log lengkap riwayat presensi harian Anda.</p>
        </div>
        <span class="badge badge-info">${escapeHtml(state.user.displayName)}</span>
      </div>
      ${items.length === 0 ? `
        <p class="cell-empty">Belum ada riwayat absensi.</p>
      ` : `
      <!-- Ponsel: daftar ringkas -->
      <ul class="history-list mobile-only">
        ${items.map(h => {
          const isKunjungan = h.attendance_type === 'kunjungan_luar';
          return `
            <li class="history-item">
              <div class="history-date">
                <span class="history-day">${formatDayShort(h.work_date)}</span>
                <span class="history-num">${formatDayNum(h.work_date)}</span>
              </div>
              <div class="history-body">
                <div class="history-row">
                  <strong style="display:flex; align-items:center; gap:5px;">
                    ${isKunjungan ? `${uiIcon('car', '', 15)} Kunjungan Luar` : `${uiIcon('building', '', 15)} Hadir Toko`}
                  </strong>
                  <span class="history-time">Masuk: ${formatTime(h.check_in_time)}${h.check_out_time ? ` • Pulang: ${formatTime(h.check_out_time)}` : ''}</span>
                </div>
                <div class="history-sub">${escapeHtml(h.branch_name || '-')}</div>
                <div class="history-badges">
                  <span class="badge ${statusBadgeClass(h.status)}">${statusLabel(h.status)}</span>
                  ${isKunjungan ? `<span class="badge badge-warning">Tanpa Uang Makan</span>` : `<span class="badge badge-success">Uang Makan Rp10.000</span>`}
                </div>
              </div>
            </li>
          `;
        }).join('')}
      </ul>

      <!-- PC: tabel -->
      <div class="table-responsive desktop-only">
        <table class="table">
          <thead>
            <tr>
              <th>Tanggal</th>
              <th>Cabang</th>
              <th>Tipe</th>
              <th>Jam Masuk</th>
              <th>Jam Pulang</th>
              <th>Uang Makan</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${items.map(h => {
              const isKunjungan = h.attendance_type === 'kunjungan_luar';
              const mealBadge = isKunjungan ? `<span class="badge badge-warning">Rp0 (Kunjungan)</span>` : `<span class="badge badge-success">Rp10.000</span>`;
              return `
                <tr>
                  <td><strong>${formatDateLong(h.work_date)}</strong></td>
                  <td>${escapeHtml(h.branch_name || '-')}</td>
                  <td>
                    <span style="display:inline-flex; align-items:center; gap:5px;">
                      ${isKunjungan ? `${uiIcon('car', '', 15)} Kunjungan Luar` : `${uiIcon('building', '', 15)} Hadir Toko`}
                    </span>
                  </td>
                  <td>${formatTime(h.check_in_time)}</td>
                  <td>${h.check_out_time ? `<span class="badge badge-success" style="font-weight:600;">${formatTime(h.check_out_time)}</span>` : `<span style="color:var(--text-muted);">-</span>`}</td>
                  <td>${mealBadge}</td>
                  <td><span class="badge ${statusBadgeClass(h.status)}">${statusLabel(h.status)}</span></td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
      `}
    </div>
  `;
}

function renderPayslips() {
  const isMgrOrOwner = isManagerOrOwner(state.user);
  return `
    <div style="margin-bottom: 20px;">
      ${isMgrOrOwner ? `
      <!-- Banner Pengelola: Arahkan ke Dashboard Pengelola -->
      <div class="card" style="border: 2px solid var(--primary-red); background: #FFF9F9; margin-bottom: 16px;">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
          <div>
            <span class="badge badge-danger">${uiIcon('crown', '', 12)} HAK AKSES PENGELOLA (MANAGER &amp; OWNER)</span>
            <h3 style="font-size: 1.1rem; font-weight: 800; color: var(--primary-red); margin-top: 6px; margin-bottom: 4px;">
              Pusat Unggah Slip Gaji PDF Staf Ada di Dashboard Pengelola
            </h3>
            <p style="font-size: 0.85rem; color: var(--text-muted); margin: 0;">
              Untuk mengunggah berkas slip gaji PDF staf (Q06) dan kirim notifikasi WhatsApp, silakan kelola di Dashboard Pengelola.
            </p>
          </div>
          <div>
            <a href="#management" class="btn btn-primary" style="font-weight: 700;">
              ${uiIcon('chart', '', 16)} Buka Dashboard Pengelola
            </a>
          </div>
        </div>
      </div>
      ` : ''}

      <div class="card">
        <div class="card-header">
          <div>
            <h3 class="card-title">${uiIcon('file-text', '', 20)} Slip Gaji Terbit Anda</h3>
            <p class="card-subtitle">
              Unduh berkas resmi slip gaji format PDF yang diterbitkan oleh manajemen.
            </p>
          </div>
          <button id="btn-refresh-payslips" class="btn btn-secondary">
            ${uiIcon('refresh', '', 16)} Segarkan
          </button>
        </div>
        <div id="payslips-list-container">
          <p style="color: var(--text-muted); font-size: 0.9rem;">Memuat slip gaji...</p>
        </div>
      </div>
    </div>
  `;
}

// --- Event Handlers ---
function attachLoginEvents() {
  const form = document.getElementById('login-form');
  const btnToggle = document.getElementById('btn-toggle-password');
  const passInput = document.getElementById('login-password');

  if (btnToggle && passInput) {
    btnToggle.addEventListener('click', () => {
      passInput.type = passInput.type === 'password' ? 'text' : 'password';
    });
  }


  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const u = document.getElementById('login-username').value;
      const p = document.getElementById('login-password').value;
      const submitBtn = document.getElementById('btn-submit-login');
      submitBtn.disabled = true;
      submitBtn.textContent = 'Memverifikasi...';

      const res = await api('/api/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify({ login_identifier: u, password: p })
      });

      submitBtn.disabled = false;
      submitBtn.textContent = 'MASUK KE APLIKASI';

      if (res.ok && res.data.success) {
        state.user = res.data.user;
        if (state.user && state.user.roles) {
          state.user.isOwner = Boolean(state.user.isOwner || state.user.roles.includes('owner'));
          state.user.isManager = Boolean(state.user.isManager || state.user.roles.includes('manager'));
          state.user.isSupervisor = Boolean(state.user.isSupervisor || state.user.roles.includes('supervisor'));
          state.user.isKaryawan = Boolean(state.user.isKaryawan || state.user.roles.includes('karyawan'));
        }
        showToast('Selamat datang, ' + state.user.displayName, 'success');
        await loadInitialData();
        state.route = '#home';
        window.location.hash = '#home';
        render();
      } else {
        showToast(res.data.error || 'Login gagal.', 'error');
      }
    });
  }
}

function attachShellEvents() {
  const logoutAction = async () => {
    await api('/api/v1/auth/logout', { method: 'POST' });
    state.user = null;
    state.route = '#login';
    window.location.hash = '#login';
    render();
  };

  const btnHLogout = document.getElementById('btn-header-logout');
  if (btnHLogout) btnHLogout.addEventListener('click', logoutAction);

  const btnHChangePwd = document.getElementById('btn-header-change-pwd');
  const quickChangePwd = document.getElementById('quick-card-change-pwd');
  if (btnHChangePwd) btnHChangePwd.addEventListener('click', openChangePasswordModal);
  if (quickChangePwd) quickChangePwd.addEventListener('click', openChangePasswordModal);
}

function attachViewEvents() {
  if (state.route === '#attendance') {
    initAttendanceView();
  } else if (state.route === '#management') {
    initManagementView();
  } else if (state.route === '#payslips') {
    loadMyPayslips();
  }
}

// --- Attendance View Controller ---
function initAttendanceView() {
  const branchSelect = document.getElementById('attendance-branch-select');
  const shiftSelect = document.getElementById('attendance-shift-select');
  const video = document.getElementById('camera-video');
  const photoPreview = document.getElementById('camera-photo-preview');
  const btnTake = document.getElementById('btn-take-photo');
  const btnRetake = document.getElementById('btn-retake-photo');
  const fileFallback = document.getElementById('file-photo-fallback');
  const btnSubmit = document.getElementById('btn-submit-attendance');
  const btnTypeHadir = document.getElementById('btn-type-hadir');
  const btnTypeKunjungan = document.getElementById('btn-type-kunjungan');

  state.capturedPhotoBase64 = null;
  state.attendanceType = 'hadir';

  const tabIn = document.getElementById('tab-mode-in');
  const tabOut = document.getElementById('tab-mode-out');
  const sectionInOnly = document.getElementById('section-absen-masuk-only');
  const bannerOut = document.getElementById('banner-absen-pulang');
  const titleText = document.getElementById('attendance-title-text');

  const setAttendanceMode = (mode) => {
    state.attendanceMode = mode;
    if (mode === 'out') {
      if (tabIn) { tabIn.className = 'btn btn-secondary'; }
      if (tabOut) { tabOut.className = 'btn btn-primary'; }
      if (sectionInOnly) sectionInOnly.style.display = 'none';
      if (bannerOut) bannerOut.style.display = 'flex';
      if (titleText) titleText.textContent = 'Absen Pulang Karyawan';
      if (btnSubmit) btnSubmit.innerHTML = `${uiIcon('check', '', 18)} KIRIM ABSEN PULANG SEKARANG`;
      window.history.replaceState(null, '', '#attendance?mode=out');
    } else {
      if (tabIn) { tabIn.className = 'btn btn-primary'; }
      if (tabOut) { tabOut.className = 'btn btn-secondary'; }
      if (sectionInOnly) sectionInOnly.style.display = 'block';
      if (bannerOut) bannerOut.style.display = 'none';
      if (titleText) titleText.textContent = 'Absen Masuk Karyawan';
      if (btnSubmit) btnSubmit.innerHTML = `${uiIcon('check', '', 18)} KIRIM ABSEN MASUK SEKARANG`;
      window.history.replaceState(null, '', '#attendance?mode=in');
    }
  };

  if (tabIn) tabIn.addEventListener('click', () => setAttendanceMode('in'));
  if (tabOut) tabOut.addEventListener('click', () => setAttendanceMode('out'));

  // Toggle Type Kehadiran (Q05)
  if (btnTypeHadir && btnTypeKunjungan) {
    btnTypeHadir.addEventListener('click', () => {
      state.attendanceType = 'hadir';
      btnTypeHadir.className = 'btn btn-primary';
      btnTypeKunjungan.className = 'btn btn-secondary';
      document.getElementById('group-branch-select').style.display = 'block';
      document.getElementById('gps-status-box').style.display = 'flex';
      showToast('Mode Hadir Toko: Wajib di radius toko, dapat uang makan Rp10.000.', 'info');
    });

    btnTypeKunjungan.addEventListener('click', () => {
      state.attendanceType = 'kunjungan_luar';
      btnTypeKunjungan.className = 'btn btn-primary';
      btnTypeHadir.className = 'btn btn-secondary';
      document.getElementById('group-branch-select').style.display = 'none';
      document.getElementById('gps-status-box').style.display = 'none';
      showToast('Mode Kunjungan Luar: Bebas radius toko, TIDAK dapat uang makan.', 'warning');
    });
  }

  // Camera Controller Setup
  const nativeCamInput = document.getElementById('camera-native-input');
  const nativeCamRear = document.getElementById('camera-native-rear');
  const btnOpenNativeCam = document.getElementById('btn-open-native-camera');
  const btnTriggerFront = document.getElementById('btn-trigger-front-cam');
  const btnTriggerRear = document.getElementById('btn-trigger-rear-cam');
  const btnTriggerFile = document.getElementById('btn-trigger-file');
  const btnSwitchCam = document.getElementById('btn-switch-camera');
  const cameraControls = document.getElementById('camera-controls');
  const fallbackCard = document.getElementById('camera-fallback-card');
  const httpsTip = document.getElementById('camera-https-tip');

  // Check if accessing over plain HTTP from a network device (Tailscale/LAN IP)
  const isNetworkHttp = window.location.protocol === 'http:' &&
    window.location.hostname !== 'localhost' &&
    window.location.hostname !== '127.0.0.1';
  if (isNetworkHttp && httpsTip) {
    httpsTip.style.display = 'block';
  }

  // Helper to process, compress and preview an image from file/camera input
  const processImageFile = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (re) => {
      const img = new Image();
      img.onload = () => {
        // Optimal downscale to max 1280x960
        const maxW = 1280;
        const maxH = 960;
        let w = img.width;
        let h = img.height;
        if (w > maxW || h > maxH) {
          if (w / h > maxW / maxH) {
            h = Math.round((h * maxW) / w);
            w = maxW;
          } else {
            w = Math.round((w * maxH) / h);
            h = maxH;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        state.capturedPhotoBase64 = dataUrl;

        stopCamera();
        if (photoPreview) {
          photoPreview.src = dataUrl;
          photoPreview.style.display = 'block';
        }
        if (video) video.style.display = 'none';
        if (cameraControls) cameraControls.style.display = 'none';
        if (fallbackCard) fallbackCard.style.display = 'none';
        if (btnRetake) btnRetake.style.display = 'inline-flex';
        showToast('Foto bukti berhasil diambil!', 'success');
      };
      img.src = re.target.result;
    };
    reader.readAsDataURL(file);
  };

  // Wire file input change listeners
  if (nativeCamInput) nativeCamInput.addEventListener('change', (e) => processImageFile(e.target.files[0]));
  if (nativeCamRear) nativeCamRear.addEventListener('change', (e) => processImageFile(e.target.files[0]));
  if (fileFallback) fileFallback.addEventListener('change', (e) => processImageFile(e.target.files[0]));

  // Wire trigger buttons
  if (btnOpenNativeCam) btnOpenNativeCam.addEventListener('click', () => {
    if (nativeCamInput) nativeCamInput.click();
  });
  if (btnTriggerFront) btnTriggerFront.addEventListener('click', () => {
    if (state.cameraStream) {
      startLiveCamera('user');
    } else if (nativeCamInput) {
      nativeCamInput.click();
    }
  });
  if (btnTriggerRear) btnTriggerRear.addEventListener('click', () => {
    if (state.cameraStream) {
      startLiveCamera('environment');
    } else if (nativeCamRear) {
      nativeCamRear.click();
    }
  });
  if (btnTriggerFile) btnTriggerFile.addEventListener('click', () => {
    if (fileFallback) fileFallback.click();
  });

  // Live Camera stream manager
  let currentFacingMode = 'user';
  const startLiveCamera = (facing = 'user') => {
    stopCamera();
    currentFacingMode = facing;
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: facing }, width: { ideal: 1280 }, height: { ideal: 720 } }
      }).then(stream => {
        state.cameraStream = stream;
        if (video) {
          video.srcObject = stream;
          video.style.display = 'block';
        }
        if (photoPreview) photoPreview.style.display = 'none';
        if (cameraControls) cameraControls.style.display = 'flex';
        if (fallbackCard) fallbackCard.style.display = 'none';
      }).catch(err => {
        console.warn('[Camera Access Warning]', err.name, err.message);
        if (video) video.style.display = 'none';
        if (cameraControls) cameraControls.style.display = 'none';
        if (fallbackCard) fallbackCard.style.display = 'block';
      });
    } else {
      if (video) video.style.display = 'none';
      if (cameraControls) cameraControls.style.display = 'none';
      if (fallbackCard) fallbackCard.style.display = 'block';
    }
  };

  // Flip camera toggle
  if (btnSwitchCam) {
    btnSwitchCam.addEventListener('click', () => {
      startLiveCamera(currentFacingMode === 'user' ? 'environment' : 'user');
    });
  }

  // Snapshot from live video
  if (btnTake) {
    btnTake.addEventListener('click', () => {
      if (video && video.videoWidth) {
        const canvas = document.getElementById('camera-canvas') || document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        state.capturedPhotoBase64 = dataUrl;

        stopCamera();
        if (photoPreview) {
          photoPreview.src = dataUrl;
          photoPreview.style.display = 'block';
        }
        if (video) video.style.display = 'none';
        if (cameraControls) cameraControls.style.display = 'none';
        if (btnRetake) btnRetake.style.display = 'inline-flex';
        showToast('Foto bukti berhasil diambil!', 'success');
      } else {
        // If live stream hasn't produced frames, trigger native camera
        if (nativeCamInput) nativeCamInput.click();
      }
    });
  }

  // Retake photo action
  if (btnRetake) {
    btnRetake.addEventListener('click', () => {
      state.capturedPhotoBase64 = null;
      if (photoPreview) photoPreview.style.display = 'none';
      btnRetake.style.display = 'none';
      startLiveCamera(currentFacingMode);
    });
  }

  // Start live camera stream upon view initialization
  startLiveCamera('user');

  // GPS
  const getTargetBranch = () => {
    const bId = branchSelect ? branchSelect.value : null;
    return state.branches.find(b => b.id === bId) || state.branches[0] || {};
  };

  const updateGpsUI = () => {
    const title = document.getElementById('gps-status-title');
    const text = document.getElementById('gps-coords-text');
    if (!title || !text) return;

    if (state.currentGps.lat) {
      title.textContent = state.currentGps.isWithinRadius
        ? '✅ Sesuai Area Cabang Toko'
        : `⚠️ Di Luar Radius Cabang (${state.currentGps.distance}m)`;
      title.style.color = state.currentGps.isWithinRadius ? '#137333' : '#C90000';
      text.textContent = `Lat: ${state.currentGps.lat.toFixed(6)}, Lon: ${state.currentGps.lon.toFixed(6)} (Akurasi: ±${state.currentGps.accuracy}m)`;
    } else {
      title.textContent = 'Mencari Lokasi GPS...';
      text.textContent = 'Aktifkan izin lokasi browser';
    }
  };

  const checkDistance = () => {
    const branch = getTargetBranch();
    if (state.currentGps.lat && branch.latitude && branch.longitude) {
      const d = haversine(state.currentGps.lat, state.currentGps.lon, parseFloat(branch.latitude), parseFloat(branch.longitude));
      state.currentGps.distance = Math.round(d);
      state.currentGps.isWithinRadius = state.currentGps.distance <= (branch.radius_m || 150);
    }
    updateGpsUI();
  };

  if (branchSelect) {
    branchSelect.addEventListener('change', () => {
      if (shiftSelect) shiftSelect.innerHTML = renderShiftOptions(branchSelect.value);
      checkDistance();
    });
  }

  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        state.currentGps.lat = pos.coords.latitude;
        state.currentGps.lon = pos.coords.longitude;
        state.currentGps.accuracy = Math.round(pos.coords.accuracy);
        checkDistance();
      },
      (err) => {
        console.warn('[GPS Error]', err.message);
        const title = document.getElementById('gps-status-title');
        if (title) title.textContent = 'GPS Browser Belum Terdeteksi';
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }

  // Submit
  if (btnSubmit) {
    btnSubmit.addEventListener('click', async () => {
      const isOut = state.attendanceMode === 'out';
      const branchId = isOut ? null : (branchSelect ? branchSelect.value : null);
      const shiftId = isOut ? null : (shiftSelect ? shiftSelect.value : null);
      const idempotencyKey = `${isOut ? 'OUT' : 'IN'}-${state.user.id}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

      btnSubmit.disabled = true;
      btnSubmit.textContent = isOut ? 'MENGIRIM ABSEN PULANG...' : 'MENGIRIM ABSEN KE SERVER...';

      const payload = {
        branch_id: branchId,
        shift_id: shiftId,
        attendance_type: isOut ? null : state.attendanceType, // 'hadir' atau 'kunjungan_luar'
        latitude: state.currentGps.lat,
        longitude: state.currentGps.lon,
        accuracy_m: state.currentGps.accuracy,
        photo_base64: state.capturedPhotoBase64,
        device_time: new Date().toISOString(),
        idempotency_key: idempotencyKey
      };

      const endpoint = isOut ? '/api/v1/attendance/check-out' : '/api/v1/attendance/check-in';
      const res = await api(endpoint, {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      btnSubmit.disabled = false;
      btnSubmit.innerHTML = isOut
        ? `${uiIcon('check', '', 18)} KIRIM ABSEN PULANG SEKARANG`
        : `${uiIcon('check', '', 18)} KIRIM ABSEN MASUK SEKARANG`;

      if (res.ok && res.data.success) {
        showToast(res.data.message || (isOut ? 'Absen pulang berhasil dicatat!' : 'Absen berhasil dicatat!'), 'success');
        await loadInitialData();
        state.route = '#home';
        window.location.hash = '#home';
        render();
      } else {
        showToast(res.data.error || 'Gagal mengirim absen.', 'error');
      }
    });
  }
}

function stopCamera() {
  if (state.cameraStream) {
    state.cameraStream.getTracks().forEach(t => t.stop());
    state.cameraStream = null;
  }
}

// --- Management View Controller ---
async function initManagementView() {
  document.querySelectorAll('.nav-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      state.activeManagementTab = btn.dataset.tab;
      render();
    });
  });

  const btnRefresh = document.getElementById('btn-refresh-monitoring');
  if (btnRefresh) {
    btnRefresh.addEventListener('click', () => {
      initManagementView();
      showToast('Data dimuat ulang!', 'info');
    });
  }

  if (state.activeManagementTab === 'monitoring') {
    await loadMonitoringData();
  } else if (state.activeManagementTab === 'recap') {
    setupRecapFilterListeners();
    await loadMonthlyRecapData();
  } else if (state.activeManagementTab === 'payroll') {
    await loadPayrollData();
  } else if (state.activeManagementTab === 'master') {
    await loadMasterData();
  } else if (state.activeManagementTab === 'schedules') {
    await loadScheduleForms();
  }
}

async function loadMonitoringData() {
  const res = await api('/api/v1/attendance/monitoring');
  if (res.ok && res.data.records) {
    const summary = res.data.summary || {};
    const kpiKaryawan = document.getElementById('kpi-total-karyawan');
    const kpiHadir = document.getElementById('kpi-total-hadir');
    const kpiKunjungan = document.getElementById('kpi-kunjungan-luar');

    if (kpiKaryawan) kpiKaryawan.textContent = summary.totalKaryawan || 0;
    if (kpiHadir) kpiHadir.textContent = summary.hadir || 0;
    if (kpiKunjungan) kpiKunjungan.textContent = summary.kunjunganLuar || 0;

    const tbody = document.getElementById('monitoring-table-body');
    if (!tbody) return;

    if (res.data.records.length === 0) {
      tbody.innerHTML = `<tr><td colspan="9" class="cell-empty">Belum ada data kehadiran hari ini.</td></tr>`;
      return;
    }

    tbody.innerHTML = res.data.records.map(r => {
      const inTime = r.check_in_time ? new Date(r.check_in_time).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-';
      const outTime = r.check_out_time ? new Date(r.check_out_time).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-';
      const isKunjungan = r.attendance_type === 'kunjungan_luar';
      const mealText = isKunjungan
        ? `<span class="badge badge-warning">Rp0 (Kunjungan)</span>`
        : (r.check_in_time ? `<span class="badge badge-success">Rp10.000</span>` : `-`);

      const locBadge = isKunjungan
        ? `<span class="badge badge-info">Luar Kantor</span>`
        : (r.is_location_valid === true
            ? `<span class="badge badge-success">Sesuai Area</span>`
            : (r.check_in_time ? `<span class="badge badge-danger">Luar Radius</span>` : `-`));

      const outBadge = r.check_out_time
        ? `<span class="badge badge-success" style="font-weight:700;">${outTime}</span>`
        : (r.check_in_time ? `<span class="badge badge-warning">Belum Pulang</span>` : `-`);

      return `
        <tr>
          <td class="cell-title" data-label="Nama"><strong>${escapeHtml(r.employee_name)}</strong> <small class="cell-code">${escapeHtml(r.employee_code)}</small></td>
          <td data-label="Cabang">${escapeHtml(r.branch_name || '-')}</td>
          <td data-label="Shift"><span class="badge badge-info" style="font-weight:600;">${escapeHtml(r.shift_name || 'Non-Shift')}</span></td>
          <td data-label="Jam Masuk">${inTime}</td>
          <td data-label="Jam Pulang">${outBadge}</td>
          <td data-label="Tipe Hadir">${isKunjungan ? `<span style="display:inline-flex; align-items:center; gap:4px;">${uiIcon('car', '', 14)} Kunjungan Luar</span>` : (r.check_in_time ? `<span style="display:inline-flex; align-items:center; gap:4px;">${uiIcon('building', '', 14)} Hadir Toko</span>` : '<span style="color:var(--text-muted);">Belum Absen</span>')}</td>
          <td data-label="Uang Makan">${mealText}</td>
          <td data-label="Lokasi GPS">${locBadge}</td>
          <td class="cell-actions" data-label="Aksi">
            <button class="btn btn-secondary btn-adjust btn-sm"
              data-session="${r.session_id || ''}"
              data-emp-id="${r.employee_id}"
              data-emp-name="${escapeHtml(r.employee_name)}"
              data-emp-code="${escapeHtml(r.employee_code)}"
              data-branch-id="${r.branch_id || ''}"
              data-shift-id="${r.shift_id || ''}"
              data-status="${r.session_status || 'present'}"
              data-date="${r.work_date || res.data.date || ''}"
              title="Koreksi jadwal shift & absensi staf">
              ${uiIcon('edit', '', 14)} Koreksi
            </button>
          </td>
        </tr>
      `;
    }).join('');

    document.querySelectorAll('.btn-adjust').forEach(btn => {
      btn.addEventListener('click', () => {
        openAdjustmentModal({
          sessionId: btn.dataset.session || null,
          empId: btn.dataset.empId,
          empName: btn.dataset.empName,
          empCode: btn.dataset.empCode,
          branchId: btn.dataset.branchId,
          shiftId: btn.dataset.shiftId,
          status: btn.dataset.status,
          date: btn.dataset.date
        });
      });
    });
  }
}

// --- Fungsi Rekapitulasi Bulanan Staf ---
function setupRecapFilterListeners() {
  const btnApply = document.getElementById('btn-apply-recap-filter');
  if (btnApply) {
    btnApply.addEventListener('click', async () => {
      const monthSelect = document.getElementById('recap-filter-month');
      const yearSelect = document.getElementById('recap-filter-year');
      const branchSelect = document.getElementById('recap-filter-branch');
      if (monthSelect) state.recapMonth = parseInt(monthSelect.value, 10);
      if (yearSelect) state.recapYear = parseInt(yearSelect.value, 10);
      if (branchSelect) state.recapBranchId = branchSelect.value;
      await loadMonthlyRecapData();
      showToast('Rekap bulanan diperbarui!', 'info');
    });
  }

  const btnRefresh = document.getElementById('btn-refresh-recap');
  if (btnRefresh) {
    btnRefresh.addEventListener('click', async () => {
      await loadMonthlyRecapData();
      showToast('Data rekap disinkronkan!', 'info');
    });
  }
}

async function loadMonthlyRecapData() {
  const month = state.recapMonth || (new Date().getMonth() + 1);
  const year = state.recapYear || new Date().getFullYear();
  const branchId = state.recapBranchId || '';

  let query = `/api/v1/attendance/monthly-recap?year=${year}&month=${month}`;
  if (branchId) query += `&branch_id=${encodeURIComponent(branchId)}`;

  const res = await api(query);
  if (!res.ok || !res.data) {
    showToast(res.data?.error || 'Gagal memuat rekap bulanan', 'error');
    return;
  }

  state.recapData = res.data;
  const summary = res.data.summary || {};

  const kpiEmp = document.getElementById('recap-kpi-employees');
  const kpiHadir = document.getElementById('recap-kpi-hadir');
  const kpiKunjungan = document.getElementById('recap-kpi-kunjungan');
  const kpiLembur = document.getElementById('recap-kpi-lembur');
  const kpiLibur = document.getElementById('recap-kpi-libur');
  const kpiUangMakan = document.getElementById('recap-kpi-uangmakan');

  if (kpiEmp) kpiEmp.textContent = summary.totalEmployees ?? 0;
  if (kpiHadir) kpiHadir.textContent = summary.totalHadirFisik ?? 0;
  if (kpiKunjungan) kpiKunjungan.textContent = summary.totalKunjunganLuar ?? 0;
  if (kpiLembur) kpiLembur.textContent = summary.totalLembur ?? 0;
  if (kpiLibur) kpiLibur.textContent = `${summary.totalLibur ?? 0} hari`;
  if (kpiUangMakan) kpiUangMakan.textContent = `Rp ${formatNumber(summary.totalUangMakan || 0)}`;

  const tbody = document.getElementById('monthly-recap-table-body');
  if (!tbody) return;

  const recapList = res.data.recap || [];
  if (recapList.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" class="cell-empty">Tidak ada data staf untuk filter ini.</td></tr>`;
    return;
  }

  tbody.innerHTML = recapList.map((item, idx) => {
    return `
      <tr>
        <td class="cell-title" data-label="Staf">
          <strong>${escapeHtml(item.employee_name)}</strong>
          <small class="cell-code" style="display:block; color:var(--text-muted);">${escapeHtml(item.job_title || '-')}</small>
        </td>
        <td data-label="Cabang">
          <span class="badge badge-secondary" style="font-size: 0.74rem;">${escapeHtml(item.branch_name || 'Semua Cabang')}</span>
        </td>
        <td data-label="Hadir">
          <strong>${item.totalHadirFisik}</strong>
        </td>
        <td data-label="Kunjungan">
          ${item.totalKunjunganLuar > 0 ? `<span class="badge badge-info">${item.totalKunjunganLuar}</span>` : '<span style="color:var(--text-muted);">0</span>'}
        </td>
        <td data-label="Lembur">
          ${item.totalLembur > 0 ? `<span class="badge badge-warning" style="background:#fef3c7; color:#92400e; font-weight:700;">${uiIcon('zap', '', 11)} ${item.totalLembur}</span>` : '<span style="color:var(--text-muted);">0</span>'}
        </td>
        <td data-label="Libur">
          <span class="badge badge-secondary" style="background:#f1f5f9; color:#334155; font-weight:700;">${item.totalLibur ?? 0} hr</span>
        </td>
        <td data-label="Jam Kerja">
          ${item.totalJamKerja} j
        </td>
        <td data-label="Uang Makan" style="text-align: right;">
          <strong style="color: var(--primary-red);">Rp ${formatNumber(item.totalUangMakan)}</strong>
        </td>
        <td data-label="Aksi" style="text-align: right;">
          <button class="btn btn-secondary btn-sm btn-recap-detail" onclick="openStaffDailyRecapModalByIndex(${idx})">
            ${uiIcon('search', '', 13)} Rincian
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

window.openStaffDailyRecapModalByIndex = function(idx) {
  if (!state.recapData || !state.recapData.recap || !state.recapData.recap[idx]) return;
  const item = state.recapData.recap[idx];
  const period = state.recapData.period || {};

  const modalContainer = document.getElementById('modal-container');
  if (!modalContainer) return;

  const records = item.dailyRecords || [];
  const recordsHtml = records.length === 0 ? `
    <tr><td colspan="7" class="cell-empty">Tidak ada riwayat absensi pada bulan ini.</td></tr>
  ` : records.map(r => {
    const isLembur = r.isLembur;
    const shiftBadge = isLembur
      ? `<span class="badge badge-warning" style="background:#fef3c7; color:#92400e; font-weight:600;">${uiIcon('zap', '', 12)} ${escapeHtml(r.shift_name)}</span>`
      : `<span class="badge badge-secondary">${escapeHtml(r.shift_name || '-')}</span>`;

    const statusBadge = r.status === 'late'
      ? `<span class="badge badge-danger">Terlambat</span>`
      : `<span class="badge badge-present">Tepat Waktu</span>`;

    const typeBadge = r.isKunjungan
      ? `<span class="badge badge-info">${uiIcon('car', '', 12)} Kunjungan</span>`
      : `<span class="badge badge-present">${uiIcon('building', '', 12)} Hadir Toko</span>`;

    const checkIn = r.check_in_time ? new Date(r.check_in_time).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-';
    const checkOut = r.check_out_time ? new Date(r.check_out_time).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-';

    return `
      <tr>
        <td><strong>${escapeHtml(r.work_date)}</strong></td>
        <td>${shiftBadge}</td>
        <td>${typeBadge}</td>
        <td>${checkIn} - ${checkOut}</td>
        <td>${statusBadge}</td>
        <td>${(r.durasiMenit / 60).toFixed(1)} jam</td>
        <td>${r.uangMakan > 0 ? `Rp ${formatNumber(r.uangMakan)}` : '-'}</td>
      </tr>
    `;
  }).join('');

  modalContainer.innerHTML = `
    <div class="modal-overlay active" onclick="if(event.target===this) closeModal()">
      <div class="modal-card" style="max-width: 840px; width: 95%; max-height: 90vh;">
        <div class="modal-header" style="background: linear-gradient(135deg, var(--primary-red), #9E0000); color: #fff;">
          <div>
            <h3 class="modal-title" style="color: #fff; font-size: 1.15rem; font-weight: 700; margin: 0; display:flex; align-items:center; gap:8px;">
              ${uiIcon('search', '', 18)} Rincian Kehadiran: ${escapeHtml(item.employee_name)}
            </h3>
            <div style="font-size: 0.8rem; color: rgba(255,255,255,0.85); margin-top: 4px;">Periode: ${period.startDate || ''} s.d. ${period.endDate || ''} • Cabang: ${escapeHtml(item.branch_name || 'Semua Cabang')} • Libur Rutin: <strong style="color: #fef08a;">${escapeHtml(item.day_off || '-')}</strong></div>
          </div>
          <button type="button" class="btn btn-secondary" onclick="closeModal()" style="color:#fff; background:none; border:none; font-size:1.4rem; cursor:pointer; line-height:1; padding:4px 8px;">✕</button>
        </div>
        <div class="modal-body" style="max-height: calc(90vh - 140px); overflow-y: auto;">
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 10px; margin-bottom: 16px; background: #f8fafc; padding: 12px; border-radius: 8px;">
            <div>
              <div style="font-size: 0.75rem; color: var(--text-muted);">Hadir Toko</div>
              <div style="font-size: 1.1rem; font-weight: 700;">${item.totalHadirFisik} hari</div>
            </div>
            <div>
              <div style="font-size: 0.75rem; color: var(--text-muted);">Kunjungan Luar</div>
              <div style="font-size: 1.1rem; font-weight: 700;">${item.totalKunjunganLuar} hari</div>
            </div>
            <div>
              <div style="font-size: 0.75rem; color: var(--text-muted);">Shift Lembur</div>
              <div style="font-size: 1.1rem; font-weight: 700; color: #b45309;">${item.totalLembur} shift</div>
            </div>
            <div>
              <div style="font-size: 0.75rem; color: var(--text-muted);">Hari Libur</div>
              <div style="font-size: 1.1rem; font-weight: 700; color: #4338ca;">${item.totalLibur ?? 0} hari</div>
            </div>
            <div>
              <div style="font-size: 0.75rem; color: var(--text-muted);">Uang Makan</div>
              <div style="font-size: 1.1rem; font-weight: 700; color: var(--primary-red);">Rp ${formatNumber(item.totalUangMakan)}</div>
            </div>
          </div>

          <div class="table-responsive">
            <table class="table" style="font-size: 0.85rem;">
              <thead>
                <tr>
                  <th>Tanggal</th>
                  <th>Shift</th>
                  <th>Tipe</th>
                  <th>Jam Kerja</th>
                  <th>Status</th>
                  <th>Durasi</th>
                  <th>Uang Makan</th>
                </tr>
              </thead>
              <tbody>
                ${recordsHtml}
              </tbody>
            </table>
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" onclick="closeModal()">Tutup</button>
        </div>
      </div>
    </div>
  `;
};

// --- Fungsi Memuat Tabel Slip Gaji Per Staf (Q06) ---
async function loadStaffSlipsTable(tbodyId) {
  const tbody = document.getElementById(tbodyId);
  if (!tbody) return;

  const res = await api('/api/v1/payroll/staff-slips');
  if (!res.ok || !res.data.staff) {
    tbody.innerHTML = `<tr><td colspan="4" class="cell-empty" style="color: var(--primary-red);">Gagal memuat daftar staf.</td></tr>`;
    return;
  }

  const staffList = res.data.staff;
  if (staffList.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" class="cell-empty">Tidak ada data staf aktif.</td></tr>`;
    return;
  }

  tbody.innerHTML = staffList.map(s => {
    const hasSlip = !!s.pdf_path;
    const slipStatusBadge = hasSlip
      ? `<span class="badge badge-success badge-wrap">${uiIcon('file-text', '', 14)} ${escapeHtml(s.original_filename || 'Slip Gaji.pdf')} (${Math.round((s.file_size || 0)/1024)} KB)</span><div class="cell-note">Terbit: ${new Date(s.published_at).toLocaleDateString('id-ID')} • ${escapeHtml(s.period_label || '')}</div>`
      : `<span class="badge badge-warning">${uiIcon('alert-circle', '', 12)} Belum Ada Slip PDF</span>`;

    const phoneDisplay = s.phone
      ? `<div class="cell-note" style="display:inline-flex; align-items:center; gap:4px;">
           <span>WA: ${escapeHtml(s.phone)}</span>
           <button type="button" class="btn-edit-staff-phone" data-id="${s.employee_id}" data-name="${escapeHtml(s.employee_name)}" data-phone="${escapeHtml(s.phone)}" style="background:none; border:none; color:var(--text-muted); cursor:pointer; font-size:0.75rem; padding:0 2px;" title="Ubah nomor WhatsApp">✎</button>
         </div>`
      : `<div class="cell-note" style="display:inline-flex; align-items:center; gap:4px;">
           <span style="color:var(--status-late); font-weight:600;">No WA belum ada</span>
           <button type="button" class="btn-set-staff-phone" data-id="${s.employee_id}" data-name="${escapeHtml(s.employee_name)}" data-phone="" style="background:none; border:none; color:var(--primary-red); cursor:pointer; font-size:0.75rem; padding:0 2px; font-weight:700;" title="Input nomor WhatsApp">+ No WA</button>
         </div>`;

    return `
      <tr>
        <td class="cell-title" data-label="Anggota Staf">
          <strong>${escapeHtml(s.employee_name)}</strong> <small class="cell-code">${escapeHtml(s.employee_code)}</small>
          ${phoneDisplay}
        </td>
        <td class="cell-full" data-label="Cabang / Jabatan">
          <div>${escapeHtml(s.branch_name || 'Head Quarter')}</div>
          <div class="cell-note">${escapeHtml(s.job_title || 'Crew Toko')}</div>
        </td>
        <td class="cell-full" data-label="Slip PDF Terakhir">${slipStatusBadge}</td>
        <td class="cell-actions" data-label="Aksi">
          <div class="action-group">
            <button class="btn btn-primary btn-sm btn-upload-slip-for-staff" data-id="${s.employee_id}" data-name="${escapeHtml(s.employee_name)}">
              ${uiIcon('upload', '', 14)} ${hasSlip ? 'Ganti PDF' : 'Upload PDF'}
            </button>
            ${hasSlip ? `
              <a href="/api/v1/payroll/slips/${s.payslip_id}/download" target="_blank" class="btn btn-secondary btn-sm">
                ${uiIcon('download', '', 14)} Unduh
              </a>
            ` : ''}
            ${s.whatsAppReminderLink ? `
              <a href="${s.whatsAppReminderLink}" target="_blank" class="btn btn-sm btn-wa" title="Kirim Notifikasi via WhatsApp (${escapeHtml(s.phone)})">
                ${uiIcon('smartphone', '', 14)} WA
              </a>
            ` : `
              <button type="button" class="btn btn-sm btn-wa-outline btn-set-staff-phone" data-id="${s.employee_id}" data-name="${escapeHtml(s.employee_name)}" title="Set nomor WhatsApp agar bisa kirim notifikasi">
                ${uiIcon('smartphone', '', 14)} + No WA
              </button>
            `}
          </div>
        </td>
      </tr>
    `;
  }).join('');

  tbody.querySelectorAll('.btn-upload-slip-for-staff').forEach(btn => {
    btn.addEventListener('click', () => {
      openUploadSlipPdfModal([], btn.dataset.id);
    });
  });

  tbody.querySelectorAll('.btn-edit-staff-phone, .btn-set-staff-phone').forEach(btn => {
    btn.addEventListener('click', () => {
      openUpdateEmployeePhoneModal(btn.dataset.id, btn.dataset.name, btn.dataset.phone || '');
    });
  });
}

async function loadPayrollData() {
  const container = document.getElementById('payroll-runs-container');

  // Load tabel slip gaji staf (Q06)
  loadStaffSlipsTable('payroll-staff-slips-tbody');
  const btnRefreshStaffPayroll = document.getElementById('btn-refresh-staff-slips-payroll');
  if (btnRefreshStaffPayroll) {
    btnRefreshStaffPayroll.addEventListener('click', () => loadStaffSlipsTable('payroll-staff-slips-tbody'));
  }

  if (!container) return;

  const [runsRes, periodsRes] = await Promise.all([
    api('/api/v1/payroll/runs'),
    api('/api/v1/payroll/periods')
  ]);

  const periods = (periodsRes.ok && periodsRes.data.periods) || [];
  const runs = (runsRes.ok && runsRes.data.runs) || [];

  container.innerHTML = `
    <div style="margin-bottom: 20px;">
      <h4 style="font-size: 1rem; font-weight: 700; margin-bottom: 10px; display: flex; align-items: center; gap: 6px;">
        ${uiIcon('settings', '', 16)} Proses Payroll Periode 27–26
      </h4>
      ${runs.length === 0 ? `
        <p style="color: var(--text-muted); font-size: 0.88rem;">Belum ada draft kalkulasi payroll. Anda bisa klik "Hitung Draft" atau langsung klik "Unggah Slip Gaji (PDF)".</p>
      ` : `
        <div class="table-responsive">
          <table class="table table-stack">
            <thead>
              <tr>
                <th>Periode</th>
                <th>Versi</th>
                <th>Karyawan</th>
                <th>Total Nominal</th>
                <th>Status</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              ${runs.map(run => `
                <tr>
                  <td class="cell-title" data-label="Periode"><strong>${escapeHtml(run.period_label)}</strong></td>
                  <td data-label="Versi">v${run.version}</td>
                  <td data-label="Karyawan">${run.total_karyawan || 0} orang</td>
                  <td data-label="Total Nominal">Rp ${formatNumber(run.total_net_pay || 0)}</td>
                  <td data-label="Status"><span class="badge ${run.status === 'published' ? 'badge-success' : 'badge-warning'}">${run.status.toUpperCase()}</span></td>
                  <td class="cell-actions" data-label="Aksi">
                    <div class="action-group">
                      <button class="btn btn-secondary btn-sm btn-view-run" data-run="${run.id}">
                        ${uiIcon('search', '', 14)} Rincian
                      </button>
                      ${state.user.isOwner && run.status !== 'published' ? `
                        <button class="btn btn-primary btn-sm btn-finalize-run" data-run="${run.id}">
                          ${uiIcon('crown', '', 14)} Finalisasi
                        </button>
                      ` : ''}
                    </div>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `}
    </div>
  `;

  document.querySelectorAll('.btn-view-run').forEach(btn => {
    btn.addEventListener('click', () => openRunDetailModal(btn.dataset.run));
  });

  document.querySelectorAll('.btn-finalize-run').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (confirm('Finalisasi payroll ini dan terbitkan slip gaji?')) {
        const res = await api(`/api/v1/payroll/runs/${btn.dataset.run}/finalize`, { method: 'POST' });
        if (res.ok) {
          showToast('Payroll berhasil difinalisasi!', 'success');
          loadPayrollData();
        } else {
          showToast(res.data.error || 'Gagal finalisasi.', 'error');
        }
      }
    });
  });

  const btnUploadModal = document.getElementById('btn-upload-pdf-modal');
  if (btnUploadModal) {
    btnUploadModal.addEventListener('click', () => openUploadSlipPdfModal(periods));
  }

  const btnCalc = document.getElementById('btn-calculate-payroll');
  if (btnCalc) {
    btnCalc.addEventListener('click', async () => {
      if (periods.length === 0) {
        showToast('Tidak ada periode aktif.', 'error');
        return;
      }
      btnCalc.disabled = true;
      btnCalc.textContent = 'Menghitung...';

      const res = await api('/api/v1/payroll/runs/calculate', {
        method: 'POST',
        body: JSON.stringify({ period_id: periods[0].id })
      });
      btnCalc.disabled = false;
      btnCalc.innerHTML = `${uiIcon('zap', '', 16)} Hitung Draft`;

      if (res.ok) {
        showToast('Draft payroll berhasil dihitung sesuai aturan Q05!', 'success');
        loadPayrollData();
      } else {
        showToast(res.data.error || 'Gagal menghitung.', 'error');
      }
    });
  }

  const btnCommModal = document.getElementById('btn-input-commission-modal');
  if (btnCommModal) {
    btnCommModal.addEventListener('click', () => openCommissionModal(periods));
  }
}

async function loadMasterData() {
  const empRes = await api('/api/v1/employees');
  const tbody = document.getElementById('master-employee-body');
  if (!tbody) return;

  if (empRes.ok && empRes.data.employees) {
    state.employees = empRes.data.employees;
    const dynContainer = document.getElementById('dynamic-day-off-rules-list');
    if (dynContainer) {
      dynContainer.innerHTML = renderDynamicDayOffRules(empRes.data.employees);
    }

    tbody.innerHTML = empRes.data.employees.length === 0
      ? `<tr><td colspan="5" class="cell-empty">Belum ada karyawan.</td></tr>`
      : empRes.data.employees.map(e => `
      <tr>
        <td class="cell-title" data-label="Nama">
          <strong>${escapeHtml(e.name)}</strong> <small class="cell-code">${escapeHtml(e.employee_code)}</small>
          <div class="cell-note" style="display:inline-flex; align-items:center; gap:8px; flex-wrap:wrap; margin-top:2px;">
            <span>WA: ${escapeHtml(e.phone || 'Belum diisi')}</span>
            <button type="button" class="btn-edit-phone-master" data-id="${e.id}" data-name="${escapeHtml(e.name)}" data-phone="${escapeHtml(e.phone || '')}" style="background:none; border:none; color:var(--primary-red); cursor:pointer; font-size:0.75rem; padding:0 2px;" title="Ubah nomor WhatsApp">✎</button>
            <span style="color:var(--border-color, #cbd5e1);">•</span>
            <span style="font-weight:600; color:#4f46e5;">Libur: ${escapeHtml(e.day_off || 'Ahad')}</span>
            <button type="button" class="btn-edit-dayoff-master" data-id="${e.id}" data-name="${escapeHtml(e.name)}" data-dayoff="${escapeHtml(e.day_off || 'Ahad')}" style="background:none; border:none; color:#4f46e5; cursor:pointer; font-size:0.75rem; padding:0 2px;" title="Ubah Hari Libur Tetap">✎</button>
          </div>
        </td>
        <td data-label="Jabatan">${escapeHtml(e.job_title || 'Crew Toko')}</td>
        <td data-label="Cabang">${escapeHtml(e.branch_name || 'Head Quarter')}</td>
        <td data-label="Status"><span class="badge badge-success">Aktif</span></td>
        <td class="cell-actions" data-label="Aksi">
          <button class="btn btn-secondary btn-sm btn-reset-emp-pwd" data-id="${e.id}" title="Reset password jika karyawan lupa">
            ${uiIcon('key', '', 14)} Reset Password
          </button>
        </td>
      </tr>
    `).join('');

    document.querySelectorAll('.btn-reset-emp-pwd').forEach(btn => {
      btn.addEventListener('click', () => {
        const emp = empRes.data.employees.find(x => x.id === btn.dataset.id);
        if (emp) openResetEmployeePasswordModal(emp);
      });
    });

    document.querySelectorAll('.btn-edit-phone-master').forEach(btn => {
      btn.addEventListener('click', () => {
        openUpdateEmployeePhoneModal(btn.dataset.id, btn.dataset.name, btn.dataset.phone || '');
      });
    });

    document.querySelectorAll('.btn-edit-dayoff-master').forEach(btn => {
      btn.addEventListener('click', () => {
        openUpdateEmployeeDayOffModal(btn.dataset.id, btn.dataset.name, btn.dataset.dayoff || 'Ahad');
      });
    });
  }

  const btnAdd = document.getElementById('btn-add-employee-modal');
  if (btnAdd) btnAdd.addEventListener('click', openAddEmployeeModal);

  const btnAddBranch = document.getElementById('btn-add-branch-modal');
  if (btnAddBranch) btnAddBranch.addEventListener('click', openAddBranchModal);
}

async function loadScheduleForms() {
  const empRes = await api('/api/v1/employees');
  const shiftRes = await api('/api/v1/schedules/shifts');
  const emps = (empRes.ok && empRes.data.employees) || [];
  const shifts = (shiftRes.ok && shiftRes.data.shifts) || [];
  state.employees = emps;

  const dynContainer = document.getElementById('dynamic-day-off-rules-list');
  if (dynContainer) {
    dynContainer.innerHTML = renderDynamicDayOffRules(emps);
  }

  const empSelect1 = document.getElementById('schedule-emp-select');
  const empSelect2 = document.getElementById('dayoff-emp-select');
  const shiftSelect = document.getElementById('schedule-shift-select');

  const empOptions = emps.map(e => `<option value="${e.id}">${escapeHtml(e.name)} (${e.employee_code})</option>`).join('');
  if (empSelect1) empSelect1.innerHTML = empOptions;
  if (empSelect2) empSelect2.innerHTML = empOptions;

  if (shiftSelect) {
    shiftSelect.innerHTML = shifts.map(s => `<option value="${s.id}">${escapeHtml(s.name)} (${s.start_time.slice(0,5)} - ${s.end_time.slice(0,5)})</option>`).join('');
  }

  const formSched = document.getElementById('form-assign-schedule');
  if (formSched) {
    formSched.addEventListener('submit', async (e) => {
      e.preventDefault();
      const empId = empSelect1.value;
      const date = document.getElementById('schedule-date-input').value;
      const shiftId = shiftSelect.value;
      const emp = emps.find(x => x.id === empId);

      const res = await api('/api/v1/schedules', {
        method: 'POST',
        body: JSON.stringify({
          employee_id: empId,
          branch_id: emp ? emp.branch_id : state.branches[0].id,
          work_date: date,
          shift_id: shiftId
        })
      });
      if (res.ok) showToast('Jadwal berhasil disimpan!', 'success');
      else showToast(res.data.error || 'Gagal.', 'error');
    });
  }

  const formDayOff = document.getElementById('form-assign-dayoff');
  if (formDayOff) {
    formDayOff.addEventListener('submit', async (e) => {
      e.preventDefault();
      const empId = empSelect2.value;
      const date = document.getElementById('dayoff-date-input').value;
      const reason = document.getElementById('dayoff-reason-input').value;

      const res = await api('/api/v1/schedules/days-off', {
        method: 'POST',
        body: JSON.stringify({ employee_id: empId, off_date: date, reason })
      });
      if (res.ok) showToast('Libur berhasil didaftarkan!', 'success');
      else showToast(res.data.error || 'Gagal.', 'error');
    });
  }
}

// --- Payslips View Controller (Karyawan & Manager/Owner) ---
// --- Payslips View Controller (Hanya Unduhan PDF Tanpa Rincian Kalkulasi) ---
async function loadMyPayslips() {
  const btnRefresh = document.getElementById('btn-refresh-payslips');
  if (btnRefresh) {
    btnRefresh.onclick = () => loadMyPayslips();
  }

  const container = document.getElementById('payslips-list-container');
  if (!container) return;

  const res = await api('/api/v1/payroll/me/payslips');
  if (res.ok && res.data.payslips) {
    state.myPayslips = res.data.payslips;
    if (state.myPayslips.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 36px 16px; color: var(--text-muted);">
          <div style="display: inline-flex; align-items: center; justify-content: center; width: 56px; height: 56px; border-radius: 50%; background: var(--bg-main); margin-bottom: 12px; color: var(--text-muted);">
            ${uiIcon('file-text', '', 28)}
          </div>
          <p style="font-weight: 700; color: var(--text-main); font-size: 1rem; margin-bottom: 4px;">
            Belum ada slip gaji terbit untuk akun Anda
          </p>
          <small>Berkas PDF resmi akan muncul di sini setelah diunggah oleh pihak pengelola (Manager / Owner).</small>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 14px;">
        ${state.myPayslips.map(ps => {
          const hasPdf = !!ps.pdf_path;
          return `
            <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 18px 20px; display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 14px; box-shadow: var(--shadow-xs);">
              <div>
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                  <span class="badge ${hasPdf ? 'badge-success' : 'badge-warning'}">
                    ${hasPdf ? `${uiIcon('file-text', '', 12)} Berkas PDF Tersedia` : `${uiIcon('alert-circle', '', 12)} Menunggu Berkas PDF Pengelola`}
                  </span>
                </div>
                <h4 style="font-size: 1.1rem; font-weight: 700; color: var(--text-main); margin: 0 0 4px 0;">
                  ${escapeHtml(ps.period_label || 'Periode Payroll')}
                </h4>
                <p style="font-size: 0.82rem; color: var(--text-muted); margin: 0;">
                  Tanggal Terbit: ${new Date(ps.published_at).toLocaleDateString('id-ID')} ${ps.slip_notes ? '• ' + escapeHtml(ps.slip_notes) : ''}
                </p>
              </div>
              <div>
                ${hasPdf ? `
                  <a href="/api/v1/payroll/slips/${ps.payslip_id}/download" target="_blank" class="btn btn-primary" style="font-size: 0.88rem; font-weight: 700; padding: 8px 16px; display: inline-flex; align-items: center; gap: 6px;">
                    ${uiIcon('download', '', 16)} Unduh Slip Gaji (PDF)
                  </a>
                ` : `
                  <span style="font-size: 0.82rem; color: var(--text-muted); font-style: italic;">
                    Berkas PDF belum diunggah pengelola
                  </span>
                `}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }
}

// --- Modals ---
// Modal Upload PDF Slip Gaji oleh Manager (Q06)
async function openUploadSlipPdfModal(periods = [], preselectedEmpId = null) {
  if (!periods || periods.length === 0) {
    const pRes = await api('/api/v1/payroll/periods');
    periods = (pRes.ok && pRes.data.periods) || [];
  }

  const modalContainer = document.getElementById('modal-container');
  modalContainer.innerHTML = `
    <div class="modal-overlay active">
      <div class="modal-card">
        <div class="modal-header" style="background: linear-gradient(135deg, var(--primary-red), #9E0000); color: #fff;">
          <h3 style="font-size: 1.1rem; font-weight: 700; color: #fff; display: flex; align-items: center; gap: 8px;">
            ${uiIcon('file-text', '', 20)} Unggah Slip Gaji PDF Staf
          </h3>
          <button type="button" class="btn btn-secondary" onclick="closeModal()" style="color:#fff; background:none; border:none; font-size:1.2rem; cursor:pointer;">✕</button>
        </div>
        <form id="form-upload-pdf">
          <div class="modal-body">
            <div class="form-group">
              <label class="form-label">Pilih Periode Payroll:</label>
              <select id="pdf-period-select" class="form-control" required>
                ${periods.map(p => `<option value="${p.id}">${escapeHtml(p.label)}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Pilih Anggota Staf:</label>
              <select id="pdf-emp-select" class="form-control" required>
                <option value="">Memuat anggota tim...</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Pilih Berkas PDF Slip Gaji:</label>
              <input type="file" id="pdf-file-input" class="form-control" accept="application/pdf" required>
              <small style="color:var(--text-muted); font-size:0.75rem;">Maksimal 10MB, format berkas PDF resmi.</small>
            </div>
            <div class="form-group">
              <label class="form-label">Catatan Tambahan (Opsional):</label>
              <input type="text" id="pdf-notes-input" class="form-control" placeholder="Contoh: Slip Gaji Resmi Sultan Arab">
            </div>
            <div id="wa-reminder-box" style="display:none; background:#E8F5E9; border:1px solid #C8E6C9; padding:12px 14px; border-radius:var(--radius-sm); margin-top:10px;">
              <div style="font-weight:700; color:#2E7D32; font-size:0.85rem; display:flex; align-items:center; gap:6px;">
                ${uiIcon('check-circle', '', 16)} Berhasil Diunggah! Kirim Notifikasi WhatsApp:
              </div>
              <p style="font-size:0.78rem; color:#388E3C; margin:4px 0 8px 0;">Klik tombol di bawah ini untuk mengirimkan notifikasi langsung ke WhatsApp staf.</p>
              <a id="wa-reminder-link" target="_blank" class="btn btn-primary" style="font-size:0.82rem; background:#25D366; border:none; display:inline-flex; align-items:center; gap:6px;">
                ${uiIcon('smartphone', '', 16)} Buka WhatsApp Sekarang
              </a>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" onclick="closeModal()">Batal / Tutup</button>
            <button type="submit" id="btn-submit-pdf" class="btn btn-primary">
              ${uiIcon('upload', '', 16)} Unggah &amp; Terbitkan
            </button>
          </div>
        </form>
      </div>
    </div>
  `;

  api('/api/v1/employees').then(res => {
    if (res.ok && res.data.employees) {
      const select = document.getElementById('pdf-emp-select');
      if (select) {
        select.innerHTML = res.data.employees.map(e => `
          <option value="${e.id}" ${preselectedEmpId === e.id ? 'selected' : ''}>
            ${escapeHtml(e.name)} (${e.employee_code}) - ${escapeHtml(e.job_title || 'Staff')}
          </option>
        `).join('');
      }
    }
  });

  document.getElementById('form-upload-pdf').addEventListener('submit', async (e) => {
    e.preventDefault();
    const periodId = document.getElementById('pdf-period-select').value;
    const empId = document.getElementById('pdf-emp-select').value;
    const file = document.getElementById('pdf-file-input').files[0];
    const notes = document.getElementById('pdf-notes-input').value;

    if (!file) {
      showToast('Pilih file PDF terlebih dahulu.', 'error');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('period_id', periodId);
    formData.append('employee_id', empId);
    formData.append('notes', notes);

    const submitBtn = document.getElementById('btn-submit-pdf');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Mengunggah...';

    const res = await api('/api/v1/payroll/upload-slip', {
      method: 'POST',
      body: formData
    });

    submitBtn.disabled = false;
    submitBtn.innerHTML = `${uiIcon('upload', '', 16)} Unggah &amp; Terbitkan`;

    if (res.ok && res.data.success) {
      showToast('Slip PDF berhasil diunggah dan diterbitkan ke staf!', 'success');
      if (res.data.whatsAppReminderLink) {
        const waBox = document.getElementById('wa-reminder-box');
        const waLink = document.getElementById('wa-reminder-link');
        waBox.style.display = 'block';
        waLink.href = res.data.whatsAppReminderLink;
      } else {
        closeModal();
      }
      loadPayrollData();
      if (typeof loadStaffSlipsTable === 'function') {
        loadStaffSlipsTable('payroll-staff-slips-tbody');
      }
      loadMasterData();
    } else {
      showToast(res.data.error || 'Gagal unggah PDF.', 'error');
    }
  });
}

function openAdjustmentModal(param) {
  const modalContainer = document.getElementById('modal-container');
  const info = typeof param === 'object' && param !== null
    ? param
    : { sessionId: param, empName: 'Karyawan', shiftId: '', status: 'present' };

  const targetBranchId = info.branchId || null;
  const currentShiftId = info.shiftId || '';

  // Render shift options (deduplikasi & filter cabang yang relevan)
  const seenShifts = new Set();
  const shiftOptions = (state.shifts || []).filter(s => {
    const isNonShift = /^non-shift/i.test(s.name);
    if (!isNonShift && targetBranchId && s.branch_id && s.branch_id !== targetBranchId) return false;
    const key = `${s.name}|${s.start_time}|${s.end_time}`;
    if (seenShifts.has(key)) return false;
    seenShifts.add(key);
    return true;
  }).map(s => `
    <option value="${s.id}" ${s.id === currentShiftId ? 'selected' : ''}>
      ${escapeHtml(s.name)} (${s.start_time.slice(0, 5)} - ${s.end_time.slice(0, 5)})
    </option>
  `).join('');

  modalContainer.innerHTML = `
    <div class="modal-overlay active" onclick="if(event.target===this) closeModal()">
      <div class="modal-card">
        <div class="modal-header">
          <div>
            <h3 style="font-size: 1.1rem; font-weight: 700; display: flex; align-items: center; gap: 8px; margin: 0;">
              ${uiIcon('edit', '', 18)} Koreksi Jadwal Shift & Absensi
            </h3>
            <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 4px;">
              Staf: <strong>${escapeHtml(info.empName || 'Karyawan')}</strong> ${info.empCode ? `(${escapeHtml(info.empCode)})` : ''}
            </div>
          </div>
          <button type="button" class="btn btn-secondary" onclick="closeModal()" style="color:#64748B; background:none; border:none; font-size:1.2rem; cursor:pointer;">✕</button>
        </div>
        <form id="form-adjustment">
          <div class="modal-body">
            <div class="form-group">
              <label class="form-label" for="adj-shift">Koreksi Jadwal Shift Kerja:</label>
              <select id="adj-shift" class="form-control" required>
                ${shiftOptions || '<option value="">Pilih shift...</option>'}
              </select>
              <small style="color: var(--text-muted); font-size: 0.75rem; margin-top: 4px; display: block;">Perubahan jadwal shift akan langsung tersimpan ke database & memutakhirkan rekap monitoring.</small>
            </div>
            <div class="form-group">
              <label class="form-label" for="adj-status">Status Kehadiran:</label>
              <select id="adj-status" class="form-control">
                <option value="present" ${info.status === 'present' ? 'selected' : ''}>Hadir (Present)</option>
                <option value="late" ${info.status === 'late' ? 'selected' : ''}>Terlambat (Late)</option>
                <option value="incomplete" ${info.status === 'incomplete' ? 'selected' : ''}>Tidak Lengkap</option>
                <option value="off" ${info.status === 'off' ? 'selected' : ''}>Libur (Off)</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label" for="adj-reason">Alasan Koreksi (Wajib untuk Audit Log):</label>
              <textarea id="adj-reason" class="form-control" rows="3" placeholder="Contoh: Salah pilih shift pagi seharusnya shift siang, atau instruksi lembur mendadak..." required></textarea>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" onclick="closeModal()">Batal</button>
            <button type="submit" class="btn btn-primary">
              ${uiIcon('check', '', 16)} Simpan Koreksi Shift & Absensi
            </button>
          </div>
        </form>
      </div>
    </div>
  `;

  document.getElementById('form-adjustment').addEventListener('submit', async (e) => {
    e.preventDefault();
    const reason = document.getElementById('adj-reason').value.trim();
    const status = document.getElementById('adj-status').value;
    const shiftId = document.getElementById('adj-shift').value;

    const payload = {
      session_id: info.sessionId || null,
      employee_id: info.empId || null,
      work_date: info.date || null,
      branch_id: info.branchId || null,
      new_shift_id: shiftId || null,
      new_status: status,
      reason
    };

    const res = await api('/api/v1/attendance/adjustments', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      showToast('Koreksi jadwal shift & absensi berhasil disimpan!', 'success');
      closeModal();
      loadMonitoringData();
    } else {
      showToast(res.data.error || 'Gagal menyimpan koreksi.', 'error');
    }
  });
}

function openCommissionModal(periods) {
  const modalContainer = document.getElementById('modal-container');
  modalContainer.innerHTML = `
    <div class="modal-overlay active">
      <div class="modal-card">
        <div class="modal-header">
          <h3 style="font-size: 1.1rem; font-weight: 700; display: flex; align-items: center; gap: 8px;">
            ${uiIcon('plus', '', 18)} Input Komisi Sales Manual
          </h3>
          <button type="button" class="btn btn-secondary" onclick="closeModal()" style="color:#64748B; background:none; border:none; font-size:1.2rem; cursor:pointer;">✕</button>
        </div>
        <form id="form-commission">
          <div class="modal-body">
            <div class="form-group">
              <label class="form-label">Periode Payroll:</label>
              <select id="comm-period" class="form-control" required>
                ${periods.map(p => `<option value="${p.id}">${escapeHtml(p.label)}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Karyawan Penerima:</label>
              <select id="comm-emp" class="form-control" required>
                <option value="">Memuat karyawan...</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Nominal Komisi (Rp):</label>
              <input type="number" id="comm-amount" class="form-control" placeholder="Contoh: 150000" min="0" required>
            </div>
            <div class="form-group">
              <label class="form-label">Catatan Penjualan:</label>
              <input type="text" id="comm-note" class="form-control" placeholder="Contoh: Penjualan Kurma Ajwa" required>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" onclick="closeModal()">Batal</button>
            <button type="submit" class="btn btn-primary">
              ${uiIcon('check', '', 16)} Simpan Komisi
            </button>
          </div>
        </form>
      </div>
    </div>
  `;

  api('/api/v1/employees').then(res => {
    if (res.ok && res.data.employees) {
      const select = document.getElementById('comm-emp');
      if (select) {
        select.innerHTML = res.data.employees.map(e => `<option value="${e.id}">${escapeHtml(e.name)} (${e.employee_code})</option>`).join('');
      }
    }
  });

  document.getElementById('form-commission').addEventListener('submit', async (e) => {
    e.preventDefault();
    const periodId = document.getElementById('comm-period').value;
    const empId = document.getElementById('comm-emp').value;
    const amount = document.getElementById('comm-amount').value;
    const note = document.getElementById('comm-note').value;

    const res = await api('/api/v1/payroll/commissions', {
      method: 'POST',
      body: JSON.stringify({ employee_id: empId, period_id: periodId, amount, note })
    });
    if (res.ok) {
      showToast('Komisi manual berhasil disimpan!', 'success');
      closeModal();
      loadPayrollData();
    } else {
      showToast(res.data.error || 'Gagal menyimpan komisi.', 'error');
    }
  });
}

function openUpdateEmployeePhoneModal(empId, empName, currentPhone) {
  const modalContainer = document.getElementById('modal-container');
  modalContainer.innerHTML = `
    <div class="modal-overlay active" onclick="if(event.target===this) closeModal()">
      <div class="modal-card" style="max-width: 440px;">
        <div class="modal-header">
          <h3 style="font-size: 1.1rem; font-weight: 700; display: flex; align-items: center; gap: 8px;">
            ${uiIcon('smartphone', '', 18)} Atur Nomor WhatsApp
          </h3>
          <button type="button" class="btn btn-secondary" onclick="closeModal()" style="color:#64748B; background:none; border:none; font-size:1.2rem; cursor:pointer;">✕</button>
        </div>
        <form id="form-update-emp-phone">
          <div class="modal-body">
            <p style="font-size: 0.88rem; color: var(--text-body); margin-bottom: 14px;">
              Karyawan: <strong>${escapeHtml(empName)}</strong>
            </p>
            <div class="form-group">
              <label class="form-label">Nomor WhatsApp / HP:</label>
              <input type="tel" id="update-emp-phone-input" class="form-control" placeholder="Contoh: 081234567890" value="${escapeHtml(currentPhone || '')}" required autofocus>
              <small style="color: var(--text-muted); font-size: 0.75rem; margin-top: 4px; display: block;">Nomor ini digunakan untuk mengirimkan notifikasi slip gaji otomatis via WhatsApp.</small>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" onclick="closeModal()">Batal</button>
            <button type="submit" class="btn btn-primary">
              ${uiIcon('check', '', 16)} Simpan & Aktifkan WA
            </button>
          </div>
        </form>
      </div>
    </div>
  `;

  document.getElementById('form-update-emp-phone').addEventListener('submit', async (e) => {
    e.preventDefault();
    const phoneVal = document.getElementById('update-emp-phone-input').value.trim();
    const res = await api(`/api/v1/employees/${empId}/phone`, {
      method: 'PATCH',
      body: JSON.stringify({ phone: phoneVal })
    });
    if (res.ok) {
      showToast('Nomor WhatsApp berhasil disimpan!', 'success');
      closeModal();
      if (document.getElementById('payroll-staff-slips-tbody')) {
        loadStaffSlipsTable('payroll-staff-slips-tbody');
      }
      if (document.getElementById('master-employee-body')) {
        loadMasterData();
      }
    } else {
      showToast(res.data.error || 'Gagal menyimpan nomor WhatsApp.', 'error');
    }
  });
}

function openUpdateEmployeeDayOffModal(empId, empName, currentDayOff) {
  const modalContainer = document.getElementById('modal-container');
  const days = ['Ahad', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  modalContainer.innerHTML = `
    <div class="modal-overlay active" onclick="if(event.target===this) closeModal()">
      <div class="modal-card">
        <div class="modal-header">
          <h3 style="font-size: 1.1rem; font-weight: 700; display: flex; align-items: center; gap: 8px;">
            ${uiIcon('calendar', '', 18)} Ubah Hari Libur Karyawan
          </h3>
          <button type="button" class="btn btn-secondary" onclick="closeModal()" style="color:#64748B; background:none; border:none; font-size:1.2rem; cursor:pointer;">✕</button>
        </div>
        <form id="form-update-emp-dayoff">
          <div class="modal-body">
            <p style="font-size: 0.88rem; color: var(--text-body); margin-bottom: 14px;">
              Karyawan: <strong>${escapeHtml(empName)}</strong>
            </p>
            <div class="form-group">
              <label class="form-label">Hari Libur Tetap Mingguan:</label>
              <select id="update-emp-dayoff-select" class="form-control" required>
                ${days.map(d => `<option value="${d}" ${d.toLowerCase() === (currentDayOff || '').toLowerCase() ? 'selected' : ''}>${d}${d === 'Ahad' ? ' (Minggu)' : ''}</option>`).join('')}
              </select>
              <small style="color: var(--text-muted); font-size: 0.75rem; margin-top: 4px; display: block;">Perubahan akan langsung memperbarui database, ketentuan libur tim, dan penghitungan rekap bulanan.</small>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" onclick="closeModal()">Batal</button>
            <button type="submit" class="btn btn-primary">
              ${uiIcon('check', '', 16)} Simpan Jadwal Libur
            </button>
          </div>
        </form>
      </div>
    </div>
  `;

  document.getElementById('form-update-emp-dayoff').addEventListener('submit', async (e) => {
    e.preventDefault();
    const dayOffVal = document.getElementById('update-emp-dayoff-select').value;
    const res = await api(`/api/v1/employees/${empId}/day-off`, {
      method: 'PATCH',
      body: JSON.stringify({ day_off: dayOffVal })
    });
    if (res.ok) {
      showToast('Jadwal libur karyawan berhasil diperbarui!', 'success');
      closeModal();
      if (document.getElementById('master-employee-body')) {
        loadMasterData();
      }
      const dynContainer = document.getElementById('dynamic-day-off-rules-list');
      if (dynContainer) {
        const empRes = await api('/api/v1/employees');
        if (empRes.ok && empRes.data.employees) {
          state.employees = empRes.data.employees;
          dynContainer.innerHTML = renderDynamicDayOffRules(empRes.data.employees);
        }
      }
      if (document.getElementById('table-monthly-recap')) {
        loadMonthlyRecap();
      }
    } else {
      showToast(res.data.error || 'Gagal mengubah jadwal libur.', 'error');
    }
  });
}

function openAddEmployeeModal() {
  const modalContainer = document.getElementById('modal-container');
  modalContainer.innerHTML = `
    <div class="modal-overlay active" onclick="if(event.target===this) closeModal()">
      <div class="modal-card">
        <div class="modal-header">
          <h3 style="font-size: 1.1rem; font-weight: 700; display: flex; align-items: center; gap: 8px;">
            ${uiIcon('users', '', 18)} Tambah Karyawan Baru
          </h3>
          <button type="button" class="btn btn-secondary" onclick="closeModal()" style="color:#64748B; background:none; border:none; font-size:1.2rem; cursor:pointer;">✕</button>
        </div>
        <form id="form-add-emp">
          <div class="modal-body">
            <div class="form-group">
              <label class="form-label">Kode Karyawan:</label>
              <input type="text" id="add-emp-code" class="form-control" placeholder="Contoh: SA-CRW-06" required>
            </div>
            <div class="form-group">
              <label class="form-label">Nama Lengkap:</label>
              <input type="text" id="add-emp-name" class="form-control" placeholder="Nama karyawan" required>
            </div>
            <div class="form-group">
              <label class="form-label">Nomor WhatsApp / HP:</label>
              <input type="tel" id="add-emp-phone" class="form-control" placeholder="Contoh: 081234567890 atau 6281234567890">
              <small style="color: var(--text-muted); font-size: 0.75rem; margin-top: 4px; display: block;">Untuk pengiriman notifikasi slip gaji & pesan resmi via WhatsApp.</small>
            </div>
            <div class="form-group">
              <label class="form-label">Jabatan:</label>
              <input type="text" id="add-emp-job" class="form-control" value="Crew Toko" required>
            </div>
            <div class="form-group">
              <label class="form-label">Cabang Penempatan:</label>
              <select id="add-emp-branch" class="form-control">
                ${state.branches.map(b => `<option value="${b.id}">${escapeHtml(b.name)}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Jadwal Libur Rutin:</label>
              <select id="add-emp-dayoff" class="form-control" required>
                <option value="Ahad">Ahad (Minggu)</option>
                <option value="Senin">Senin</option>
                <option value="Selasa">Selasa</option>
                <option value="Rabu">Rabu</option>
                <option value="Kamis">Kamis</option>
                <option value="Jumat">Jumat</option>
                <option value="Sabtu">Sabtu</option>
              </select>
              <small style="color: var(--text-muted); font-size: 0.75rem; margin-top: 4px; display: block;">Jadwal libur mingguan tetap yang otomatis tersimpan ke database & memperbarui ketentuan libur tim.</small>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" onclick="closeModal()">Batal</button>
            <button type="submit" class="btn btn-primary">
              ${uiIcon('check', '', 16)} Simpan Karyawan
            </button>
          </div>
        </form>
      </div>
    </div>
  `;

  document.getElementById('form-add-emp').addEventListener('submit', async (e) => {
    e.preventDefault();
    const code = document.getElementById('add-emp-code').value;
    const name = document.getElementById('add-emp-name').value;
    const phone = document.getElementById('add-emp-phone').value;
    const job = document.getElementById('add-emp-job').value;
    const branchId = document.getElementById('add-emp-branch').value;
    const dayOff = document.getElementById('add-emp-dayoff').value;

    const res = await api('/api/v1/employees', {
      method: 'POST',
      body: JSON.stringify({ employee_code: code, name, phone: phone.trim(), job_title: job, branch_id: branchId, day_off: dayOff, is_test_data: false })
    });
    if (res.ok) {
      showToast('Karyawan berhasil ditambahkan!', 'success');
      closeModal();
      loadMasterData();
      if (document.getElementById('payroll-staff-slips-tbody')) {
        loadStaffSlipsTable('payroll-staff-slips-tbody');
      }
    } else {
      showToast(res.data.error || 'Gagal menambah karyawan.', 'error');
    }
  });
}

async function openRunDetailModal(runId) {
  const modalContainer = document.getElementById('modal-container');
  modalContainer.innerHTML = `
    <div class="modal-overlay active">
      <div class="modal-card" style="max-width: 700px;">
        <div class="modal-header">
          <h3 style="font-size: 1.1rem; font-weight: 700; display: flex; align-items: center; gap: 8px;">
            ${uiIcon('search', '', 18)} Rincian Kalkulasi Payroll
          </h3>
          <button type="button" class="btn btn-secondary" onclick="closeModal()" style="color:#64748B; background:none; border:none; font-size:1.2rem; cursor:pointer;">✕</button>
        </div>
        <div class="modal-body" id="run-detail-body">
          <p>Memuat rincian...</p>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" onclick="closeModal()">Tutup</button>
        </div>
      </div>
    </div>
  `;

  const res = await api(`/api/v1/payroll/runs/${runId}`);
  const body = document.getElementById('run-detail-body');
  if (res.ok && res.data.run && body) {
    const run = res.data.run;
    const items = res.data.items || [];
    body.innerHTML = `
      <div style="background: var(--status-success-bg, #F0FDF4); border: 1px solid #BBF7D0; color: #166534; padding: 12px 14px; border-radius: var(--radius-sm); font-size: 0.85rem; margin-bottom: 14px; display: flex; align-items: flex-start; gap: 8px;">
        ${uiIcon('check-circle', '', 16)}
        <div>
          <strong>Aturan Q05 Sultan Arab:</strong> Uang makan Rp10.000 hanya dihitung untuk kehadiran fisik toko. Kunjungan luar tidak mendapatkan uang makan.
        </div>
      </div>
      <div style="margin-bottom: 12px; font-size: 0.9rem;">
        <strong>Periode:</strong> ${escapeHtml(run.period_label)} (v${run.version})<br>
        <strong>Status:</strong> ${run.status.toUpperCase()}
      </div>
      <div class="table-responsive">
        <table class="table table-stack">
          <thead>
            <tr>
              <th>Karyawan</th>
              <th>Hadir Toko</th>
              <th>Kunjungan Luar</th>
              <th>Uang Makan</th>
              <th>Total Net Pay</th>
            </tr>
          </thead>
          <tbody>
            ${items.map(it => {
              const snap = it.calculation_snapshot || {};
              return `
                <tr>
                  <td class="cell-title" data-label="Karyawan"><strong>${escapeHtml(it.employee_name)}</strong></td>
                  <td data-label="Hadir Toko">${snap.totalHadirUangMakan || 0} hari</td>
                  <td data-label="Kunjungan Luar">${snap.totalKunjunganLuar || 0} hari</td>
                  <td data-label="Uang Makan">Rp ${formatNumber(snap.totalUangMakan || 0)}</td>
                  <td data-label="Total Net Pay"><strong style="color:var(--primary-red);">Rp ${formatNumber(it.net_pay)}</strong></td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
  }
}

function openPayslipDetailModal(slip) {
  const modalContainer = document.getElementById('modal-container');
  const snap = slip.calculation_snapshot || {};
  modalContainer.innerHTML = `
    <div class="modal-overlay active">
      <div class="modal-card" style="max-width: 520px;">
        <div class="modal-header" style="background: linear-gradient(135deg, var(--primary-red), #9E0000); color: #fff;">
          <div>
            <h3 style="font-size: 1.15rem; font-weight: 800; color: #fff; display: flex; align-items: center; gap: 8px;">
              ${uiIcon('file-text', '', 20)} SLIP GAJI SULTAN ARAB
            </h3>
            <span style="font-size: 0.78rem; color: var(--accent-gold);">${escapeHtml(slip.period_label)}</span>
          </div>
          <button type="button" class="btn btn-secondary" onclick="closeModal()" style="color:#fff; background:none; border:none; font-size:1.2rem; cursor:pointer;">✕</button>
        </div>
        <div class="modal-body">
          <div style="display: flex; justify-content: space-between; border-bottom: 1px solid var(--border-color); padding-bottom: 10px; margin-bottom: 12px; font-size: 0.9rem;">
            <div>
              <div style="font-weight: 700;">${escapeHtml(slip.employee_name)}</div>
              <div style="font-size: 0.8rem; color: var(--text-muted);">${escapeHtml(slip.employee_code)} • ${escapeHtml(slip.job_title || 'Staff')}</div>
            </div>
            <div style="text-align: right;">
              <span class="badge badge-success">LUNAS</span>
              <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 4px;">Terbit: ${new Date(slip.published_at).toLocaleDateString('id-ID')}</div>
            </div>
          </div>

          <h4 style="font-size: 0.9rem; font-weight: 700; margin-bottom: 8px;">Rincian Komponen Pendapatan:</h4>
          <div style="display: flex; flex-direction: column; gap: 6px; font-size: 0.88rem; margin-bottom: 14px;">
            <div style="display: flex; justify-content: space-between;">
              <span>Gaji Pokok:</span>
              <span>Rp ${formatNumber(slip.earnings - (snap.totalKomisi || 0) - (snap.totalUangMakan || 0))}</span>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span>Uang Makan (${snap.totalHadirUangMakan || 0} hari x Rp10.000):</span>
              <span>Rp ${formatNumber(snap.totalUangMakan || 0)}</span>
            </div>
            ${(snap.totalKomisi || 0) > 0 ? `
              <div style="display: flex; justify-content: space-between;">
                <span>Komisi Sales Manual:</span>
                <span>Rp ${formatNumber(snap.totalKomisi)}</span>
              </div>
            ` : ''}
          </div>

          <div style="background: var(--primary-red-light); border-radius: var(--radius-sm); padding: 12px 14px; display: flex; justify-content: space-between; align-items: center;">
            <strong style="color: var(--primary-red); font-size: 0.95rem;">TOTAL DITERIMA (NET):</strong>
            <strong style="color: var(--primary-red); font-size: 1.3rem;">Rp ${formatNumber(slip.net_pay)}</strong>
          </div>
        </div>
        <div class="modal-footer">
          ${slip.pdf_path ? `
            <a href="/api/v1/payroll/slips/${slip.payslip_id}/download" target="_blank" class="btn btn-primary">
              ${uiIcon('download', '', 16)} Unduh PDF Resmi
            </a>
          ` : `
            <button type="button" class="btn btn-secondary" onclick="window.print()">
              ${uiIcon('printer', '', 16)} Cetak
            </button>
          `}
          <button type="button" class="btn btn-secondary" onclick="closeModal()">Tutup</button>
        </div>
      </div>
    </div>
  `;
}

function closeModal() {
  const container = document.getElementById('modal-container');
  if (container) container.innerHTML = '';
}

// --- Cabang: Render Baris & Modal Tambah Cabang ---
function renderBranchRows() {
  if (!state.branches.length) {
    return `<tr><td colspan="4" class="cell-empty">Belum ada cabang. Klik "+ Cabang" untuk menambahkan.</td></tr>`;
  }
  return state.branches.map(b => {
    const hasCoord = b.latitude && b.longitude;
    const coordText = hasCoord ? `${parseFloat(b.latitude).toFixed(5)}, ${parseFloat(b.longitude).toFixed(5)}` : '-';
    return `
      <tr>
        <td class="cell-title" data-label="Nama Cabang"><strong>${escapeHtml(b.name)}</strong> <small class="cell-code">${escapeHtml(b.code)}</small></td>
        <td data-label="Radius">${b.radius_m || 150} m</td>
        <td data-label="Koordinat">
          ${hasCoord ? `<a href="https://www.google.com/maps?q=${encodeURIComponent(b.latitude + ',' + b.longitude)}" target="_blank" rel="noopener" style="display:inline-flex; align-items:center; gap:4px;">${uiIcon('map-pin', '', 13)} ${coordText}</a>` : '-'}
        </td>
        <td class="cell-full" data-label="Alamat">${escapeHtml(b.address || '-')}</td>
      </tr>
    `;
  }).join('');
}

// Mengurai teks koordinat "lat, lon" atau tautan Google Maps berisi koordinat.
function parseCoordinateText(text) {
  if (!text) return null;
  let decoded = String(text);
  try { decoded = decodeURIComponent(decoded); } catch (e) { /* teks biasa */ }
  const patterns = [/@(-?\d+\.\d+),\s*(-?\d+\.\d+)/, /[?&](?:q|query|ll)=(-?\d+\.\d+),\s*(-?\d+\.\d+)/, /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/, /^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/];
  for (const re of patterns) {
    const m = decoded.match(re);
    if (m) {
      const lat = parseFloat(m[1]);
      const lon = parseFloat(m[2]);
      if (Math.abs(lat) <= 90 && Math.abs(lon) <= 180) return { lat, lon };
    }
  }
  return null;
}

function openAddBranchModal() {
  const modalContainer = document.getElementById('modal-container');
  modalContainer.innerHTML = `
    <div class="modal-overlay active">
      <div class="modal-card">
        <div class="modal-header" style="background: linear-gradient(135deg, var(--primary-red), #9E0000);">
          <h3 style="font-size: 1.1rem; font-weight: 700; color: #fff; display: flex; align-items: center; gap: 8px;">
            ${uiIcon('building', '', 18)} Tambah Cabang Baru
          </h3>
          <button type="button" class="btn btn-secondary" onclick="closeModal()" style="color:#fff; background:none; border:none; font-size:1.2rem; cursor:pointer;">✕</button>
        </div>
        <form id="form-add-branch">
          <div class="modal-body">
            <div class="form-row-2">
              <div class="form-group">
                <label class="form-label" for="add-branch-code">Kode Cabang</label>
                <input type="text" id="add-branch-code" class="form-control" placeholder="Contoh: CBG-BGR" maxlength="50" required style="text-transform: uppercase;">
              </div>
              <div class="form-group">
                <label class="form-label" for="add-branch-radius">Radius Absen (meter)</label>
                <input type="number" id="add-branch-radius" class="form-control" value="150" min="10" max="5000" required>
              </div>
            </div>
            <div class="form-group">
              <label class="form-label" for="add-branch-name">Nama Cabang</label>
              <input type="text" id="add-branch-name" class="form-control" placeholder="Contoh: Cabang Bogor" maxlength="150" required>
            </div>
            <div class="form-group">
              <label class="form-label" for="add-branch-address">Alamat</label>
              <input type="text" id="add-branch-address" class="form-control" placeholder="Alamat lengkap cabang">
            </div>
            <div class="form-group">
              <label class="form-label" for="add-branch-coord">Koordinat Lokasi Toko</label>
              <input type="text" id="add-branch-coord" class="form-control" placeholder="-6.2122736, 107.0218103 atau tempel link Google Maps">
              <small id="add-branch-coord-hint" class="form-hint">Dipakai untuk validasi radius absen. Tautan pendek maps.app.goo.gl tidak memuat koordinat — buka dulu lalu salin koordinatnya.</small>
            </div>
            <button type="button" id="btn-branch-use-my-location" class="btn btn-secondary btn-block">
              ${uiIcon('map-pin', '', 16)} Gunakan Lokasi Saya Saat Ini
            </button>
            <p class="form-hint" style="margin-top: 10px;">Shift Pagi (08:00–17:00), Siang (12:00–21:00), &amp; Lembur (08:00–21:00) otomatis dibuat untuk cabang baru.</p>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" onclick="closeModal()">Batal</button>
            <button type="submit" id="btn-submit-branch" class="btn btn-primary">
              ${uiIcon('check', '', 16)} Simpan Cabang
            </button>
          </div>
        </form>
      </div>
    </div>
  `;

  const coordInput = document.getElementById('add-branch-coord');
  const coordHint = document.getElementById('add-branch-coord-hint');
  coordInput.addEventListener('input', () => {
    if (!coordInput.value.trim()) {
      coordHint.style.color = '';
      return;
    }
    const c = parseCoordinateText(coordInput.value);
    coordHint.style.color = c ? '#137333' : 'var(--primary-red)';
    coordHint.textContent = c ? `✅ Terbaca: ${c.lat.toFixed(6)}, ${c.lon.toFixed(6)}` : '⚠️ Koordinat belum terbaca. Format: lat, lon';
  });

  document.getElementById('btn-branch-use-my-location').addEventListener('click', (ev) => {
    const btn = ev.currentTarget;
    if (!navigator.geolocation) {
      showToast('Browser tidak mendukung GPS.', 'error');
      return;
    }
    btn.disabled = true;
    btn.textContent = 'Mengambil lokasi...';
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        coordInput.value = `${pos.coords.latitude.toFixed(7)}, ${pos.coords.longitude.toFixed(7)}`;
        coordInput.dispatchEvent(new Event('input'));
        btn.disabled = false;
        btn.textContent = '📍 Gunakan Lokasi Saya Saat Ini';
        showToast(`Lokasi diambil (akurasi ±${Math.round(pos.coords.accuracy)}m).`, 'success');
      },
      (err) => {
        btn.disabled = false;
        btn.textContent = '📍 Gunakan Lokasi Saya Saat Ini';
        showToast('Gagal mengambil lokasi: ' + err.message, 'error');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  });

  document.getElementById('form-add-branch').addEventListener('submit', async (e) => {
    e.preventDefault();
    const coordText = coordInput.value.trim();
    const coord = coordText ? parseCoordinateText(coordText) : null;
    if (coordText && !coord) {
      showToast('Koordinat tidak valid. Gunakan format: lat, lon', 'error');
      return;
    }

    const submitBtn = document.getElementById('btn-submit-branch');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Menyimpan...';

    const res = await api('/api/v1/branches', {
      method: 'POST',
      body: JSON.stringify({
        code: document.getElementById('add-branch-code').value,
        name: document.getElementById('add-branch-name').value,
        address: document.getElementById('add-branch-address').value,
        radius_m: document.getElementById('add-branch-radius').value,
        latitude: coord ? coord.lat : null,
        longitude: coord ? coord.lon : null
      })
    });

    submitBtn.disabled = false;
    submitBtn.textContent = 'Simpan Cabang';

    if (res.ok && res.data.success) {
      showToast(`Cabang "${res.data.branch.name}" berhasil ditambahkan!`, 'success');
      closeModal();
      await loadInitialData();
      const tbody = document.getElementById('master-branch-body');
      if (tbody) tbody.innerHTML = renderBranchRows();
      const kpi = document.getElementById('kpi-total-cabang');
      if (kpi) kpi.textContent = state.branches.length;
    } else {
      showToast(res.data.error || 'Gagal menambah cabang.', 'error');
    }
  });
}

// Modal Ubah Password Mandiri (Perorangan)
function openChangePasswordModal() {
  const modalContainer = document.getElementById('modal-container');
  modalContainer.innerHTML = `
    <div class="modal-overlay active">
      <div class="modal-card">
        <div class="modal-header" style="background: linear-gradient(135deg, var(--primary-red), #9E0000);">
          <h3 style="font-size: 1.1rem; font-weight: 700; color: #fff; display: flex; align-items: center; gap: 8px;">
            ${uiIcon('key', '', 18)} Ubah Password Akun
          </h3>
          <button type="button" class="btn btn-secondary" onclick="closeModal()" style="color:#fff; background:none; border:none; font-size:1.2rem; cursor:pointer;">✕</button>
        </div>
        <form id="form-change-password">
          <div class="modal-body">
            <div style="background: var(--bg-main); border: 1px solid var(--border-color); border-left: 3px solid var(--accent-gold-dark); padding: 12px 14px; border-radius: var(--radius-sm); margin-bottom: 16px; font-size: 0.85rem;">
              Akun: <strong>${escapeHtml(state.user.displayName || '')}</strong> (<code>${escapeHtml(state.user.loginIdentifier || '')}</code>)<br>
              <span style="color: var(--text-muted); font-size: 0.8rem;">Gunakan password baru yang aman minimal 6 karakter.</span>
            </div>
            <div class="form-group">
              <label class="form-label" for="input-current-password">Password Saat Ini</label>
              <div style="position: relative;">
                <input type="password" id="input-current-password" class="form-control" placeholder="Masukkan password lama" required autocomplete="current-password">
                <button type="button" id="btn-peek-current" style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; color: var(--text-muted); display: flex; align-items: center;" title="Lihat/Sembunyikan">${uiIcon('eye', '', 16)}</button>
              </div>
            </div>
            <div class="form-group">
              <label class="form-label" for="input-new-password">Password Baru</label>
              <div style="position: relative;">
                <input type="password" id="input-new-password" class="form-control" placeholder="Minimal 6 karakter" required minlength="6" autocomplete="new-password">
                <button type="button" id="btn-peek-new" style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; color: var(--text-muted); display: flex; align-items: center;" title="Lihat/Sembunyikan">${uiIcon('eye', '', 16)}</button>
              </div>
            </div>
            <div class="form-group">
              <label class="form-label" for="input-confirm-password">Konfirmasi Password Baru</label>
              <div style="position: relative;">
                <input type="password" id="input-confirm-password" class="form-control" placeholder="Ketik ulang password baru" required minlength="6" autocomplete="new-password">
                <button type="button" id="btn-peek-confirm" style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; color: var(--text-muted); display: flex; align-items: center;" title="Lihat/Sembunyikan">${uiIcon('eye', '', 16)}</button>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" onclick="closeModal()">Batal</button>
            <button type="submit" id="btn-submit-change-pwd" class="btn btn-primary">
              ${uiIcon('check', '', 16)} Simpan Password Baru
            </button>
          </div>
        </form>
      </div>
    </div>
  `;

  const setupToggle = (inputId, btnId) => {
    const input = document.getElementById(inputId);
    const btn = document.getElementById(btnId);
    if (input && btn) {
      btn.addEventListener('click', () => {
        input.type = input.type === 'password' ? 'text' : 'password';
      });
    }
  };
  setupToggle('input-current-password', 'btn-peek-current');
  setupToggle('input-new-password', 'btn-peek-new');
  setupToggle('input-confirm-password', 'btn-peek-confirm');

  const form = document.getElementById('form-change-password');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const curPass = document.getElementById('input-current-password').value;
    const newPass = document.getElementById('input-new-password').value;
    const confPass = document.getElementById('input-confirm-password').value;

    if (newPass.length < 6) {
      showToast('Password baru minimal 6 karakter.', 'error');
      return;
    }
    if (newPass !== confPass) {
      showToast('Konfirmasi password baru tidak cocok.', 'error');
      return;
    }

    const submitBtn = document.getElementById('btn-submit-change-pwd');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Menyimpan...';

    const res = await api('/api/v1/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({
        current_password: curPass,
        new_password: newPass,
        confirm_password: confPass
      })
    });

    submitBtn.disabled = false;
    submitBtn.innerHTML = `${uiIcon('check', '', 16)} Simpan Password Baru`;

    if (res.ok && res.data.success) {
      showToast(res.data.message || 'Password berhasil diubah!', 'success');
      closeModal();
    } else {
      showToast(res.data.error || 'Gagal mengubah password.', 'error');
    }
  });
}

// Modal Reset Password Karyawan oleh Pengelola (Manager & Owner)
function openResetEmployeePasswordModal(emp) {
  const modalContainer = document.getElementById('modal-container');
  modalContainer.innerHTML = `
    <div class="modal-overlay active">
      <div class="modal-card">
        <div class="modal-header" style="background: linear-gradient(135deg, var(--accent-gold-dark), #8a6a12);">
          <h3 style="font-size: 1.1rem; font-weight: 700; color: #fff; display: flex; align-items: center; gap: 8px;">
            ${uiIcon('key', '', 18)} Reset Password Karyawan
          </h3>
          <button type="button" class="btn btn-secondary" onclick="closeModal()" style="color:#fff; background:none; border:none; font-size:1.2rem; cursor:pointer;">✕</button>
        </div>
        <form id="form-reset-emp-password">
          <div class="modal-body">
            <div style="background: #FFF9E6; border: 1px solid #FEF08A; border-left: 4px solid var(--accent-gold-dark); padding: 12px 14px; border-radius: var(--radius-sm); margin-bottom: 16px; font-size: 0.88rem; color: #5c4400;">
              <strong>Target Akun:</strong> ${escapeHtml(emp.name)} (${escapeHtml(emp.login_identifier || emp.employee_code)})<br>
              <strong>Jabatan:</strong> ${escapeHtml(emp.job_title || 'Crew Toko')} • ${escapeHtml(emp.branch_name || 'Cabang')}<br>
              <div style="margin-top: 6px; font-size: 0.8rem; color: #7a5d00; display:flex; align-items:flex-start; gap:4px;">
                ${uiIcon('alert-circle', '', 14)}
                <span><em>Fungsi ini digunakan jika karyawan lupa password. Seluruh sesi aktif karyawan akan otomatis dihentikan dan karyawan harus login kembali menggunakan password baru ini.</em></span>
              </div>
            </div>

            <div class="form-group">
              <label class="form-label" for="input-reset-new-password">Password Baru:</label>
              <div style="display: flex; gap: 8px;">
                <input type="text" id="input-reset-new-password" class="form-control" value="sultan123" required minlength="6" placeholder="Masukkan password baru">
                <button type="button" id="btn-use-default-pwd" class="btn btn-secondary" style="white-space: nowrap; font-size: 0.82rem;" title="Isi default sultan123">Default</button>
              </div>
              <small class="form-hint">Standar awal reset adalah <code>sultan123</code>. Anda dapat menggantinya sesuai kebutuhan.</small>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" onclick="closeModal()">Batal</button>
            <button type="submit" id="btn-submit-reset-emp-pwd" class="btn btn-primary" style="background: var(--accent-gold-dark); border-color: var(--accent-gold-dark);">
              ${uiIcon('check', '', 16)} Konfirmasi Reset Password
            </button>
          </div>
        </form>
      </div>
    </div>
  `;

  document.getElementById('btn-use-default-pwd').addEventListener('click', () => {
    document.getElementById('input-reset-new-password').value = 'sultan123';
  });

  const form = document.getElementById('form-reset-emp-password');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const newPass = document.getElementById('input-reset-new-password').value.trim();
    if (newPass.length < 6) {
      showToast('Password baru minimal 6 karakter.', 'error');
      return;
    }

    if (!emp.user_id) {
      showToast('Karyawan ini belum terhubung ke akun user sistem.', 'error');
      return;
    }

    const submitBtn = document.getElementById('btn-submit-reset-emp-pwd');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Mereset...';

    const res = await api('/api/v1/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({
        user_id: emp.user_id,
        new_password: newPass
      })
    });

    submitBtn.disabled = false;
    submitBtn.innerHTML = `${uiIcon('check', '', 16)} Konfirmasi Reset Password`;

    if (res.ok && res.data.success) {
      showToast(res.data.message || 'Password karyawan berhasil direset!', 'success');
      closeModal();
    } else {
      showToast(res.data.error || 'Gagal mereset password.', 'error');
    }
  });
}

// --- Utilities ---
// Opsi shift sesuai cabang terpilih (Non-Shift Staff/Admin selalu tersedia, tanpa duplikat).
function renderShiftOptions(branchId) {
  const seen = new Set();
  const list = state.shifts.filter(s => {
    const isNonShift = /^non-shift/i.test(s.name);
    if (!isNonShift && branchId && s.branch_id && s.branch_id !== branchId) return false;
    const key = `${s.name}|${s.start_time}|${s.end_time}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return list.map(s => `
    <option value="${s.id}">${escapeHtml(s.name)} (${s.start_time.slice(0, 5)} - ${s.end_time.slice(0, 5)})</option>
  `).join('');
}

function toDate(value) {
  if (!value) return null;
  const str = String(value);
  const d = /^\d{4}-\d{2}-\d{2}$/.test(str) ? new Date(str + 'T00:00:00') : new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

function formatDayShort(value) {
  const d = toDate(value);
  return d ? d.toLocaleDateString('id-ID', { weekday: 'short' }) : '-';
}

function formatDayNum(value) {
  const d = toDate(value);
  return d ? d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' }) : '-';
}

function formatDateLong(value) {
  const d = toDate(value);
  return d ? d.toLocaleDateString('id-ID', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }) : '-';
}

function formatTime(value) {
  const d = value ? new Date(value) : null;
  return d && !isNaN(d.getTime()) ? d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-';
}

function statusLabel(status) {
  const map = { present: 'Hadir', late: 'Terlambat', incomplete: 'Tidak Lengkap', off: 'Libur', absent: 'Tidak Hadir' };
  return map[status] || escapeHtml(status || '-');
}

function statusBadgeClass(status) {
  if (status === 'late' || status === 'incomplete') return 'badge-warning';
  if (status === 'absent') return 'badge-danger';
  if (status === 'off') return 'badge-info';
  return 'badge-success';
}
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatNumber(num) {
  return new Intl.NumberFormat('id-ID').format(num || 0);
}

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Kickoff
window.addEventListener('DOMContentLoaded', initApp);
