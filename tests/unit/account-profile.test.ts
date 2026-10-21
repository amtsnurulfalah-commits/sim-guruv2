import test from "node:test";
import assert from "node:assert/strict";
import { profileDtoSchema, emailDispatchSchema, changePasswordSchema, profileSchema } from "../../src/lib/accounts/schemas";
import { validateAccount } from "../../src/lib/accounts/client-validation";
import { ApiRequestError } from "../../src/lib/feedback/api-error";
test("profile contract rejects null/incomplete responses without inventing verified state",()=>{
 for(const input of [null,{}, {emailVerified:true}])assert.equal(profileDtoSchema.safeParse(input).success,false);
 const profile={id:"11111111-1111-4111-8111-111111111111",username:"guru",fullName:"Guru",nip:"",phone:"",address:"",photoUrl:"",email:"",emailVerified:false,question:"",version:"1"};
 assert.ok(profileDtoSchema.safeParse(profile).success);
});
test("OTP response requires a new valid challenge whenever a code is queued",()=>{
 assert.ok(emailDispatchSchema.safeParse({queued:false,retryAfter:60}).success);
 assert.equal(emailDispatchSchema.safeParse({queued:true,delivery:"accepted"}).success,false);
 assert.equal(emailDispatchSchema.safeParse({queued:true,challengeId:"invalid"}).success,false);
 for(const delivery of ["accepted","failed","pending","unknown"])assert.ok(emailDispatchSchema.safeParse({queued:true,challengeId:"11111111-1111-4111-8111-111111111111",delivery}).success);
});
test("client validation points to confirmation without including passwords",()=>{
 assert.throws(()=>validateAccount(changePasswordSchema,{currentPassword:"private-old",newPassword:"private-new",confirmation:"different"}),e=>e instanceof ApiRequestError && !!e.fieldErrors.confirmation && !e.message.includes("private-"));
});
test("client profile normalization matches existing schema and preserves text NIP",()=>{
 const result=validateAccount(profileSchema,{version:"1",currentPassword:"private-old",username:" Teacher.One ",fullName:"Guru",nip:"001234",phone:"0812-345-678",address:"",photoUrl:""});
 assert.equal(result.username,"teacher.one");assert.equal(result.nip,"001234");assert.equal(result.phone,"+62812345678");
});
