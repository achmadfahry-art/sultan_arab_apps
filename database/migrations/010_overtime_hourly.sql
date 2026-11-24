-- Migrasi 010: Penambahan kolom lembur berbasis jam (1-4 jam) pada attendance_sessions
ALTER TABLE attendance_sessions
  ADD COLUMN IF NOT EXISTS overtime_hours INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS overtime_pay INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS overtime_note TEXT;

DO $$
BEGIN
  ALTER TABLE attendance_sessions
    ADD CONSTRAINT chk_attendance_overtime_hours CHECK (overtime_hours >= 0 AND overtime_hours <= 4);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
