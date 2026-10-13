const http = require('http');
const crypto = require('crypto');
const app = require('../apps/server/src/index');
const db = require('../apps/server/src/db');

function request(port, options, data) {
  return new Promise((resolve, reject) => {
    const req = http.request({ ...options, port, hostname: '127.0.0.1' }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch (e) {
          resolve({ status: res.statusCode, raw: body });
        }
      });
    });
    req.on('error', reject);
    if (data) {
      req.write(typeof data === 'string' ? data : JSON.stringify(data));
    }
    req.end();
  });
}

async function runTest() {
  console.log('=== PENGUJIAN FITUR EDIT NAMA & KURANG KARYAWAN ===');
  
  // 1. Dapatkan Owner/Manager User ID
  const ownerRes = await db.query(`
    SELECT u.id, u.login_identifier FROM users u
    JOIN user_roles ur ON u.id = ur.user_id
    JOIN roles r ON ur.role_id = r.id
    WHERE r.code IN ('owner', 'manager') LIMIT 1;
  `);
  if (ownerRes.rows.length === 0) {
    throw new Error('Owner / Manager user not found in database');
  }
  const ownerId = ownerRes.rows[0].id;

  // 2. Buat session token untuk testing
  const token = 'test-token-crud-' + Date.now();
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  await db.query(
    `INSERT INTO sessions (user_id, token_hash, expires_at) VALUES ($1, $2, NOW() + INTERVAL '1 hour');`,
    [ownerId, tokenHash]
  );

  const authHeaders = {
    'Content-Type': 'application/json',
    'Cookie': `sultan_token=${token}`
  };

  // Gunakan port dari server yang berjalan (3000)
  const port = 3000;
  const testCode = 'TEST-CRUD-' + Date.now().toString(36).toUpperCase();
  let createdEmpId = null;

  try {
    // A. Buat karyawan uji baru
    console.log('\n1. Membuat Karyawan Uji...');
    const postRes = await request(port, {
      path: '/api/v1/employees',
      method: 'POST',
      headers: authHeaders
    }, {
      employee_code: testCode,
      name: 'Karyawan Percobaan Awal',
      job_title: 'Crew Toko Uji',
      phone: '081299990001',
      day_off: 'Selasa',
      is_test_data: true
    });

    console.log('   POST /api/v1/employees status:', postRes.status);
    if (postRes.status !== 201 || !postRes.data.employee) {
      throw new Error('Gagal membuat karyawan uji: ' + JSON.stringify(postRes.data));
    }
    createdEmpId = postRes.data.employee.id;
    console.log('   Karyawan uji dibuat dengan ID:', createdEmpId);

    // B. Verifikasi bahwa karyawan muncul di GET /api/v1/employees
    console.log('\n2. Verifikasi Karyawan di Daftar Aktif...');
    const listRes1 = await request(port, {
      path: '/api/v1/employees',
      method: 'GET',
      headers: authHeaders
    });
    const found1 = listRes1.data.employees?.find(e => e.id === createdEmpId);
    if (!found1 || found1.name !== 'Karyawan Percobaan Awal') {
      throw new Error('Karyawan baru tidak ditemukan pada GET /api/v1/employees');
    }
    console.log('   Karyawan terdaftar aktif:', found1.name, `(${found1.employee_code})`);

    // C. Uji Fitur 2: EDIT NAMA KARYAWAN (PATCH /api/v1/employees/:id/name)
    console.log('\n3. Menguji Edit Nama Karyawan (Fitur 2)...');
    const newName = 'Ahmad Fauzan Pratama (Nama Terubah)';
    const patchRes = await request(port, {
      path: `/api/v1/employees/${createdEmpId}/name`,
      method: 'PATCH',
      headers: authHeaders
    }, {
      name: newName,
      job_title: 'Senior Crew Toko'
    });

    console.log('   PATCH /api/v1/employees/:id/name status:', patchRes.status);
    if (patchRes.status !== 200 || !patchRes.data.employee) {
      throw new Error('Gagal mengedit nama karyawan: ' + JSON.stringify(patchRes.data));
    }
    console.log('   Nama berhasil diupdate menjadi:', patchRes.data.employee.name);

    // Verifikasi di DB & GET
    const listRes2 = await request(port, {
      path: '/api/v1/employees',
      method: 'GET',
      headers: authHeaders
    });
    const found2 = listRes2.data.employees?.find(e => e.id === createdEmpId);
    if (!found2 || found2.name !== newName) {
      throw new Error('Nama karyawan tidak terupdate di GET /api/v1/employees');
    }
    console.log('   Verifikasi GET sukses:', found2.name, '— Jabatan:', found2.job_title);

    // D. Uji Validasi: Nama Kosong harus Ditolak (400)
    console.log('\n4. Menguji Validasi Nama Kosong...');
    const emptyNameRes = await request(port, {
      path: `/api/v1/employees/${createdEmpId}/name`,
      method: 'PATCH',
      headers: authHeaders
    }, { name: '   ' });
    if (emptyNameRes.status !== 400) {
      throw new Error('Server seharusnya menolak nama kosong dengan status 400, didapat: ' + emptyNameRes.status);
    }
    console.log('   Validasi nama kosong berhasil (400 Bad Request)!');

    // E. Uji Fitur 1: KURANG KARYAWAN (DELETE /api/v1/employees/:id)
    console.log('\n5. Menguji Kurang Karyawan (Fitur 1)...');
    const deleteRes = await request(port, {
      path: `/api/v1/employees/${createdEmpId}`,
      method: 'DELETE',
      headers: authHeaders
    });

    console.log('   DELETE /api/v1/employees/:id status:', deleteRes.status);
    if (deleteRes.status !== 200) {
      throw new Error('Gagal menghapus karyawan: ' + JSON.stringify(deleteRes.data));
    }
    console.log('   Pesan respons:', deleteRes.data.message);

    // Verifikasi bahwa karyawan sudah hilang dari GET /api/v1/employees
    console.log('\n6. Verifikasi Karyawan Terhapus dari Daftar Aktif...');
    const listRes3 = await request(port, {
      path: '/api/v1/employees',
      method: 'GET',
      headers: authHeaders
    });
    const found3 = listRes3.data.employees?.find(e => e.id === createdEmpId);
    if (found3) {
      throw new Error('Karyawan masih ditemukan di daftar setelah dihapus!');
    }
    console.log('   Karyawan berhasil terhapus dari daftar aktif!');

    // E2. Uji Fitur 1b: KURANG KARYAWAN DENGAN RIWAYAT ABSENSI (SOFT DELETE)
    console.log('\n5b. Menguji Kurang Karyawan dengan Riwayat Absensi (Soft Delete)...');
    const testCode2 = 'TEST-SOFT-' + Date.now().toString(36).toUpperCase();
    const postRes2 = await request(port, {
      path: '/api/v1/employees',
      method: 'POST',
      headers: authHeaders
    }, {
      employee_code: testCode2,
      name: 'Karyawan Uji Soft Delete',
      job_title: 'Crew Toko',
      is_test_data: true
    });
    const softEmpId = postRes2.data.employee.id;
    const softUserId = postRes2.data.employee.user_id;

    // Masukkan dummy attendance session
    const cbgRes = await db.query('SELECT id FROM branches LIMIT 1;');
    const branchId = cbgRes.rows[0].id;
    await db.query(`
      INSERT INTO attendance_sessions (employee_id, branch_id, work_date, status)
      VALUES ($1, $2, CURRENT_DATE, 'present');
    `, [softEmpId, branchId]);

    // Hapus karyawan berriwayat
    const delSoftRes = await request(port, {
      path: `/api/v1/employees/${softEmpId}`,
      method: 'DELETE',
      headers: authHeaders
    });
    if (delSoftRes.status !== 200) {
      throw new Error('Gagal menghapus karyawan berriwayat: ' + JSON.stringify(delSoftRes.data));
    }
    console.log('   DELETE soft delete status:', delSoftRes.status);

    // Cek di DB bahwa record masih ada tapi active = false
    const checkEmp = await db.query('SELECT active FROM employees WHERE id = $1;', [softEmpId]);
    if (checkEmp.rows.length === 0 || checkEmp.rows[0].active !== false) {
      throw new Error('Karyawan seharusnya soft delete (active = false) di DB');
    }
    const checkUser = await db.query('SELECT active FROM users WHERE id = $1;', [softUserId]);
    if (checkUser.rows.length === 0 || checkUser.rows[0].active !== false) {
      throw new Error('User login seharusnya dinonaktifkan (active = false)');
    }

    // Cek di GET /api/v1/employees bahwa karyawan tidak lagi muncul
    const listResSoft = await request(port, {
      path: '/api/v1/employees',
      method: 'GET',
      headers: authHeaders
    });
    const foundSoft = listResSoft.data.employees?.find(e => e.id === softEmpId);
    if (foundSoft) {
      throw new Error('Karyawan soft-deleted masih muncul di daftar aktif!');
    }
    console.log('   Soft-delete terverifikasi: data historis aman, akun nonaktif & hilang dari daftar aktif!');

    // Cleanup soft test employee
    await db.query('DELETE FROM employees WHERE id = $1;', [softEmpId]);
    await db.query('DELETE FROM users WHERE id = $1;', [softUserId]);

    // F. Uji Proteksi Keamanan: Hapus Akun Owner Harus Ditolak (403)
    console.log('\n7. Menguji Proteksi Keamanan Akun Owner...');
    const ownerEmpRes = await db.query(`
      SELECT e.id FROM employees e
      JOIN users u ON e.user_id = u.id
      JOIN user_roles ur ON u.id = ur.user_id
      JOIN roles r ON ur.role_id = r.id
      WHERE r.code = 'owner' LIMIT 1;
    `);
    if (ownerEmpRes.rows.length > 0) {
      const ownerEmpId = ownerEmpRes.rows[0].id;
      const delOwnerRes = await request(port, {
        path: `/api/v1/employees/${ownerEmpId}`,
        method: 'DELETE',
        headers: authHeaders
      });
      if (delOwnerRes.status !== 403 && delOwnerRes.status !== 400) {
        throw new Error('Penghapusan Owner seharusnya ditolak, didapat: ' + delOwnerRes.status);
      }
      console.log('   Proteksi Owner berhasil! Status:', delOwnerRes.status, delOwnerRes.data.error);
    }

    console.log('\n===========================================================');
    console.log(' SEMUA PENGUJIAN FITUR BARU LULUS 100%! ');
    console.log(' 1. Fitur Edit Nama Karyawan: BERHASIL');
    console.log(' 2. Fitur Kurang Karyawan: BERHASIL');
    console.log(' 3. Proteksi Validasi & Keamanan: BERHASIL');
    console.log('===========================================================');
  } finally {
    // Teardown: Bersihkan session dan jika karyawan masih ada
    if (createdEmpId) {
      await db.query('DELETE FROM employees WHERE id = $1', [createdEmpId]);
    }
    await db.query('DELETE FROM sessions WHERE token_hash = $1', [tokenHash]);
    await db.pool.end();
  }
}

runTest().then(() => {
  process.exit(0);
}).catch((err) => {
  console.error('\n[TEST GAGAL]:', err);
  process.exit(1);
});
