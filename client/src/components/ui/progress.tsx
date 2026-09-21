import type * as React from "react";
import { cn } from "../../lib/utils";

export function Progress({
  value,
  className,
  ...props
}: React.ComponentProps<"div"> & { value?: number }) {
  const clampedValue = Math.min(100, Math.max(0, value ?? 0));

  return (
    <div
      data-slot="progress"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={clampedValue}
      className={cn(
        "relative h-2 w-full overflow-hidden rounded-full bg-blue-100",
        className,
      )}
      {...props}
    >
      <div
        data-slot="progress-indicator"
        className="h-full rounded-full bg-blue-600 transition-[width] duration-200"
        style={{ width: `${clampedValue}%` }}
      />
    </div>
  );
}
