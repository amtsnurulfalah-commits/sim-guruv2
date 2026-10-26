# Validasi PRO-6 — 26 Oktober 2026 WIB

Semua data/akun sintetis. Tidak menjalankan transaksi atau email produksi.

| Pemeriksaan | Hasil |
| --- | --- |
| Unit baru | Dua skenario: roundtrip allowlist/density/count/pins dan penolakan scope/role/JSON/versi/ukuran/field sensitif/duplikasi. Full unit suite diwajibkan di CI. |
| Preferensi UI | Lulus7lebar280–1920: reload, jumlah tugas tanpa refetch, reset, padding desktop/pointerfine, tombol>=44px, density mobile, isolasi akun/peran, forged admin pins tersembunyi dan slot tetap usable, versi invalid, storage denied, tidak mengubah URL. 0 page error/overflow. |
| Pusat tugas existing | Lulus28kasus: role/view/width, filter/status/kind/search, paging/clamp/growth, slow focus/online/hidden tab, error/retry/date/duplicate/source link, prerequisite/deadline, orientation/200%teks, uncertain write lock, preferensi notifikasi/draft existing. |
| Lifecycle draft/preferensi | Logout sukses, broadcast logout, session401, pergantian akun dan peran membersihkan key preferensi bersama draft; draft offline/reload/TTL/versi/tab isolation tetap lulus. |
| Lint / typecheck | Lulus. |
| Build lokal | Lulus setelah cache Turbopack lokal yang rusak dipindahkan; source tidak diubah untuk menyembunyikan kegagalan cache. |

Quality CI dan native-release pada head PR harus hijau sebelum merge; tree merge dan SHA/alias produksi harus cocok, READY. Dokumentasi hasil aktual tersedia melalui PR/Actions, bukan asumsi dari checkpoint.

React review: provider per scope, listener cleanup, SSR default stabil, state/ref tanpa request cache akun, tidak fetch pada update tampilan, allowlist sebelum storage, safe fallback. Tidak menambah dependency, API preferensi/DB, kalkulator, antrean tulis atau hak akses. Tidak ada migrasi.

Batas: Chromium otomatis/fixture bukan perangkat fisik atau UAT. Pengguna nyata belum memilih preferensi atau mengukur manfaat. Sidebar collapse perangkat existing dan preferensi notifikasi server tidak direset oleh tombol reset tiga preferensi baru.
