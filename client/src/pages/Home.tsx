import axios from "axios";
import {
  Plus,
  UploadCloud,
  Loader2,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom";

import {
  createFolder,
  deleteDirectory,
  getDirectoryItems,
  renameDirectory,
} from "../api/directoryApi";
import {
  abortUpload,
  completeMultipartUpload,
  completeSingleUpload,
  deleteFile,
  getFileUrl,
  initiateUpload,
  renameFile,
  uploadMultipartFileToS3,
  uploadSingleFileToS3,
} from "../api/fileApi";
import { getCurrentUser } from "../api/authApi";
import Header from "../components/Header";
import Sidebar from "../components/Sidebar";
import DirectoryItemsView from "../components/DirectoryItemsView";
import UploadProgressPanel from "../components/UploadProgressPanel";
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
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "../components/ui/breadcrumb";
import { Button } from "../components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { toast } from "../components/ui/toast";
import { getErrorMessage } from "../lib/error";
import {
  setUser,
  updateStorageUsed,
} from "../store/auth/authSlice";
import type { RootState, AppDispatch } from "../store/store";
import type {
  Directory,
  DirectoryResponse,
  DriveFile,
} from "../types/directory";
import type { FileUploadItem } from "../types/upload";

type MultipartPart = {
  partNumber: number;
  eTag: string;
};

type UploadWorkItem = FileUploadItem & {
  serverFileId?: string;
  uploadType?: "single" | "multipart";
  phase?: "uploading" | "completing";
  multipartParts?: MultipartPart[];
};

const Home = () => {
  const { id } = useParams<{
    id: string;
  }>();
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch<AppDispatch>();
  const user = useSelector(
    (state: RootState) => state.auth.user,
  );

  const [directoryData, setDirectoryData] =
    useState<DirectoryResponse | null>(null);
  const [loading, setLoading] =
    useState(true);
  const [search, setSearch] = useState("");
  const [mobileOpen, setMobileOpen] =
    useState(false);

  const [createFolderOpen, setCreateFolderOpen] =
    useState(false);
  const [newFolderName, setNewFolderName] =
    useState("");
  const [renameDirectoryTarget, setRenameDirectoryTarget] =
    useState<Directory | null>(null);
  const [renameDirectoryName, setRenameDirectoryName] =
    useState("");
  const [renameFileTarget, setRenameFileTarget] =
    useState<DriveFile | null>(null);
  const [renameFileName, setRenameFileName] =
    useState("");
  const [deleteTarget, setDeleteTarget] =
    useState<
      | { type: "directory"; item: Directory }
      | { type: "file"; item: DriveFile }
      | null
    >(null);
  const [actionLoading, setActionLoading] =
    useState(false);

  const [uploadItems, setUploadItems] =
    useState<UploadWorkItem[]>([]);
  const fileInputRef =
    useRef<HTMLInputElement>(null);
  const uploadControllersRef =
    useRef(
      new Map<string, AbortController>(),
    );
  const removalTimersRef =
    useRef(
      new Set<number>(),
    );

  const isRoot =
    Boolean(user) && id === user?.rootDirectoryId;

  const loadDirectory = useCallback(
    async () => {
      if (!id || !user) return;

      setLoading(true);

      try {
        const data =
          await getDirectoryItems(id);
        setDirectoryData(data);
      } catch (directoryError) {
        try {
          const file = await getFileUrl(
            id,
            false,
          );
          window.location.replace(
            file.url,
          );
          return;
        } catch (fileError) {
          console.error(
            "Resource could not be opened:",
            {
              directoryError,
              fileError,
            },
          );
          setDirectoryData(null);
        }
      } finally {
        setLoading(false);
      }
    }, [id, user]);

  useEffect(() => {
    setSearch("");
    void loadDirectory();
  }, [loadDirectory, location.key]);

  useEffect(() => {
    return () => {
      for (const timer of removalTimersRef.current) {
        window.clearTimeout(timer);
      }

      for (const controller of uploadControllersRef.current.values()) {
        controller.abort();
      }

      uploadControllersRef.current.clear();
    };
  }, []);

  const directories = useMemo(() => {
    const value = search
      .trim()
      .toLowerCase();
    const items =
      directoryData?.directories ?? [];

    if (!value) return items;

    return items.filter((directory) =>
      directory.name
        .toLowerCase()
        .includes(value),
    );
  }, [directoryData?.directories, search]);

  const files = useMemo(() => {
    const value = search
      .trim()
      .toLowerCase();
    const items =
      directoryData?.files ?? [];

    if (!value) return items;

    return items.filter((file) =>
      file.name
        .toLowerCase()
        .includes(value),
    );
  }, [directoryData?.files, search]);

  if (!user) return null;

  const totalItems =
    directories.length +
    files.length;

  const updateUploadItem = (
    uploadItemId: string,
    patch: Partial<UploadWorkItem>,
  ) => {
    setUploadItems((current) =>
      current.map((item) =>
        item.id === uploadItemId
          ? { ...item, ...patch }
          : item,
      ),
    );
  };


  const removeUploadItemLater = (
    uploadItemId: string,
    delay = 500,
  ) => {
    const timer = window.setTimeout(() => {
      removalTimersRef.current.delete(
        timer,
      );

      setUploadItems((current) =>
        current.filter(
          (item) =>
            item.id !== uploadItemId,
        ),
      );
    }, delay);

    removalTimersRef.current.add(timer);
  };

  const refreshAuthoritativeUser =
    async () => {
      try {
        const freshUser =
          await getCurrentUser();
        dispatch(setUser(freshUser));
      } catch (error) {
        console.error(
          "Failed to refresh authoritative user state:",
          error,
        );
      }
    };

  const sleep = (ms: number) =>
    new Promise<void>((resolve) =>
      window.setTimeout(resolve, ms),
    );

  const shouldRetryCompletion = (error: unknown) => {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;

      // These are definitive client/resource errors. Retrying will not help.
      return status === undefined || status >= 500;
    }

    return true;
  };

  const completeSingleWithRetry = async (
    fileId: string,
  ) => {
    let lastError: unknown;

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        return await completeSingleUpload(fileId);
      } catch (error) {
        lastError = error;

        if (
          attempt === 3 ||
          !shouldRetryCompletion(error)
        ) {
          throw error;
        }

        await sleep(attempt * 1000);
      }
    }

    throw lastError;
  };

  const completeMultipartWithRetry = async ({
    fileId,
    parts,
  }: {
    fileId: string;
    parts: MultipartPart[];
  }) => {
    let lastError: unknown;

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        return await completeMultipartUpload({
          fileId,
          parts,
        });
      } catch (error) {
        lastError = error;

        if (
          attempt === 3 ||
          !shouldRetryCompletion(error)
        ) {
          throw error;
        }

        await sleep(attempt * 1000);
      }
    }

    throw lastError;
  };

  const uploadOneFile = async (
    item: UploadWorkItem,
    signal: AbortSignal,
  ) => {
    if (!id) {
      throw new Error(
        "Current directory is unavailable.",
      );
    }

    const mimeType =
      item.file.type ||
      "application/octet-stream";

    const initiated =
      await initiateUpload({
        directoryId: id,
        name: item.file.name,
        size: item.file.size,
        mimeType,
      });

    const fileId = initiated.fileId;

    // Keep these local fields in sync as well as in React state so the
    // catch block always knows whether S3 upload already finished.
    item.serverFileId = fileId;
    item.uploadType = initiated.uploadType;
    item.phase = "uploading";

    updateUploadItem(item.id, {
      serverFileId: fileId,
      uploadType: initiated.uploadType,
      phase: "uploading",
    });

    if (signal.aborted) {
      throw new Error("Upload cancelled.");
    }

    if (initiated.uploadType === "single") {
      try {
        await uploadSingleFileToS3({
          uploadUrl: initiated.uploadUrl,
          file: item.file,
          mimeType,
          signal,
          onProgress: (progress) =>
            updateUploadItem(item.id, { progress }),
        });
      } catch (s3Error) {
        /*
         * The PUT response can fail after S3 has already received the file.
         * Treat this as an ambiguous completion state and preserve the
         * server-side upload while we try to finalize it.
         */
        item.phase = "completing";
        item.progress = 100;

        updateUploadItem(item.id, {
          phase: "completing",
          progress: 100,
        });

        try {
          const completed =
            await completeSingleWithRetry(fileId);

          dispatch(
            updateStorageUsed(
              completed.storageUsedInBytes,
            ),
          );

          return;
        } catch {
          throw s3Error;
        }
      }

      if (signal.aborted) {
        throw new Error("Upload cancelled.");
      }

      item.phase = "completing";
      item.progress = 100;

      updateUploadItem(item.id, {
        phase: "completing",
        progress: 100,
      });

      /*
       * IMPORTANT:
       * If this request fails after S3 succeeded, do NOT abort the upload.
       * The Retry button will call this completion endpoint again.
       */
      const completed =
        await completeSingleWithRetry(fileId);

      dispatch(
        updateStorageUsed(
          completed.storageUsedInBytes,
        ),
      );

      return;
    }

    const parts =
      await uploadMultipartFileToS3({
        file: item.file,
        fileId: initiated.fileId,
        partSize: initiated.partSize,
        totalParts: initiated.totalParts,
        signal,
        onProgress: (progress) =>
          updateUploadItem(item.id, { progress }),
      });

    if (signal.aborted) {
      throw new Error("Upload cancelled.");
    }

    item.phase = "completing";
    item.progress = 100;
    item.multipartParts = parts;

    updateUploadItem(item.id, {
      phase: "completing",
      progress: 100,
      multipartParts: parts,
    });

    const completed =
      await completeMultipartWithRetry({
        fileId: initiated.fileId,
        parts,
      });

    dispatch(
      updateStorageUsed(
        completed.storageUsedInBytes,
      ),
    );
  };

  const retryCompletion = async (
    item: UploadWorkItem,
  ) => {
    if (!item.serverFileId) {
      throw new Error(
        "This upload no longer has a server upload ID. Please upload the file again.",
      );
    }

    updateUploadItem(item.id, {
      status: "uploading",
      phase: "completing",
      progress: 100,
      error: undefined,
    });

    if (item.uploadType === "multipart") {
      if (!item.multipartParts?.length) {
        throw new Error(
          "Multipart upload parts are unavailable. Please upload the file again.",
        );
      }

      const completed =
        await completeMultipartWithRetry({
          fileId: item.serverFileId,
          parts: item.multipartParts,
        });

      dispatch(
        updateStorageUsed(
          completed.storageUsedInBytes,
        ),
      );
    } else {
      const completed =
        await completeSingleWithRetry(
          item.serverFileId,
        );

      dispatch(
        updateStorageUsed(
          completed.storageUsedInBytes,
        ),
      );
    }
  };

  const startUploadItems = async (
    items: UploadWorkItem[],
  ) => {
    // Files are intentionally processed sequentially so storage usage and
    // the current directory remain easy to reconcile.
    for (const item of items) {
      const controller =
        new AbortController();

      uploadControllersRef.current.set(
        item.id,
        controller,
      );

      updateUploadItem(item.id, {
        status: "uploading",
        progress: item.phase === "completing"
          ? 100
          : 0,
        error: undefined,
      });

      try {
        if (
          item.phase === "completing" &&
          item.serverFileId
        ) {
          await retryCompletion(item);
        } else {
          await uploadOneFile(
            item,
            controller.signal,
          );
        }

        updateUploadItem(item.id, {
          status: "completed",
          progress: 100,
          phase: undefined,
        });

        await loadDirectory();
        await refreshAuthoritativeUser();

        toast.add({
          title: "Upload complete",
          description: item.file.name,
          type: "success",
        });

        removeUploadItemLater(
          item.id,
          600,
        );
      } catch (error) {
        if (controller.signal.aborted) {
          if (item.serverFileId) {
            try {
              await abortUpload(item.serverFileId);
            } catch (abortError) {
              console.error(
                "Failed to abort cancelled upload:",
                abortError,
              );
            }
          }

          updateUploadItem(item.id, {
            status: "cancelling",
          });

          toast.add({
            title: "Upload cancelled",
            description: item.file.name,
            type: "info",
          });

          removeUploadItemLater(
            item.id,
            500,
          );
        } else {
          const message =
            getErrorMessage(
              error,
              "Upload failed.",
            );

          /*
           * If phase is completing, the S3 object is already uploaded and
           * the File reservation must remain so Retry can finish it.
           * For an actual S3/upload failure, clean up the reservation.
           */
          const currentItem =
            uploadItems.find(
              (candidate) =>
                candidate.id === item.id,
            );

          const completionFailed =
            currentItem?.phase === "completing" ||
            item.phase === "completing";

          if (
            !completionFailed &&
            item.serverFileId
          ) {
            try {
              await abortUpload(
                item.serverFileId,
              );
            } catch (abortError) {
              console.error(
                "Failed to abort failed upload:",
                abortError,
              );
            }
          }

          updateUploadItem(item.id, {
            status: "failed",
            error: message,
          });

          console.error(
            `Failed to upload ${item.file.name}:`,
            error,
          );

          toast.add({
            title: "Upload failed",
            description: `${item.file.name}: ${message}`,
            type: "error",
          });
        }
      } finally {
        uploadControllersRef.current.delete(
          item.id,
        );
      }
    }
  };

  const handleDismiss = useCallback(
    (uploadItemId: string) => {
      const item = uploadItems.find(
        (candidate) =>
          candidate.id === uploadItemId,
      );

      if (item?.serverFileId) {
        void abortUpload(item.serverFileId)
          .catch((error) => {
            // A ready file means completion already succeeded.
            // In that case abort returns 404 and there is nothing to clean up.
            console.error(
              "Failed to discard upload:",
              error,
            );
          });
      }

      setUploadItems((items) =>
        items.filter(
          (candidate) =>
            candidate.id !== uploadItemId,
        ),
      );
    },
    [uploadItems],
  );

  const handleFilesSelected = (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const selectedFiles = Array.from(
      event.target.files ?? [],
    );

    event.target.value = "";

    if (selectedFiles.length === 0) {
      return;
    }

    const items: UploadWorkItem[] =
      selectedFiles.map((file) => ({
        id: crypto.randomUUID(),
        file,
        progress: 0,
        status: "uploading",
      }));

    setUploadItems((current) => [
      ...current,
      ...items,
    ]);

    void startUploadItems(items);
  };

  const handleRetryUpload = (
    uploadItemId: string,
  ) => {
    const item =
      uploadItems.find(
        (candidate) =>
          candidate.id === uploadItemId,
      );

    if (!item) return;

    void startUploadItems([item]);
  };

  const handleCancelUpload = (
    uploadItemId: string,
  ) => {
    const controller =
      uploadControllersRef.current.get(
        uploadItemId,
      );

    if (
      !controller ||
      controller.signal.aborted
    ) {
      return;
    }

    updateUploadItem(
      uploadItemId,
      { status: "cancelling" },
    );

    controller.abort();
  };

  const handleCreateFolder = async () => {
    const name =
      newFolderName.trim();

    if (!id || !name) return;

    setActionLoading(true);

    try {
      await createFolder({
        parentDirectoryId: id,
        name,
      });

      setCreateFolderOpen(false);
      setNewFolderName("");
      await loadDirectory();

      toast.add({
        title: "Folder created",
        type: "success",
      });
    } catch (error) {
      console.error(
        "Failed to create folder:",
        error,
      );

      toast.add({
        title: "Unable to create folder",
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

  const handleRenameDirectory =
    async () => {
      if (!renameDirectoryTarget)
        return;

      const name =
        renameDirectoryName.trim();

      if (!name) return;

      setActionLoading(true);

      try {
        await renameDirectory(
          renameDirectoryTarget._id,
          name,
        );

        setRenameDirectoryTarget(
          null,
        );
        setRenameDirectoryName("");
        await loadDirectory();

        toast.add({
          title: "Folder renamed",
          type: "success",
        });
      } catch (error) {
        console.error(
          "Failed to rename folder:",
          error,
        );

        toast.add({
          title:
            "Unable to rename folder",
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

  const handleRenameFile =
    async () => {
      if (!renameFileTarget)
        return;

      const name =
        renameFileName.trim();

      if (!name) return;

      setActionLoading(true);

      try {
        await renameFile(
          renameFileTarget._id,
          name,
        );

        setRenameFileTarget(null);
        setRenameFileName("");
        await loadDirectory();

        toast.add({
          title: "File renamed",
          type: "success",
        });
      } catch (error) {
        console.error(
          "Failed to rename file:",
          error,
        );

        toast.add({
          title:
            "Unable to rename file",
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

  const handleDelete = async () => {
    if (!deleteTarget)
      return;

    setActionLoading(true);

    try {
      if (
        deleteTarget.type ===
        "directory"
      ) {
        await deleteDirectory(
          deleteTarget.item._id,
        );

        toast.add({
          title: "Folder moved to trash",
          type: "success",
        });
      } else {
        await deleteFile(
          deleteTarget.item._id,
        );

        toast.add({
          title: "File moved to trash",
          type: "success",
        });
      }

      setDeleteTarget(null);
      await loadDirectory();
    } catch (error) {
      console.error(
        "Failed to move item to trash:",
        error,
      );

      toast.add({
        title: "Unable to move to trash",
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

  const handleOpenFile = (
    file: DriveFile,
  ) => {
    if (file.status !== "ready")
      return;

    navigate(`/${file._id}`);
  };

  const handleDownloadFile = async (
    file: DriveFile,
  ) => {
    if (file.status !== "ready")
      return;

    try {
      const data = await getFileUrl(
        file._id,
        true,
      );

      window.location.assign(
        data.url,
      );
    } catch (error) {
      console.error(
        "Failed to generate download URL:",
        error,
      );

      toast.add({
        title:
          "Unable to download file",
        description:
          getErrorMessage(
            error,
            "Please try again.",
          ),
        type: "error",
      });
    }
  };

  const handleHome = () => {
    navigate(
      `/${user.rootDirectoryId}`,
    );
  };

  const handleOpenDirectory = (
    directoryId: string,
  ) => {
    setSearch("");
    navigate(`/${directoryId}`);
  };

  const navigateToShare = (
    type: "file" | "directory",
    item: DriveFile | Directory,
  ) => {
    console.log(
      `${type} share-link integration is not implemented yet.`,
      item,
    );

    navigate("/share", {
      state: {
        type,
        id: item._id,
        name: item.name,
      },
    });
  };

  const renderSidebar = () => (
    <Sidebar
      activeRoot={isRoot}
      activeTrash={false}
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
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50">
        {renderSidebar()}
        <div className="min-h-screen lg:ml-64">
          <Header
            user={user}
            search={search}
            onSearchChange={setSearch}
            onMenuClick={() =>
              setMobileOpen(true)
            }
          />
          <main className="px-4 pb-8 pt-20 sm:px-6">
            <div className="flex min-h-[60vh] items-center justify-center gap-2 text-sm text-slate-500">
              <Loader2 className="size-4 animate-spin text-blue-600" />
              Loading your files...
            </div>
          </main>
        </div>
      </div>
    );
  }

  if (!directoryData) {
    return (
      <div className="min-h-screen bg-slate-50">
        {renderSidebar()}
        <div className="min-h-screen lg:ml-64">
          <Header
            user={user}
            search={search}
            onSearchChange={setSearch}
            onMenuClick={() =>
              setMobileOpen(true)
            }
          />
          <main className="px-4 pb-8 pt-20 sm:px-6">
            <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
              <p className="text-sm font-medium text-slate-900">
                Unable to open this resource.
              </p>
              <p className="mt-1 text-sm text-slate-500">
                The directory or ready file could not be found.
              </p>
              <Button
                className="mt-4 bg-blue-600 hover:bg-blue-700"
                onClick={handleHome}
              >
                Back to Home
              </Button>
            </div>
          </main>
        </div>
      </div>
    );
  }

  const breadcrumbs =
    directoryData.breadcrumbs.length >
    0
      ? directoryData.breadcrumbs
      : [
          {
            id: user.rootDirectoryId,
            name: "Home",
          },
        ];

  return (
    <div className="min-h-screen bg-slate-50">
      {renderSidebar()}

      <div className="min-h-screen lg:ml-64">
        <Header
          user={user}
          search={search}
          onSearchChange={setSearch}
          onMenuClick={() =>
            setMobileOpen(true)
          }
        />

        <main className="px-4 pb-8 pt-20 sm:px-6">
          <div className="mb-5 overflow-x-auto pb-1">
            <Breadcrumb>
              <BreadcrumbList className="flex-nowrap">
                {breadcrumbs.map(
                  (crumb, index) => {
                    const current =
                      index ===
                      breadcrumbs.length -
                        1;
                    const isRootCrumb =
                      crumb.id ===
                      user.rootDirectoryId;
                    const label =
                      isRootCrumb
                        ? "Home"
                        : crumb.name;

                    return (
                      <span
                        key={crumb.id}
                        className="contents"
                      >
                        <BreadcrumbItem>
                          {current ? (
                            <BreadcrumbPage className="max-w-60 truncate text-sm font-medium">
                              {label}
                            </BreadcrumbPage>
                          ) : (
                            <BreadcrumbLink
                              href={`/${crumb.id}`}
                              className="max-w-48 truncate text-sm"
                              onClick={(event) => {
                                event.preventDefault();
                                navigate(
                                  `/${crumb.id}`,
                                );
                              }}
                            >
                              {label}
                            </BreadcrumbLink>
                          )}
                        </BreadcrumbItem>
                        {!current ? (
                          <BreadcrumbSeparator />
                        ) : null}
                      </span>
                    );
                  },
                )}
              </BreadcrumbList>
            </Breadcrumb>
          </div>

          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-500">
              {totalItems}{" "}
              {totalItems === 1
                ? "item"
                : "items"}
            </p>

            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={handleFilesSelected}
              />

              <Button
                className="bg-blue-600 text-white hover:bg-blue-700"
                onClick={() =>
                  fileInputRef.current?.click()
                }
              >
                <UploadCloud className="size-4" />
                Upload
              </Button>

              <Button
                variant="outline"
                className="border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                onClick={() =>
                  setCreateFolderOpen(true)
                }
              >
                <Plus className="size-4 text-blue-600" />
                New folder
              </Button>
            </div>
          </div>

          <DirectoryItemsView
            directories={directories}
            files={files}
            onOpenDirectory={
              handleOpenDirectory
            }
            onOpenFile={handleOpenFile}
            onDirectoryDetails={(directory) => {
              console.log(
                "Directory details API is not implemented yet:",
                directory,
              );
            }}
            onDirectoryDownload={(directory) => {
              console.log(
                "Directory download API is not implemented yet:",
                directory,
              );
            }}
            onDirectoryShare={(directory) =>
              navigateToShare(
                "directory",
                directory,
              )
            }
            onDirectoryRename={(directory) => {
              setRenameDirectoryTarget(
                directory,
              );
              setRenameDirectoryName(
                directory.name,
              );
            }}
            onDirectoryDelete={(directory) =>
              setDeleteTarget({
                type: "directory",
                item: directory,
              })
            }
            onFileDetails={(file) => {
              console.log(
                "File details API is not implemented yet:",
                file,
              );
            }}
            onFileDownload={
              handleDownloadFile
            }
            onFileShare={(file) =>
              navigateToShare(
                "file",
                file,
              )
            }
            onFileRename={(file) => {
              setRenameFileTarget(file);
              setRenameFileName(
                file.name,
              );
            }}
            onFileDelete={(file) =>
              setDeleteTarget({
                type: "file",
                item: file,
              })
            }
          />
        </main>
      </div>

      <UploadProgressPanel
        items={uploadItems}
        onRetry={handleRetryUpload}
        onCancel={handleCancelUpload}
          onDismiss={handleDismiss}
      />

      <Dialog
        open={createFolderOpen}
        onOpenChange={(open) => {
          if (!actionLoading) {
            setCreateFolderOpen(open);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Create folder
            </DialogTitle>
            <DialogDescription>
              Create a new folder inside the current directory.
            </DialogDescription>
          </DialogHeader>

          <Input
            value={newFolderName}
            onChange={(event) =>
              setNewFolderName(
                event.target.value,
              )
            }
            placeholder="Folder name"
            maxLength={255}
            autoFocus
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void handleCreateFolder();
              }
            }}
          />

          <DialogFooter>
            <Button
              variant="outline"
              disabled={actionLoading}
              onClick={() =>
                setCreateFolderOpen(false)
              }
            >
              Cancel
            </Button>
            <Button
              className="bg-blue-600 hover:bg-blue-700"
              disabled={
                actionLoading ||
                newFolderName.trim().length ===
                  0
              }
              onClick={() =>
                void handleCreateFolder()
              }
            >
              {actionLoading
                ? "Creating..."
                : "Create folder"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={
          renameDirectoryTarget !==
          null
        }
        onOpenChange={(open) => {
          if (!open && !actionLoading) {
            setRenameDirectoryTarget(
              null,
            );
            setRenameDirectoryName("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Rename folder
            </DialogTitle>
            <DialogDescription>
              Choose a new name for this folder.
            </DialogDescription>
          </DialogHeader>

          <Input
            value={renameDirectoryName}
            onChange={(event) =>
              setRenameDirectoryName(
                event.target.value,
              )
            }
            placeholder="Folder name"
            maxLength={255}
            autoFocus
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void handleRenameDirectory();
              }
            }}
          />

          <DialogFooter>
            <Button
              variant="outline"
              disabled={actionLoading}
              onClick={() =>
                setRenameDirectoryTarget(null)
              }
            >
              Cancel
            </Button>
            <Button
              className="bg-blue-600 hover:bg-blue-700"
              disabled={
                actionLoading ||
                renameDirectoryName.trim().length ===
                  0
              }
              onClick={() =>
                void handleRenameDirectory()
              }
            >
              {actionLoading
                ? "Saving..."
                : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={renameFileTarget !== null}
        onOpenChange={(open) => {
          if (!open && !actionLoading) {
            setRenameFileTarget(null);
            setRenameFileName("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Rename file
            </DialogTitle>
            <DialogDescription>
              Choose a new name for this file. The stored object key will remain unchanged.
            </DialogDescription>
          </DialogHeader>

          <Input
            value={renameFileName}
            onChange={(event) =>
              setRenameFileName(
                event.target.value,
              )
            }
            placeholder="File name"
            maxLength={255}
            autoFocus
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void handleRenameFile();
              }
            }}
          />

          <DialogFooter>
            <Button
              variant="outline"
              disabled={actionLoading}
              onClick={() =>
                setRenameFileTarget(null)
              }
            >
              Cancel
            </Button>
            <Button
              className="bg-blue-600 hover:bg-blue-700"
              disabled={
                actionLoading ||
                renameFileName.trim().length ===
                  0
              }
              onClick={() =>
                void handleRenameFile()
              }
            >
              {actionLoading
                ? "Saving..."
                : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open && !actionLoading) {
            setDeleteTarget(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Move to trash?
            </AlertDialogTitle>
            <AlertDialogDescription>
              "{deleteTarget?.item.name}" will be moved to Trash. Storage usage will not change until the item is permanently deleted.
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
                void handleDelete()
              }
              className="bg-blue-600 hover:bg-blue-700"
            >
              {actionLoading
                ? "Moving..."
                : "Move to trash"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Home;
