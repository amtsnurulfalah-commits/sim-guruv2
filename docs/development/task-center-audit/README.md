# Audit Pusat Tugas — Oktober 2026

Basis: main setelah PR #53. Ruang lingkup: halaman `/tugas`, widget ringkas Dashboard dan dependency yang dipakai keduanya.

## Alur yang dipertahankan

`pageSession` dan SessionBoundary memeriksa sesi, onboarding dan maintenance. `TaskWorkspace` menggunakan tanggal WIB untuk membentuk halaman penuh. `TaskCenter` membaca `/api/operations/tasks` melalui `useReadResource` dan helper request/error yang sama dengan Dashboard. HTTP memverifikasi sesi/cross-site; OperationsService memanggil `app.tasks_read` menggunakan hash sesi, bukan ID/peran dari browser.

`app.tasks_read` memakai guard, advisory lock dan materializer kegiatan kanonik sebelum memproyeksikan `app.task_items`. Sumbernya jurnal KBM, BAP, jurnal acara, konfirmasi kegiatan, kehadiran, rekap siswa, penugasan, pekerjaan otomatis dan email gagal. Urutan server (blocked/deadline/id), policy H-1, periode final, kelayakan, kewenangan petugas dan isolasi akun dipertahankan.

Tidak ada CRUD tugas mandiri: penyelesaian berasal dari halaman sumber. Membaca notifikasi bukan menyelesaikan tugas. Tidak ditambahkan tombol selesai atau retry write otomatis. GET task tetap mempunyai perilaku materialisasi kanonik yang sudah ada; tidak ada jalur materialisasi alternatif.

## A. Temuan

1. Halaman penuh belum memiliki koordinasi tanggal WIB/pemeriksaan tanggal envelope seperti Dashboard. Tab yang melewati pergantian hari dapat menampilkan snapshot hari berbeda tanpa verifikasi lingkup tanggal.
2. Kontrak menerima ID ganda, deskripsi kosong dan link internal dengan tanggal/jenis yang tidak sesuai tugas. Risiko duplicate React keys dan pengarahan ke sumber yang salah.
3. Kode `STUDENT_ATTENDANCE_MISMATCH` ditampilkan sebagai prasyarat jurnal generik, sehingga kebutuhan rekap siswa ujian tidak jelas.
4. Snapshot yang melewati batas waktu eksklusif masih diberi label `Segera`. Label tidak membedakan waktu yang telah lewat.
5. Pagination hanya membatasi nilai yang dirender; state halaman lama dapat kembali saat data menyusut lalu bertambah setelah background refresh.
6. Daftar penuh hanya mempunyai filter status; belum ada ringkasan jumlah, pencarian, filter jenis dan penjelasan kosong akibat filter. Satu kolom juga membuang ruang desktop.
7. Halaman route belum memberi metadata judul atau pesan maintenance khusus. Fokus pengguna setelah mengganti halaman daftar belum diarahkan ke hasil baru.

## B. Perubahan

- `TaskWorkspace`: header, tanggal WIB, link notifikasi dan key akun/tanggal. Hook tanggal dipindah ke `lib/calendar/use-wib-day`; ekspor `useDashboardDay` tetap tersedia sebagai alias, tanpa implementasi ganda. Keduanya memeriksa tanggal saat focus/online/visible dan interval, dengan cleanup.
- Pemeriksaan tanggal envelope pada halaman penuh; perubahan tanggal membentuk widget baru dan membatalkan pembacaan lama. Request lambat, fokus beruntun, snapshot refresh, timeout/error dan cleanup tetap memakai hook read yang sudah diuji pada Dashboard.
- Validasi unique ID, judul/keterangan tidak kosong, whitelist path sesuai jenis serta kesesuaian tanggal link. Link internal tanpa tanggal yang sebelumnya valid tetap didukung. Field dan nama API tidak berubah.
- Penjelasan prasyarat ujian spesifik; status deadline eksklusif ditampilkan jelas. Ini hanya presentasi snapshot, bukan perubahan kelayakan atau deadline server. Halaman sumber tetap memutuskan hak tindakan.
- Ringkasan jumlah/status, pencarian judul/keterangan terjemahan/tanggal/jenis, filter gabungan, reset, dan jumlah hasil. Filter lokal menjaga urutan kanonik SQL. Empty state membedakan filter kosong dan proyeksi kosong.
- Pagination 20 baris penuh/5 ringkas dipertahankan. State halaman disesuaikan setelah snapshot valid menyusut; temporary error tidak mereset filter. Navigasi pagination memindahkan fokus ke judul daftar.
- Grid card responsif; toolbar/tombol mobile, wrapping teks panjang, label select dengan ID unik, warna status beserta teks. Ringkasan mobile memakai baris ringkas agar daftar lebih cepat terjangkau; desktop memakai kartu. Scroll vertikal dokumen tetap normal untuk daftar panjang.

Tidak ada perubahan SQL, schema/migrasi, endpoint, hak akses, rumus honorarium, notifikasi/email worker atau logika bisnis sumber.

## C. Kode final

- `src/app/(workspace)/tugas/page.tsx`
- `src/features/tasks/task-workspace.tsx`
- `src/features/tasks/task-center.tsx`
- `src/lib/tasks/contracts.ts` dan `src/lib/tasks/presentation.ts`
- `src/lib/calendar/use-wib-day.ts`, alias kompatibel `src/features/dashboard/use-dashboard-day.ts`

## D. Verifikasi

- `npm run check`: lint, TypeScript, unit, crypto/HTTP, seluruh integrasi database dan build.
- Unit: kontrak duplicate/blank/unsafe/mismatched links, deadline tepat pada batas, filter gabungan dan urutan, terjemahan prasyarat ujian.
- `test:ui:tasks`: admin/guru, tugas/inbox, 280–1920 px; pencarian/status/jenis/reset/touch; pagination shrink/growth dan 101 entri; skeleton, HTTP/malformed/network/retry; date guard; duplicate IDs; wrong source link; fokus/online beruntun dan hidden tab; teks panjang/200%/orientation; pergantian WIB; SQL fixture nyata; regresi preferensi/read receipt/double submit/uncertain write.
- `test:ui:dashboard` dan `test:ui`: regresi widget bersama, tanggal, lifecycle dan layout umum.
- Screenshot desktop/mobile ditinjau secara visual, disertai pemeriksaan document width dan runtime errors. Pengujian localhost memakai identitas dan data sintetis, bukan UAT perangkat fisik atau akun produksi.
- CI dan merge final mengikuti PR. Pemeriksaan produksi menggunakan probe anonim tanpa login, pengiriman email, atau perubahan data bisnis baru.
