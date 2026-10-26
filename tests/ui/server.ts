import {SemesterPreparationService} from "../../src/server/semester-preparation/service";
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
import { renderHonorExcel,renderHonorPdf } from "../../src/server/finance/export";
import type { FinanceAction, FinancePreview } from "../../src/lib/finance/schemas";
import { FinanceService } from "../../src/server/finance/service";
import {ReportsService} from "../../src/server/reports/service";
import {reportWorkbook} from "../../src/server/reports/export";
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
    define: { "process.env.NODE_ENV": process.env.UI_REACT_DEVELOPMENT === "1" ? "'development'" : "'production'" },
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
  if(process.env.UI_REPORT_FIXTURE==='1')await db.query("insert into app.daily_attendance(user_id,date,actual_time_in,actual_time_out,time_in_source) select $1,date_trunc('month',app.activity_today())::date+s,time '07:00',time '13:00','admin' from generate_series(0,extract(day from app.activity_today())::int-2)s",[guru]);
  const masters = new MasterService(db),
    calendar = new CalendarService(db),
    schedules = new ScheduleService(db),
    activities = new ActivityService(db),
    duties = new DutyService(db),
    programs = new ProgramService(db),
    finance = new FinanceService(db),
    operations = new OperationsService(db),
    reports=new ReportsService(db),
    semesterPreparation=new SemesterPreparationService(db),
    migration = new MigrationService(db);
  if(process.env.UI_SEMESTER_FIXTURE==='1'){
   const reason='Fikstur persiapan semester sintetis';
   await masters.save(token,'school',{version:'0',reason,data:{name:'Madrasah Semester',address:'',npsn:'',level:'SMP',useParallel:false,parallelMax:1,minutesPerJtm:40,headmasterId:''}});
   const year=await masters.save(token,'academic-years',{version:'0',reason,data:{label:'2095/2096',dateStart:'2095-01-01',dateEnd:'2096-12-31'}});
   const src=await masters.save(token,'academic-periods',{version:'0',reason,data:{academicYearId:year.id,semester:1,dateStart:'2095-01-01',dateEnd:'2095-06-30',isActive:true}});
   await masters.save(token,'academic-periods',{version:'0',reason,data:{academicYearId:year.id,semester:2,dateStart:'2095-07-01',dateEnd:'2095-12-31',isActive:false}});
   const cls=await masters.save(token,'classes',{version:'0',reason,data:{academicPeriodId:src.id,name:'Kelas Pengujian Semester',level:'SMP',grade:7,parallel:'',expectedStudents:30}});
   const sub=await masters.save(token,'subjects',{version:'0',reason,data:{name:'IPA Semester'}});
   await schedules.save(token,undefined,{reason,data:{academicPeriodId:src.id,userId:guru,subjectId:sub.id,classId:cls.id,dayIndex:1,timeStart:'07:00',scheduledJtm:'1',restMinutes:0,validFrom:'2095-01-01',validTo:'2095-06-30'}});
  }
  await masters.save(token, "subjects", {
    version: "0",
    reason: "Fikstur antarmuka sintetis",
    data: { name: "Mata Pelajaran Pengujian Responsivitas" },
  });
  // Opt-in KBM fixture: disposable database only, isolated from the global UI matrix.
  if (process.env.UI_CONFIRMATION_FIXTURE === "1" || process.env.UI_STUDENT_FIXTURE === "1" || process.env.UI_DUTY_FIXTURE === "1" || process.env.UI_EXAM_FIXTURE === "1" || process.env.UI_ATTENDANCE_FIXTURE === "1" || process.env.UI_EVENT_FIXTURE === "1") {
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
  // Browser suites freeze at noon WIB. Preview leases must be valid for both
  // that synthetic browser clock and the real disposable DB clock (any host hour).
  if (process.env.UI_ATTENDANCE_FIXTURE === "1") {
    await db.exec("alter table ops.attendance_previews alter column expires_at set default greatest(clock_timestamp(),(app.activity_today()+time '12:00') at time zone 'Asia/Jakarta')+interval '10 minutes'");
  }
  if (process.env.UI_EXAM_FIXTURE === "1" || process.env.UI_EVENT_FIXTURE === "1") {
    await db.exec("alter table ops.module_previews alter column expires_at set default greatest(clock_timestamp(),(app.activity_today()+time '12:00') at time zone 'Asia/Jakarta')+interval '10 minutes'");
    await db.exec("alter table ops.duty_previews alter column expires_at set default greatest(clock_timestamp(),(app.activity_today()+time '12:00') at time zone 'Asia/Jakarta')+interval '10 minutes'");
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
  if(process.env.UI_FINANCE_FIXTURE === "1"){
    const reason="Fikstur honorarium sintetis";
    await db.exec("alter table ops.finance_previews alter column expires_at set default timestamptz '2090-02-01 12:10:00+07'");
    await db.exec("create or replace function app.activity_today() returns date language sql stable set search_path=pg_catalog as $$ select date '2090-01-01' $$; create or replace function finance.today() returns date language sql stable set search_path=pg_catalog as $$ select date '2090-02-01' $$");
    await db.query("update app.app_users set additional_role='KEPALA_SEKOLAH' where id=$1",[id]);
    await masters.save(token,"school",{version:"0",reason,data:{name:"Madrasah Honorarium Sintetis",address:"Alamat pengujian",npsn:"12345678",level:"SMP",useParallel:false,parallelMax:1,minutesPerJtm:40,headmasterId:id}});
    const year=await masters.save(token,"academic-years",{version:"0",reason,data:{label:"2090/2091",dateStart:"2090-01-01",dateEnd:"2090-12-31"}});
    const period=await masters.save(token,"academic-periods",{version:"0",reason,data:{academicYearId:year.id,semester:1,dateStart:"2090-01-01",dateEnd:"2090-12-31",isActive:true}});
    const klass=await masters.save(token,"classes",{version:"0",reason,data:{academicPeriodId:period.id,name:"Kelas 7",level:"SMP",grade:7,parallel:"",expectedStudents:30}});
    const subject=(await masters.list(token,"subjects",{page:1,pageSize:20})).items[0]!;
    await schedules.save(token,undefined,{reason,data:{academicPeriodId:period.id,userId:guru,subjectId:subject.id,classId:klass.id,dayIndex:new Date("2090-01-02T00:00:00Z").getUTCDay(),timeStart:"07:30",scheduledJtm:"3",restMinutes:0,validFrom:"2090-01-01",validTo:"2090-12-31"}});
    await masters.save(token,"rates",{version:"0",reason,data:{kind:"jtm",amount:"10001",enabled:true,dateStart:"2090-01-01",dateEnd:"2090-12-31"}});
    for(const date of ["2090-01-02","2090-01-09"]){const preview=await calendar.preview(token,"calendar",{action:"upsert",date,version:"0",description:"Libur sintetis",isHoliday:true,reason});await calendar.commit(token,"calendar",{previewId:preview.previewId},"upsert");}
    if(process.env.UI_FINANCE_FINAL === "1"){
      for(const date of ["2090-01-02","2090-01-09"])await finance.command(token,"holiday",{operation:"generate",date,reason});
      const preview=await finance.command<FinancePreview>(token,"preview",{operation:"finalize",period:"2090-01",reason});await finance.command(token,"commit",{previewId:preview.previewId});
    }
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
      if (path === "/api/auth/session") data = {
        user: { id: token.startsWith("B") ? guru : id, username: "fixture", fullName: "Pengguna Akun Sintetis", role: token.startsWith("B") ? "guru" : "admin" },
        scope: "business", expiresAt: "2099-01-01T00:00:00Z", idleExpiresAt: "2099-01-01T00:00:00Z",
        onboarding: { mustChangePassword: false, emailVerified: true, securityQuestionReady: true }, maintenance: false,
      };
      else if (path === "/api/auth/csrf") data = { csrfToken: "fixture-csrf" };
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
          date: new Intl.DateTimeFormat("en-CA", {timeZone:"Asia/Jakarta",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date()),
          user: {id: token.startsWith("B") ? guru : id, role: token.startsWith("B") ? "guru" : "admin"},
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
        const action=path.split("/").at(-1)!,methods={"event-save":programs.saveEvent,"event-delete":programs.deleteEvent,attendance:programs.attendance,journal:programs.journal,block:programs.block,"exam-save":programs.saveExam,"exam-delete":programs.deleteExam,bap:programs.bap,preview:programs.preview,commit:programs.commit};
        if(!Object.hasOwn(methods,action))throw Error("FIXTURE_ROUTE_NOT_IMPLEMENTED");
        data=await methods[action as keyof typeof methods].call(programs,token,input);
      }
      else if(path==="/api/honorarium/excel"){
        const bytes=renderHonorExcel(await finance.exportHistory(token,{...q,kind:"history"}));res.setHeader("content-type","application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");res.end(bytes);return;
      }
      else if(path==="/api/honorarium/pdf"){
        const statement=await finance.statement(token,input.statementId as string);
        const proof=await finance.command<{token:string}>(token,"token",input);
        const bytes=await renderHonorPdf(statement,"http://127.0.0.1:4319/verifikasi-dokumen#"+proof.token);res.setHeader("content-type","application/pdf");res.end(bytes);return;
      }
      else if(path==="/api/honorarium/verify")data=await finance.verify(input);
      else if (path === "/api/honorarium/read")
        data = await finance.read(token, q);
      else if(path.startsWith("/api/honorarium/")) data=await finance.command(token,path.split("/").at(-1)! as FinanceAction,input);
      else if(path.startsWith('/api/semester-preparation/'))data=req.method==='GET'?await semesterPreparation.read(token,q):await semesterPreparation.command(token,path.split('/').at(-1)!,input);
      else if(path==='/api/reports/excel') {res.writeHead(200,{'Content-Type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','Content-Disposition':'attachment; filename="laporan-pimpinan.xlsx"'});res.end(reportWorkbook(await reports.export(token,q)));return;}
      else if(path.startsWith('/api/reports/'))data=req.method==='GET'?await reports.read(token,q):await reports.access(token,input);
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
            "select auth_private.users_list($1,$2,$3,$4,$5,$6) value",
            [createHash("sha256").update(token).digest("hex"), q.q ?? "",q.role??"",q.status??"",Number(q.page??1),Number(q.pageSize??20)],
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
