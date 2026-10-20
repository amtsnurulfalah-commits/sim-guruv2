# Tahap 4.1–4.4 — Piket, upacara, substitusi dan relokasi JTM

## Fitur dan alur

| Tahap | Fitur | Akses |
|---|---|---|
| 4.1 Piket | Jadwal mingguan, aktif/nonaktif/rentang, occurrence dan klaim terpisah, konfirmasi/cabut, 4 JTM dan panel operasional | Admin jadwal/konfirmasi; guru piket mengelola KBM sesudah konfirmasi dan time-in |
| 4.2 Upacara | Pembina bertanggal hanya Senin, satu pembina/tanggal, konfirmasi/cabut, 5 JTM, pengganti | Admin atau pembina efektif sendiri untuk konfirmasi/cabut; admin/piket untuk pengganti |
| 4.3 Substitusi penuh | Tunjuk, ganti dan batalkan pengganti KBM/piket/upacara; validasi kandidat sebelum cleanup; jurnal pemilik efektif | Admin/piket tanggal tugas; bukan diri sendiri/admin/guru tidak aktif/berbentrok |
| 4.4 Penyesuaian/relokasi | Basis integer 0..S, alokasi positif sampai empat desimal, multi-penerima, hapus alokasi/reset, reversal dan konservasi | Admin/piket; bukan tugas sendiri; konfirmasi aktif wajib |

Halaman `/piket` dan `/upacara` memuat penugasan tanggal terpilih. `/admin/piket` dan `/admin/upacara` juga membuka pengelolaan jadwal. Pilih kegiatan, tindakan, kandidat/jumlah dan alasan; **Periksa dampak** menampilkan kredit bersih/jurnal aktif, kemudian **Konfirmasi tindakan** menyimpan transaksi. Pratinjau terikat akun, payload, versi assignment dan keadaan jurnal/ledger/alokasi; sekali pakai dan berlaku 10 menit. Keputusan hak dan bentrok diperiksa ulang saat commit.

Kredit tidak berasal dari klaim pribadi. Piket mendapat 4 JTM sesudah konfirmasi admin, tetapi hak operasional baru tersedia dengan time-in sah. Piket tanpa jadwal mengajar tidak dapat mencatat time-in sendiri; admin membukanya. Piket yang juga pemilik efektif KBM mempunyai pengecualian input jam pribadi, tanpa hak mengesahkan piket sendiri. Piket lain tidak boleh mencatat jam target piket; admin tetap memiliki jalur manual. Upacara berbeda: pembina efektif dapat mengonfirmasi tugasnya sendiri pada Senin.

Piket operasional dapat mengonfirmasi KBM guru lain dan mencatat waktu guru biasa, mengisi rekap siswa serta mengelola substitusi dan JTM pada tanggal tugas. Kewenangan diterapkan di SQL yang sama pada API langsung, bukan sekadar tombol. Penerima alokasi partial piket yang positif dan memiliki time-in juga memperoleh capability ini, dengan kredit hanya sebesar alokasinya. Hapus alokasi/cabut sumber segera menghilangkan capability tersebut.

Piket adalah pengawasan umum; intervalnya tidak otomatis memblokir seluruh jadwal mengajar. Bentrok eksklusif berlaku untuk KBM/upacara, substitusi, alokasi KBM dan perubahan jadwal mingguan terhadap penugasan bertanggal. Modul ujian belum aktif; adapter dependensi tetap fail-closed bila schema ujian/honor baru muncul sebelum integrasinya tersedia.

## Aturan kredit dan pembatalan

`S = JTM terjadwal`, `A = basis disesuaikan atau S jika belum disesuaikan`, `R = jumlah alokasi aktif`. Selalu `A + R <= S`; sisa `S-A-R`. Angka JTM dikirim sebagai string decimal, disimpan numeric(12,4), tanpa akumulasi float JavaScript. Basis adjustment integer; alokasi sampai 0.0001.

Satu ledger `finance.jtm_ledger` memuat KBM, PIKET, UPACARA, PARTIAL_SUB_KBM, PARTIAL_SUB_PIKET dan REVERSAL. Setiap sumber memiliki FK jurnal/assignment/alokasi yang sesuai. Perubahan selalu membalik posting aktif kemudian memposting revisi; ledger tidak dapat diedit/hapus. Constraint deferred memeriksa konservasi pada akhir transaksi, di samping pemeriksaan sebelum tulis.

Jurnal KBM H-1 dihitung sekali dari basis setelah adjustment: misalnya A=1 memberi 0.8 JTM. Alokasi 0.5 tetap 0.5, sehingga total contoh 1.3; alokasi tidak ikut penalti H-1. Penyesuaian mengubah versi jurnal agar editor lama menerima VERSION_CONFLICT.

Cabut konfirmasi, penggantian penuh atau pembatalan pengganti membalik kredit occurrence itu, menonaktifkan jurnal aktif, mencabut konfirmasi, membatalkan alokasi dan menghapus adjustment terkait. Riwayat jurnal/substitusi/ledger/audit tetap disimpan. Kehadiran harian dan tugas lain tidak dihapus. Pengganti baru atau guru asli yang dipulihkan wajib dikonfirmasi dan mengisi jurnal kembali jika sesuai eligibility. Replace gagal mempertahankan pengganti, jurnal dan kredit lama melalui rollback transaksi.

Assignment kanonis tetap satu slot/occurrence sesuai fondasi Tahap 3; original_user_id tidak berubah, effective_user_id dan nama efektif berubah secara versioned. Tabel substitutions menyimpan setiap pergantian, pembatalan dan replaced_by_id. Ini tidak membuat dua pemilik efektif untuk satu slot.

Semua mutasi memakai advisory lock bersama domain akun/master, lock assignment dan guard bulan `finance.period_guards`. Bulan final menolak mutasi langsung. Jadwal yang telah memiliki occurrence tidak dapat diubah sehingga merusak snapshot; rentang dapat ditutup ke depan jika bukti lama tetap tercakup. Parent periode tidak dapat dipersempit/diarsipkan sehingga menyingkirkan tugas aktif.

## API konkret

| Metode | Endpoint | Isi |
|---|---|---|
| GET | `/api/duties/board?date=YYYY-MM-DD` | Board scope admin/piket/pemilik; canOperate, jadwal, occurrence, alokasi dan pilihan guru/periode terotorisasi |
| POST | `/api/duties/schedule` | `id?`, `version`, `kind`, `userId`, `academicPeriodId`, `dayIndex`, `date`, `validFrom`, `validTo`, `timeStart`, `timeEnd`, `active`, `reason` |
| POST | `/api/duties/preview` | `occurrenceId`, `version`, `operation`, `reason`; kandidat/jumlah sesuai operasi |
| POST | `/api/duties/commit` | `previewId` saja; request dari pratinjau tidak dapat ditukar |

Operasi: confirm, revoke, substitute, replace, cancel-substitute, adjust, allocate, remove-allocation, reset. substitute/replace/allocate memerlukan userId; adjust memerlukan adjustedJtm; allocate memerlukan allocatedJtm; remove-allocation memerlukan allocationId. Jadwal baru memakai version="0", alasan jadwal 5–500 karakter, alasan operasi 1–500. Upacara: dayIndex=1 dan date=validFrom=validTo yang jatuh Senin; piket: date=null.

Seluruh POST memerlukan Origin, CSRF sesi dan sesi business aktif; validasi strict Zod serta pemeriksaan SQL berulang. Respons no-store dengan error Indonesia, rate-limit kegiatan terpisah dari OTP. API Tahap 3 otomatis memakai capability piket untuk scope kehadiran/rekap/konfirmasi; jurnal dan ledger pribadi tetap dibatasi pemilik.

## Batas bukti

Pengujian lokal meliputi race dua promise pada PGlite yang mengantre transaksi, bukan dua koneksi native. Probe Supabase rollback menguji invariant ledger dan constraint native tanpa menyimpan fixture atau mengirim email. UAT browser berakun nyata dan race PostgreSQL native dua koneksi tetap memerlukan verifikasi tersendiri. Notifikasi bisnis terjadwal dan finalisasi honor bukan cakupan tahap ini.
