import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes,randomUUID } from "node:crypto";
import { createActivationToken,activationTokenDigest,encryptActivationToken,decryptActivationToken } from "../../src/server/auth/activation-secrets";
const binding=()=>({outboxId:randomUUID(),challengeId:randomUUID(),userId:randomUUID(),email:"uji@example.test",keyVersion:1 as const});
test("CR06 token32byte acak, digest dan cipher tidak memuat token plaintext",()=>{
 const a=createActivationToken(),b=createActivationToken(),key=randomBytes(32).toString("hex"),context=binding();
 assert.notEqual(a.token,b.token);assert.equal(a.token.length,43);assert.equal(a.digest,activationTokenDigest(a.token));
 const encrypted=encryptActivationToken(a.token,key,context);assert.equal(JSON.stringify(encrypted).includes(a.token),false);assert.equal(decryptActivationToken(encrypted,key,context),a.token);
 assert.notEqual(encrypted.nonceHex,encryptActivationToken(a.token,key,context).nonceHex);
});
test("CR07 binding email/user/outbox/key dan ciphertext yang diubah ditolak",()=>{
 const a=createActivationToken(),key=randomBytes(32).toString("hex"),context=binding(),encrypted=encryptActivationToken(a.token,key,context);
 assert.throws(()=>decryptActivationToken(encrypted,key,{...context,email:"lain@example.test"}));
 assert.throws(()=>decryptActivationToken(encrypted,key,{...context,userId:randomUUID()}));
 assert.throws(()=>decryptActivationToken(encrypted,randomBytes(32).toString("hex"),context));
 assert.throws(()=>decryptActivationToken({...encrypted,tagHex:"0".repeat(32)},key,context));
 assert.throws(()=>encryptActivationToken(a.token,"short",context));
 assert.throws(()=>activationTokenDigest("short"));
});
