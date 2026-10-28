"use client";
import { HelpDisclosure } from "@/components/ui/help-disclosure";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { inboxSchema } from "@/lib/tasks/contracts";
import { masterRequest } from "@/features/masters/api";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";
import { FeatureState, EmptyState } from "@/components/feedback/feature-state";
import { ErrorFeedback } from "@/components/feedback/error-feedback";
const states = {
  pending: "Email dalam antrean",
  sending: "Email sedang dikirim",
  sent: "Email diterima layanan pengiriman",
  retry_wait: "Email menunggu percobaan ulang",
  failed: "Email gagal dikirim",
  unknown: "Status penerimaan email belum pasti",
  cancelled: "Pengiriman email dibatalkan",
};
export function NotificationInbox() {
  const [data, setData] = useState<ReturnType<typeof inboxSchema.parse> | null>(
      null,
    ),
    [page, setPage] = useState(1),
    [unread, setUnread] = useState(false),
    [revision, setRevision] = useState(0);
  const [error, setError] = useState(""),
    [actionError, setActionError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [blocked, setBlocked] = useState(false);
  const [email, setEmail] = useState(true),
    [reminder, setReminder] = useState(true);
  const pending = useRef(false),
    mounted = useRef(false),
    preferenceVersion = useRef<string | null>(null);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    masterRequest<unknown>(
      `/api/operations/inbox?page=${page}&unread=${unread}`,
      "GET",
      undefined,
      controller.signal,
    )
      .then((value) => {
        const parsed = inboxSchema.safeParse(value);
        if (!parsed.success)
          throw Error(
            "Data notifikasi belum sesuai. Muat ulang atau hubungi administrator.",
          );
        if (controller.signal.aborted) return;
        const last = Math.max(1, Math.ceil(parsed.data.total / 20));
        if (page > last) {
          setPage(last);
          return;
        }
        setData(parsed.data);
        if (preferenceVersion.current !== parsed.data.preferences.version) {
          preferenceVersion.current = parsed.data.preferences.version;
          setEmail(parsed.data.preferences.emailEnabled);
          setReminder(parsed.data.preferences.reminderEmail);
        }
        setError("");
        setBlocked(false);
      })
      .catch((value) => {
        if (!controller.signal.aborted) {
          setData(null);
          setError(
            value instanceof Error
              ? value.message
              : "Notifikasi belum dapat dimuat.",
          );
        }
      });
    return () => controller.abort();
  }, [page, unread, revision]);
  function reload() {
    setData(null);
    setError("");
    setActionError("");
    setRevision((v) => v + 1);
  }
  async function write(kind: string, input: unknown) {
    if (pending.current || blocked) return;
    pending.current = true;
    setBusy(true);
    setActionError("");
    setNotice("");
    try {
      const result = await masterRequest<unknown>(
        "/api/operations/" + kind,
        "POST",
        input,
      );
      if (
        !result ||
        typeof result !== "object" ||
        !(kind === "notification-read"
          ? "read" in result && result.read === true
          : "saved" in result && result.saved === true)
      )
        throw Error(
          "Status perubahan belum dapat dipastikan. Muat ulang sebelum mencoba kembali.",
        );
      if (mounted.current) {
        setNotice(
          kind === "notification-read"
            ? "Notifikasi ditandai sudah dibaca."
            : "Preferensi notifikasi tersimpan.",
        );
        reload();
      }
    } catch (value) {
      if (mounted.current) {
        setActionError(
          value instanceof Error
            ? value.message
            : "Perubahan belum dapat dipastikan. Muat ulang sebelum mencoba kembali.",
        );
        setBlocked(true);
      }
    } finally {
      pending.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  return (
    <div className="min-w-0 space-y-6">
      <header>
        <h1>Notifikasi</h1>
        <HelpDisclosure><p className="mt-3 text-sm leading-6 text-muted-foreground">
          Tandai dibaca hanya mengubah inbox. Penyelesaian tugas tetap mengikuti
          sumber. Antrean email bukan bukti pesan telah diterima pengguna.
        </p></HelpDisclosure>
      </header>
      <Button type="button" variant="outline" disabled={busy} onClick={reload}>
        Muat ulang notifikasi
      </Button>
      {notice && <p role="status">{notice}</p>}
      <ErrorFeedback message={actionError} />
      {!data ? (
        <FeatureState
          error={error}
          headingLevel={2}
          label="Memuat notifikasi…"
          retry={reload}
        />
      ) : (
        <>
          <form
            className="ui-panel space-y-4"
            aria-busy={busy}
            onSubmit={(event) => {
              event.preventDefault();
              void write("notification-preferences", {
                version: data.preferences.version,
                emailEnabled: email,
                reminderEmail: reminder,
              });
            }}
          >
            <h2 className="text-lg font-bold">Preferensi email</h2>
            <p className="text-sm leading-6 text-muted-foreground">
              Email keamanan akun tetap mengikuti kebijakan keamanan. Inbox dan
              pusat tugas selalu tersedia. Perubahan ini berlaku pada pesan
              domain yang belum diklaim pengirim.
            </p>
            <fieldset disabled={busy || blocked} className="space-y-3">
              <label className="flex min-h-11 items-center gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={email}
                  onChange={(event) => setEmail(event.target.checked)}
                />
                Email informasi kegiatan dan honorarium
              </label>
              <label className="flex min-h-11 items-center gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={reminder}
                  onChange={(event) => setReminder(event.target.checked)}
                />
                Email ringkasan pengingat tugas
              </label>
              <Button type="submit">
                {busy ? "Menyimpan…" : "Simpan preferensi"}
              </Button>
            </fieldset>
          </form>
          <section
            className="ui-panel min-w-0 space-y-4"
            aria-label="Inbox notifikasi"
          >
            <h2 className="text-xl font-bold">
              Inbox · {data.unread} belum dibaca
            </h2>
            <label className="flex min-h-11 items-center gap-3 text-sm">
              <input
                type="checkbox"
                checked={unread}
                disabled={busy}
                onChange={(event) => {
                  setUnread(event.target.checked);
                  setPage(1);
                  setData(null);
                }}
              />
              Hanya yang belum dibaca
            </label>
            {!data.items.length && (
              <EmptyState title="Tidak ada notifikasi pada tampilan ini" />
            )}
            <ul className="space-y-3">
              {data.items.map((item) => (
                <li
                  key={item.id}
                  className="min-w-0 space-y-3 rounded-xl border p-4 [overflow-wrap:anywhere]"
                >
                  <h3 className="font-semibold">{item.subject}</h3>
                  <p className="whitespace-pre-wrap text-sm leading-6">
                    {item.body}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(item.created_at).toLocaleString("id-ID", {
                      timeZone: "Asia/Jakarta",
                    })}{" "}
                    WIB · {states[item.state]} ·{" "}
                    {item.read ? "Sudah dibaca" : "Belum dibaca"}
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <Button asChild variant="outline">
                      <Link prefetch={false} href={item.href}>
                        Buka rincian
                      </Link>
                    </Button>
                    {!item.read && (
                      <Button
                        type="button"
                        disabled={busy || blocked}
                        variant="outline"
                        onClick={() =>
                          void write("notification-read", { id: item.id })
                        }
                      >
                        Tandai sudah dibaca
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
            <Pagination
              label="Halaman notifikasi"
              page={page}
              pageSize={20}
              total={data.total}
              disabled={busy}
              onPageChange={(next) => {
                setPage(next);
                setData(null);
              }}
            />
          </section>
        </>
      )}
    </div>
  );
}
