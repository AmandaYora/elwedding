-- Template pesan KEDUA pada telegram_config - cermin invitation_template
-- milik whatsapp_config (migration 000013). `message_template` yang sudah ada
-- tetap milik jalur QR otomatis (userbot); kolom ini dipakai tombol kirim
-- undangan manual per tamu di menu Tamu yang kini dikirim LEWAT MODUL
-- telegram (bukan wa.me dan bukan jalur klien lain).
--
-- DUA pernyataan, bukan satu, dan itu bukan gaya penulisan: kolom TEXT di
-- MySQL TIDAK BOLEH punya DEFAULT literal (alasan yang sama dengan migration
-- 000013). Kolomnya ditambahkan lebih dulu, lalu baris singleton id=1 diisi
-- teks default lewat UPDATE.
--
-- Placeholder sengaja TANPA {jumlah}: saat undangan dikirim, tamu belum RSVP
-- sehingga angka jumlah hadir selalu menyesatkan (K5
-- docs/plan/og-share-image-dinamis/PLAN.md).
ALTER TABLE telegram_config
  ADD COLUMN invitation_template TEXT NOT NULL AFTER message_template;

UPDATE telegram_config SET invitation_template =
  'Halo {nama}, kami mengundang Anda ke pernikahan {mempelai} pada {tanggal}. Undangan lengkap bisa dibuka di: {link}'
WHERE id = 1;
