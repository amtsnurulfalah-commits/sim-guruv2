import "server-only";
import { randomBytes } from "node:crypto";
import * as argon2 from "argon2";

export const ARGON2_POLICY = Object.freeze({ memoryCost: 19456, timeCost: 2, parallelism: 1, hashLength: 32, type: argon2.argon2id, version: 0x13 });
export type PasswordIdentity = { username: string; fullName: string };
export class PasswordPolicyError extends Error {
  constructor(readonly codes: readonly string[]) { super("PASSWORD_POLICY_REJECTED"); }
}
export class PasswordCryptoError extends Error {
  constructor() { super("PASSWORD_SERVICE_UNAVAILABLE"); }
}
export function passwordPolicyIssues(password: string, identity: PasswordIdentity): string[] {
  const issues: string[] = [];
  const length = Array.from(password).length;
  if (length < 8 || length > 128) issues.push("LENGTH_8_128");
  if (!/[A-Z]/u.test(password)) issues.push("UPPERCASE_REQUIRED");
  if (!/[a-z]/u.test(password)) issues.push("LOWERCASE_REQUIRED");
  if (!/[0-9]/u.test(password)) issues.push("NUMBER_REQUIRED");
  if (!/[!@#$%^&*(),.?":{}|<>]/u.test(password)) issues.push("SYMBOL_REQUIRED");
  const lower = password.toLowerCase();
  const username = identity.username.trim().toLowerCase();
  if (username && lower.includes(username)) issues.push("CONTAINS_USERNAME");
  if (identity.fullName.split(/\s+/u).some((part) => Array.from(part).length > 2 && lower.includes(part.toLowerCase()))) issues.push("CONTAINS_NAME");
  return issues;
}
function inspectHash(encoded: string) {
  const match = /^\$argon2id\$v=19\$([^$]+)\$([A-Za-z0-9+/]+={0,2})\$([A-Za-z0-9+/]+={0,2})$/u.exec(encoded);
  if (!match) throw new PasswordCryptoError();
  const parts=match[1]!.split(",");
  if(parts.length!==3 || parts.some(part=>! /^(m=\d{1,7}|t=\d{1,3}|p=\d{1,2})$/u.test(part))) throw new PasswordCryptoError();
  const parameters=new Map(parts.map(part=>{const [key,value]=part.split("=");return [key!,Number(value)] as const;}));
  if(parameters.size!==3) throw new PasswordCryptoError();
  const memoryCost=parameters.get("m")!,timeCost=parameters.get("t")!,parallelism=parameters.get("p")!;
  const saltSize=Buffer.from(match[2]!,"base64").length, hashLength=Buffer.from(match[3]!,"base64").length;
  // Cap menolak hash rusak/berparameter ekstrem sebelum native allocation; parameter lebih kuat didukung tanpa downgrade.
  if (parallelism<1 || parallelism>8 || memoryCost<8*parallelism || memoryCost>262144 || timeCost<1 || timeCost>10 || saltSize<16 || saltSize>64 || hashLength<16 || hashLength>64) throw new PasswordCryptoError();
  return {memoryCost,timeCost,parallelism,hashLength};
}
export class PasswordService {
  private constructor(private readonly dummyHash: string) {}
  static async create(): Promise<PasswordService> {
    try { return new PasswordService(await argon2.hash(randomBytes(32),ARGON2_POLICY)); }
    catch { throw new PasswordCryptoError(); }
  }
  async hashNew(password: string, identity: PasswordIdentity): Promise<string> {
    const issues=passwordPolicyIssues(password,identity);
    if (issues.length) throw new PasswordPolicyError(issues);
    try { return await argon2.hash(password,ARGON2_POLICY); } catch { throw new PasswordCryptoError(); }
  }
  async verify(storedHash: string | null, password: string): Promise<{ valid: boolean; needsRehash: boolean }> {
    const length=Array.from(password).length;
    if (length<1 || length>128) return {valid:false,needsRehash:false};
    const encoded=storedHash ?? this.dummyHash;
    const options=inspectHash(encoded);
    let valid: boolean;
    try { valid=await argon2.verify(encoded,password); } catch { throw new PasswordCryptoError(); }
    if (storedHash===null || !valid) return {valid:false,needsRehash:false};
    return {valid:true,needsRehash:options.memoryCost<ARGON2_POLICY.memoryCost || options.timeCost<ARGON2_POLICY.timeCost || options.parallelism<ARGON2_POLICY.parallelism || options.hashLength<ARGON2_POLICY.hashLength};
  }
  /** Hanya setelah password terbukti cocok; tidak mengubah password atau menurunkan parameter lebih kuat. */
  async upgradeVerified(storedHash: string, password: string): Promise<string> {
    const verified=await this.verify(storedHash,password);
    if (!verified.valid) throw new PasswordPolicyError(["INVALID_CURRENT_PASSWORD"]);
    if (!verified.needsRehash) return storedHash;
    const old=inspectHash(storedHash);
    try { return await argon2.hash(password,{...ARGON2_POLICY,memoryCost:Math.max(old.memoryCost,ARGON2_POLICY.memoryCost),timeCost:Math.max(old.timeCost,ARGON2_POLICY.timeCost),parallelism:Math.max(old.parallelism,ARGON2_POLICY.parallelism),hashLength:Math.max(old.hashLength,ARGON2_POLICY.hashLength)}); }
    catch { throw new PasswordCryptoError(); }
  }
}
let service: Promise<PasswordService> | undefined;
export function getPasswordService(): Promise<PasswordService> {
  // Cache crypto saja, tanpa actor/sesi/password; init failure dapat dicoba kembali.
  service ??= PasswordService.create().catch((error: unknown)=>{service=undefined;throw error;});
  return service;
}
