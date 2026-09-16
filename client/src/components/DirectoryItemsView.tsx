import {
  File,
  Folder,
  FolderOpen,
} from "lucide-react";

import type {
  Directory,
  DriveFile,
} from "../types/directory";

import DriveItemMenu from "./DriveItemMenu";

interface DirectoryItemsViewProps {
  directories: Directory[];
  files: DriveFile[];

  onOpenDirectory: (
    directoryId: string,
  ) => void;

  onDirectoryDetails: (
    directory: Directory,
  ) => void;

  onDirectoryDownload: (
    directory: Directory,
  ) => void;

  onDirectoryShare: (
    directory: Directory,
  ) => void;

  onDirectoryRename: (
    directory: Directory,
  ) => void;

  onDirectoryDelete: (
    directory: Directory,
  ) => void;

  onFileDetails: (
    file: DriveFile,
  ) => void;

  onFileDownload: (
    file: DriveFile,
  ) => void;

  onFileShare: (
    file: DriveFile,
  ) => void;

  onFileRename: (
    file: DriveFile,
  ) => void;

  onFileDelete: (
    file: DriveFile,
  ) => void;
}

const formatDate = (
  value?: string | null,
) => {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat(
    "en-IN",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
    },
  ).format(new Date(value));
};

const formatBytes = (
  bytes: number,
) => {
  if (bytes <= 0) {
    return "0 B";
  }

  const units = [
    "B",
    "KB",
    "MB",
    "GB",
    "TB",
  ];

  const index = Math.min(
    Math.floor(
      Math.log(bytes) /
        Math.log(1024),
    ),
    units.length - 1,
  );

  return `${(
    bytes /
    1024 ** index
  ).toFixed(
    index === 0 ? 0 : 1,
  )} ${units[index]}`;
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

  onFileDetails,
  onFileDownload,
  onFileShare,
  onFileRename,
  onFileDelete,
}: DirectoryItemsViewProps) => {
  const hasItems =
    directories.length > 0 ||
    files.length > 0;

  if (!hasItems) {
    return (
      <div className="min-h-[55vh] rounded-xl border border-slate-200 bg-white">
        <div className="flex min-h-[55vh] flex-col items-center justify-center px-6 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100">
            <FolderOpen
              size={28}
              className="text-slate-400"
            />
          </div>

          <h3 className="mt-4 text-base font-semibold text-slate-900">
            This folder is empty
          </h3>

          <p className="mt-1 max-w-sm text-sm text-slate-500">
            Upload files or create a folder
            to get started.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full overflow-visible">
      {/* Horizontal scrolling only on very small screens */}
      <div className="w-full overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <div className="min-w-[720px] overflow-visible">
          {/* Header */}
          <div
            className="
              grid
              grid-cols-[minmax(0,1fr)_170px_120px_44px]
              items-center
              border-b border-slate-200
              bg-slate-50
              px-4 py-3
              text-xs font-medium
              uppercase tracking-wide
              text-slate-400
            "
          >
            <span>Name</span>
            <span>Modified</span>
            <span>Size</span>
            <span />
          </div>

          {/* Folders */}
          {directories.map(
            (directory) => (
              <div
                key={directory._id}
                className="
                  grid
                  grid-cols-[minmax(0,1fr)_170px_120px_44px]
                  items-center
                  border-b border-slate-100
                  px-4 py-3
                  transition
                  hover:bg-slate-50
                "
              >
                {/* Name */}
                <button
                  type="button"
                  onDoubleClick={() =>
                    onOpenDirectory(
                      directory._id,
                    )
                  }
                  className="flex min-w-0 items-center gap-3 text-left"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                    <Folder size={20} />
                  </div>

                  <span className="truncate text-sm font-medium text-slate-800">
                    {directory.name}
                  </span>
                </button>

                {/* Modified */}
                <span className="text-sm text-slate-500">
                  {formatDate(
                    directory.updatedAt ??
                      directory.createdAt,
                  )}
                </span>

                {/* Size */}
                <span className="text-sm text-slate-500">
                  {formatBytes(
                    directory.size,
                  )}
                </span>

                {/* Menu */}
                <div className="flex justify-end">
                  <DriveItemMenu
                    onDetails={() =>
                      onDirectoryDetails(
                        directory,
                      )
                    }
                    onDownload={() =>
                      onDirectoryDownload(
                        directory,
                      )
                    }
                    onShare={() =>
                      onDirectoryShare(
                        directory,
                      )
                    }
                    onRename={() =>
                      onDirectoryRename(
                        directory,
                      )
                    }
                    onDelete={() =>
                      onDirectoryDelete(
                        directory,
                      )
                    }
                  />
                </div>
              </div>
            ),
          )}

          {/* Files */}
          {files.map((file) => (
            <div
              key={file._id}
              className="
                grid
                grid-cols-[minmax(0,1fr)_170px_120px_44px]
                items-center
                border-b border-slate-100
                px-4 py-3
                transition
                last:border-b-0
                hover:bg-slate-50
              "
            >
              {/* Name */}
              <button
                type="button"
                className="flex min-w-0 items-center gap-3 text-left"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                  <File size={19} />
                </div>

                <span className="truncate text-sm font-medium text-slate-800">
                  {file.name}
                </span>
              </button>

              {/* Modified */}
              <span className="text-sm text-slate-500">
                {formatDate(
                  file.updatedAt ??
                    file.createdAt,
                )}
              </span>

              {/* Size */}
              <span className="text-sm text-slate-500">
                {formatBytes(file.size)}
              </span>

              {/* Menu */}
              <div className="flex justify-end">
                <DriveItemMenu
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
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default DirectoryItemsView;