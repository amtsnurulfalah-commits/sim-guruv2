import React, { useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { AuthLayout } from "../../src/components/shell/auth-layout";
import { LoginForm } from "../../src/features/auth/login-form";
import HomePage from "../../src/app/page";
import { Workspace } from "../../src/components/shell/workspace";
import { DataForm } from "../../src/features/programs/forms";
import { FormDialog } from "../../src/components/ui/dialog";
import {
  ManagedDialog,
  requestDialogClose,
} from "../../src/components/ui/managed-dialog";
import { ToastRegion } from "../../src/components/feedback/toast-region";
import { Button } from "../../src/components/ui/button";
import { MasterManager } from "../../src/features/masters/master-manager";
import { UserManager } from "../../src/features/users/user-manager";
import { CalendarManager } from "../../src/features/calendar/calendar-manager";
import { ScheduleManager } from "../../src/features/schedules/schedule-manager";
import { ActivityWorkspace } from "../../src/features/activities/workspace";
import { DutyManager } from "../../src/features/duties/duty-manager";
import { ExamManager } from "../../src/features/programs/exam-manager";
import { EventManager } from "../../src/features/programs/event-manager";
import { FinanceManager } from "../../src/features/finance/finance-manager";
import {
  AnnouncementManager,
  OperationsManager,
} from "../../src/features/operations/managers";
import { MigrationManager } from "../../src/features/migration/manager";
import type { SessionDto } from "../../src/types/auth";
const params = new URLSearchParams(location.search),
  admin = params.get("role") !== "guru",
  view = params.get("view") ?? "lab",
  id = admin
    ? "11111111-1111-4111-8111-111111111111"
    : "22222222-2222-4222-8222-222222222222";
const session: SessionDto = {
  user: {
    id,
    username: "fixture",
    fullName: "Guru Pengujian Sintetis",
    role: admin ? "admin" : "guru",
  },
  scope: "business",
  expiresAt: "2099-01-01",
  idleExpiresAt: "2099-01-01",
  onboarding: {
    mustChangePassword: false,
    emailVerified: true,
    securityQuestionReady: true,
  },
  maintenance: false,
};
function Lab() {
  const [count, setCount] = useState(0),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const legacy = useRef<HTMLDialogElement>(null);
  return (
    <div className="ui-panel space-y-6">
      <h1>Laboratorium antarmuka sintetis</h1>
      <p role="status">Jumlah penyimpanan: {count}</p>
      <DataForm
        label="Simpan contoh"
        busy={busy}
        fields={[
          { key: "name", label: "Nama" },
          { key: "reason", label: "Alasan" },
          {
            key: "days",
            label: "Hari",
            type: "days",
            optional: true,
            options: [
              { id: "1", name: "Senin" },
              { id: "2", name: "Selasa" },
            ],
          },
        ]}
        onSave={async (data) => {
          setBusy(true);
          try {
            await new Promise((r) => setTimeout(r, 150));
            if (data.name === "gagal")
              throw Error("Penyimpanan ditolak untuk pengujian.");
            setCount((v) => v + 1);
          } finally {
            setBusy(false);
          }
        }}
      />
      <FormDialog title="Formulir kontekstual" busy={busy} success={message}>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setMessage("");
            await new Promise((r) => setTimeout(r, 100));
            setMessage("Data sintetis tersimpan.");
            setBusy(false);
          }}
        >
          <label>
            Catatan
            <input className="ui-control" name="note" />
          </label>
          <Button type="submit">Simpan catatan</Button>
        </form>
      </FormDialog>
      <Button variant="outline" onClick={() => legacy.current?.showModal()}>
        Buka editor native
      </Button>
      <ManagedDialog ref={legacy} aria-labelledby="native-title">
        <h2 id="native-title">Editor native</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setCount((v) => v + 1);
            legacy.current?.close();
          }}
        >
          <label>
            Nama native
            <input className="ui-control" name="nativeName" />
          </label>
          <Button
            type="button"
            variant="outline"
            onClick={() => requestDialogClose(legacy.current)}
          >
            Tutup editor
          </Button>
          <Button type="submit">Simpan native</Button>
        </form>
      </ManagedDialog>
    </div>
  );
}
const components: Record<string, React.ReactNode> = {
  lab: <Lab />,
  masters: <MasterManager />,
  users: <UserManager />,
  calendar: <CalendarManager />,
  schedules: <ScheduleManager admin={admin} />,
  occurrences: (
    <ActivityWorkspace admin={admin} userId={id} mode="occurrences" />
  ),
  attendance: <ActivityWorkspace admin={admin} userId={id} mode="attendance" />,
  students: <ActivityWorkspace admin={admin} userId={id} mode="students" />,
  journals: <ActivityWorkspace admin={admin} userId={id} mode="journals" />,
  duties: <DutyManager admin={admin} userId={id} />,
  exams: <ExamManager admin={admin} userId={id} />,
  events: <EventManager admin={admin} userId={id} />,
  finance: <FinanceManager admin={admin} />,
  history: <FinanceManager admin={admin} view="history" />,
  financeOperations: <FinanceManager admin={admin} view="operations" />,
  announcements: <AnnouncementManager />,
  operations: <OperationsManager />,
  migration: <MigrationManager />,
};
createRoot(document.getElementById("root")!).render(
  <>
    {view === "login" ? (
      <AuthLayout
        title="Masuk ke SiM-Guru"
        description="Gunakan username dan kata sandi akun madrasah Anda."
      >
        <LoginForm />
      </AuthLayout>
    ) : view === "home" ? (
      <HomePage />
    ) : (
      <Workspace session={session} onLogout={() => {}}>
        {components[view] ?? <Lab />}
      </Workspace>
    )}
    <ToastRegion />
  </>,
);
