import test from "node:test";
import assert from "node:assert/strict";
import { recoveryAcceptedSchema, resetProofSchema, resetSchema } from "../../src/lib/accounts/schemas";
import { recoveryRequestsSchema, approveRecoverySchema, rejectRecoverySchema } from "../../src/lib/users/schemas";
import { validateAccount } from "../../src/lib/accounts/client-validation";
import { ApiRequestError } from "../../src/lib/feedback/api-error";
const id="11111111-1111-4111-8111-111111111111";
test("recovery replies require challenge and opaque proof before advancing",()=>{
 assert.equal(recoveryAcceptedSchema.safeParse({accepted:true}).success,false);
 assert.ok(recoveryAcceptedSchema.safeParse({accepted:true,challengeId:id}).success);
 for(const token of ["", "short", "!".repeat(43)]) assert.equal(resetProofSchema.safeParse({challengeId:id,token}).success,false);
 assert.ok(resetProofSchema.safeParse({challengeId:id,token:"A".repeat(43)}).success);
});
test("admin recovery list rejects malformed rows and accepts empty lists",()=>{
 assert.ok(recoveryRequestsSchema.safeParse([]).success);
 const row={id,userId:id,version:"1",username:"guru",fullName:"Guru",createdAt:"2026-10-21T00:00:00+00:00",reason:null};
 assert.ok(recoveryRequestsSchema.safeParse([row]).success);
 for(const change of [{createdAt:"bad"},{version:"0"},{userId:null}])assert.equal(recoveryRequestsSchema.safeParse([{...row,...change}]).success,false);
});
test("approval requires evidence; rejection keeps existing independent schema",()=>{
 const payload={action:"approve",requestId:id,targetId:id,version:"1",method:"tatap_muka",evidence:"",reason:"Verifikasi identitas",currentPassword:"private"};
 assert.throws(()=>validateAccount(approveRecoverySchema,payload),e=>e instanceof ApiRequestError && !!e.fieldErrors.evidence && !e.message.includes("private"));
 assert.ok(rejectRecoverySchema.safeParse({action:"reject",requestId:id,reason:"Identitas belum cocok",currentPassword:"private"}).success);
});
test("reset mismatch identifies confirmation without exposing secrets",()=>{
 assert.throws(()=>validateAccount(resetSchema,{challengeId:id,token:"A".repeat(43),newPassword:"secret-new",confirmation:"different"}),e=>e instanceof ApiRequestError && !!e.fieldErrors.confirmation && !e.message.includes("secret-new"));
});
