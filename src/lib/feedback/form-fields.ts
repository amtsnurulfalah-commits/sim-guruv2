/** Associate server validation with native controls without changing their values. */
const cleanups = new WeakMap<Element, () => void>();
export function applyFieldErrors(
  form: HTMLFormElement,
  errors: Record<string, string>,
) {
  let first: HTMLElement | undefined;
  for (const control of form.querySelectorAll<
    HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
  >("input[name],select[name],textarea[name]")) {
    cleanups.get(control)?.();
    const message = errors[control.name];
    if (!message) continue;
    const invalid = control.getAttribute("aria-invalid"),
      description = control.getAttribute("aria-description");
    control.setAttribute("aria-invalid", "true");
    control.setAttribute("aria-description", message);
    control.classList.add("border-destructive");
    function clear() {
      if (invalid === null) control.removeAttribute("aria-invalid");
      else control.setAttribute("aria-invalid", invalid);
      if (description === null) control.removeAttribute("aria-description");
      else control.setAttribute("aria-description", description);
      control.classList.remove("border-destructive");
      control.removeEventListener("input", clear);
      control.removeEventListener("change", clear);
      cleanups.delete(control);
    }
    cleanups.set(control, clear);
    control.addEventListener("input", clear);
    control.addEventListener("change", clear);
    first ??= control;
  }
  requestAnimationFrame(() => first?.focus());
}
