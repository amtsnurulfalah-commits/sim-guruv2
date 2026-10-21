"use client";
import { ActionIcon } from "@/components/ui/action-icon";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type ComponentProps,
  type Ref,
} from "react";
import { Button } from "./button";
/** Allows a requested close to run the same cancellation guard as Escape. */
export function requestDialogClose(element: HTMLDialogElement | null) {
  if (element?.dispatchEvent(new Event("cancel", { cancelable: true })))
    element.close();
}
export function ManagedDialog({
  ref,
  children,
  onCancel,
  onClose,
  ...props
}: ComponentProps<"dialog">) {
  const [discard, setDiscard] = useState(false),
    dirty = useRef(false),
    previous = useRef<HTMLElement | null>(null),
    confirmation = useRef<HTMLDialogElement>(null),
    element = useRef<HTMLDialogElement>(null),
    id = useId();
  function assign(value: HTMLDialogElement | null) {
    element.current = value;
    if (typeof ref === "function") ref(value);
    else if (ref)
      (ref as { current: HTMLDialogElement | null }).current = value;
  }
  useEffect(() => {
    const node = element.current;
    if (!node) return;
    const observer = new MutationObserver(() => {
      if (node.open) {
        dirty.current = false;
        previous.current =
          document.activeElement instanceof HTMLElement
            ? document.activeElement
            : null;
      }
    });
    observer.observe(node, { attributes: true, attributeFilter: ["open"] });
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (discard) confirmation.current?.showModal();
    else confirmation.current?.close();
  }, [discard]);
  return (
    <>
      <dialog
        {...props}
        ref={assign as Ref<HTMLDialogElement>}
        onChangeCapture={() => {
          dirty.current = true;
        }}
        onCancel={(event) => {
          onCancel?.(event);
          if (event.defaultPrevented) return;
          if (dirty.current) {
            event.preventDefault();
            setDiscard(true);
          }
        }}
        onClose={(event) => {
          dirty.current = false;
          onClose?.(event);
          if (previous.current?.isConnected) previous.current.focus();
        }}
      >
        {children}
      </dialog>
      <dialog
        ref={confirmation}
        aria-labelledby={id}
        aria-describedby={id + "-description"}
        className="w-[min(30rem,calc(100%-2rem))] space-y-4"
        onCancel={() => setDiscard(false)}
        onClose={() => setDiscard(false)}
      >
        <h2 id={id} className="text-xl font-bold">
          Buang perubahan?
        </h2>
        <p
          id={id + "-description"}
          className="text-sm leading-6 text-muted-foreground"
        >
          Formulir memiliki perubahan yang belum disimpan.
        </p>
        <div className="flex flex-wrap justify-end gap-3">
          <Button autoFocus variant="outline" onClick={() => setDiscard(false)}>
            <ActionIcon action="edit" />
            Lanjutkan mengisi
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              dirty.current = false;
              setDiscard(false);
              element.current?.close();
            }}
          >
            <ActionIcon action="close" />
            Buang perubahan
          </Button>
        </div>
      </dialog>
    </>
  );
}
