import { HardDrive } from "lucide-react";
import { useSelector } from "react-redux";

import type { RootState } from "../store/store";
import { Progress } from "./ui/progress";

export const formatBytes = (bytes: number) => {
  if (bytes <= 0) return "0 B";

  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );

  const value = bytes / 1024 ** index;
  const maximumFractionDigits = index === 0 ? 0 : 1;

  return `${value.toLocaleString("en-IN", {
    maximumFractionDigits,
  })} ${units[index]}`;
};

interface StorageUsageProps {
  className?: string;
}

const StorageUsage = ({ className }: StorageUsageProps) => {
  const user = useSelector(
    (state: RootState) => state.auth.user,
  );

  if (!user) return null;

  const used = Math.max(
    0,
    user.storageUsedInBytes,
  );
  const limit = Math.max(
    0,
    user.maxStorageLimitInBytes,
  );

  const percentage =
    limit > 0
      ? Math.min((used / limit) * 100, 100)
      : 0;

  return (
    <div className={`border-t px-4 py-4 ${className ?? ""}`}>
      <Progress
        value={percentage}
        className="h-2 bg-blue-100 [&_[data-slot=progress-indicator]]:bg-blue-600"
      />

      <div className="mt-2 flex items-baseline justify-between gap-2">
        <span className="text-xs font-medium text-foreground">
          {formatBytes(used)}
        </span>
        <span className="text-xs text-muted-foreground">
          of {formatBytes(limit)}
        </span>
      </div>

      <p className="mt-1 text-[11px] text-muted-foreground">
        {percentage.toFixed(1)}% used
      </p>
    </div>
  );
};

export default StorageUsage;
