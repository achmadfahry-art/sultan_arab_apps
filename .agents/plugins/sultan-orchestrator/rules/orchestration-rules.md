# Standar Orkestrasi Agen — SULTAN ARAB APP

## 1. Siklus Hidup Pengerjaan Fitur (Multi-Agent Workflow)
Setiap penambahan fitur baru atau perubahan arsitektural wajib mengikuti 4 tahapan berurutan:

```text
[1. Spesifikasi] ➔ [2. Database DDL] ➔ [3. Implementasi Kode] ➔ [4. Verifikasi & Deploy]
  (sultan-architect)  (sultan-dba)       (full-stack engineer)   (sultan-qa & sultan-devops)
```

1. **Tahap Perencanaan (sultan-architect)**:
   * Merumuskan kontrak endpoint, request/response payload, dan model data sebelum koding dimulai.
2. **Tahap Basis Data (sultan-dba)**:
   * Menulis migrasi bernomor urut di `database/migrations/`.
   * Menjalankan `npm run db:migrate` untuk verifikasi skema.
3. **Tahap Implementasi Kode**:
   * Menulis controller, route Express, dan UI frontend responsif (mobile & desktop).
4. **Tahap Pengujian & Keamanan (sultan-qa & sultan-security)**:
   * Menjalankan seluruh pengujian otomatis: `npm test` (`16/16 passing`).
   * Memastikan tidak ada celah SQL injection atau kebocoran akses otorisasi.
5. **Tahap Deployment Produksi (sultan-devops)**:
   * Push perubahan ke GitHub `main`.
   * Melakukan Git pull dan restart task di server produksi `sultanarab-server` (`100.86.176.62`).
   * Memverifikasi HTTP 200 di `https://absen.sultanarab.store`.

---

## 2. Invarian Lingkungan Server Produksi
* **Host**: `sultanarab-server` (`100.86.176.62`)
* **URL Resmi**: `https://absen.sultanarab.store`
* **Jalur Tunnel**: Cloudflare Tunnel Service (`cloudflared`)
* **Service Background**: Windows Scheduled Task `SultanArabApp` (`ExecutionTimeLimit PT0S`)
