import {
  Code2,
  File,
  FileArchive,
  FileAudio,
  FileCode2,
  FileImage,
  FileJson2,
  FileSpreadsheet,
  FileText,
  FileType2,
  Folder,
  FolderOpen,
  Presentation,
  Video,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import type { Directory, DriveFile } from "../types/directory";
import DriveItemActions from "./DriveItemActions";
import { Badge } from "./ui/badge";

export type SelectedDriveItem =
  | {
      type: "directory";
      id: string;
    }
  | {
      type: "file";
      id: string;
    };

interface DirectoryItemsViewProps {
  directories: Directory[];
  files: DriveFile[];

  /* Normal item actions */
  onOpenDirectory: (directoryId: string) => void;
  onDirectoryDetails: (directory: Directory) => void;
  onDirectoryDownload: (directory: Directory) => void;
  onDirectoryShare: (directory: Directory) => void;
  onDirectoryRename: (directory: Directory) => void;
  onDirectoryDelete: (directory: Directory) => void;

  onOpenFile: (file: DriveFile) => void;
  onFileDetails: (file: DriveFile) => void;
  onFileDownload: (file: DriveFile) => void;
  onFileShare: (file: DriveFile) => void;
  onFileRename: (file: DriveFile) => void;
  onFileDelete: (file: DriveFile) => void;
  selectionMode: boolean;
  selectedItems: SelectedDriveItem[];
  onEnterSelectionMode: () => void;
  onToggleSelection: (item: SelectedDriveItem) => void;
}

const formatDate = (value?: string | null) => {
  if (!value) return "-";

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
};

const formatBytes = (bytes: number) => {
  if (bytes <= 0) return "0 B";

  const units = ["B", "KB", "MB", "GB", "TB"];

  const index = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );

  return `${(bytes / 1024 ** index).toLocaleString("en-IN", {
    maximumFractionDigits: index === 0 ? 0 : 1,
  })} ${units[index]}`;
};

type IconInfo = {
  icon: LucideIcon;
  wrapper: string;
  iconClass: string;
};

const getFileIconInfo = (file: DriveFile): IconInfo => {
  const name = file.name.toLowerCase();
  const mime = file.mimeType.toLowerCase();

  if (
    mime.startsWith("image/") ||
    /\.(png|jpe?g|gif|webp|bmp|ico|tiff?)$/.test(name)
  ) {
    return {
      icon: FileImage,
      wrapper: "bg-pink-50",
      iconClass: "text-pink-500",
    };
  }

  if (
    mime.startsWith("video/") ||
    /\.(mp4|mov|mkv|avi|webm|m4v)$/.test(name)
  ) {
    return {
      icon: Video,
      wrapper: "bg-violet-50",
      iconClass: "text-violet-500",
    };
  }

  if (
    mime.startsWith("audio/") ||
    /\.(mp3|wav|flac|aac|m4a|ogg)$/.test(name)
  ) {
    return {
      icon: FileAudio,
      wrapper: "bg-rose-50",
      iconClass: "text-rose-500",
    };
  }

  if (/\.(pdf)$/.test(name)) {
    return {
      icon: FileText,
      wrapper: "bg-red-50",
      iconClass: "text-red-500",
    };
  }

  if (
    /\.(doc|docx|odt|rtf)$/.test(name) ||
    mime.includes("word")
  ) {
    return {
      icon: FileType2,
      wrapper: "bg-blue-50",
      iconClass: "text-blue-600",
    };
  }

  if (
    /\.(xls|xlsx|ods)$/.test(name) ||
    mime.includes("spreadsheet")
  ) {
    return {
      icon: FileSpreadsheet,
      wrapper: "bg-emerald-50",
      iconClass: "text-emerald-600",
    };
  }

  if (
    /\.(ppt|pptx|odp)$/.test(name) ||
    mime.includes("presentation")
  ) {
    return {
      icon: Presentation,
      wrapper: "bg-orange-50",
      iconClass: "text-orange-500",
    };
  }

  if (
    /\.(zip|7z|rar|tar|gz|bz2)$/.test(name) ||
    mime.includes("zip") ||
    mime.includes("archive")
  ) {
    return {
      icon: FileArchive,
      wrapper: "bg-purple-50",
      iconClass: "text-purple-500",
    };
  }

  if (
    /\.(js|mjs|cjs|ts|jsx|tsx|java|cpp|c|h|go|rs|py|php)$/.test(name)
  ) {
    return {
      icon: Code2,
      wrapper: "bg-amber-50",
      iconClass: "text-amber-600",
    };
  }

  if (/\.(html|htm|css|scss|less|xml)$/.test(name)) {
    return {
      icon: FileCode2,
      wrapper: "bg-cyan-50",
      iconClass: "text-cyan-600",
    };
  }

  if (/\.(json)$/.test(name)) {
    return {
      icon: FileJson2,
      wrapper: "bg-yellow-50",
      iconClass: "text-yellow-600",
    };
  }

  if (/\.(csv|tsv)$/.test(name)) {
    return {
      icon: FileSpreadsheet,
      wrapper: "bg-lime-50",
      iconClass: "text-lime-600",
    };
  }

  if (/\.(txt|md|log)$/.test(name)) {
    return {
      icon: FileText,
      wrapper: "bg-slate-100",
      iconClass: "text-slate-600",
    };
  }

  if (
    mime.includes("code") ||
    mime.includes("javascript") ||
    mime.includes("typescript")
  ) {
    return {
      icon: FileCode2,
      wrapper: "bg-indigo-50",
      iconClass: "text-indigo-600",
    };
  }

  if (mime.includes("text")) {
    return {
      icon: FileText,
      wrapper: "bg-sky-50",
      iconClass: "text-sky-600",
    };
  }

  return {
    icon: File,
    wrapper: "bg-slate-100",
    iconClass: "text-slate-600",
  };
};

const DirectoryItemsView = ({
  directories,
  files,

  onOpenDirectory,
  onDirectoryDetails,
  onDirectoryDownload,
  onDirectoryShare,
  onDirectoryRename,
  onDirectoryDelete,

  onOpenFile,
  onFileDetails,
  onFileDownload,
  onFileShare,
  onFileRename,
  onFileDelete,

  selectionMode,
  selectedItems,
  onEnterSelectionMode,
  onToggleSelection,
}: DirectoryItemsViewProps) => {
  const hasItems =
    directories.length > 0 || files.length > 0;

  const isSelected = (
    item: SelectedDriveItem,
  ): boolean => {
    return selectedItems.some(
      (selected: SelectedDriveItem) =>
        selected.type === item.type &&
        selected.id === item.id,
    );
  };

  const getRowClassName = (
    selected: boolean,
  ) =>
    `grid ${
      selectionMode
        ? "grid-cols-[40px_minmax(0,1fr)_160px_110px]"
        : "grid-cols-[minmax(0,1fr)_160px_110px_44px]"
    } items-center border-b px-4 py-3 transition-colors ${
      selected
        ? "bg-blue-50 hover:bg-blue-50"
        : "hover:bg-slate-50"
    } last:border-b-0`;

  if (!hasItems) {
    return (
      <div className="flex min-h-[55vh] items-center justify-center rounded-xl border bg-white px-6 text-center">
        <div>
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-slate-50">
            <FolderOpen className="size-7 text-slate-300" />
          </div>

          <h3 className="mt-4 text-base font-semibold text-slate-900">
            This folder is empty
          </h3>

          <p className="mt-1 max-w-sm text-sm text-slate-500">
            Upload files or create a folder to get started.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border bg-white shadow-sm">
      <div className="min-w-[720px]">
        {/* Header */}
        <div
          className={`grid ${
            selectionMode
              ? "grid-cols-[40px_minmax(0,1fr)_160px_110px]"
              : "grid-cols-[minmax(0,1fr)_160px_110px_44px]"
          } items-center border-b bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-400`}
        >
          {selectionMode ? (
            <span aria-hidden="true" />
          ) : null}

          <span>Name</span>
          <span>Modified</span>
          <span>Size</span>

          {!selectionMode ? (
            <span aria-hidden="true" />
          ) : null}
        </div>

        {/* Directories */}
        {directories.map((directory) => {
          const selected = isSelected({
            type: "directory",
            id: directory._id,
          });

          return (
            <div
              key={directory._id}
              className={getRowClassName(selected)}
            >
              {selectionMode ? (
                <input
                  type="checkbox"
                  checked={selected}
                  onChange={() =>
                    onToggleSelection({
                      type: "directory",
                      id: directory._id,
                    })
                  }
                  onClick={(event) =>
                    event.stopPropagation()
                  }
                  aria-label={`Select folder ${directory.name}`}
                  className="size-4 cursor-pointer accent-blue-600"
                />
              ) : null}

              <button
                type="button"
                onClick={() => {
                  if (selectionMode) {
                    onToggleSelection({
                      type: "directory",
                      id: directory._id,
                    });

                    return;
                  }

                  onOpenDirectory(directory._id);
                }}
                className="flex min-w-0 items-center gap-3 text-left"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-yellow-50">
                  <Folder className="size-5 fill-yellow-400 text-yellow-500" />
                </span>

                <span className="truncate text-sm font-medium text-slate-800">
                  {directory.name}
                </span>
              </button>

              <span className="text-sm text-slate-500">
                {formatDate(
                  directory.updatedAt ??
                    directory.createdAt,
                )}
              </span>

              <span className="text-sm text-slate-500">
                {formatBytes(directory.size)}
              </span>

              {selectionMode ? (
                <span aria-hidden="true" />
              ) : (
                <div className="flex justify-end">
                  <DriveItemActions
                    onDetails={() =>
                      onDirectoryDetails(directory)
                    }
                    onDownload={() =>
                      onDirectoryDownload(directory)
                    }
                    onShare={() =>
                      onDirectoryShare(directory)
                    }
                    onRename={() =>
                      onDirectoryRename(directory)
                    }
                    onDelete={() =>
                      onDirectoryDelete(directory)
                    }
                    onSelect={onEnterSelectionMode}
                  />
                </div>
              )}
            </div>
          );
        })}

        {/* Files */}
        {files.map((file) => {
          const iconInfo = getFileIconInfo(file);
          const FileIcon = iconInfo.icon;
          const clickable =
            file.status === "ready";

          const selected = isSelected({
            type: "file",
            id: file._id,
          });

          return (
            <div
              key={file._id}
              className={getRowClassName(selected)}
            >
              {selectionMode ? (
                <input
                  type="checkbox"
                  checked={selected}
                  disabled={!clickable}
                  onChange={() =>
                    onToggleSelection({
                      type: "file",
                      id: file._id,
                    })
                  }
                  onClick={(event) =>
                    event.stopPropagation()
                  }
                  aria-label={`Select file ${file.name}`}
                  title={
                    clickable
                      ? undefined
                      : "File is still uploading"
                  }
                  className="size-4 cursor-pointer accent-blue-600 disabled:cursor-not-allowed disabled:opacity-40"
                />
              ) : null}

              <button
                type="button"
                disabled={!clickable}
                onClick={() => {
                  if (selectionMode) {
                    if (clickable) {
                      onToggleSelection({
                        type: "file",
                        id: file._id,
                      });
                    }

                    return;
                  }

                  onOpenFile(file);
                }}
                className="flex min-w-0 items-center gap-3 text-left disabled:cursor-default"
              >
                <span
                  className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${iconInfo.wrapper}`}
                >
                  <FileIcon
                    className={`size-5 ${iconInfo.iconClass}`}
                  />
                </span>

                <span className="min-w-0 truncate text-sm font-medium text-slate-800">
                  {file.name}
                </span>

                {file.status === "uploading" ? (
                  <Badge variant="secondary">
                    Uploading
                  </Badge>
                ) : null}
              </button>

              <span className="text-sm text-slate-500">
                {formatDate(
                  file.updatedAt ??
                    file.createdAt,
                )}
              </span>

              <span className="text-sm text-slate-500">
                {formatBytes(file.size)}
              </span>

              {selectionMode ? (
                <span aria-hidden="true" />
              ) : (
                <div className="flex justify-end">
                  <DriveItemActions
                    onDetails={() =>
                      onFileDetails(file)
                    }
                    onDownload={() =>
                      onFileDownload(file)
                    }
                    onShare={() =>
                      onFileShare(file)
                    }
                    onRename={() =>
                      onFileRename(file)
                    }
                    onDelete={() =>
                      onFileDelete(file)
                    }
                    onSelect={onEnterSelectionMode}
                    downloadDisabled={!clickable}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default DirectoryItemsView;
