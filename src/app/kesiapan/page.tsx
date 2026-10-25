import Link from "next/link";
import type { Metadata } from "next";
import { BookOpen, CircleHelp, LogIn } from "lucide-react";
import { ActionIcon } from "@/components/ui/action-icon";
import { Button } from "@/components/ui/button";
import { Workspace } from "@/components/shell/workspace";
import { ModuleCards } from "@/features/dashboard/module-cards";
import { modules, navigationGroups } from "@/lib/navigation/modules";

export const metadata: Metadata = {
  title: "Panduan aplikasi",
  description:
    "Panduan memulai, menjalankan tugas, dan menangani kendala penggunaan SiM-Guru.",
};
const sections = [
  ["mulai", "Mulai menggunakan"],
  ["alur-kerja", "Alur kerja harian"],
  ["modules-heading", "Kenali modul"],
  ["bantuan", "Bantuan dan kendala"],
] as const;
const questions = [
  {
    question: "Lupa kata sandi atau tidak menerima kode verifikasi?",
    answer:
      "Buka pemulihan akun menggunakan username madrasah. OTP dikirim jika akun memenuhi syarat dan memiliki email terverifikasi. Periksa folder spam. Jika email tidak dapat diakses atau verifikasi tidak dapat diselesaikan, hubungi administrator untuk verifikasi identitas. Ikuti waktu tunggu yang ditampilkan sebelum meminta kode kembali.",
  },
  {
    question: "Menu tidak tersedia atau akses ditolak?",
    answer:
      "Menu mengikuti peran, izin, status akun, dan penugasan Anda. Selesaikan pengamanan akun jika diminta. Jika akses masih tidak sesuai, sampaikan nama menu dan kegiatan yang perlu dikerjakan kepada administrator. Daftar modul di panduan ini bukan bukti bahwa akun Anda memiliki akses.",
  },
  {
    question: "Jadwal atau penugasan tidak sesuai?",
    answer:
      "Periksa tanggal, semester, kelas, dan filter yang dipilih. Jika masih berbeda, sampaikan tanggal serta kegiatan terkait kepada administrator agar jadwal atau penugasan dapat diperiksa sebelum Anda mencatat kegiatan.",
  },
  {
    question: "Penyimpanan gagal atau koneksi terputus?",
    answer:
      "Baca pesan kesalahan dan perbaiki isian yang ditandai. Jika koneksi terputus setelah menyimpan, periksa riwayat atau status hasil terlebih dahulu sebelum mengirim ulang agar tidak membuat data ganda. Pada Persiapan semester, gunakan Periksa hasil pratinjau untuk menelusuri penerapan yang belum pasti.",
  },
  {
    question: "Bagaimana menggunakan kode referensi bantuan?",
    answer:
      "Salin kode referensi bantuan lengkap jika ditampilkan. Sampaikan kepada administrator bersama waktu kejadian, nama halaman, tindakan terakhir, dan pesan kesalahan. Administrator menelusurinya melalui Laporan Kendala. Jika kode tidak tersedia, tetap laporkan rincian kejadian; gangguan sebelum permintaan mencapai server dapat tidak tercatat.",
  },
] as const;

export default function ReadinessPage() {
  return (
    <Workspace>
      <div className="application-guide @container min-w-0 space-y-8 [overflow-wrap:anywhere]">
        <header className="space-y-3">
          <p className="text-xs font-semibold tracking-widest uppercase text-primary">
            Bantuan pengguna
          </p>
          <h1>Panduan aplikasi</h1>
          <p className="max-w-3xl text-sm leading-7 text-muted-foreground">
            Mulai dari akun, lanjutkan tugas harian, dan temukan langkah bantuan
            saat penggunaan SiM-Guru mengalami kendala.
          </p>
          <p className="max-w-3xl text-sm leading-7 text-muted-foreground">
            Panduan ini dapat dibaca tanpa masuk. Menu dan data yang dapat
            digunakan setelah masuk tetap mengikuti kewenangan akun Anda.
          </p>
        </header>
        <nav
          aria-label="Daftar isi panduan"
          className="rounded-2xl border bg-card p-4 sm:p-5"
        >
          <p className="mb-3 text-sm font-semibold">
            Temukan yang Anda butuhkan
          </p>
          <ul
            role="list"
            className="grid min-w-0 gap-2 @min-[34rem]:grid-cols-2 @min-[60rem]:grid-cols-4"
          >
            {sections.map(([id, label]) => (
              <li key={id} className="min-w-0">
                <a
                  href={`#${id}`}
                  className="ui-action ui-action-secondary w-full text-left justify-start"
                >
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <section
          aria-labelledby="mulai"
          className="grid min-w-0 gap-5 @min-[40rem]:grid-cols-2"
        >
          <div className="ui-panel space-y-4">
            <LogIn aria-hidden="true" className="size-6 text-primary" />
            <h2
              id="mulai"
              tabIndex={-1}
              className="scroll-mt-28 text-lg font-bold"
            >
              Masuk dan lengkapi akun
            </h2>
            <ol className="list-decimal space-y-3 pl-5 text-sm leading-7 text-muted-foreground">
              <li>
                Dapatkan akun dari administrator madrasah. Tidak ada pendaftaran
                akun publik.
              </li>
              <li>
                Masuk dengan username dan kata sandi. Selesaikan aktivasi atau
                pengamanan akun jika diminta.
              </li>
              <li>
                Periksa Akun dan profil, lalu buka jadwal dan tugas sesuai
                penugasan Anda.
              </li>
            </ol>
            <Button asChild variant="outline">
              <Link prefetch={false} href="/login">
                <ActionIcon action="access" />
                Masuk ke SiM-Guru
              </Link>
            </Button>
          </div>
          <div className="ui-panel space-y-4">
            <CircleHelp aria-hidden="true" className="size-6 text-primary" />
            <h2 className="text-lg font-bold">Pulihkan akses akun</h2>
            <p className="text-sm leading-7 text-muted-foreground">
              Lupa kata sandi? Ikuti verifikasi pada pemulihan akun. Jika
              aktivasi atau kode verifikasi belum diterima, periksa folder spam
              dan hubungi administrator untuk memeriksa status pengiriman.
            </p>
            <p className="text-sm leading-7 text-muted-foreground">
              Jangan membagikan kata sandi, kode OTP, jawaban keamanan, atau
              tautan pemulihan akun kepada siapa pun.
            </p>
            <Button asChild variant="outline">
              <Link prefetch={false} href="/lupa-password">
                <ActionIcon action="open" />
                Buka pemulihan akun
              </Link>
            </Button>
          </div>
        </section>
        <section aria-labelledby="alur-kerja" className="ui-panel space-y-5">
          <h2
            id="alur-kerja"
            tabIndex={-1}
            className="scroll-mt-28 text-xl font-bold"
          >
            Alur kerja harian
          </h2>
          <ol className="grid min-w-0 list-inside list-decimal gap-4 text-sm leading-7 @min-[52rem]:grid-cols-3">
            <li className="min-w-0 rounded-xl bg-muted/50 p-4">
              <strong>Periksa informasi.</strong>
              <p className="mt-2 text-muted-foreground">
                Buka Dashboard untuk ringkasan dan Notifikasi untuk
                pemberitahuan. Cocokkan jadwal dengan tanggal kegiatan.
              </p>
            </li>
            <li className="min-w-0 rounded-xl bg-muted/50 p-4">
              <strong>Kerjakan penugasan.</strong>
              <p className="mt-2 text-muted-foreground">
                Gunakan Pusat tugas untuk melihat pekerjaan. Lengkapi konfirmasi
                KBM, kehadiran, jurnal, atau kegiatan lain sesuai penugasan yang
                tersedia.
              </p>
            </li>
            <li className="min-w-0 rounded-xl bg-muted/50 p-4">
              <strong>Periksa hasil.</strong>
              <p className="mt-2 text-muted-foreground">
                Pastikan pesan berhasil dan data pada riwayat atau status hasil
                sesuai. Jika ditolak, baca alasannya sebelum mencoba kembali.
              </p>
            </li>
          </ol>
        </section>
        <section
          aria-labelledby="modules-heading"
          className="ui-panel space-y-5"
        >
          <h2
            id="modules-heading"
            tabIndex={-1}
            className="scroll-mt-28 text-xl font-bold"
          >
            Modul SiM-Guru
          </h2>
          <p className="text-sm leading-7 text-muted-foreground">
            Daftar ini menjelaskan fungsi aplikasi, bukan daftar izin akun.
            Modul administrasi khusus administrator; Laporan pimpinan memerlukan
            kewenangan laporan. Masuk untuk menggunakan modul yang diizinkan.
          </p>
          {navigationGroups.map((group) => (
            <section
              key={group}
              aria-label={group}
              className="min-w-0 space-y-3"
            >
              <p className="flex items-center gap-2 text-sm font-bold text-primary">
                <BookOpen aria-hidden="true" className="size-4 shrink-0" />
                {group}
              </p>
              <ModuleCards
                items={modules.filter((module) => module.group === group)}
                linked={false}
                describeAccess
              />
            </section>
          ))}
        </section>
        <section aria-labelledby="bantuan" className="ui-panel space-y-5">
          <h2
            id="bantuan"
            tabIndex={-1}
            className="scroll-mt-28 text-xl font-bold"
          >
            Bantuan dan kendala
          </h2>
          <p className="text-sm leading-7 text-muted-foreground">
            Pilih pertanyaan untuk melihat langkah penanganan. Jika masih
            terkendala, hubungi administrator madrasah.
          </p>
          <div className="min-w-0 space-y-3">
            {questions.map(({ question, answer }) => (
              <details
                key={question}
                className="guide-question min-w-0 rounded-xl border bg-card"
              >
                <summary className="min-h-11 rounded-xl px-4 py-3 text-sm font-semibold hover:bg-accent">
                  {question}
                </summary>
                <p className="px-4 pb-4 text-sm leading-7 text-muted-foreground">
                  {answer}
                </p>
              </details>
            ))}
          </div>
          <p className="rounded-xl border bg-muted/50 p-4 text-sm leading-7">
            Sebelum mengirim tangkapan layar, tutupi data pribadi dan rahasia.
            Kode referensi membantu penelusuran kejadian, tetapi bukan bukti
            identitas pemilik akun.
          </p>
        </section>
      </div>
    </Workspace>
  );
}
