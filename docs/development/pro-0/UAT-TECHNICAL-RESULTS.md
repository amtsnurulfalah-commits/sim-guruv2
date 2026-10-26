# Hasil validasi teknis untuk UAT setelah PRO-1

Source yang diuji: `bcae21e67eae8be3033d1b8c168d22b41218337c` (main setelah PR70). Pelaksanaan 26 Oktober 2026 WIB. Pelaksana T01 adalah agen otomatis, bukan peserta admin/guru.

## Hasil browser aktual

| Suite | Exit code | Detik eksekusi suite |
|---|---:|---:|
| schedules | 0 | 25.32 |
| journals | 0 | 19.13 |
| confirmations | 0 | 13.03 |
| duties | 0 | 10.67 |
| exams | 0 | 10.11 |
| finance | 0 | 13.78 |
| support-cases | 0 | 42.8 |
| tasks | 0 | 17.05 |
| drafts | 0 | 10.69 |

Sembilan suite lulus; assertion page error pada suite terkait tidak menemukan error. Angka detik mencakup boot fixture dan beberapa alur; bukan waktu tugas manusia. Bukti terstruktur, waktu mulai/akhir dan ringkasan assertion tersedia di [uat-technical-results.json](uat-technical-results.json).

## Pemetaan dan batas U01–U10

| Skenario | Bukti otomatis | Bagian yang belum dibuktikan |
|---|---|---|
| U01 | schedules: jadwal harian/pekan, guru/admin, tanggal, error/retry dan perlindungan stale data | Tiga guru nyata menemukan kelas/jam berikutnya tanpa bantuan |
| U02 | journals: create/edit/delete, validasi jumlah siswa, sekali submit, riwayat, konflik dan gagal refresh; draft terpisah | Dua guru menjelaskan perbedaan draft/server dan menyelesaikan tugas |
| U03 | duties/confirmations/exams browser + integrasi duties/programs: pemilik efektif, pembalikan kredit, perubahan/pembatalan, reconfirm | Admin nyata menuntaskan tiga langkah dan memahami riwayat; tidak semua langkah substitusi dicakup oleh satu alur browser |
| U04 | confirmations: claim/confirm/revoke browser→API→service→PGlite, role/prasyarat; duties/exams | Admin/guru menjelaskan perbedaan konfirmasi dan jam hadir |
| U05 | exams: BAP create/edit, count validation, draft restore, ownership; integrasi programs | Guru panitia/pengawas nyata menyelesaikan dan menjelaskan hitungan |
| U06 | finance: history/slip, privasi, PDF/Excel, periode final dan koreksi sintetis | Tiga guru nyata menjelaskan asal komponen honor; tidak ada slip produksi diakses |
| U07 | support-cases: reference-to-case, verified reporter, owner/status, resolution/reopen dan audit | Admin nyata menentukan tindakan tanpa petunjuk |
| U08 | tasks: status/jenis/search/reset/pagination, deadline/prasyarat, deep link/tanggal | Admin nyata memilih tugas paling mendesak; pemahaman urgensi belum dinilai |
| U09 | drafts + exams: restore eksplisit, reload, isolasi akun/tab, TTL, discard, purge setelah simpan/logout | Guru nyata mengenali draft belum tersimpan di server |
| U10 | journals/tasks/drafts/exams/finance: uncertain write, double submit lock, pemeriksaan sumber dan recovery | Respons admin/guru nyata terhadap koneksi terputus dan kebutuhan bantuan |

Semua baris T01 berstatus lulus_teknis hanya untuk bagian yang diperiksa oleh suite, **bukan kelulusan UAT manusia**. Pengujian UI menggunakan mock request pada sebagian alur; jalur database tertentu menggunakan PGlite nyata. Ini bukan tes lengkap Next.js SSR/cookie/reCAPTCHA/Gmail/WAN/produksi atau perangkat fisik. Tidak membuat akun nyata, tidak mengirim undangan/email, dan tidak memodifikasi transaksi produksi.

## Penerimaan manusia

17 percobaan A01/G01/G02/G03 tetap belum_diuji. Durasi tugas, bantuan, jumlah kesalahan pengguna dan skor kemudahan belum diukur. Prasyarat yang belum tersedia: jadwal/perangkat peserta, moderator dan akses staging yang aman. Jangan menutup PRO-0/PRO-1 berdasarkan validasi otomatis ini.

## Cara ulang

Jalankan suite tests/ui/schedules.mjs, journals.mjs, confirmations.mjs, duties.mjs, exams.mjs, finance.mjs, support-cases.mjs, tasks.mjs dan drafts.mjs satu per satu dengan UI_PLAYWRIGHT_MODULE dan UI_BROWSER_EXECUTABLE. Port localhost4319 dipakai bersama. Jangan mengarahkan fixture ke produksi. Database diuji terpisah menggunakan daftar test:db pada package.json.

## Verifikasi database aktual

Daftar test:db dijalankan ulang berurutan (test-concurrency=1, reporter TAP) pada source yang sama: **391 lulus, 0 gagal, 0 skipped**, exit 0; 95.03 detik eksekusi seluruh suite. D10/D11/D12 dan E15 lulus untuk pemilik efektif, penggantian/pembatalan dan konservasi kredit. Tidak ada koneksi database produksi. Run awal paralel tidak memiliki summary akhir lengkap dalam log sehingga tidak digunakan sebagai bukti hitungan; run TAP lengkap ini yang menjadi acuan.
