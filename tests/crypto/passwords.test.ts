import test from "node:test";
import assert from "node:assert/strict";
import * as argon2 from "argon2";
import { getPasswordService,passwordPolicyIssues,PasswordCryptoError } from "../../src/server/auth/passwords";
const identity={username:"operator",fullName:"Admin Uji"};
const password="V9!aL4#qN8@zR2$kD7&x";
test("CR01 Argon2id nyata, salt unik, verify tepat dan password salah ditolak",async()=>{
 const service=await getPasswordService(),a=await service.hashNew(password,identity),b=await service.hashNew(password,identity);
 assert.match(a,/^\$argon2id\$v=19\$m=19456,(?:t=2,p=1|p=1,t=2)\$/u);assert.notEqual(a,b);
 assert.deepEqual(await service.verify(a,password),{valid:true,needsRehash:false});
 assert.equal((await service.verify(a,password+"!")).valid,false);assert.equal((await service.verify(null,password)).valid,false);
});
test("CR02 password tidak di-trim atau dinormalisasi dan panjang memakai code point",async()=>{
 const service=await getPasswordService(),spaced=" "+password+" ",hash=await service.hashNew(spaced,identity);
 assert.equal((await service.verify(hash,spaced)).valid,true);assert.equal((await service.verify(hash,password)).valid,false);
 const unicode="Aa1!"+"😀".repeat(124);assert.equal(passwordPolicyIssues(unicode,identity).length,0);
 assert.ok(passwordPolicyIssues(unicode+"😀",identity).includes("LENGTH_8_128"));
});
test("CR03 kebijakan menolak unsur identitas, kompleksitas lemah dan panjang tidak sah",()=>{
 assert.ok(passwordPolicyIssues("operatorA9!abcdefgh",identity).includes("CONTAINS_USERNAME"));
 assert.ok(passwordPolicyIssues("AdminA9!abcdefgh",identity).includes("CONTAINS_NAME"));
 assert.ok(passwordPolicyIssues("short",identity).length>=4);
 assert.ok(passwordPolicyIssues("Aa1!"+"x".repeat(125),identity).includes("LENGTH_8_128"));
});
test("CR04 hash rusak atau parameter ekstrem menghasilkan kegagalan crypto terkendali",async()=>{
 const service=await getPasswordService();await assert.rejects(()=>service.verify("plaintext",password),PasswordCryptoError);
 await assert.rejects(()=>service.verify('$argon2id$v=19$m=9999999,t=2,p=1$abcdefghijklmnopqrstuv$'+'A'.repeat(43),password),PasswordCryptoError);
});
test("CR05 rehash hanya setelah verify, mempertahankan parameter lama yang lebih kuat",async()=>{
 const service=await getPasswordService();
 const weak=await argon2.hash(password,{type:argon2.argon2id,memoryCost:8192,timeCost:3,parallelism:1,hashLength:32});
 assert.equal((await service.verify(weak,password)).needsRehash,true);
 const upgraded=await service.upgradeVerified(weak,password);assert.match(upgraded,/m=19456,(?:t=3,p=1|p=1,t=3)/u);assert.equal((await service.verify(upgraded,password)).valid,true);
 await assert.rejects(()=>service.upgradeVerified(weak,"incorrect"));
 const strong=await argon2.hash(password,{type:argon2.argon2id,memoryCost:32768,timeCost:3,parallelism:2,hashLength:32});
 assert.equal((await service.verify(strong,password)).needsRehash,false);assert.equal(await service.upgradeVerified(strong,password),strong);
});
