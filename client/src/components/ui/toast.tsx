/* eslint-disable react-refresh/only-export-components */
import * as React from "react";
import { Toast as ToastPrimitive } from "@base-ui/react/toast";
import {
  CheckCircle2,
  Info,
  Loader2,
  TriangleAlert,
  X,
  XCircle,
} from "lucide-react";
import { cn } from "../../lib/utils";

const toastManager = ToastPrimitive.createToastManager();

export const toast = toastManager;

function ToastIcon({ type }: { type?: string }) {
  if (type === "success") {
    return <CheckCircle2 className="mt-0.5 size-4 shrink-0" />;
  }
  if (type === "error") {
    return <XCircle className="mt-0.5 size-4 shrink-0" />;
  }
  if (type === "warning") {
    return <TriangleAlert className="mt-0.5 size-4 shrink-0" />;
  }
  if (type === "info") {
    return <Info className="mt-0.5 size-4 shrink-0" />;
  }
  if (type === "loading") {
    return <Loader2 className="mt-0.5 size-4 shrink-0 animate-spin" />;
  }
  return null;
}

function ToastList() {
  const { toasts } = ToastPrimitive.useToastManager();

  return (
    <ToastPrimitive.Viewport className="fixed top-4 right-4 z-[100] flex w-[360px] max-w-[calc(100vw-2rem)] flex-col gap-2 outline-none">
      {toasts.map((item) => (
        <ToastPrimitive.Root
          key={item.id}
          toast={item}
          className={cn(
            "pointer-events-auto w-full rounded-lg border bg-background text-foreground shadow-xl outline-none",
            "data-[type=success]:border-emerald-200 data-[type=success]:text-emerald-700",
            "data-[type=error]:border-red-200 data-[type=error]:text-red-700",
            "data-[type=warning]:border-amber-200 data-[type=warning]:text-amber-700",
            "data-[type=info]:border-blue-200 data-[type=info]:text-blue-700",
          )}
        >
          <ToastPrimitive.Content className="flex items-start gap-3 p-4">
            <ToastIcon type={item.type} />
            <div className="min-w-0 flex-1">
              {item.title ? (
                <ToastPrimitive.Title className="text-sm font-semibold text-foreground" />
              ) : null}
              {item.description ? (
                <ToastPrimitive.Description className="mt-0.5 text-sm text-muted-foreground" />
              ) : null}
            </div>
            <ToastPrimitive.Close
              aria-label="Dismiss notification"
              className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition hover:bg-accent hover:text-foreground"
            >
              <X className="size-4" />
            </ToastPrimitive.Close>
          </ToastPrimitive.Content>
        </ToastPrimitive.Root>
      ))}
    </ToastPrimitive.Viewport>
  );
}

export function Toaster() {
  return (
    <ToastPrimitive.Provider toastManager={toastManager} timeout={1500}>
      <ToastPrimitive.Portal>
        <ToastList />
      </ToastPrimitive.Portal>
    </ToastPrimitive.Provider>
  );
}
/* eslint-enable react-refresh/only-export-components */