import {
  ArrowLeft,
  Download,
  FileText,
  Folder,
  FolderPlus,
  Loader2,
  Pencil,
  ShieldAlert,
  Trash2,
  UploadCloud,
  Users,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ReactNode,
} from "react";
import { useSelector } from "react-redux";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import {
  abortRestrictedUpload,
  browsePublicDirectory,
  browseRestrictedDirectory,
  completeRestrictedMultipartUpload,
  completeRestrictedSingleUpload,
  createRestrictedDirectory,
  deleteRestrictedDirectory,
  deleteRestrictedFile,
  downloadPublicFile,
  downloadRestrictedFile,
  getRestrictedMultipartPartUploadUrl,
  initiateRestrictedUpload,
  renameRestrictedDirectory,
  renameRestrictedFile,
  resolvePublicShare,
  resolveRestrictedShare,
  viewPublicFile,
  viewRestrictedFile,
} from "../api/SharedAccessApi";
import { uploadMultipartFileToS3, uploadSingleFileToS3 } from "../api/fileApi";
import Header from "../components/Header";
import Sidebar from "../components/Sidebar";
import UploadProgressPanel from "../components/UploadProgressPanel";
import { formatBytes } from "../components/StorageUsage";

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
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "../components/ui/breadcrumb";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { getErrorMessage } from "../lib/error";
import { toast } from "../components/ui/toast";
import type { RootState } from "../store/store";
import type {
  ShareAccessType,
  SharedBreadcrumb,
  SharedDirectory,
  SharedDirectoryResponse,
  SharedFile,
} from "../types/share-link";
import type { FileUploadItem } from "../types/upload";


interface SharedAccessProps {
  accessType: ShareAccessType;
}

type SharedUploadWorkItem =
  FileUploadItem & {
    serverFileId?: string;
  };

const isAxiosStatus = (error: unknown, status: number) =>
  axios.isAxiosError(error) && error.response?.status === status;

const getSharedError = (error: unknown, fallback: string) => {
  if (isAxiosStatus(error, 410)) {
    return "This share link has expired. Ask the owner to create a new link.";
  }
  if (isAxiosStatus(error, 403)) {
    return "Your account is not allowed to access this restricted link.";
  }
  if (isAxiosStatus(error, 404)) {
    return "This shared item is no longer available.";
  }
  if (isAxiosStatus(error, 401)) {
    return "Please sign in to use this restricted link.";
  }
  return getErrorMessage(error, fallback);
};

const SharedAccess = ({ accessType }: SharedAccessProps) => {
  const { token, "*": splat = "" } = useParams<{
    token: string;
    "*": string;
  }>();
  const location = useLocation();
  const navigate = useNavigate();
  const user = useSelector((state: RootState) => state.auth.user);
  const isCheckingAuth = useSelector(
    (state: RootState) => state.auth.isCheckingAuth,
  );
  const isRestricted = accessType === "restricted";

  const [mobileOpen, setMobileOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [share, setShare] = useState<
    SharedDirectoryResponse["data"]["share"] | null
  >(null);
  const [directoryData, setDirectoryData] = useState<
    SharedDirectoryResponse["data"] | null
  >(null);
  const [rootFile, setRootFile] = useState<SharedFile | null>(null);
  const [rootFileUrl, setRootFileUrl] = useState<string | null>(null);
  const isEditor = isRestricted && share?.permission === "editor";

  const [previewFile, setPreviewFile] = useState<SharedFile | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const [renameTarget, setRenameTarget] = useState<
    | { type: "file"; item: SharedFile }
    | { type: "directory"; item: SharedDirectory }
    | null
  >(null);
  const [renameName, setRenameName] = useState("");
  const [renameLoading, setRenameLoading] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<
    | { type: "file"; item: SharedFile }
    | { type: "directory"; item: SharedDirectory }
    | null
  >(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [createFolderOpen, setCreateFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [createFolderLoading, setCreateFolderLoading] = useState(false);
  const [uploadItems, setUploadItems] =
    useState<SharedUploadWorkItem[]>([]);
  const uploadControllersRef = useRef(new Map<string, AbortController>());
  const removalTimersRef = useRef(new Set<number>());
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentDirectoryId = useMemo(() => {
    if (!splat) return null;
    const parts = splat.split("/").filter(Boolean);
    return parts[0] === "directories" ? (parts[1] ?? null) : null;
  }, [splat]);

  const basePath = `/share/${accessType}/${token}`;

  const loadPage = useCallback(async () => {
    if (!token) {
      setPageError("The share link is invalid.");
      setLoading(false);
      return;
    }

    if (isRestricted && isCheckingAuth) return;

    if (isRestricted && !user) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setPageError(null);

    try {
      const requestedDirectoryId =
        splat.split("/").filter(Boolean)[0] === "directories"
          ? (splat.split("/").filter(Boolean)[1] ?? null)
          : null;

      const data = requestedDirectoryId
        ? isRestricted
          ? await browseRestrictedDirectory(token, requestedDirectoryId)
          : await browsePublicDirectory(token, requestedDirectoryId)
        : isRestricted
          ? await resolveRestrictedShare(token)
          : await resolvePublicShare(token);

      if ("file" in data) {
        setShare(data.share);
        setRootFile(data.file);
        setRootFileUrl(data.url);
        setDirectoryData(null);
      } else {
        setShare(data.share);
        setDirectoryData(data);
        setRootFile(null);
        setRootFileUrl(null);
      }
    } catch (error) {
      setPageError(getSharedError(error, "Unable to open this shared link."));
      setShare(null);
      setDirectoryData(null);
      setRootFile(null);
      setRootFileUrl(null);
    } finally {
      setLoading(false);
    }
  }, [isCheckingAuth, isRestricted, splat, token, user]);

  useEffect(() => {
    void loadPage();
  }, [loadPage, splat]);

  useEffect(() => {
    return () => {
      uploadControllersRef.current.forEach((controller) => controller.abort());
      removalTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    };
  }, []);

  const updateUploadItem = (
    uploadId: string,
    patch: Partial<SharedUploadWorkItem>,
  ) => {
    setUploadItems((current) =>
      current.map((item) =>
        item.id === uploadId ? { ...item, ...patch } : item,
      ),
    );
  };

  const dismissUpload = async (uploadItemId: string) => {
    const item = uploadItems.find(
      (candidate) => candidate.id === uploadItemId,
    );

    if (!item) return;

    const controller = uploadControllersRef.current.get(uploadItemId);

    if (controller && !controller.signal.aborted) {
      updateUploadItem(uploadItemId, {
        status: "cancelling",
      });

      controller.abort();
      return;
    }

    if (!item.serverFileId || !token) {
      setUploadItems((current) =>
        current.filter((candidate) => candidate.id !== uploadItemId),
      );
      return;
    }

    updateUploadItem(uploadItemId, {
      status: "cancelling",
    });

    try {
      await abortRestrictedUpload(token, item.serverFileId);

      setUploadItems((current) =>
        current.filter((candidate) => candidate.id !== uploadItemId),
      );
    } catch (error) {
      // A 404 means the backend already cleaned up the failed upload.
      if (isAxiosStatus(error, 404)) {
        setUploadItems((current) =>
          current.filter((candidate) => candidate.id !== uploadItemId),
        );
        return;
      }

      console.error(
        "Failed to discard shared upload:",
        error,
      );

      updateUploadItem(uploadItemId, {
        status: "failed",
        error:
          "Could not discard the upload. Cleanup will be retried automatically.",
      });
    }
  };

  const removeUploadItemLater = (uploadId: string, delay = 700) => {
    const timer = window.setTimeout(() => {
      removalTimersRef.current.delete(timer);
      setUploadItems((current) =>
        current.filter((item) => item.id !== uploadId),
      );
    }, delay);
    removalTimersRef.current.add(timer);
  };

  const uploadOneFile = async (
    item: SharedUploadWorkItem,
    signal: AbortSignal,
  ) => {
    if (!token || !directoryData)
      throw new Error("Shared directory is unavailable.");

    const directoryId = directoryData.directory._id;
    const mimeType = item.file.type || "application/octet-stream";
    let fileId: string | null = null;

    try {
      const initiated = await initiateRestrictedUpload({
        token,
        directoryId,
        name: item.file.name,
        size: item.file.size,
        mimeType,
      });

      fileId = initiated.fileId;

      updateUploadItem(item.id, {
        serverFileId: fileId,
      });

      if (signal.aborted) throw new Error("Upload cancelled.");

      if (initiated.uploadType === "single") {
        if (!initiated.uploadUrl)
          throw new Error("Server did not return an upload URL.");

        await uploadSingleFileToS3({
          uploadUrl: initiated.uploadUrl,
          file: item.file,
          mimeType,
          signal,
          onProgress: (progress) => updateUploadItem(item.id, { progress }),
        });

        if (signal.aborted) throw new Error("Upload cancelled.");
        await completeRestrictedSingleUpload(token, fileId);
      } else {
        if (!initiated.partSize || !initiated.totalParts) {
          throw new Error(
            "Server returned an invalid multipart upload configuration.",
          );
        }

        const parts = await uploadMultipartFileToS3({
          file: item.file,
          fileId: fileId as string,
          partSize: initiated.partSize,
          totalParts: initiated.totalParts,
          signal,
          onProgress: (progress) => updateUploadItem(item.id, { progress }),
          getPartUploadUrl: (sharedFileId, partNumber, partSignal) =>
            getRestrictedMultipartPartUploadUrl(
              token,
              sharedFileId,
              partNumber,
              partSignal,
            ),
        });

        if (signal.aborted) throw new Error("Upload cancelled.");
        await completeRestrictedMultipartUpload({ token, fileId, parts });
      }
    } catch (error) {
      if (fileId) {
        try {
          await abortRestrictedUpload(token, fileId);
        } catch (abortError) {
          console.error("Failed to abort shared upload:", abortError);
        }
      }
      throw error;
    }
  };

  const startUploadItems = async (items: SharedUploadWorkItem[]) => {
    for (const item of items) {
      const controller = new AbortController();
      uploadControllersRef.current.set(item.id, controller);
      updateUploadItem(item.id, {
        status: "uploading",
        progress: 0,
        error: undefined,
      });

      try {
        await uploadOneFile(item, controller.signal);
        updateUploadItem(item.id, { status: "completed", progress: 100 });
        await loadPage();
        removeUploadItemLater(item.id);
      } catch (error) {
        if (controller.signal.aborted) {
          updateUploadItem(item.id, { status: "cancelling" });
          removeUploadItemLater(item.id, 500);
        } else {
          updateUploadItem(item.id, {
            status: "failed",
            error: getErrorMessage(error, "Upload failed."),
          });
        }
      } finally {
        uploadControllersRef.current.delete(item.id);
      }
    }
  };

  const handleFilesSelected = (event: ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (selected.length === 0) return;

    const items: SharedUploadWorkItem[] = selected.map((file) => ({
      id: crypto.randomUUID(),
      file,
      progress: 0,
      status: "uploading",
    }));

    setUploadItems((current) => [...current, ...items]);
    void startUploadItems(items);
  };

  const openFile = async (file: SharedFile) => {
    if (!token) return;
    setPreviewFile(file);
    setPreviewUrl(null);
    setPreviewError(null);
    setPreviewLoading(true);

    try {
      const data = isRestricted
        ? await viewRestrictedFile(token, file._id)
        : await viewPublicFile(token, file._id);
      setPreviewUrl(data.url);
      setPreviewFile(data.file);
    } catch (error) {
      setPreviewError(getSharedError(error, "Unable to open this file."));
    } finally {
      setPreviewLoading(false);
    }
  };

  const downloadFile = async (file: SharedFile) => {
    if (!token) return;
    try {
      const data = isRestricted
        ? await downloadRestrictedFile(token, file._id)
        : await downloadPublicFile(token, file._id);
      window.location.assign(data.url);
    } catch (error) {
      toast.add({
        title: "Unable to download file",
        description: getSharedError(error, "Please try again."),
        type: "error",
      });
    }
  };

  const submitRename = async () => {
    if (!token || !renameTarget || !renameName.trim()) return;
    setRenameLoading(true);
    try {
      if (renameTarget.type === "file") {
        await renameRestrictedFile(
          token,
          renameTarget.item._id,
          renameName.trim(),
        );
      } else {
        await renameRestrictedDirectory(
          token,
          renameTarget.item._id,
          renameName.trim(),
        );
      }
      setRenameTarget(null);
      setRenameName("");
      await loadPage();
    } catch (error) {
      toast.add({
        title: "Unable to rename item",
        description: getSharedError(error, "Please try again."),
        type: "error",
      });
    } finally {
      setRenameLoading(false);
    }
  };

  const createFolder = async () => {
    if (!token || !directoryData || !newFolderName.trim()) return;
    setCreateFolderLoading(true);
    try {
      await createRestrictedDirectory(
        token,
        directoryData.directory._id,
        newFolderName.trim(),
      );
      setCreateFolderOpen(false);
      setNewFolderName("");
      await loadPage();
    } catch (error) {
      toast.add({
        title: "Unable to create folder",
        description: getSharedError(error, "Please try again."),
        type: "error",
      });
    } finally {
      setCreateFolderLoading(false);
    }
  };

  const confirmDelete = async () => {
    if (!token || !deleteTarget) return;
    setDeleteLoading(true);
    try {
      if (deleteTarget.type === "file") {
        await deleteRestrictedFile(token, deleteTarget.item._id);
      } else {
        await deleteRestrictedDirectory(token, deleteTarget.item._id);
      }
      setDeleteTarget(null);
      await loadPage();
    } catch (error) {
      toast.add({
        title: "Unable to move item",
        description: getSharedError(error, "Please try again."),
        type: "error",
      });
    } finally {
      setDeleteLoading(false);
    }
  };

  const cancelUpload = (id: string) => {
    const controller = uploadControllersRef.current.get(id);
    if (!controller || controller.signal.aborted) return;
    updateUploadItem(id, { status: "cancelling" });
    controller.abort();
  };

  const retryUpload = async (id: string) => {
    const item = uploadItems.find(
      (candidate) => candidate.id === id,
    );

    if (!item) return;

    /*
     * A failed upload normally has already been aborted by uploadOneFile.
     * If that cleanup failed, clear the old server-side upload before
     * starting a new one so its reservation cannot remain duplicated.
     * A 404 means the previous upload has already been cleaned up.
     */
    if (item.serverFileId && token) {
      try {
        await abortRestrictedUpload(
          token,
          item.serverFileId,
        );
      } catch (error) {
        if (!isAxiosStatus(error, 404)) {
          console.error(
            "Failed to clear previous shared upload before retry:",
            error,
          );

          updateUploadItem(id, {
            status: "failed",
            error:
              "Could not clear the previous upload. Please try again.",
          });
          return;
        }
      }
    }

    const retryItem: SharedUploadWorkItem = {
      ...item,
      serverFileId: undefined,
      progress: 0,
      status: "uploading",
      error: undefined,
    };

    updateUploadItem(id, {
      serverFileId: undefined,
      status: "uploading",
      progress: 0,
      error: undefined,
    });

    await startUploadItems([retryItem]);
  };

  const isRootShare = Boolean(
    share && share.resourceId === directoryData?.directory._id,
  );
  const breadcrumbs: SharedBreadcrumb[] = directoryData?.breadcrumbs ?? [];
  const allDirectories = directoryData?.directories ?? [];
  const allFiles = directoryData?.files ?? [];
  const query = search.trim().toLowerCase();
  const directories = query
    ? allDirectories.filter((directory) =>
        directory.name.toLowerCase().includes(query),
      )
    : allDirectories;
  const files = query
    ? allFiles.filter((file) => file.name.toLowerCase().includes(query))
    : allFiles;

  const navigateBackToSharedRoot = () => {
    if (!share) return;
    navigate(basePath);
  };

  const renderActions = (
    type: "file" | "directory",
    item: SharedFile | SharedDirectory,
  ) => {
    if (!isEditor) return null;

    const canDelete = "canDelete" in item ? item.canDelete === true : false;

    return (
      <div className="flex shrink-0 items-center gap-1">
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="size-8 text-slate-400 hover:bg-slate-100 hover:text-slate-900"
          onClick={() => {
            if (type === "file") {
              setRenameTarget({ type: "file", item: item as SharedFile });
              setRenameName(item.name);
            } else {
              setRenameTarget({
                type: "directory",
                item: item as SharedDirectory,
              });
              setRenameName(item.name);
            }
          }}
          aria-label={`Rename ${item.name}`}
        >
          <Pencil className="size-4" />
        </Button>

        {canDelete ? (
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="size-8 text-slate-400 hover:bg-red-50 hover:text-red-600"
            onClick={() => {
              if (type === "file") {
                setDeleteTarget({ type: "file", item: item as SharedFile });
              } else {
                setDeleteTarget({
                  type: "directory",
                  item: item as SharedDirectory,
                });
              }
            }}
            aria-label={`Delete ${item.name}`}
          >
            <Trash2 className="size-4" />
          </Button>
        ) : null}
      </div>
    );
  };

  if (isRestricted && isCheckingAuth) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="size-4 animate-spin text-blue-600" />
          Checking your session...
        </div>
      </div>
    );
  }

  if (isRestricted && !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
            <ShieldAlert className="size-7" />
          </div>
          <h1 className="mt-5 text-xl font-semibold text-slate-900">
            Sign in to continue
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            This is a restricted OmniSpace link. Sign in with the account the
            owner shared it with.
          </p>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row">
            <Button
              className="flex-1 bg-blue-600 hover:bg-blue-700"
              onClick={() =>
                navigate("/login", {
                  state: { from: `${location.pathname}${location.search}` },
                })
              }
            >
              Sign in
            </Button>
            <Button
              variant="outline"
              className="flex-1"
              onClick={() =>
                navigate("/register", {
                  state: { from: `${location.pathname}${location.search}` },
                })
              }
            >
              Create account
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="flex min-h-screen items-center justify-center gap-2 text-sm text-slate-500">
          <Loader2 className="size-4 animate-spin text-blue-600" />
          Opening shared link...
        </div>
      </div>
    );
  }

  if (pageError || !share) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
        <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-red-50 text-red-600">
            <ShieldAlert className="size-7" />
          </div>
          <h1 className="mt-5 text-xl font-semibold text-slate-900">
            Shared link unavailable
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            {pageError ?? "This shared item is no longer available."}
          </p>
          {user ? (
            <Button
              className="mt-6 bg-blue-600 hover:bg-blue-700"
              onClick={() => navigate(`/${user.rootDirectoryId}`)}
            >
              Back to OmniSpace
            </Button>
          ) : null}
        </div>
      </div>
    );
  }

  const renderFilePage = (file: SharedFile, url: string | null) => (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
        <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-600">
          <FileText className="size-7" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="break-words text-xl font-semibold text-slate-900 sm:text-2xl">
              {file.name}
            </h1>
            <Badge variant={isRestricted ? "secondary" : "outline"}>
              {isRestricted ? share.permission : "Viewer"}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            {file.mimeType || "Unknown type"} · {formatBytes(file.size)}
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            <Button
              className="bg-blue-600 hover:bg-blue-700"
              onClick={() => void downloadFile(file)}
            >
              <Download className="size-4" />
              Download
            </Button>
            {url ? (
              <Button
                variant="outline"
                onClick={() => {
                  setPreviewFile(file);
                  setPreviewUrl(url);
                  setPreviewError(null);
                  setPreviewLoading(false);
                }}
              >
                Preview
              </Button>
            ) : null}
            {isEditor ? (
              <Button
                variant="outline"
                onClick={() => {
                  setRenameTarget({ type: "file", item: file });
                  setRenameName(file.name);
                }}
              >
                <Pencil className="size-4" />
                Rename
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );

  const appShell = (content: ReactNode) => {
    if (!user) return <div className="min-h-screen bg-slate-50">{content}</div>;

    return (
      <div className="min-h-screen bg-slate-50">
        <Sidebar
          activeRoot={false}
          activeTrash={false}
          activeSharedByMe={false}
          activeSharedWithMe={false}
          mobileOpen={mobileOpen}
          user={user}
          onHome={() => navigate(`/${user.rootDirectoryId}`)}
          onCloseMobile={() => setMobileOpen(false)}
          onSharedByMe={() => navigate("/share")}
          onSharedWithMe={() => navigate("/shared-with-me")}
          onRecent={() => undefined}
          onStarred={() => undefined}
          onTrash={() => navigate("/trash")}
        />
        <div className="min-h-screen lg:ml-64">
          <Header
            user={user}
            search={search}
            onSearchChange={setSearch}
            onMenuClick={() => setMobileOpen(true)}
          />
          {content}
        </div>
      </div>
    );
  };

  return appShell(
    <>
      <main className="px-4 pb-10 pt-20 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1 overflow-x-auto pb-1">
              <Breadcrumb>
                <BreadcrumbList className="flex-nowrap">
                  {breadcrumbs.map((crumb: SharedBreadcrumb, index) => {
                    const current = index === breadcrumbs.length - 1;
                    return (
                      <span key={crumb.id} className="contents">
                        <BreadcrumbItem>
                          {current ? (
                            <BreadcrumbPage className="max-w-60 truncate">
                              {crumb.name}
                            </BreadcrumbPage>
                          ) : (
                            <BreadcrumbLink
                              href={`${basePath}/directories/${crumb.id}`}
                              className="max-w-48 truncate"
                              onClick={(event) => {
                                event.preventDefault();
                                navigate(`${basePath}/directories/${crumb.id}`);
                              }}
                            >
                              {crumb.name}
                            </BreadcrumbLink>
                          )}
                        </BreadcrumbItem>
                        {!current ? <BreadcrumbSeparator /> : null}
                      </span>
                    );
                  })}
                  {breadcrumbs.length === 0 ? (
                    <BreadcrumbItem>
                      <BreadcrumbPage>
                        {directoryData?.directory.name ?? "Shared file"}
                      </BreadcrumbPage>
                    </BreadcrumbItem>
                  ) : null}
                </BreadcrumbList>
              </Breadcrumb>
            </div>
            {user ? (
              <Badge
                variant="outline"
                className="hidden shrink-0 sm:inline-flex"
              >
                <Users className="mr-1 size-3.5" />
                Shared access
              </Badge>
            ) : null}
          </div>

          {rootFile ? (
            renderFilePage(rootFile, rootFileUrl)
          ) : directoryData ? (
            <>
              <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                    <Folder className="size-5" />
                  </div>
                  <div className="min-w-0">
                    <h1 className="truncate text-xl font-semibold text-slate-900 sm:text-2xl">
                      {directoryData.directory.name}
                    </h1>
                    <p className="mt-1 text-xs text-slate-500">
                      {isRestricted
                        ? `${share.permission === "editor" ? "Editor" : "Viewer"} access`
                        : "Viewer access"}{" "}
                      · {directories.length + files.length} item
                      {directories.length + files.length === 1 ? "" : "s"}
                    </p>
                  </div>
                </div>

                {isEditor ? (
                  <div className="flex flex-wrap gap-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      className="hidden"
                      onChange={handleFilesSelected}
                    />
                    <Button
                      className="bg-blue-600 hover:bg-blue-700"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <UploadCloud className="size-4" />
                      Upload
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setCreateFolderOpen(true)}
                    >
                      <FolderPlus className="size-4" />
                      New folder
                    </Button>
                  </div>
                ) : null}
              </div>

              {directories.length === 0 && files.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
                  <Folder className="mx-auto size-8 text-slate-300" />
                  <h2 className="mt-3 text-sm font-semibold text-slate-900">
                    {search ? "No matching items" : "This folder is empty"}
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {search
                      ? "Try a different name or clear the search."
                      : "There are no visible items in this shared folder."}
                  </p>
                </div>
              ) : (
                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <div className="hidden grid-cols-[minmax(0,1fr)_160px_100px] gap-4 border-b bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-400 sm:grid">
                    <span>Name</span>
                    <span>Size</span>
                    <span />
                  </div>

                  {directories.map((directory) => (
                    <div
                      key={directory._id}
                      className="flex items-center gap-3 border-b px-4 py-3 last:border-b-0 sm:grid sm:grid-cols-[minmax(0,1fr)_160px_100px] sm:gap-4"
                    >
                      <button
                        type="button"
                        className="flex min-w-0 flex-1 items-center gap-3 text-left"
                        onClick={() =>
                          navigate(`${basePath}/directories/${directory._id}`)
                        }
                      >
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-yellow-50 text-yellow-500">
                          <Folder className="size-5 fill-yellow-400" />
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium text-slate-800">
                            {directory.name}
                          </span>
                          <span className="block text-xs text-slate-400 sm:hidden">
                            {formatBytes(directory.size)}
                          </span>
                        </span>
                      </button>
                      <span className="hidden text-xs text-slate-500 sm:block">
                        {formatBytes(directory.size)}
                      </span>
                      <div className="sm:flex sm:justify-end">
                        {renderActions("directory", directory)}
                      </div>
                    </div>
                  ))}

                  {files.map((file) => (
                    <div
                      key={file._id}
                      className="flex items-center gap-3 border-b px-4 py-3 last:border-b-0 sm:grid sm:grid-cols-[minmax(0,1fr)_160px_100px] sm:gap-4"
                    >
                      <button
                        type="button"
                        className="flex min-w-0 flex-1 items-center gap-3 text-left"
                        onClick={() => void openFile(file)}
                      >
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                          <FileText className="size-5" />
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium text-slate-800">
                            {file.name}
                          </span>
                          <span className="block text-xs text-slate-400 sm:hidden">
                            {formatBytes(file.size)}
                          </span>
                        </span>
                      </button>
                      <span className="hidden text-xs text-slate-500 sm:block">
                        {formatBytes(file.size)}
                      </span>
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="size-8 text-slate-400 hover:bg-slate-100 hover:text-slate-900"
                          onClick={() => void downloadFile(file)}
                          aria-label={`Download ${file.name}`}
                        >
                          <Download className="size-4" />
                        </Button>
                        {renderActions("file", file)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : null}

          {currentDirectoryId ? (
            <Button
              variant="ghost"
              className="mt-4"
              onClick={navigateBackToSharedRoot}
            >
              <ArrowLeft className="size-4" />
              Shared root
            </Button>
          ) : null}
        </div>
      </main>

      <UploadProgressPanel
        items={uploadItems}
        onRetry={retryUpload}
        onCancel={cancelUpload}
        onDismiss={dismissUpload}
      />

      <Dialog
        open={previewFile !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPreviewFile(null);
            setPreviewUrl(null);
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle className="truncate pr-8">
              {previewFile?.name ?? "Preview"}
            </DialogTitle>
            <DialogDescription>
              {previewFile
                ? `${previewFile.mimeType} · ${formatBytes(previewFile.size)}`
                : ""}
            </DialogDescription>
          </DialogHeader>

          {previewLoading ? (
            <div className="flex min-h-72 items-center justify-center text-sm text-slate-500">
              <Loader2 className="mr-2 size-4 animate-spin text-blue-600" />
              Loading preview...
            </div>
          ) : previewError ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {previewError}
            </div>
          ) : previewUrl && previewFile ? (
            <div className="overflow-hidden rounded-xl border bg-slate-950">
              {previewFile.mimeType.startsWith("image/") ? (
                <img
                  src={previewUrl}
                  alt={previewFile.name}
                  className="mx-auto max-h-[65vh] object-contain"
                />
              ) : previewFile.mimeType.startsWith("video/") ? (
                <video
                  src={previewUrl}
                  controls
                  className="mx-auto max-h-[65vh] w-full"
                />
              ) : previewFile.mimeType.startsWith("audio/") ? (
                <div className="flex min-h-48 items-center justify-center p-8">
                  <audio src={previewUrl} controls className="w-full" />
                </div>
              ) : (
                <iframe
                  src={previewUrl}
                  title={previewFile.name}
                  className="h-[65vh] w-full bg-white"
                />
              )}
            </div>
          ) : null}

          <DialogFooter>
            {previewFile ? (
              <Button
                variant="outline"
                onClick={() => void downloadFile(previewFile)}
              >
                <Download className="size-4" />
                Download
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={renameTarget !== null}
        onOpenChange={(open) => {
          if (!open && !renameLoading) setRenameTarget(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              Rename {renameTarget?.type === "directory" ? "folder" : "file"}
            </DialogTitle>
            <DialogDescription>
              Only restricted editors can make this change.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={renameName}
            onChange={(event) => setRenameName(event.target.value)}
            autoFocus
            maxLength={255}
          />
          <DialogFooter>
            <Button
              variant="outline"
              disabled={renameLoading}
              onClick={() => setRenameTarget(null)}
            >
              Cancel
            </Button>
            <Button
              className="bg-blue-600 hover:bg-blue-700"
              disabled={renameLoading || !renameName.trim()}
              onClick={() => void submitRename()}
            >
              {renameLoading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Pencil className="size-4" />
              )}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={createFolderOpen}
        onOpenChange={(open) => {
          if (!open && !createFolderLoading) setCreateFolderOpen(false);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create folder</DialogTitle>
            <DialogDescription>
              Create a folder inside the current shared directory.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={newFolderName}
            onChange={(event) => setNewFolderName(event.target.value)}
            placeholder="Folder name"
            autoFocus
            maxLength={255}
          />
          <DialogFooter>
            <Button
              variant="outline"
              disabled={createFolderLoading}
              onClick={() => setCreateFolderOpen(false)}
            >
              Cancel
            </Button>
            <Button
              className="bg-blue-600 hover:bg-blue-700"
              disabled={createFolderLoading || !newFolderName.trim()}
              onClick={() => void createFolder()}
            >
              {createFolderLoading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <FolderPlus className="size-4" />
              )}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open && !deleteLoading) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Move this item to trash?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.type === "directory"
                ? "The share server will allow this only when the complete subtree is eligible for your editor account."
                : "This file will be soft-deleted through the shared editor API."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteLoading}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteLoading}
              className="bg-red-600 hover:bg-red-700"
              onClick={() => void confirmDelete()}
            >
              {deleteLoading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Trash2 className="size-4" />
              )}
              Move to trash
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>,
  );
};

export default SharedAccess;
