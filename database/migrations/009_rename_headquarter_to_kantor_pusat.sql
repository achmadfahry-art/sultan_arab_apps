-- Migrasi 009: Ubah penamaan cabang Head Quarter Bekasi menjadi Kantor Pusat
UPDATE branches
SET name = 'Kantor Pusat',
    address = 'Jl. Duta Harapan / Bekasi (Kantor Pusat Sultan Arab)'
WHERE code = 'HQ-BKS' OR id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
