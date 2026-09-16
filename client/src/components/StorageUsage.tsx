import { HardDrive } from "lucide-react";

interface StorageUsageProps {
  used: number;
  limit: number;
}

const formatBytes = (bytes: number) => {
  if (bytes <= 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB", "TB"];

  const index = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );

  return `${(bytes / 1024 ** index).toFixed(
    index === 0 ? 0 : 1,
  )} ${units[index]}`;
};

const StorageUsage = ({
  used,
  limit,
}: StorageUsageProps) => {
  const percentage =
    limit > 0
      ? Math.min((used / limit) * 100, 100)
      : 0;

  return (
    <div className="px-4 pb-5">
      <div className="mb-2 flex items-center gap-2 text-xs font-medium text-slate-500">
        <HardDrive size={14} />
        Storage
      </div>

      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-blue-600 transition-all duration-300"
          style={{
            width: `${percentage}%`,
          }}
        />
      </div>

      <p className="mt-2 text-xs text-slate-500">
        {formatBytes(used)} of {formatBytes(limit)} used
      </p>
    </div>
  );
};

export { formatBytes };
export default StorageUsage;