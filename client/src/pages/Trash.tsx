import { useCallback, useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import {
  File,
  Folder,
  Loader2,
  RotateCcw,
  Trash2,
} from "lucide-react";

import {
  getDirectoryTrash,
  permanentlyDeleteDirectory,
  restoreDirectory,
} from "../api/directoryApi";

import {
  getFileTrash,
  permanentlyDeleteFile,
  restoreFile,
} from "../api/fileApi";

import { emptyTrash } from "../api/trashApi";

import Header from "../components/Header";
import Sidebar from "../components/Sidebar";
import { Button } from "../components/ui/button";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../components/ui/alert-dialog";

import { toast } from "../components/ui/toast";
import { getErrorMessage } from "../lib/error";

import {
  decrementStorageUsed,
  setUser,
} from "../store/auth/authSlice";

import type {
  RootState,
  AppDispatch,
} from "../store/store";

import type {
  Directory,
  DriveFile,
} from "../types/directory";

import { getCurrentUser } from "../api/authApi";
import { formatBytes } from "../components/StorageUsage";

const Trash = () => {
  const user = useSelector(
    (state: RootState) => state.auth.user,
  );

  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();

  const [mobileOpen, setMobileOpen] =
    useState(false);

  const [directories, setDirectories] =
    useState<Directory[]>([]);

  const [files, setFiles] =
    useState<DriveFile[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [actionLoading, setActionLoading] =
    useState(false);

  const [
    emptyTrashDialogOpen,
    setEmptyTrashDialogOpen,
  ] = useState(false);

  const [
    emptyTrashLoading,
    setEmptyTrashLoading,
  ] = useState(false);

  const [pendingAction, setPendingAction] =
    useState<{
      type: "directory" | "file";
      action: "restore" | "permanent";
      item: Directory | DriveFile;
    } | null>(null);

  const loadTrash = useCallback(
    async () => {
      setLoading(true);

      try {
        const [
          directoryTrash,
          fileTrash,
        ] = await Promise.all([
          getDirectoryTrash(),
          getFileTrash(),
        ]);

        setDirectories(directoryTrash);
        setFiles(fileTrash);
      } catch (error) {
        console.error(
          "Failed to load trash:",
          error,
        );

        toast.add({
          title: "Unable to load trash",
          description: getErrorMessage(
            error,
            "Please try again.",
          ),
          type: "error",
        });
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    void loadTrash();
  }, [loadTrash]);

  if (!user) {
    return null;
  }

  const handleHome = () => {
    navigate(
      `/${user.rootDirectoryId}`,
    );
  };

  const refreshAuthoritativeUser =
    async () => {
      try {
        const freshUser =
          await getCurrentUser();

        dispatch(
          setUser(freshUser),
        );
      } catch (error) {
        console.error(
          "Failed to refresh user storage state:",
          error,
        );
      }
    };

  const handleConfirmedAction =
    async () => {
      if (!pendingAction) {
        return;
      }

      setActionLoading(true);

      try {
        if (
          pendingAction.type ===
          "directory"
        ) {
          if (
            pendingAction.action ===
            "restore"
          ) {
            await restoreDirectory(
              pendingAction.item._id,
            );

            toast.add({
              title:
                "Folder restored",
              type: "success",
            });
          } else {
            const result =
              await permanentlyDeleteDirectory(
                pendingAction.item._id,
              );

            dispatch(
              decrementStorageUsed(
                result.storageFreedInBytes ??
                  0,
              ),
            );

            await refreshAuthoritativeUser();

            toast.add({
              title:
                "Folder permanently deleted",
              type: "success",
            });
          }
        } else {
          if (
            pendingAction.action ===
            "restore"
          ) {
            await restoreFile(
              pendingAction.item._id,
            );

            toast.add({
              title:
                "File restored",
              type: "success",
            });
          } else {
            const result =
              await permanentlyDeleteFile(
                pendingAction.item._id,
              );

            dispatch(
              decrementStorageUsed(
                result.storageFreedInBytes,
              ),
            );

            await refreshAuthoritativeUser();

            toast.add({
              title:
                "File permanently deleted",
              type: "success",
            });
          }
        }

        setPendingAction(null);

        await loadTrash();
      } catch (error) {
        console.error(
          "Trash action failed:",
          error,
        );

        toast.add({
          title: "Operation failed",
          description:
            getErrorMessage(
              error,
              "Please try again.",
            ),
          type: "error",
        });
      } finally {
        setActionLoading(false);
      }
    };

  const handleEmptyTrash =
    async () => {
      setEmptyTrashLoading(true);

      try {
        await emptyTrash();

        setEmptyTrashDialogOpen(
          false,
        );

        /*
         * Refresh the authoritative user
         * because the backend has released
         * all reserved trash storage.
         */
        await refreshAuthoritativeUser();

        /*
         * Reload the trash lists so both
         * folders and files disappear.
         */
        await loadTrash();

        toast.add({
          title: "Trash emptied",
          description:
            "All trashed files and folders were permanently deleted.",
          type: "success",
        });
      } catch (error) {
        console.error(
          "Failed to empty trash:",
          error,
        );

        toast.add({
          title:
            "Unable to empty trash",
          description:
            getErrorMessage(
              error,
              "Please try again.",
            ),
          type: "error",
        });
      } finally {
        setEmptyTrashLoading(
          false,
        );
      }
    };

  const itemName =
    pendingAction?.item.name ??
    "this item";

  const permanent =
    pendingAction?.action ===
    "permanent";

  const hasTrashItems =
    directories.length > 0 ||
    files.length > 0;

  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar
        activeRoot={false}
        activeTrash
        mobileOpen={mobileOpen}
        user={user}
        onHome={handleHome}
        onCloseMobile={() =>
          setMobileOpen(false)
        }
        onSharedWithMe={() =>
          console.log(
            "Shared with me API is not implemented yet.",
          )
        }
        onRecent={() =>
          console.log(
            "Recent API is not implemented yet.",
          )
        }
        onStarred={() =>
          console.log(
            "Starred API is not implemented yet.",
          )
        }
        onTrash={() =>
          navigate("/trash")
        }
      />

      <div className="min-h-screen lg:ml-64">
        <Header
          user={user}
          search=""
          onSearchChange={() =>
            undefined
          }
          onMenuClick={() =>
            setMobileOpen(true)
          }
        />

        <main className="px-4 pb-8 pt-20 sm:px-6">
          <div className="mb-6 flex items-end justify-between gap-4">
            <div>
              <h1 className="text-xl font-semibold text-slate-900">
                Trash
              </h1>

              <p className="mt-1 text-sm text-slate-500">
                Restore items or permanently delete them.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="destructive"
                disabled={
                  !hasTrashItems ||
                  emptyTrashLoading
                }
                onClick={() =>
                  setEmptyTrashDialogOpen(
                    true,
                  )
                }
              >
                <Trash2 className="size-4" />
                Empty trash
              </Button>

              <Button
                variant="outline"
                className="bg-white"
                onClick={() =>
                  navigate(
                    `/${user.rootDirectoryId}`,
                  )
                }
              >
                Home
              </Button>
            </div>
          </div>

          {loading ? (
            <div className="flex min-h-[50vh] items-center justify-center">
              <Loader2 className="size-5 animate-spin text-blue-600" />
            </div>
          ) : directories.length ===
              0 &&
            files.length === 0 ? (
            <div className="flex min-h-[50vh] items-center justify-center rounded-xl border bg-white text-center shadow-sm">
              <div>
                <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-slate-50">
                  <Trash2 className="size-7 text-slate-300" />
                </div>

                <h2 className="mt-4 text-base font-semibold text-slate-900">
                  Trash is empty
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Deleted files and folders will appear here.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {directories.length >
              0 ? (
                <section>
                  <h2 className="mb-3 text-sm font-semibold text-slate-900">
                    Folders
                  </h2>

                  <div className="overflow-x-auto rounded-xl border bg-white shadow-sm">
                    <div className="min-w-[700px]">
                      {directories.map(
                        (
                          directory,
                        ) => (
                          <div
                            key={
                              directory._id
                            }
                            className="grid grid-cols-[minmax(0,1fr)_120px_210px] items-center gap-4 border-b px-4 py-3 last:border-b-0"
                          >
                            <div className="flex min-w-0 items-center gap-3">
                              <span className="flex size-9 items-center justify-center rounded-lg bg-yellow-50">
                                <Folder className="size-5 fill-yellow-400 text-yellow-500" />
                              </span>

                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium text-slate-800">
                                  {
                                    directory.name
                                  }
                                </p>

                                <p className="text-xs text-slate-400">
                                  {formatBytes(
                                    directory.size,
                                  )}
                                </p>
                              </div>
                            </div>

                            <div className="flex justify-end gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  setPendingAction(
                                    {
                                      type: "directory",
                                      action: "restore",
                                      item: directory,
                                    },
                                  )
                                }
                              >
                                <RotateCcw className="size-3.5" />
                                Restore
                              </Button>

                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() =>
                                  setPendingAction(
                                    {
                                      type: "directory",
                                      action: "permanent",
                                      item: directory,
                                    },
                                  )
                                }
                              >
                                Delete forever
                              </Button>
                            </div>
                          </div>
                        ),
                      )}
                    </div>
                  </div>
                </section>
              ) : null}

              {files.length > 0 ? (
                <section>
                  <h2 className="mb-3 text-sm font-semibold text-slate-900">
                    Files
                  </h2>

                  <div className="overflow-x-auto rounded-xl border bg-white shadow-sm">
                    <div className="min-w-[700px]">
                      {files.map(
                        (file) => (
                          <div
                            key={file._id}
                            className="grid grid-cols-[minmax(0,1fr)_120px_210px] items-center gap-4 border-b px-4 py-3 last:border-b-0"
                          >
                            <div className="flex min-w-0 items-center gap-3">
                              <span className="flex size-9 items-center justify-center rounded-lg bg-slate-100">
                                <File className="size-5 text-slate-500" />
                              </span>

                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium text-slate-800">
                                  {
                                    file.name
                                  }
                                </p>

                                <p className="text-xs text-slate-400">
                                  {formatBytes(
                                    file.size,
                                  )}
                                </p>
                              </div>
                            </div>

                            <span className="text-xs text-slate-500">
                              Deleted
                            </span>

                            <div className="flex justify-end gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  setPendingAction(
                                    {
                                      type: "file",
                                      action: "restore",
                                      item: file,
                                    },
                                  )
                                }
                              >
                                <RotateCcw className="size-3.5" />
                                Restore
                              </Button>

                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() =>
                                  setPendingAction(
                                    {
                                      type: "file",
                                      action: "permanent",
                                      item: file,
                                    },
                                  )
                                }
                              >
                                Delete forever
                              </Button>
                            </div>
                          </div>
                        ),
                      )}
                    </div>
                  </div>
                </section>
              ) : null}
            </div>
          )}
        </main>
      </div>

      {/* Empty trash confirmation */}
      <AlertDialog
        open={emptyTrashDialogOpen}
        onOpenChange={(open) => {
          if (
            !open &&
            !emptyTrashLoading
          ) {
            setEmptyTrashDialogOpen(
              false,
            );
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Empty trash?
            </AlertDialogTitle>

            <AlertDialogDescription>
              All files and folders in
              Trash will be permanently
              deleted. This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={
                emptyTrashLoading
              }
            >
              Cancel
            </AlertDialogCancel>

            <AlertDialogAction
              disabled={
                emptyTrashLoading
              }
              onClick={() =>
                void handleEmptyTrash()
              }
              className="bg-red-600 hover:bg-red-700"
            >
              {emptyTrashLoading
                ? "Emptying..."
                : "Empty trash"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Existing individual action confirmation */}
      <AlertDialog
        open={
          pendingAction !== null
        }
        onOpenChange={(open) => {
          if (
            !open &&
            !actionLoading
          ) {
            setPendingAction(
              null,
            );
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {permanent
                ? "Delete permanently?"
                : "Restore this item?"}
            </AlertDialogTitle>

            <AlertDialogDescription>
              {permanent
                ? `"${itemName}" and its stored data will be permanently removed. This cannot be undone.`
                : `"${itemName}" will be restored to its original location.`}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={actionLoading}
            >
              Cancel
            </AlertDialogCancel>

            <AlertDialogAction
              disabled={actionLoading}
              onClick={() =>
                void handleConfirmedAction()
              }
              className={
                permanent
                  ? "bg-red-600 hover:bg-red-700"
                  : "bg-blue-600 hover:bg-blue-700"
              }
            >
              {actionLoading
                ? "Please wait..."
                : permanent
                  ? "Delete forever"
                  : "Restore"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Trash;