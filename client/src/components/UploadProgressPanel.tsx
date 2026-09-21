import { useEffect } from "react";
import {
  Check,
  Loader2,
  RotateCcw,
  UploadCloud,
  X,
  XCircle,
} from "lucide-react";
import type { FileUploadItem } from "../types/upload";
import { Button } from "./ui/button";
import { Progress } from "./ui/progress";

interface UploadProgressPanelProps {
  items: FileUploadItem[];
  onRetry: (id: string) => void;
  onCancel: (id: string) => void;
  onDismiss: (id: string) => void;
}

const UploadProgressPanel = ({
  items,
  onRetry,
  onCancel,
  onDismiss,
}: UploadProgressPanelProps) => {
  /*
   * Automatically remove failed uploads after 3 seconds.
   *
   * If the user clicks Retry, the item becomes "uploading",
   * so the cleanup timer is cleared.
   */
  useEffect(() => {
    const timers = items
      .filter(
        (item) => item.status === "failed",
      )
      .map((item) =>
        window.setTimeout(() => {
          onDismiss(item.id);
        }, 3000),
      );

    return () => {
      timers.forEach((timer) => {
        window.clearTimeout(timer);
      });
    };
  }, [items, onDismiss]);

  if (items.length === 0) {
    return null;
  }

  const activeCount = items.filter(
    (item) =>
      item.status === "uploading" ||
      item.status === "cancelling",
  ).length;

  return (
    <div className="fixed bottom-4 right-4 z-40 w-[min(420px,calc(100vw-2rem))] rounded-xl border border-slate-200 bg-white p-4 shadow-2xl">
      <div className="mb-3 flex items-center gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
          <UploadCloud className="size-4" />
        </span>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-900">
            Uploads
          </p>

          <p className="text-xs text-slate-500">
            {activeCount > 0
              ? `${activeCount} active upload${
                  activeCount === 1
                    ? ""
                    : "s"
                }`
              : "Upload activity"}
          </p>
        </div>
      </div>

      <div className="max-h-96 space-y-4 overflow-y-auto pr-1">
        {items.map((item) => (
          <div
            key={item.id}
            className="space-y-1.5"
          >
            {/* File name + status icon */}
            <div className="flex items-center gap-2">
              <p className="min-w-0 flex-1 truncate text-sm font-medium text-slate-800">
                {item.file.name}
              </p>

              {item.status ===
              "uploading" ? (
                <Loader2 className="size-4 shrink-0 animate-spin text-blue-600" />
              ) : null}

              {item.status ===
              "cancelling" ? (
                <Loader2 className="size-4 shrink-0 animate-spin text-slate-400" />
              ) : null}

              {item.status ===
              "completed" ? (
                <Check className="size-4 shrink-0 text-emerald-600" />
              ) : null}

              {/* {item.status ===
              "failed" ? (
                <XCircle className="size-4 shrink-0 text-red-500" />
              ) : null} */}
            </div>

            {/* Failed */}
            {item.status ===
            "failed" ? (
              <div className="flex items-center gap-2">
                <p className="min-w-0 flex-1 truncate text-xs text-red-600">
                  {item.error ??
                    "Upload failed"}
                </p>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    onRetry(item.id)
                  }
                >
                  <RotateCcw className="size-3.5" />
                  Retry
                </Button>

                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 shrink-0 text-slate-400 hover:bg-red-50 hover:text-red-600"
                  onClick={() =>
                    onDismiss(item.id)
                  }
                  aria-label={`Dismiss ${item.file.name}`}
                  title="Dismiss"
                >
                  <X className="size-4" />
                </Button>
              </div>
            ) : item.status ===
              "cancelling" ? (
              /*
               * Cancelling
               */
              <p className="text-xs text-slate-500">
                Cancelling upload...
              </p>
            ) : (
              /*
               * Uploading / completed
               */
              <div className="flex items-center gap-2">
                <Progress
                  value={item.progress}
                  className="h-2 flex-1 bg-blue-100 [&_[data-slot=progress-indicator]]:bg-blue-600"
                />

                <span className="w-9 text-right text-xs tabular-nums text-slate-500">
                  {item.progress}%
                </span>

                {item.status ===
                "uploading" ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 shrink-0 text-slate-400 hover:bg-blue-50 hover:text-blue-600"
                    onClick={() =>
                      onCancel(item.id)
                    }
                    aria-label={`Cancel ${item.file.name}`}
                    title="Cancel upload"
                  >
                    <X className="size-4" />
                  </Button>
                ) : null}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default UploadProgressPanel;