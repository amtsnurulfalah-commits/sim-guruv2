"use client";
import * as Primitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Button } from "./button";

/** Source-owned shadcn pattern: Radix supplies modal focus, inertness and restoration. */
export function FormDialog({
  title,
  description = "Lengkapi isian, lalu simpan perubahan. Isian bertanda * wajib diisi.",
  trigger,
  children,
  busy = false,
  success = "",
  error = "",
  revealKey,
  open: controlled,
  onOpenChange,
  onDiscard,
  footer,
}: {
  title: string;
  description?: string;
  trigger?: string;
  children: ReactNode;
  busy?: boolean;
  success?: string;
  error?: string;
  revealKey?: string | null | undefined;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onDiscard?: () => void;
  footer?: ReactNode;
}) {
  const [localOpen, setLocalOpen] = useState(false),
    [dirty, setDirty] = useState(false),
    [discard, setDiscard] = useState(false);
  const submitted = useRef(false),
    sawBusy = useRef(false),
    lastReveal = useRef(revealKey),
    cancelDiscard = useRef<HTMLButtonElement>(null),
    formBody = useRef<HTMLDivElement>(null);
  const discardId = useId();
  const open = controlled ?? localOpen;
  function setOpen(value: boolean) {
    if (controlled === undefined) setLocalOpen(value);
    onOpenChange?.(value);
  }
  function requestClose() {
    if (busy) return;
    if (dirty) {
      setDiscard(true);
    } else setOpen(false);
  }
  useEffect(() => {
    if (revealKey && revealKey !== lastReveal.current) {
      lastReveal.current = revealKey;
      // Changing the entity opens its editor; never read or fetch hidden account state.
      queueMicrotask(() => {
        if (controlled === undefined) setLocalOpen(true);
      });
    }
  }, [revealKey, controlled]);
  useEffect(() => {
    if (discard) cancelDiscard.current?.focus();
  }, [discard]);
  useEffect(() => {
    if (busy && submitted.current) sawBusy.current = true;
    if (
      open &&
      submitted.current &&
      sawBusy.current &&
      !busy &&
      success &&
      !error
    ) {
      submitted.current = false;
      queueMicrotask(() => {
        if (controlled === undefined) setLocalOpen(false);
        onOpenChange?.(false);
      });
    }
  }, [open, busy, success, error, controlled, onOpenChange]);
  return (
    <Primitive.Root
      open={open}
      onOpenChange={(value) => {
        if (!value) requestClose();
        else {
          submitted.current = false;
          sawBusy.current = false;
          setDirty(false);
          setDiscard(false);
          setOpen(true);
        }
      }}
    >
      {trigger !== "" && (
        <Primitive.Trigger asChild>
          <Button type="button" variant="outline" disabled={busy}>
            {trigger ?? title}
          </Button>
        </Primitive.Trigger>
      )}
      <Primitive.Portal>
        <Primitive.Overlay className="fixed inset-0 z-40 bg-slate-950/55 backdrop-blur-sm" />
        <Primitive.Content
          data-slot="dialog-content"
          className="fixed inset-2 z-50 flex max-h-[calc(100dvh-1rem)] flex-col overflow-hidden rounded-2xl border bg-card text-foreground shadow-2xl sm:inset-auto sm:top-1/2 sm:left-1/2 sm:max-h-[calc(100dvh-3rem)] sm:w-[min(48rem,calc(100vw-3rem))] sm:-translate-x-1/2 sm:-translate-y-1/2"
          onEscapeKeyDown={(e) => {
            e.preventDefault();
            if (discard) setDiscard(false);
            else requestClose();
          }}
          onInteractOutside={(e) => {
            e.preventDefault();
            if (!discard) requestClose();
          }}
        >
          <div
            inert={discard}
            className="flex items-start justify-between gap-4 border-b px-5 py-5 sm:px-7"
          >
            <div>
              <Primitive.Title className="text-xl font-bold">
                {title}
              </Primitive.Title>
              <Primitive.Description className="mt-2 text-sm leading-6 text-muted-foreground">
                {description}
              </Primitive.Description>
            </div>
            <Button
              type="button"
              variant="outline"
              aria-label="Tutup formulir"
              disabled={busy}
              onClick={requestClose}
            >
              <X aria-hidden="true" />
            </Button>
          </div>
          {discard && (
            <div
              role="alertdialog"
              aria-modal="true"
              onKeyDown={(event) => {
                if (event.key !== "Tab") return;
                const buttons = Array.from(
                  event.currentTarget.querySelectorAll("button"),
                );
                const index = buttons.indexOf(
                  document.activeElement as HTMLButtonElement,
                );
                event.preventDefault();
                buttons[
                  (index + (event.shiftKey ? -1 : 1) + buttons.length) %
                    buttons.length
                ]?.focus();
              }}
              aria-labelledby={discardId}
              aria-describedby={discardId + "-description"}
              className="space-y-4 px-5 py-7 sm:px-7"
            >
              <h3 id={discardId} className="text-lg font-bold">
                Buang perubahan yang belum disimpan?
              </h3>
              <p
                id={discardId + "-description"}
                className="text-sm leading-6 text-muted-foreground"
              >
                Isian Anda belum tersimpan. Kembali ke formulir untuk
                melanjutkan atau buang perubahan untuk menutupnya.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button
                  ref={cancelDiscard}
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setDiscard(false);
                    requestAnimationFrame(() =>
                      formBody.current
                        ?.querySelector<HTMLElement>(
                          "input, select, textarea, button",
                        )
                        ?.focus(),
                    );
                  }}
                >
                  Lanjutkan mengisi
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => {
                    setDiscard(false);
                    setDirty(false);
                    onDiscard?.();
                    setOpen(false);
                  }}
                >
                  Buang perubahan
                </Button>
              </div>
            </div>
          )}
          <div
            ref={formBody}
            hidden={discard}
            className="ui-modal-body"
            onChangeCapture={() => setDirty(true)}
            onSubmitCapture={() => {
              submitted.current = true;
            }}
          >
            <fieldset disabled={busy} className="contents">
              {children}
            </fieldset>
            {error && (
              <p role="alert" className="form-feedback-error mt-4">
                {error}
              </p>
            )}
          </div>
          {!discard && (
            <div className="ui-modal-footer">
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={requestClose}
              >
                Batal
              </Button>
              {footer}
            </div>
          )}
        </Primitive.Content>
      </Primitive.Portal>
    </Primitive.Root>
  );
}
