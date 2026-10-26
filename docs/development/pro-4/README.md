# PRO-4 — Mobile dan koneksi tidak stabil

Baseline rilis: main `70180ec648ce273034a6586ad4449e78bada2b96` (PRO-3/PR73). Implementasi dan merge diizinkan pengelola pada 26 Oktober 2026 WIB.

## Temuan dan perubahan

- Browser offline masih mencoba mengambil CSRF, sehingga kegagalan sebelum dispatch dapat disalahartikan sebagai hasil transaksi tidak pasti. Helper `assertWriteConnection` dipakai sebelum CSRF pada `masterRequest` dan sebelum dispatch HTTP bersama. OFFLINE berarti permintaan belum dikirim; putus setelah dispatch tetap perlu rekonsiliasi. Tidak ada retry/antrean background baru.
- Draft hanya menampilkan waktu simpan lokal. Status kini membedakan sedang dikirim, hasil belum pasti, permintaan belum tersimpan dan receipt server. Kebijakan sessionStorage, akun, TTL 24 jam, versi sumber serta penghapusan saat logout dipertahankan. Receipt jurnal tetap diverifikasi identitas/versinya oleh workspace.
- Persetujuan tinjauan hasil tidak pasti sebelumnya boolean, dapat terbawa ketika kandidat draft berubah. Persetujuan sekarang terikat akun, entitas, basis dan waktu kandidat.
- Layout modal mengikuti layout viewport saja. FormDialog sekarang mendengarkan resize/scroll visualViewport, membatasi tinggi area header/footer, menjaga body dapat digulir dan tombol wrapping. Native dialog juga mendapat scroll lokal. Listener dibersihkan saat tutup/unmount.
- Indikator koneksi pada shell menjelaskan data mungkin lama dan perlunya simpan/muat ulang manual. Status online browser bukan bukti server tersedia atau transaksi tersimpan.

Tidak mengubah API, struktur bisnis, kebijakan akses, SQL, index, perhitungan honor atau mesin draft. Tidak ada migrasi database. Tidak membuat cache data privat/service worker/offline transaction queue.

## Cakupan dan batas

Pilot tulis: jurnal existing; komponen bersama berlaku untuk form lain. Jadwal, BAP/ujian, tugas dan honor/slip diverifikasi melalui suite existing. Tabel yang perlu perbandingan mempertahankan scroll lokal; tidak memaksa semua tabel menjadi kartu.

Uji browser memakai Chromium headless dan fixture sintetis; bukan perangkat fisik, Safari/iOS atau inbox/server produksi. Tinggi layar pendek adalah pendekatan geometri, bukan bukti keyboard fisik. PRO-4.7 dan penerimaan matriks perangkat/UAT tetap terbuka. Gate PRO-3 BKP-01/BKP-02/MAIL-01 tidak otomatis selesai.

Lihat [validasi](VALIDATION.md) dan [checkpoint](CHECKPOINT.md).
