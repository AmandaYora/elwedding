-- Template pesan KEDUA pada whatsapp_config - docs/plan/og-share-image-dinamis/
-- PLAN.md D11/T17. `message_template` yang sudah ada tetap milik jalur QR
-- otomatis (whatsmeow); `invitation_template` ini dipakai tombol "Kirim
-- Undangan" per tamu di menu Tamu, yang murni klien lewat wa.me dan TIDAK
-- menyentuh modul whatsapp sama sekali.
--
-- DUA pernyataan, bukan satu, dan itu bukan gaya penulisan: kolom TEXT di
-- MySQL TIDAK BOLEH punya DEFAULT literal, jadi pola `NOT NULL DEFAULT ''`
-- yang dipakai kolom VARCHAR (mis. migration 000012) tidak berlaku di sini.
-- Kolomnya ditambahkan lebih dulu, lalu baris singleton id=1 diisi teks
-- default lewat UPDATE. Tanpa UPDATE itu, admin membuka menu WhatsApp dan
-- menemukan Template Undangan kosong.
--
-- Placeholder sengaja TANPA {jumlah} (K5): saat undangan dikirim, tamu belum
-- RSVP sehingga angka jumlah hadir selalu menyesatkan.
ALTER TABLE whatsapp_config
  ADD COLUMN invitation_template TEXT NOT NULL AFTER message_template;

UPDATE whatsapp_config SET invitation_template =
  'Halo {nama}, kami mengundang Anda ke pernikahan {mempelai} pada {tanggal}. Undangan lengkap bisa dibuka di: {link}'
WHERE id = 1;
