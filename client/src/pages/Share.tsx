import {
  Clipboard,
  ExternalLink,
  FileText,
  Folder,
  Link2,
  Loader2,
  Pencil,
  Search,
  Share2,
  Trash2,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import {
  getMyShares,
  revokeShareLink,
} from "../api/shareLinkApi";
import Header from "../components/Header";
import Sidebar from "../components/Sidebar";
import ShareDialog from "../components/share-link/ShareDialog";
import { Badge } from "../components/ui/badge";
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
import { Input } from "../components/ui/input";
import { getErrorMessage } from "../lib/error";
import { toast } from "../components/ui/toast";
import {
  removeMyShare,
  setMyShares,
  setMySharesLoading,
  upsertMyShare,
} from "../store/share/shareSlice";
import type { RootState, AppDispatch } from "../store/store";
import type { ShareLink } from "../types/share-link";

const absoluteUrl = (url: string) =>
  url.startsWith("http") ? url : `${window.location.origin}${url}`;

const formatExpiry = (value: string) =>
  new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));

const relativeExpiry = (value: string) => {
  const difference = new Date(value).getTime() - Date.now();
  const hours = Math.floor(difference / 3_600_000);

  if (hours < 1) return "Expires in less than an hour";
  if (hours < 24) return `Expires in ${hours}h`;

  const days = Math.floor(hours / 24);
  return `Expires in ${days}d`;
};

const Share = () => {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const user = useSelector((state: RootState) => state.auth.user);
  const shares = useSelector((state: RootState) => state.share.myShares);
  const loading = useSelector((state: RootState) => state.share .mySharesLoading);

  const [mobileOpen, setMobileOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [editingShare, setEditingShare] = useState<ShareLink | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<ShareLink | null>(null);
  const [revokeLoading, setRevokeLoading] = useState(false);

  const loadShares = useCallback(async () => {
    if (!user) return;
    dispatch(setMySharesLoading(true));
    try {
      const data = await getMyShares();
      dispatch(setMyShares(data));
    } catch (error) {
      // Keep stale Redux data visible when a background refresh fails.
      console.error("Failed to load share links:", error);
      toast.add({
        title: "Unable to refresh share links",
        description: getErrorMessage(error, "Please try again."),
        type: "error",
      });
    } finally {
      dispatch(setMySharesLoading(false));
    }
  }, [dispatch, user]);

  useEffect(() => {
    void loadShares();
  }, [loadShares]);

  const filteredShares = useMemo(() => {
    const value = search.trim().toLowerCase();
    if (!value) return shares;

    return shares.filter((share) => {
      const recipients = share.recipients
        .map((recipient) => `${recipient.name} ${recipient.email}`)
        .join(" ");
      return `${share.resource.name} ${share.accessType} ${share.permission} ${recipients}`
        .toLowerCase()
        .includes(value);
    });
  }, [search, shares]);

  const handleCopy = async (share: ShareLink) => {
    try {
      const value = absoluteUrl(share.url);
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = value;
        textarea.setAttribute("readonly", "true");
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        const copied = document.execCommand("copy");
        textarea.remove();
        if (!copied) throw new Error("Clipboard unavailable");
      }
      toast.add({
        title: "Link copied",
        description: "The share URL is ready to paste.",
        type: "success",
      });
    } catch {
      toast.add({
        title: "Unable to copy link",
        description: "Copy the URL manually from Manage share.",
        type: "error",
      });
    }
  };

  const handleRevoke = async () => {
    if (!revokeTarget) return;
    setRevokeLoading(true);

    try {
      await revokeShareLink(revokeTarget.id);
      dispatch(removeMyShare(revokeTarget.id));
      setRevokeTarget(null);
    } catch (error) {
      console.error("Failed to revoke share:", error);
      toast.add({
        title: "Unable to revoke link",
        description: getErrorMessage(error, "Please try again."),
        type: "error",
      });
    } finally {
      setRevokeLoading(false);
    }
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar
        activeRoot={false}
        activeTrash={false}
        activeSharedByMe
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

        <main className="px-4 pb-10 pt-20 sm:px-6">
          <div className="mx-auto max-w-6xl">
            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <div className="flex items-center gap-2 text-blue-600">
                  <Share2 className="size-5" />
                  <span className="text-sm font-medium">Sharing</span>
                </div>
                <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
                  Shared by me
                </h1>
                <p className="mt-1 text-sm text-slate-500">
                  Manage active links you created for your files and folders.
                </p>
              </div>

              <div className="relative w-full sm:w-72">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search shared links"
                  className="h-10 bg-white pl-9"
                />
              </div>
            </div>

            {loading && shares.length === 0 ? (
              <div className="flex min-h-[45vh] items-center justify-center gap-2 text-sm text-slate-500">
                <Loader2 className="size-4 animate-spin text-blue-600" />
                Loading your shared links...
              </div>
            ) : filteredShares.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
                <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                  <Link2 className="size-6" />
                </div>
                <h2 className="mt-4 text-base font-semibold text-slate-900">
                  {search ? "No matching share links" : "Nothing shared yet"}
                </h2>
                <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-slate-500">
                  {search
                    ? "Try a different file, folder, recipient or permission."
                    : "Use Share link from any file or folder in Home to create your first link."}
                </p>
                {!search ? (
                  <Button
                    className="mt-5 bg-blue-600 hover:bg-blue-700"
                    onClick={() => navigate(`/${user.rootDirectoryId}`)}
                  >
                    Go to Home
                  </Button>
                ) : null}
              </div>
            ) : (
              <div className="space-y-3">
                {filteredShares.map((share) => (
                  <article
                    key={share.id}
                    className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md sm:p-5"
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                      <div className="flex min-w-0 items-start gap-3">
                        <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                          {share.resourceType === "directory" ? (
                            <Folder className="size-5" />
                          ) : (
                            <FileText className="size-5" />
                          )}
                        </div>

                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h2 className="truncate text-sm font-semibold text-slate-900 sm:text-base">
                              {share.resource.name}
                            </h2>
                            <Badge variant="secondary">
                              {share.accessType === "public" ? "Public" : "Restricted"}
                            </Badge>
                            <Badge variant="outline">
                              {share.permission === "editor" ? "Editor" : "Viewer"}
                            </Badge>
                          </div>

                          <p className="mt-1 truncate text-xs text-slate-500">
                            {share.url}
                          </p>

                          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                            <span>{relativeExpiry(share.expiresAt)}</span>
                            <span>{formatExpiry(share.expiresAt)}</span>
                            {share.accessType === "restricted" ? (
                              <span className="inline-flex items-center gap-1">
                                <Users className="size-3.5" />
                                {share.recipients.length} recipient{share.recipients.length === 1 ? "" : "s"}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2 lg:justify-end">
                        <Button variant="outline" size="sm" onClick={() => void handleCopy(share)}>
                          <Clipboard className="size-3.5" />
                          Copy
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => window.open(absoluteUrl(share.url), "_blank", "noopener,noreferrer")}>
                          <ExternalLink className="size-3.5" />
                          Open
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => setEditingShare(share)}>
                          <Pencil className="size-3.5" />
                          Manage
                        </Button>
                        <Button variant="outline" size="sm" className="text-red-600 hover:bg-red-50 hover:text-red-700" onClick={() => setRevokeTarget(share)}>
                          <Trash2 className="size-3.5" />
                          Revoke
                        </Button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>

      <ShareDialog
        open={editingShare !== null}
        onOpenChange={(open) => {
          if (!open) setEditingShare(null);
        }}
        existingShare={editingShare}
        onSaved={(share) => dispatch(upsertMyShare(share))}
      />

      <AlertDialog
        open={revokeTarget !== null}
        onOpenChange={(open) => {
          if (!open && !revokeLoading) setRevokeTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke this share link?</AlertDialogTitle>
            <AlertDialogDescription>
              Anyone using this URL will lose access immediately at the OmniSpace application layer. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={revokeLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={revokeLoading}
              className="bg-red-600 hover:bg-red-700"
              onClick={() => void handleRevoke()}
            >
              {revokeLoading ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
              {revokeLoading ? "Revoking..." : "Revoke link"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Share;
