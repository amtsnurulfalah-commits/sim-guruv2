import test from "node:test";
import assert from "node:assert/strict";
import {
  modules,
  modulesFor,
  moduleBySlug,
  canViewModule,
} from "../../src/lib/navigation/modules";
test("navigation registry has unique slugs and enforces role visibility independently of the UI", () => {
  assert.equal(new Set(modules.map((m) => m.slug)).size, modules.length);
  assert.equal(modulesFor("guru").length, 7);
  assert.equal(modulesFor("admin").length, 12);
  const users = moduleBySlug("pengguna")!;
  assert.equal(canViewModule("guru", users), false);
  assert.equal(canViewModule("admin", users), true);
  assert.equal(moduleBySlug("unknown-module"), undefined);
});
