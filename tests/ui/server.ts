/** Disposable localhost UI fixture. Never imported by app routes; no production DB or email. */
import { createServer } from "node:http";
import { randomUUID, createHash } from "node:crypto";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { build } from "esbuild";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";
import { openPgliteDatabase } from "../helpers/pglite-database";
import { applyMigrations, readMigrations } from "../../scripts/lib/migrations";
import { MasterService } from "../../src/server/masters/service";
import { CalendarService } from "../../src/server/calendar/service";
import { ScheduleService } from "../../src/server/schedules/service";
import { ActivityService } from "../../src/server/activities/service";
import { DutyService } from "../../src/server/duties/service";
import { renderCsv, renderPdf } from "../../src/server/activities/export";
import { ProgramService } from "../../src/server/programs/service";
import { FinanceService } from "../../src/server/finance/service";
import { OperationsService } from "../../src/server/operations/service";
import { MigrationService } from "../../src/server/migration/service";
async function main() {
  const output = resolve("../ui-fixture-build");
  await mkdir(output, { recursive: true });
  await build({
    entryPoints: ["tests/ui/harness.tsx"],
    outfile: resolve(output, "app.js"),
    bundle: true,
    platform: "browser",
    jsx: "automatic",
    define: { "process.env.NODE_ENV": "'production'" },
    alias: {
      "next/link": resolve("tests/ui/navigation-stub.tsx"),
      "next/navigation": resolve("tests/ui/navigation-stub.tsx"),
    },
  });
  const css = await postcss([tailwind({ base: process.cwd() })]).process(
    await readFile("src/app/globals.css", "utf8"),
    { from: resolve("src/app/globals.css") },
  );
  await writeFile(resolve(output, "app.css"), css.css);
  const db = await openPgliteDatabase();
  await applyMigrations(db, await readMigrations("supabase/migrations"));
  await db.query("select ops.record_support_event($1,clock_timestamp(),'activities','JOURNAL_BLOCKED',403)", ["48bfc3a0-adb3-45d0-a97f-eb27186062b0"]);
  const id = "11111111-1111-4111-8111-111111111111",
    token = "A".repeat(43),
    hash =
      "$argon2id$v=19$m=19456,t=2,p=1$abcdefghijklmnopqrstuv$" + "A".repeat(43);
  await db.query(
    "insert into app.app_users(id,username,full_name,role,status,must_change_password,contact_email,email_verified_at,km_distance) values($1,'fixture.admin','Administrator Pengujian Sintetis','admin','active',false,'fixture@example.test',clock_timestamp(),10)",
    [id],
  );
  await db.query(
    "insert into auth_private.user_credentials(user_id,password_hash) values($1,$2)",
    [id, hash],
  );
  await db.query(
    "insert into auth_private.security_questions(user_id,question,answer_hash) values($1,'Pertanyaan sintetis',$2)",
    [id, hash],
  );
  await db.query(
    "select auth_private.issue_session($1,$2,'1','1',$3,'business')",
    [id, hash, createHash("sha256").update(token).digest("hex")],
  );
  const guru = "22222222-2222-4222-8222-222222222222";
  await db.query(
    "insert into app.app_users(id,username,full_name,role,status,must_change_password,contact_email,email_verified_at,km_distance) values($1,'fixture.guru','Guru Pengujian Sintetis','guru','active',false,'guru.fixture@example.test',clock_timestamp(),10)",
    [guru],
  );
  await db.query(
    "insert into auth_private.user_credentials(user_id,password_hash) values($1,$2)",
    [guru, hash],
  );
  await db.query(
    "insert into auth_private.security_questions(user_id,question,answer_hash) values($1,'Pertanyaan sintetis',$2)",
    [guru, hash],
  );
  await db.query(
    "select auth_private.issue_session($1,$2,'1','1',$3,'business')",
    [guru, hash, createHash("sha256").update("B".repeat(43)).digest("hex")],
  );
  const masters = new MasterService(db),
    calendar = new CalendarService(db),
    schedules = new ScheduleService(db),
    activities = new ActivityService(db),
    duties = new DutyService(db),
    programs = new ProgramService(db),
    finance = new FinanceService(db),
    operations = new OperationsService(db),
    migration = new MigrationService(db);
  await masters.save(token, "subjects", {
    version: "0",
    reason: "Fikstur antarmuka sintetis",
    data: { name: "Mata Pelajaran Pengujian Responsivitas" },
  });
  // Opt-in KBM fixture: disposable database only, isolated from the global UI matrix.
  if (process.env.UI_CONFIRMATION_FIXTURE === "1" || process.env.UI_STUDENT_FIXTURE === "1" || process.env.UI_DUTY_FIXTURE === "1" || process.env.UI_EXAM_FIXTURE === "1" || process.env.UI_ATTENDANCE_FIXTURE === "1") {
    const reason = "Fikstur konfirmasi KBM sintetis",
      today = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Jakarta",
      }).format(new Date());
    const yearNumber = today.slice(0, 4),
      start = yearNumber + "-01-01",
      end = yearNumber + "-12-31";
    await masters.save(token, "school", {
      version: "0",
      reason,
      data: {
        name: "Madrasah Konfirmasi",
        address: "",
        npsn: "",
        level: "SMP",
        useParallel: false,
        parallelMax: 1,
        minutesPerJtm: 40,
        headmasterId: "",
      },
    });
    const year = await masters.save(token, "academic-years", {
      version: "0",
      reason,
      data: {
        label: yearNumber + "/" + (Number(yearNumber) + 1),
        dateStart: start,
        dateEnd: end,
      },
    });
    const period = await masters.save(token, "academic-periods", {
      version: "0",
      reason,
      data: {
        academicYearId: year.id,
        semester: 1,
        dateStart: start,
        dateEnd: end,
        isActive: true,
      },
    });
    const klass = await masters.save(token, "classes", {
      version: "0",
      reason,
      data: {
        academicPeriodId: period.id,
        name: "Kelas 7",
        level: "SMP",
        grade: 7,
        parallel: "",
        expectedStudents: 30,
      },
    });
    const subject = await masters.save(token, "subjects", {
      version: "0",
      reason,
      data: { name: "IPA Konfirmasi" },
    });
    const preview = await calendar.preview(token, "context", {
      action: "override",
      date: today,
      version: "0",
      academicPeriodId: period.id,
      kbmEnabled: process.env.UI_EXAM_FIXTURE !== "1",
      examEnabled: process.env.UI_EXAM_FIXTURE === "1",
      reason,
    });
    await calendar.commit(
      token,
      "context",
      { previewId: preview.previewId },
      "context",
    );
    await schedules.save(token, undefined, {
      reason,
      data: {
        academicPeriodId: period.id,
        userId: guru,
        subjectId: subject.id,
        classId: klass.id,
        dayIndex: new Date(today + "T00:00:00Z").getUTCDay(),
        timeStart: "07:30",
        scheduledJtm: "2",
        restMinutes: 0,
        validFrom: today,
        validTo: end,
      },
    });
  }
  if(process.env.UI_EXAM_FIXTURE === "1"){
    const today=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Jakarta"}).format(new Date()),reason="Fikstur ujian sintetis";
    // Fixed clock in the disposable test database only.
    await db.exec("create or replace function app.exam_now() returns timestamp language sql volatile set search_path=pg_catalog as $$ select (clock_timestamp() at time zone 'Asia/Jakarta')::date + time '12:00' $$");
    const academic=(await masters.list(token,"academic-periods",{page:1,pageSize:20})).items[0]!,klass=(await masters.list(token,"classes",{page:1,pageSize:20})).items[0]!,subject=(await masters.list(token,"subjects",{page:1,pageSize:20})).items[0]!;
    const period=await programs.saveExam(token,{entity:"period",version:"0",reason,data:{academicPeriodId:academic.id,name:"Ujian Sintetis",dateStart:today,dateEnd:today.slice(0,4)+"-12-31",committeeJtm:"1"}}) as {id:string};
    const session=await programs.saveExam(token,{entity:"session",version:"0",reason,data:{periodId:period.id,date:today,name:"Sesi Sintetis",timeStart:"08:00",timeEnd:"09:00",jtm:"3"}}) as {id:string};
    const room=await programs.saveExam(token,{entity:"room",version:"0",reason,data:{sessionId:session.id,name:"Ruang Sintetis",subjectId:subject.id,totalStudents:30,classIds:[klass.id]}}) as {id:string};
    await programs.saveExam(token,{entity:"supervisor",version:"0",reason,data:{roomId:room.id,userId:guru,overrideJtm:null}});
  }
  // A real disposable attendance row exercises repeated leave-editor selection.
  const fixtureDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
  }).format(new Date());
  await db.query(
    "insert into app.daily_attendance(user_id,date,sched_time_in,sched_time_out,actual_time_in,time_in_recorded_by,time_in_source) values($1,$2,'07:00','14:00','07:00',$3,'admin')",
    [guru, fixtureDate, id],
  );
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? "/", "http://localhost"),
        q = Object.fromEntries(url.searchParams),
        path = url.pathname;
      if (path === "/app.js" || path === "/app.css") {
        res.setHeader(
          "content-type",
          path.endsWith("js") ? "text/javascript" : "text/css",
        );
        res.end(await readFile(resolve(output, path.slice(1))));
        return;
      }
      if (!path.startsWith("/api/")) {
        res.setHeader(
          "set-cookie",
          "fixture-role=" +
            (q.role === "guru" ? "guru" : "admin") +
            "; Path=/; SameSite=Lax",
        );
        res.setHeader("content-type", "text/html");
        res.end(
          '<!doctype html><html lang="id"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Fikstur UI SiM-Guru</title><link rel="stylesheet" href="/app.css"><div id="root"></div><script src="/app.js"></script></html>',
        );
        return;
      }
      const token = req.headers.cookie?.includes("fixture-role=guru")
        ? "B".repeat(43)
        : "A".repeat(43);
      let data: unknown;
      let body = "";
      for await (const b of req) body += b;
      const input = body ? JSON.parse(body) : {};
      if (path === "/api/activities/export") {
        const {kind,format,...filter}=q;
        if(kind!=="attendance")throw Error("FIXTURE_EXPORT_KIND");
        const rows=await activities.exportRows(token,"attendance",filter);
        res.setHeader("content-type",format==="pdf"?"application/pdf":"text/csv; charset=utf-8");
        res.setHeader("content-disposition",'attachment; filename="attendance.'+(format==="pdf"?"pdf":"csv")+'"');
        res.end(format==="pdf"?await renderPdf(rows,"attendance",filter.from+" – "+filter.to):renderCsv(rows,"attendance"));return;
      }
      if (path === "/api/auth/csrf") data = { csrfToken: "fixture-csrf" };
      else if (path === "/api/auth/profile" && req.method === "GET")
        data = {
          id,
          username: "fixture.account",
          fullName: "Pengguna Akun Sintetis",
          nip: "",
          phone: "",
          address: "",
          photoUrl: "",
          email: "account@example.test",
          emailVerified: true,
          question: "Pertanyaan sintetis",
          version: "1",
        };
      else if (path === "/api/dashboard")
        data = {
          summary: (
            await db.query<{ value: unknown }>(
              "select app.dashboard_summary($1) as value",
              [createHash("sha256").update(token).digest("hex")],
            )
          ).rows[0]!.value,
        };
      else if (path === "/api/day-context")
        data = await calendar.context(token, q);
      else if (path.startsWith("/api/activities/")) {
        const kind = path.split("/").at(-1)!;
        data =
          req.method === "GET"
            ? await activities.read(token, kind, q)
            : await activities.command(token, kind, input);
      } else if (path === "/api/duties/board")
        data = await duties.read(token, q);
      else if (path === "/api/duties/schedule") data = await duties.schedule(token,input);
      else if (path === "/api/duties/preview") data = await duties.preview(token,input);
      else if (path === "/api/duties/commit") data = await duties.commit(token,input);
      else if (path === "/api/programs/read")
        data = await programs.read(token, q);
      else if (path.startsWith("/api/programs/")) {
        const action=path.split("/").at(-1)!,methods={"exam-save":programs.saveExam,"exam-delete":programs.deleteExam,bap:programs.bap,preview:programs.preview,commit:programs.commit};
        if(!Object.hasOwn(methods,action))throw Error("FIXTURE_ROUTE_NOT_IMPLEMENTED");
        data=await methods[action as keyof typeof methods].call(programs,token,input);
      }
      else if (path === "/api/honorarium/read")
        data = await finance.read(token, q);
      else if (path.startsWith("/api/operations/"))
        data = req.method === "GET" ? await operations.read(token, path.split("/").at(-1)!, q) : await operations.command(token, path.split("/").at(-1)!, input);
      else if (path.startsWith("/api/migration/"))
        data = req.method === "GET" ? await migration.read(token, path.split("/").at(-1)!, q) : await migration.command(token, path.split("/").at(-1)!, input);
      else if (path === "/api/settings/calendar")
        data = await calendar.list(token, q);
      else if (path === "/api/settings/day-context")
        data = await calendar.context(token, q);
      else if (path.startsWith("/api/settings/")) {
        const kind = path.split("/")[3];
        data =
          req.method === "GET"
            ? await masters.list(token, kind, q)
            : await masters.save(token, kind, input, req.method === "DELETE");
      } else if (path === "/api/schedules")
        data = await schedules.list(token, q);
      else if (path === "/api/schedules/recaps")
        data = await schedules.recaps(token, q);
      else if (path === "/api/schedules/today")
        data = await schedules.today(token, q.date!);
      else if (path === "/api/schedules/mine")
        data = await schedules.list(token, q, true);
      else if (path === "/api/users")
        data = (
          await db.query<{ value: unknown }>(
            "select auth_private.users_list($1,$2,'','',1,20) value",
            [createHash("sha256").update(token).digest("hex"), q.q ?? ""],
          )
        ).rows[0]!.value;
      else throw Error("FIXTURE_ROUTE_NOT_IMPLEMENTED");
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ ok: true, data, requestId: randomUUID() }));
    } catch (error) {
      res.statusCode = 422;
      res.setHeader("content-type", "application/json");
      res.end(
        JSON.stringify({
          ok: false,
          error: {
            code: "FIXTURE_ERROR",
            message: error instanceof Error ? error.message : "Fikstur gagal",
          },
          requestId: randomUUID(),
        }),
      );
      console.error(
        "fixture",
        req.url,
        error instanceof Error ? error.message : "error",
      );
    }
  });
  server.listen(4319, "127.0.0.1", () =>
    console.log("UI_FIXTURE_READY http://127.0.0.1:4319"),
  );
  process.on("SIGTERM", () => server.close(() => void db.close()));
}
void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
