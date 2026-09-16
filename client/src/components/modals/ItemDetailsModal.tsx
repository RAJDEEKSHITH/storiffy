import {
  File,
  Folder,
} from "lucide-react";

import type {
  Directory,
  DriveFile,
} from "../../types/directory";

import { formatBytes } from "../StorageUsage";
import Modal from "./Modal";

interface ItemDetailsModalProps {
  open: boolean;
  onClose: () => void;
  item: Directory | DriveFile | null;
  type: "directory" | "file";
}

const formatDate = (
  value?: string | null,
) => {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
};

const ItemDetailsModal = ({
  open,
  onClose,
  item,
  type,
}: ItemDetailsModalProps) => {
  if (!item) {
    return null;
  }

  const isDirectory =
    type === "directory";

  const directory = isDirectory
    ? (item as Directory)
    : null;

  const file = !isDirectory
    ? (item as DriveFile)
    : null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Details"
      maxWidth="max-w-lg"
    >
      {/* Item heading */}
      <div className="flex items-center gap-4">
        <div
          className={`
            flex h-12 w-12 shrink-0
            items-center justify-center
            rounded-xl
            ${
              isDirectory
                ? "bg-blue-50 text-blue-600"
                : "bg-slate-100 text-slate-500"
            }
          `}
        >
          {isDirectory ? (
            <Folder size={25} />
          ) : (
            <File size={23} />
          )}
        </div>

        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold text-slate-900">
            {item.name}
          </h3>

          <p className="mt-0.5 text-sm text-slate-500">
            {isDirectory
              ? "Folder"
              : file?.mimeType}
          </p>
        </div>
      </div>

      {/* Information */}
      <div className="mt-6 divide-y divide-slate-100 rounded-xl border border-slate-200">
        <div className="flex items-center justify-between gap-4 px-4 py-3">
          <span className="text-sm text-slate-500">
            Size
          </span>

          <span className="text-sm font-medium text-slate-800">
            {formatBytes(item.size)}
          </span>
        </div>

        <div className="flex items-center justify-between gap-4 px-4 py-3">
          <span className="text-sm text-slate-500">
            Modified
          </span>

          <span className="text-right text-sm font-medium text-slate-800">
            {formatDate(
              item.updatedAt ??
                item.createdAt,
            )}
          </span>
        </div>

        {isDirectory ? (
          <div className="flex items-center justify-between gap-4 px-4 py-3">
            <span className="text-sm text-slate-500">
              Directory ID
            </span>

            <span className="max-w-[220px] truncate text-right text-xs text-slate-500">
              {directory?._id}
            </span>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-4 px-4 py-3">
              <span className="text-sm text-slate-500">
                Type
              </span>

              <span className="text-right text-sm font-medium text-slate-800">
                {file?.mimeType}
              </span>
            </div>

            <div className="flex items-center justify-between gap-4 px-4 py-3">
              <span className="text-sm text-slate-500">
                File ID
              </span>

              <span className="max-w-[220px] truncate text-right text-xs text-slate-500">
                {file?._id}
              </span>
            </div>
          </>
        )}
      </div>

      <div className="mt-5 flex justify-end">
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Close
        </button>
      </div>
    </Modal>
  );
};

export default ItemDetailsModal;