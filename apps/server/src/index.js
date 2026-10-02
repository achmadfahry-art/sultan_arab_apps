const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const cors = require('cors');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });

const { authenticate } = require('./middleware/auth');
const authRoutes = require('./routes/auth');
const branchesRoutes = require('./routes/branches');
const employeesRoutes = require('./routes/employees');
const schedulesRoutes = require('./routes/schedules');
const attendanceRoutes = require('./routes/attendance');
const payrollRoutes = require('./routes/payroll');

const app = express();
const PORT = process.env.PORT || 3000;

// Security & Parsing Middleware
app.use(cors({
  origin: true,
  credentials: true
}));
app.use(cookieParser());
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// Global Authentication Context
app.use(authenticate);

// API Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/branches', branchesRoutes);
app.use('/api/v1/employees', employeesRoutes);
app.use('/api/v1/schedules', schedulesRoutes);
app.use('/api/v1/attendance', attendanceRoutes);
app.use('/api/v1/payroll', payrollRoutes);

// Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    appName: 'SULTAN ARAB APP',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// Serve Frontend Static Files
const WEB_DIR = path.resolve(__dirname, '../../web');
app.use(express.static(WEB_DIR));

// SPA Fallback to index.html for client-side routing
app.get('*', (req, res) => {
  res.sendFile(path.join(WEB_DIR, 'index.html'));
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('[Unhandled Server Error]', err);
  res.status(500).json({
    success: false,
    error: 'Terjadi kesalahan internal pada server.',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`=======================================================`);
  console.log(` SULTAN ARAB APP — Server Berjalan Aktif`);
  console.log(` Port: ${PORT}`);
  console.log(` Akses Lokal PC: http://localhost:${PORT}`);
  console.log(` Akses Tailscale HP: http://100.84.77.41:${PORT}`);
  console.log(` Mode: ${process.env.NODE_ENV || 'development'}`);
  console.log(` Database: Standalone PostgreSQL`);
  console.log(`=======================================================`);
});

module.exports = app;
