"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { masterRequest } from "@/features/masters/api";
import { Announcements } from "@/features/operations/announcements";
type Summary = {
  date: string;
  planned: { id: string; kind: string; time_start: string; time_end: string }[];
  pendingEventJournals: number;
  tasks: {
    id: string;
    kind: string;
    start: string;
    end: string;
    confirmed: boolean;
    journalComplete: boolean;
  }[];
  attendance: { actualIn: string | null; actualOut: string | null } | null;
  honor: { total: string; totalJtm: string; rateMissing: boolean };
  pendingHolidays: number;
  admin: {
    activeUsers: number;
    failedMessages: number;
    failedJobs: number;
  } | null;
};
export function LiveSummary() {
  const [value, setValue] = useState<Summary | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    const c = new AbortController();
    masterRequest<{ summary: Summary }>(
      "/api/dashboard",
      "GET",
      undefined,
      c.signal,
    )
      .then((v) => {
        if (!c.signal.aborted) setValue(v.summary);
      })
      .catch((e) => {
        if (!c.signal.aborted) setError(e.message);
      });
    return () => c.abort();
  }, []);
  return (
    <div className="space-y-5">
      <Announcements />
      {error && <p role="alert">{error}</p>}
      {!value ? (
        <p role="status">
          {error
            ? "Ringkasan belum dapat dimuat."
            : "Memuat ringkasan kegiatan…"}
        </p>
      ) : (
        <>
          <section className="grid gap-4 sm:grid-cols-3">
            <article className="rounded-xl border p-5">
              <h2 className="font-bold">Kehadiran hari ini</h2>
              <p>Masuk: {value.attendance?.actualIn ?? "Belum tercatat"}</p>
              <p>Keluar: {value.attendance?.actualOut ?? "Belum tercatat"}</p>
              <Link className="underline" href="/kehadiran">
                Buka kehadiran
              </Link>
            </article>
            <article className="rounded-xl border p-5">
              <h2 className="font-bold">Honor terealisasi bulan ini</h2>
              <p className="text-xl font-bold">
                {value.honor.rateMissing
                  ? "Tarif belum lengkap"
                  : "Rp " +
                    value.honor.total
                      .split(".")[0]!
                      .replace(/\B(?=(\d{3})+(?!\d))/g, ".")}
              </p>
              <p>
                {value.honor.totalJtm} JTM · {value.pendingHolidays} hak libur
                belum diproses
              </p>
              {value.honor.rateMissing && (
                <p>Tarif belum lengkap; nominal belum dapat disimpulkan.</p>
              )}
              <p className="text-sm">
                Perhitungan berjalan, dapat berubah sampai finalisasi.
              </p>
              <Link className="underline" href="/honorarium">
                Rincian honorarium
              </Link>
            </article>
            <article className="rounded-xl border p-5">
              <h2 className="font-bold">Progres kegiatan tercatat</h2>
              <p>
                {value.tasks.filter((t) => t.confirmed).length} /{" "}
                {value.tasks.length} terkonfirmasi
              </p>
              <p>
                {
                  value.tasks.filter((t) => t.confirmed && !t.journalComplete)
                    .length
                }{" "}
                jurnal / BAP perlu dilengkapi
              </p>
              <Link className="underline" href="/kegiatan">
                Buka kegiatan
              </Link>
            </article>
          </section>
          <section className="space-y-3 rounded-xl border p-5">
            <h2 className="font-bold">
              Penugasan efektif yang sudah tercatat hari ini
            </h2>
            <p className="text-sm">
              Jadwal yang belum dibentuk sebagai kegiatan dapat diperiksa pada
              menu Jadwal.
            </p>
            {value.tasks.length === 0 && (
              <p>Belum ada penugasan kegiatan tercatat untuk Anda.</p>
            )}
            {value.planned.map((t) => (
              <p key={t.id}>
                {t.kind} · {t.time_start.slice(0, 5)}–{t.time_end.slice(0, 5)}{" "}
                WIB · Terjadwal, belum tercatat
              </p>
            ))}
            <p>{value.pendingEventJournals} jurnal acara perlu dilengkapi</p>
            {value.tasks.map((t) => (
              <p key={t.id}>
                {t.kind} · {t.start.slice(0, 5)}–{t.end.slice(0, 5)} WIB ·{" "}
                {t.confirmed ? "Terkonfirmasi" : "Menunggu konfirmasi"}
                {t.confirmed && !t.journalComplete
                  ? " · Jurnal/BAP belum lengkap"
                  : ""}
              </p>
            ))}
          </section>
          {value.admin && (
            <section className="rounded-xl border p-5">
              <h2 className="font-bold">Ringkasan administrasi</h2>
              <p>
                {value.admin.activeUsers} pengguna aktif ·{" "}
                {value.admin.failedMessages} email perlu ditinjau ·{" "}
                {value.admin.failedJobs} pekerjaan gagal
              </p>
              <Link className="underline" href="/admin/operasional">
                Buka pemantauan operasional
              </Link>
            </section>
          )}
        </>
      )}
    </div>
  );
}
