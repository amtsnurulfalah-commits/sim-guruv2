import {createHash} from "node:crypto";
import type {SqlDatabase} from "./sql-database";

/** Synthetic data only; callers must use an empty disposable database. No workers/mail run. */
export async function seedPro2Fixture(db: SqlDatabase) {
  const hash = "$argon2id$v=19$m=19456,t=2,p=1$abcdefghijklmnopqrstuv$" + "A".repeat(43);
  const actor = (await db.query<{id:string}>("insert into app.app_users(username,full_name,role,status,must_change_password,contact_email,email_verified_at) values('pro2.admin','Synthetic Admin','admin','active',false,'pro2@example.test',clock_timestamp()) returning id")).rows[0]!.id;
  await db.query("insert into auth_private.user_credentials(user_id,password_hash) values($1,$2)",[actor,hash]);
  await db.query("insert into auth_private.security_questions(user_id,question,answer_hash) values($1,'Synthetic question',$2)",[actor,hash]);
  const token="P".repeat(43);
  await db.query("select auth_private.issue_session($1,$2,1,1,$3,'business')",[actor,hash,createHash("sha256").update(token).digest("hex")]);
  await db.exec("insert into app.app_users(username,full_name,role,status,must_change_password) select 'pro2.teacher.'||n,'Synthetic Teacher '||n,'guru','active',false from generate_series(1,200)n");
  await db.exec("insert into app.daily_attendance(user_id,date,sched_time_in,sched_time_out,actual_time_in,actual_time_out,time_in_source) select id,'2025-01-01'::date+n,'07:30','14:00','07:30','14:00','self' from app.app_users cross join generate_series(0,59)n");
  await db.exec("ANALYZE app.app_users; ANALYZE app.daily_attendance");
  return {actor,token};
}
