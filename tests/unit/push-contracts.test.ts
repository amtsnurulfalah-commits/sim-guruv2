import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { notificationEvent, subscribeInput } from "../../src/lib/notifications/contracts";
import { parseEnvironment } from "../../src/lib/env/schema";

test("push defaults off without keys and malformed secrets stay redacted", () => {
  const result = parseEnvironment("push", {NODE_ENV:"production"});
  assert.equal(result.ok,true);
  if (result.ok) assert.equal(result.value.PUSH_DELIVERY_ENABLED,"false");
  const invalid = parseEnvironment("push",{PUSH_DELIVERY_ENABLED:"true",PUSH_VAPID_PRIVATE_KEY:"private-value"});
  assert.equal(invalid.ok,false);
  assert.equal(JSON.stringify(invalid).includes("private-value"),false);
});
test("push registration rejects caller identity and insecure subscription URLs", () => {
  const input = {installationId:randomUUID(),requestId:randomUUID(),version:"0",label:"Uji",subscription:{endpoint:"https://example.test/subscription",keys:{p256dh:"A".repeat(87),auth:"B".repeat(22)}}};
  assert.equal(subscribeInput.safeParse(input).success,true);
  assert.equal(subscribeInput.safeParse({...input,userId:randomUUID()}).success,false);
  assert.equal(subscribeInput.safeParse({...input,subscription:{...input.subscription,endpoint:"http://example.test"}}).success,false);
  const event = {schemaVersion:1,eventKey:"task:test",recipientId:randomUUID(),category:"task",sourceType:"task",sourceId:null,sourceVersion:"1",routeKey:"tasks",occurredAt:"2026-11-12T00:00:00Z",expiresAt:"2026-11-13T00:00:00Z"};
  assert.equal(notificationEvent.safeParse(event).success,true);
  assert.equal(notificationEvent.safeParse({...event,routeKey:"https://example.test"}).success,false);
  assert.equal(notificationEvent.safeParse({...event,expiresAt:event.occurredAt}).success,false);
});
