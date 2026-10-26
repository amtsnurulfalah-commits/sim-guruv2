import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { openPgliteDatabase } from "../helpers/pglite-database";
import { applyMigrations, readMigrations } from "../../scripts/lib/migrations";
import type { SqlDatabase, SqlExecutor, SqlParameter } from "../../scripts/lib/sql-database";
import { EnvironmentConfigurationError } from "../../src/server/env";
import { getPasswordService } from "../../src/server/auth/passwords";
import { LocalAuthService, AuthError, tokenHash } from "../../src/server/auth/service";
import { createAuthHandlers } from "../../src/server/auth/http";
import { issueCsrf, verifyCsrf, sourceIp } from "../../src/server/auth/security";
const password = "Q8!synthetic#Password72";
const config = { appUrl: "https://school.example", sessionSecret: randomBytes(48).toString("hex"), production: true, vercel: true };
test("Tahap1.4 login/session/logout — HTTP handlers + Argon2 + PostgreSQL WASM", async (t) => {
    const db = await openPgliteDatabase();
    t.after(() => db.close());
    await applyMigrations(db, await readMigrations(resolve("supabase/migrations")));
    const hash = await (await getPasswordService()).hashNew(password, { username: "guru.test", fullName: "Nama Guru" });
    const userId = (await db.query<{
        id: string;
    }>("insert into app.app_users(username,full_name,role,status,must_change_password,contact_email,email_verified_at) values('guru.test','Nama Guru','guru','active',false,'guru@example.test',clock_timestamp()) returning id")).rows[0]!.id;
    await db.query("insert into auth_private.user_credentials(user_id,password_hash) values($1,$2)", [userId, hash]);
    await db.query("insert into auth_private.security_questions(user_id,question,answer_hash) values($1,'Pertanyaan sintetis',$2)", [userId, hash]);
    const adminId = (await db.query<{
        id: string;
    }>("insert into app.app_users(username,full_name,role,status,must_change_password) values('operator','Operator Uji','admin','active',true) returning id")).rows[0]!.id;
    await db.query("insert into auth_private.user_credentials(user_id,password_hash,temporary_expires_at) values($1,$2,clock_timestamp()+interval '24 hours')", [adminId, hash]);
    const scoped: SqlDatabase = {
        async transaction<T>(work: (tx: SqlExecutor) => Promise<T>) { try {
            return await db.transaction(async (tx) => { await tx.exec("SET SESSION AUTHORIZATION sim_guru_auth"); return work(tx); });
        }
        finally {
            await db.exec("SET SESSION AUTHORIZATION postgres; RESET ROLE");
        } },
        query<T extends Record<string, unknown>>(sql: string, args: readonly SqlParameter[] = []) { return this.transaction(tx => tx.query<T>(sql, args)); }, exec(sql) { return this.transaction(tx => tx.exec(sql)); }, close: async () => { },
    };
    const rateSecret = randomBytes(48).toString("hex");
    const service = new LocalAuthService(scoped, await getPasswordService(), rateSecret), handlers = createAuthHandlers({ service: async () => service, config: () => config });
    let seq = 1;
    const headers = (cookie = "", csrf = "", ip = "198.51.100.1") => ({ origin: config.appUrl, cookie, "x-csrf-token": csrf, "content-type": "application/json", "x-vercel-forwarded-for": ip });
    async function csrfSession(cookie: string) { const res = await handlers.csrf(new Request(config.appUrl + "/api/auth/csrf?intent=session", { headers: headers(cookie) })); assert.equal(res.status, 200); return (await res.json()).data.csrfToken as string; }
    async function signIn(username = "guru.test", value = password, ip = `198.51.100.${seq++}`, previous = "") {
        const c = await handlers.csrf(new Request(config.appUrl + "/api/auth/csrf")), token = (await c.json()).data.csrfToken as string, cookie = c.cookies.get("__Host-sim_guru_prelogin")!.value;
        return handlers.login(new Request(config.appUrl + "/api/auth/login", { method: "POST", headers: headers(`__Host-sim_guru_prelogin=${cookie}; ${previous}`, token, ip), body: JSON.stringify({ username, password: value }) }));
    }
    const sessionCookie = (res: Awaited<ReturnType<typeof signIn>>) => `__Host-sim_guru_session=${res.cookies.get("__Host-sim_guru_session")!.value}`;
    let cookie = "", raw = "";
    await t.test("AU01 login nyata, normalisasi username, cookie aman, DTO tanpa token/hash", async () => {
        const res = await signIn("  GURU.TEST  ");
        assert.equal(res.status, 200);
        cookie = sessionCookie(res);
        raw = res.cookies.get("__Host-sim_guru_session")!.value;
        const body = await res.json();
        assert.equal(body.data.session.scope, "business");
        assert.equal(body.data.session.user.username, "guru.test");
        assert.ok(!JSON.stringify(body).includes(raw));
        assert.ok(!JSON.stringify(body).includes(hash));
        const set = res.headers.get("set-cookie")!;
        for (const flag of ["HttpOnly", "Secure", "SameSite=lax", "Path=/"])
            assert.ok(set.includes(flag));
        assert.ok(!set.includes("Domain="));
        assert.equal(res.headers.get("cache-control"), "no-store");
        const row = (await db.query<{
            token_hash: string;
        }>("select token_hash from auth_private.app_sessions where user_id=$1", [userId])).rows[0]!;
        assert.equal(row.token_hash, tokenHash(raw));
    });
    await t.test("AU02 salah/tidak ada/pending/nonaktif/kedaluwarsa menghasilkan respons generik", async () => {
        for (const username of ["guru.test", "unknown.user"]) {
            const res = await signIn(username, "wrong");
            assert.equal(res.status, 401);
            assert.equal((await res.json()).error.code, "INVALID_CREDENTIALS");
            assert.equal(res.cookies.get("__Host-sim_guru_session"), undefined);
        }
        await db.query("update app.app_users set status='disabled' where id=$1", [userId]);
        assert.equal((await signIn()).status, 401);
        await db.query("update app.app_users set status='active' where id=$1", [userId]);
        await db.query("update auth_private.user_credentials set temporary_expires_at=clock_timestamp()-interval '1 second' where user_id=$1", [adminId]);
        assert.equal((await signIn("operator")).status, 401);
        await db.query("update auth_private.user_credentials set temporary_expires_at=clock_timestamp()+interval '24 hours' where user_id=$1", [adminId]);
        await db.query("insert into app.app_users(username,full_name,role) values('pending.user','Pending','guru')");
        assert.equal((await signIn("pending.user")).status, 401);
    });
    await t.test("AU03 prelogin CSRF terikat cookie/purpose/TTL; Origin dan body limit", async () => {
        const c = await handlers.csrf(new Request(config.appUrl + "/api/auth/csrf")), token = (await c.json()).data.csrfToken as string;
        const goodCookie = `__Host-sim_guru_prelogin=${c.cookies.get('__Host-sim_guru_prelogin')!.value}`;
        for (const h of [{ ...headers(goodCookie, token), origin: "https://evil.example" }, headers(goodCookie, "wrong"), headers("", token)])
            assert.equal((await handlers.login(new Request(config.appUrl + "/api/auth/login", { method: "POST", headers: h, body: '{}' }))).status, 403);
        assert.equal((await handlers.login(new Request(config.appUrl + "/api/auth/login", { method: "POST", headers: headers(goodCookie, token), body: "x".repeat(9000) }))).status, 422);
        const binding = randomBytes(32).toString("base64url"), csrf = issueCsrf(config.sessionSecret, "login", binding, Date.now() - 901000);
        assert.throws(() => verifyCsrf(csrf, config.sessionSecret, "login", binding), AuthError);
        assert.throws(() => verifyCsrf(issueCsrf(config.sessionSecret, "login", binding), config.sessionSecret, "session", binding), AuthError);
    });
    await t.test("AU04 lima gagal/account lintas instance persisten, cooldown, sukses hanya reset account", async () => {
        for (let n = 0; n < 5; n++)
            assert.equal((await signIn("limit.user", "wrong")).status, 401);
        const anotherInstance = new LocalAuthService(scoped, await getPasswordService(), rateSecret);
        await assert.rejects(() => anotherInstance.login({username:"LIMIT.USER",password},"198.51.100.222",randomUUID()), (error:unknown) => error instanceof AuthError && error.code === "RATE_LIMITED");
        const again = await signIn("LIMIT.USER", password);
        assert.equal(again.status, 429);
        assert.ok(Number(again.headers.get("retry-after")) > 0);
        await db.query("update auth_private.auth_rate_limits set blocked_until=clock_timestamp()-interval '1 second' where scope='login_account'");
        assert.equal((await signIn("limit.user", "wrong")).status, 401);
        await signIn("guru.test", "wrong");
        assert.equal((await signIn()).status, 200);
        const source = (await db.query<{
            n: number;
        }>("select sum(count)::int as n from auth_private.auth_rate_limits where scope='login_ip'")).rows[0]!.n;
        assert.ok(source > 0);
    });
    await t.test("AU05 IP membatasi 30 usaha lintas akun; header palsu di dev diabaikan", async () => {
        for (let n = 0; n < 30; n++)
            assert.equal((await signIn(`absent.${n}`, "wrong", "203.0.113.8")).status, 401);
        assert.equal((await signIn("guru.test", password, "203.0.113.8")).status, 429);
        assert.equal(sourceIp(new Request(config.appUrl, { headers: { "x-vercel-forwarded-for": "1.2.3.4" } }), { ...config, production: false }), "local-development");
        assert.throws(() => sourceIp(new Request(config.appUrl, { headers: { "x-forwarded-for": "1.2.3.4" } }), config), AuthError);
    });
    await t.test("AU06 sesi onboarding boleh status/logout, tidak mendapat akses bisnis", async () => {
        const res = await signIn("operator");
        assert.equal(res.status, 200);
        const body = await res.json();
        assert.equal(body.data.session.scope, "onboarding");
        assert.equal(body.data.session.onboarding.mustChangePassword, true);
        await assert.rejects(() => service.requireSession(res.cookies.get('__Host-sim_guru_session')!.value, true), (e: unknown) => e instanceof AuthError && e.code === 'ONBOARDING_REQUIRED');
    });
    await t.test("AU07 session polling tidak memperpanjang idle; heartbeat CSRF memperpanjang dengan batas absolut", async () => {
        await db.query("update auth_private.app_sessions set idle_expires_at=clock_timestamp()+interval '1 hour' where token_hash=$1", [tokenHash(raw)]);
        const before = (await service.session(raw))!.idle_expires_at;
        const read = await handlers.session(new Request(config.appUrl + "/api/auth/session", { headers: headers(cookie) }));
        assert.equal(read.status, 200);
        assert.equal(String((await service.session(raw))!.idle_expires_at), String(before));
        assert.equal((await handlers.session(new Request(config.appUrl + "/api/auth/session", { method: "POST", headers: headers(cookie) }))).status, 403);
        const csrf = await csrfSession(cookie);
        assert.equal((await handlers.session(new Request(config.appUrl + "/api/auth/session", { method: "POST", headers: headers(cookie, csrf) }))).status, 200);
        const next = (await service.session(raw))!;
        assert.ok(new Date(next.idle_expires_at) > new Date(before));
        assert.ok(new Date(next.idle_expires_at) <= new Date(next.expires_at));
    });
    await t.test("AU08 maintenance memblokir login/operasi guru termasuk sesi lama; admin dan logout tetap tersedia", async () => {
        await db.query("insert into app.system_settings(key,typed_value) values('maintenance.enabled','true')");
        assert.equal((await signIn()).status, 503);
        await assert.rejects(() => service.requireSession(raw, true), (e: unknown) => e instanceof AuthError && e.code === 'MAINTENANCE');
        assert.ok(await service.requireSession(raw));
        assert.equal((await signIn("operator")).status, 200);
        const row = (await service.session(raw))!;
        const actor = await db.transaction(async (tx) => { await tx.query("select set_config('app.actor_id',$1,true),set_config('app.session_id',$2,true),set_config('app.request_id',$3,true),set_config('app.session_token_hash',$4,true)", [userId, row.session_id, randomUUID(), tokenHash(raw)]); return tx.query<{
            actor: string | null;
        }>("select app.actor_id() as actor"); });
        assert.equal(actor.rows[0]!.actor, null);
        await db.query("delete from app.system_settings where key='maintenance.enabled'");
    });
    await t.test("AU09 login ulang merotasi token dan mencabut sesi browser sebelumnya", async () => {
        const res = await signIn("guru.test", password, `198.51.100.${seq++}`, cookie);
        assert.equal(res.status, 200);
        assert.equal(await service.session(raw), null);
        cookie = sessionCookie(res);
        raw = res.cookies.get('__Host-sim_guru_session')!.value;
    });
    await t.test("AU10 logout CSRF/origin, revoke server, idempotensi dan replay cookie tab lama ditolak", async () => {
        assert.equal((await handlers.logout(new Request(config.appUrl + '/api/auth/logout', { method: 'POST', headers: headers(cookie) }))).status, 403);
        const csrf = await csrfSession(cookie), res = await handlers.logout(new Request(config.appUrl + '/api/auth/logout', { method: 'POST', headers: headers(cookie, csrf) }));
        assert.equal(res.status, 200);
        assert.ok(res.headers.get('set-cookie')!.includes('Max-Age=0'));
        assert.equal(await service.session(raw), null);
        assert.equal((await handlers.session(new Request(config.appUrl + '/api/auth/session', { headers: headers(cookie) }))).status, 401);
        assert.equal((await handlers.logout(new Request(config.appUrl + '/api/auth/logout', { method: 'POST', headers: headers(cookie, csrf) }))).status, 200);
    });
    await t.test("AU11 expiry idle/absolut, auth_version dan status nonaktif mencabut akses", async () => {
        // One statement instant keeps idle expiry <= absolute expiry on millisecond boundaries.
        for (const mutation of ["idle_expires_at=statement_timestamp()-interval '1 second',issued_at=statement_timestamp()-interval '3 hours',expires_at=statement_timestamp()+interval '20 hours'", "expires_at=statement_timestamp()-interval '1 second',issued_at=statement_timestamp()-interval '24 hours',idle_expires_at=statement_timestamp()-interval '1 second'"]) {
            const res = await signIn();
            const token = res.cookies.get('__Host-sim_guru_session')!.value;
            await db.query(`update auth_private.app_sessions set ${mutation} where token_hash=$1`, [tokenHash(token)]);
            assert.equal(await service.session(token), null);
        }
        const a = await signIn(), token = a.cookies.get('__Host-sim_guru_session')!.value;
        await db.query("update app.app_users set auth_version=auth_version+1 where id=$1", [userId]);
        assert.equal(await service.session(token), null);
        const b = await signIn(), other = b.cookies.get('__Host-sim_guru_session')!.value;
        await db.query("update app.app_users set status='disabled' where id=$1", [userId]);
        assert.equal(await service.session(other), null);
        await db.query("update app.app_users set status='active' where id=$1", [userId]);
    });
    await t.test("AU12 gagal konfigurasi menghasilkan 503 tanpa stack/secret/URL", async () => {
        const unavailable = createAuthHandlers({ config: () => { throw new EnvironmentConfigurationError("database", ["DATABASE_URL"]); }, service: async () => service }), res = await unavailable.csrf(new Request(config.appUrl + '/api/auth/csrf'));
        assert.equal(res.status, 503);
        assert.ok(!(await res.text()).includes('postgresql'));
        const tlsError = Object.assign(new Error("private-certificate-details"), {code:"SELF_SIGNED_CERT_IN_CHAIN"});
        const tls = createAuthHandlers({config:()=>config,service:async()=>{throw tlsError;}});
        const tlsResponse = await tls.session(new Request(config.appUrl+"/api/auth/session",{headers:{cookie:"__Host-sim_guru_session="+randomBytes(32).toString("base64url")}}));
        assert.equal(tlsResponse.status,503);
        assert.ok(!(await tlsResponse.text()).includes("private-certificate-details"));

    });
    await t.test("AU13 sesi anonim tidak membuka database, dan error internal tidak bocor", async () => {
        const offline = createAuthHandlers({config:()=>config, service:async()=>{throw new Error("private-stack-secret");}});
        assert.equal((await offline.session(new Request(config.appUrl+"/api/auth/session"))).status,401);
        assert.equal((await offline.csrf(new Request(config.appUrl+"/api/auth/csrf?intent=session"))).status,401);
        const token=randomBytes(32).toString("base64url");
        const res=await offline.session(new Request(config.appUrl+"/api/auth/session",{headers:{cookie:"__Host-sim_guru_session="+token}}));
        assert.equal(res.status,500);assert.ok(!(await res.text()).includes("private-stack-secret"));
    });

    await t.test("AU14 CAPTCHA errors retain reference/no-store, no cookie and no credential/session mutation", async () => {
        const h = createAuthHandlers({ config: () => config, service: async () => service, verifyCaptcha: async token => {
            throw new AuthError(token ? "CAPTCHA_INVALID" : "CAPTCHA_REQUIRED", 422);
        }});
        const before = (await db.query<{n:number}>("select count(*)::int n from auth_private.app_sessions")).rows[0]!.n;
        for (const captchaToken of [undefined, "synthetic-expired-token"]) {
            const c = await h.csrf(new Request(config.appUrl + "/api/auth/csrf"));
            const csrf = (await c.json()).data.csrfToken;
            const pre = c.cookies.get("__Host-sim_guru_prelogin")!.value;
            const response = await h.login(new Request(config.appUrl + "/api/auth/login", { method: "POST", headers: headers("__Host-sim_guru_prelogin="+pre,csrf,"198.51.100.240"), body: JSON.stringify({username:"guru.test",password,captchaToken}) }));
            assert.equal(response.status,422);
            assert.equal(response.cookies.get("__Host-sim_guru_session"),undefined);
            assert.equal(response.headers.get("cache-control"),"no-store");
            const body=await response.json();
            assert.equal(body.error.code,captchaToken?"CAPTCHA_INVALID":"CAPTCHA_REQUIRED");
            assert.match(body.error.message,/reCAPTCHA/);
            assert.ok(body.requestId);
        }
        assert.equal((await db.query<{n:number}>("select count(*)::int n from auth_private.app_sessions")).rows[0]!.n,before);
        let verified=false;
        const allowed=createAuthHandlers({config:()=>config,service:async()=>service,verifyCaptcha:async token=>{assert.equal(token,"synthetic-valid-token");verified=true;}});
        const c=await allowed.csrf(new Request(config.appUrl+"/api/auth/csrf"));
        const csrf=(await c.json()).data.csrfToken;
        const response=await allowed.login(new Request(config.appUrl+"/api/auth/login",{method:"POST",headers:headers("__Host-sim_guru_prelogin="+c.cookies.get("__Host-sim_guru_prelogin")!.value,csrf,"198.51.100.241"),body:JSON.stringify({username:"guru.test",password,captchaToken:"synthetic-valid-token"})}));
        assert.equal(verified,true);assert.equal(response.status,200);
    });

});
