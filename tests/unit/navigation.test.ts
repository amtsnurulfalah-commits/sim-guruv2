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
  assert.equal(modulesFor("guru").length, 9);
  assert.equal(modulesFor("admin").length, 17);
  assert.equal(canViewModule("guru", moduleBySlug("laporan-kendala")!), false);
  assert.equal(canViewModule("admin", moduleBySlug("laporan-kendala")!), true);
  assert.equal(canViewModule("guru", moduleBySlug("laporan-pimpinan")!), false);
  assert.ok(
    modulesFor("guru", true).some((m) => m.slug === "laporan-pimpinan"),
  );
  const users = moduleBySlug("pengguna")!;
  assert.equal(canViewModule("guru", users), false);
  assert.equal(canViewModule("admin", users), true);
  assert.equal(moduleBySlug("unknown-module"), undefined);
});

test("four navigation groups retain the complete role-specific module registry", () => {
  assert.deepEqual(
    [...new Set(modulesFor("admin").map((m) => m.group))],
    ["Pembelajaran", "Kehadiran & Penugasan", "Keuangan", "Administrasi"],
  );
  assert.equal(moduleBySlug("honorarium")?.group, "Keuangan");
  assert.ok(modulesFor("guru").every((m) => m.group !== "Administrasi"));
});
