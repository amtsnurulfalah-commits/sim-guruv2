import test from "node:test";
import assert from "node:assert/strict";
import { commands } from "../../src/lib/operations/schemas";
import { visibleAnnouncementsSchema, announcementSavedSchema } from "../../src/lib/operations/announcement-contracts";
const base={title:"Informasi",body:"Isi",severity:"info",active:true,targetRole:"all",dismissible:true,sendEmail:false,reason:"Alasan uji"};
test("Malformed announcement URLs are validation failures, never URL constructor exceptions",()=>{
 for(const ctaUrl of ["bukan-url","https://","javascript:alert(1)","https://user:pass@example.test","https://example.test/a b"]){
  let result;assert.doesNotThrow(()=>{result=commands.save.safeParse({...base,ctaText:"Buka",ctaUrl});});assert.equal(result!.success,false);
 }
});
test("Announcement cross-field failures identify the control to repair",()=>{
 for(const [value,path] of [[{from:"2090-03-02",to:"2090-03-01"},"to"],[{ctaText:"Buka"},"ctaUrl"],[{ctaUrl:"https://example.test"},"ctaText"],[{allowDismiss:["33333333-3333-4333-8333-333333333333"],denyDismiss:["33333333-3333-4333-8333-333333333333"]},"denyDismiss"]] as const){
  const r=commands.save.safeParse({...base,...value});assert.equal(r.success,false);if(!r.success)assert.equal(r.error.issues[0]?.path.join('.'),path);
 }
});
test("Announcement limits and visible-link contracts preserve server policy",()=>{
 assert.equal(commands.save.safeParse({...base,title:"a".repeat(200),body:"b".repeat(5000)}).success,true);
 assert.equal(commands.save.safeParse({...base,body:"b".repeat(5001)}).success,false);
 const row={id:"33333333-3333-4333-8333-333333333333",title:"Info",body:"Isi",severity:"critical",version:2,canDismiss:false,cta_url:null,cta_text:null};
 assert.equal(visibleAnnouncementsSchema.parse([row])[0]?.version,"2");
 assert.equal(visibleAnnouncementsSchema.safeParse([{...row,cta_url:"not-url"}]).success,false);
 assert.equal(announcementSavedSchema.safeParse({id:row.id,version:null}).success,false);
});
