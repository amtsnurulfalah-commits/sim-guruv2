import test from "node:test";
import assert from "node:assert/strict";
import { claimDraftAccount, clearDrafts, DRAFT_TTL, draftKey, readDraft, writeDraft, type DraftStorage, type DraftScope } from "../../src/lib/drafts/storage";
function storage(): DraftStorage {
  const data = new Map<string, string>();
  return { get length() { return data.size; }, key: index => [...data.keys()][index] ?? null, getItem: key => data.get(key) ?? null, setItem: (key, value) => { data.set(key, value); }, removeItem: key => { data.delete(key); } };
}
const scope: DraftScope = { account: "account-a", module: "journal", entity: "create:occurrence-a", basis: "source-version-1" }, fields = { material: 2000, present: 4 };
test("draft isolates account/module/entity and retains basis for conflict review", () => {
  const s = storage(); claimDraftAccount(s, scope.account, 100);
  writeDraft(s, scope, fields, { material: "Materi", present: "20", token: "must-not-persist" }, "editing", 100);
  assert.equal(readDraft(s, scope, fields, 101)?.values.material, "Materi");
  assert.equal(s.getItem(draftKey(scope))?.includes("must-not-persist"), false);
  assert.equal(readDraft(s, { ...scope, account: "other" }, fields, 101), null);
  assert.equal(readDraft(s, { ...scope, entity: "other" }, fields, 101), null);
  assert.equal(readDraft(s, { ...scope, module: "bap" }, fields, 101), null);
  assert.equal(readDraft(s, { ...scope, basis: "changed" }, fields, 101)?.basis, scope.basis);
});
test("TTL is fixed from last user edit; malformed/future/oversized drafts are purged", () => {
  const s = storage(); claimDraftAccount(s, scope.account, 100);
  writeDraft(s, scope, fields, { material: "IPA", present: "0" }, "editing", 100);
  assert.ok(readDraft(s, scope, fields, 100 + DRAFT_TTL - 1));
  assert.equal(readDraft(s, scope, fields, 100 + DRAFT_TTL), null);
  for (const raw of ["{bad", "x".repeat(20001), JSON.stringify({ format: 8 }), JSON.stringify({ format: 1, ...scope, savedAt: 200, state: "editing", values: { material: "a", present: "0" } })]) {
    s.setItem(draftKey(scope), raw); assert.equal(readDraft(s, scope, fields, 100), null); assert.equal(s.getItem(draftKey(scope)), null);
  }
});
test("logout/account switch clears only drafts and refuses writes from old account", () => {
  const s = storage(); s.setItem("unrelated", "keep"); claimDraftAccount(s, scope.account, 100);
  writeDraft(s, scope, fields, { material: "IPA", present: "0" }, "uncertain", 100);
  assert.equal(readDraft(s, scope, fields, 100)?.state, "uncertain");
  claimDraftAccount(s, "account-b", 101);
  assert.equal(readDraft(s, scope, fields, 101), null);
  assert.throws(() => writeDraft(s, scope, fields, { material: "IPA", present: "0" }));
  clearDrafts(s); assert.equal(s.length, 1); assert.equal(s.getItem("unrelated"), "keep");
});
test("draft values require allowlist and field bounds; denied storage is not hidden", () => {
  const s = storage(); claimDraftAccount(s, scope.account);
  assert.throws(() => writeDraft(s, scope, fields, { material: "a".repeat(2001), present: "0" }));
  assert.throws(() => writeDraft(s, scope, fields, { material: "IPA" }));
  const denied = { ...s, getItem() { throw Error("SecurityError"); } };
  assert.throws(() => readDraft(denied, scope, fields));
});

test("pre-upgrade journal drafts gain empty reflection fields without losing existing input", () => {
 const s=storage(); claimDraftAccount(s,scope.account,100);
 const old={material:2000,present:4,absent:4,notes:2000,reason:500};
 const additions={learningObjectives:2000,obstacles:2000,followUp:2000,reflection:2000};
 writeDraft(s,scope,old,{material:"Materi lama",present:"20",absent:"0",notes:"Catatan lama",reason:"Alasan lama"},"editing",100);
 const result=readDraft(s,scope,{...old,...additions},101);
 assert.equal(result?.values.material,"Materi lama");assert.equal(result?.values.notes,"Catatan lama");assert.equal(result?.values.reflection,"");
});
