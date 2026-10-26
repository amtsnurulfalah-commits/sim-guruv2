export type RecaptchaApi = {
  render: (node: HTMLElement, options: {
    sitekey: string;
    size: "compact";
    callback: (token: string) => void;
    "expired-callback": () => void;
    "error-callback": () => void;
  }) => number;
  reset: (id: number) => void;
};
declare global {
  interface Window {
    grecaptcha?: RecaptchaApi;
  }
}
let loading: Promise<RecaptchaApi> | null = null;
let generation = 0;

/** Each load has its own callback: a timed-out script cannot settle a newer retry. */
export function loadRecaptcha(): Promise<RecaptchaApi> {
  // Share in-flight work even when Google's bootstrap has exposed a partial API.
  if (loading) return loading;
  const callbackName = `simGuruRecaptchaReady${++generation}`;
  const callbacks = window as unknown as Record<string, (() => void) | undefined>;
  loading = new Promise<RecaptchaApi>((resolve, reject) => {
    const script = document.createElement("script");
    let settled = false;
    const fail = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      script.remove();
      // A late provider callback must remain harmless after a timeout.
      callbacks[callbackName] = () => { delete callbacks[callbackName]; };
      reject(new Error("CAPTCHA_SCRIPT_UNAVAILABLE"));
    };
    const timer = window.setTimeout(fail, 15000);
    callbacks[callbackName] = () => {
      if (settled) return;
      if (!window.grecaptcha?.render) { fail(); return; }
      settled = true;
      window.clearTimeout(timer);
      delete callbacks[callbackName];
      resolve(window.grecaptcha);
    };
    script.src = `https://www.google.com/recaptcha/api.js?onload=${callbackName}&render=explicit&hl=id`;
    script.async = true;
    script.defer = true;
    script.onerror = fail;
    try { document.head.appendChild(script); } catch { fail(); }
  }).catch(error => { loading = null; throw error; });
  return loading;
}
