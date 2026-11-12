# Tahap 3 — Pemisahan inbox dari email

Inbox membaca `app.notifications` melalui endpoint operasi yang sudah ada. Preferensi email tetap tersedia, dan status pengiriman tetap di halaman operasional. Penugasan dan honorarium menerbitkan event dalam transaksi sumber. Pengingat dan pengumuman menerbitkan event dalam transaksi job yang menyeleksi penerima. Pengumuman lama tetap muncul dalam riwayat, dengan isi disembunyikan jika versi dan akses pengguna sudah berubah.

## Pengiriman

- Inbox dibuat sekali per event dan penerima, termasuk ketika kedua kanal pengiriman dinonaktifkan.
- SMTP memakai `ops.domain_outbox`, dedupe key yang sama dengan event, serta claim/lease existing. Tombol admin untuk retry dan rekonsiliasi tetap bekerja pada antrean ini. Email keamanan akun mengikuti jalur existing.
- `ops.fanout_notification_push(environment, pilot, limit)` mengantrekan push per binding yang masih aktif, pada lingkungan yang dipilih. Fungsi internal ini belum dipanggil scheduler. Sambungkan melalui worker yang memvalidasi flag, cohort, lingkungan, dan akses sumber. Worker pengiriman tetap perlu memeriksa ulang binding, akses, masa berlaku, dan jam tenang tepat sebelum send.

## Cutover

1. Verifikasi target database dan ledger migrasi. Ambil baseline jumlah outbox, tanda baca, dan distribusi status email. Rilis UI baru kompatibel dengan respons inbox lama karena skema UI mengabaikan kolom transport tambahan.
2. Terapkan migrasi setelah UI baru tersedia. Advisory lock mengikuti job/claim existing. Lock tabel outbox dan receipts membatasi populasi historis selama migrasi. Marker permanennya adalah entri migrasi pada ledger dan `source_type = 'legacy_email'` pada setiap event impor.
3. `ops.backfill_notification_inbox(250)` memproses batch dengan ID outbox sebagai ID inbox, memindahkan relasi tanda baca, dan mempertahankan `read_at` serta `created_at`. Fungsi hanya mengambil key yang belum mempunyai event. Cutover menjalankan semua batch dalam satu transaksi untuk volume produksi saat ini. Kegagalan membatalkan transaksi dan migrasi dapat diulang. SMTP historis tetap mengikuti status yang sudah tersimpan dan event impor langsung berstatus fanout `completed`.
4. Jalankan kueri rekonsiliasi berikut. Bandingkan jumlah histori dan tanda baca dengan baseline, lalu uji inbox pengguna, aksi baca, preferensi, dan email. Simpan bukti angka agregat saja.

```sql
SELECT count(*) AS imported,
       count(r.notification_id) AS read,
       count(*) FILTER (WHERE r.notification_id IS NULL) AS unread,
       count(*) FILTER (WHERE o.id IS NULL OR n.id IS NULL OR n.created_at <> o.created_at
                         OR e.fanout_state <> 'completed') AS mismatches,
       count(*) FILTER (WHERE EXISTS (
         SELECT 1 FROM ops.notification_deliveries d WHERE d.notification_id = n.id
       )) AS historical_deliveries
FROM ops.notification_events e
LEFT JOIN ops.domain_outbox o ON o.id = e.id AND o.recipient_id = e.recipient_id
LEFT JOIN app.notifications n ON n.event_id = e.id AND n.recipient_id = e.recipient_id
LEFT JOIN app.notification_receipts r ON r.notification_id = n.id AND r.user_id = n.recipient_id
WHERE e.source_type = 'legacy_email';

SELECT count(*) AS remaining_legacy_receipts
FROM app.notification_receipts WHERE outbox_id IS NOT NULL;
```

Nilai `mismatches`, `historical_deliveries`, dan `remaining_legacy_receipts` harus nol. Bandingkan jumlah tanda baca sebelum aplikasi menerima perubahan baca baru. Pengujian upgrade memverifikasi kesamaan timestamp baca secara persis.

Setelah cutover, perbaikan rollback harus tetap membaca inbox baru. Jalur inbox lama akan menghilangkan pesan yang tidak pernah memiliki email. Jeda fan-out atau transport secara terpisah bila diperlukan.
