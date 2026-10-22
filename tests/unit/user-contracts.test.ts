import test from "node:test";
import assert from "node:assert/strict";
import { userProfileSchema } from "../../src/lib/users/schemas";
import { userListSchema,userMutationSchema } from "../../src/lib/users/contracts";
const profile={username:"guru.test",fullName:"Guru",nip:"001234",role:"guru",email:"",phone:"",address:"",photoUrl:"",employmentStatus:"",rank:"",kmDistance:"1.25",additionalRole:""};
test("invalid distance and photo are validation errors, never Decimal or URL exceptions",()=>{
 for(const patch of [{kmDistance:"invalid"},{kmDistance:"--"},{kmDistance:"1e2"},{photoUrl:"not a URL"},{photoUrl:"http://example.test"},{photoUrl:"https://user:pass@example.test"}])assert.equal(userProfileSchema.safeParse({...profile,...patch}).success,false);
 assert.equal(userProfileSchema.parse(profile).nip,"001234");assert.equal(userProfileSchema.parse({...profile,kmDistance:"999.99"}).kmDistance,"999.99");
});
test("user list and mutation DTOs reject malformed values without inventing status",()=>{
 const user={...profile,id:"11111111-1111-4111-8111-111111111111",version:"1",status:"active",emailVerified:false,mustChangePassword:true,securityQuestionReady:false,temporaryExpiresAt:null,createdAt:"2026-10-22T00:00:00Z"};
 assert.ok(userListSchema.safeParse({items:[user],total:1,page:1,pageSize:20}).success);
 for(const raw of [null,{}, {items:null,total:0,page:1,pageSize:20}])assert.equal(userListSchema.safeParse(raw).success,false);
 assert.equal(userMutationSchema.safeParse({temporaryPassword:"secret"}).success,false);
 assert.ok(userMutationSchema.safeParse({user,delivery:"handover",temporaryPassword:"Synthetic9!",expiresInHours:24}).success);
});
