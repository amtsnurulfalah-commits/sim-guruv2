import test from "node:test";
import assert from "node:assert/strict";
import { loadRecaptcha } from "../../src/features/auth/recaptcha-loader";

test("a late failed script cannot complete a retry; shared loads wait for the actual ready callback", async () => {
  const scripts: { src: string; remove: () => void; onerror?: () => void }[] = [];
  const timers = new Map<number, () => void>();
  let timerId = 0;
  const fakeWindow: Record<string, unknown> = {
    setTimeout: (callback: () => void) => { timers.set(++timerId, callback); return timerId; },
    clearTimeout: (id: number) => timers.delete(id),
  };
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const originalDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
  Object.defineProperty(globalThis, "window", { configurable: true, value: fakeWindow });
  Object.defineProperty(globalThis, "document", { configurable: true, value: {
    createElement: () => ({ src: "", remove() {} }),
    head: { appendChild: (script: typeof scripts[number]) => scripts.push(script) },
  } });
  try {
    const first = loadRecaptcha();
    assert.equal(loadRecaptcha(), first);
    const oldCallback = new URL(scripts[0]!.src).searchParams.get("onload")!;
    const rejected = assert.rejects(first, /CAPTCHA_SCRIPT_UNAVAILABLE/);
    timers.get(1)!();
    await rejected;
    // Google's bootstrap may expose render before its onload callback fires.
    fakeWindow.grecaptcha = { render() { return 0; }, reset() {} };
    const retry = loadRecaptcha();
    assert.equal(scripts.length, 2);
    const callback = new URL(scripts[1]!.src).searchParams.get("onload")!;
    assert.notEqual(callback, oldCallback);
    let settled = false;
    void retry.then(() => { settled = true; });
    (fakeWindow[oldCallback] as () => void)();
    await Promise.resolve();
    assert.equal(settled, false);
    assert.equal(loadRecaptcha(), retry);
    (fakeWindow[callback] as () => void)();
    assert.equal(await retry, fakeWindow.grecaptcha);
    assert.equal(timers.size, 0);
    assert.equal(fakeWindow[callback], undefined);
    scripts[1]!.onerror?.(); // Ignore errors after success, do not evict ready state.
    assert.equal(await loadRecaptcha(), fakeWindow.grecaptcha);
  } finally {
    if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
    else Reflect.deleteProperty(globalThis, "window");
    if (originalDocument) Object.defineProperty(globalThis, "document", originalDocument);
    else Reflect.deleteProperty(globalThis, "document");
  }
});
