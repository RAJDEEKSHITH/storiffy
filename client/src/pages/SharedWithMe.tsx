import {
  ExternalLink,
  FileText,
  Folder,
  Loader2,
  Search,
  Share2,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { getSharedWithMe } from "../api/shareLinkApi";
import Header from "../components/Header";
import Sidebar from "../components/Sidebar";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { toast } from "../components/ui/toast";
import { setSharedWithMe, setSharedWithMeLoading } from "../store/share/shareSlice";
import { getErrorMessage } from "../lib/error";
import type { AppDispatch, RootState } from "../store/store";
import type { SharedWithMeShare } from "../types/share-link";

const absoluteUrl = (url: string) =>
  url.startsWith("http") ? url : `${window.location.origin}${url}`;

const SharedWithMe = () => {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const user = useSelector((state: RootState) => state.auth.user);
  const shares = useSelector((state: RootState) => state.share.sharedWithMe);
  const loading = useSelector((state: RootState) => state.share.sharedWithMeLoading);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [search, setSearch] = useState("");

  const loadShares = useCallback(async () => {
    if (!user) return;
    dispatch(setSharedWithMeLoading(true));
    try {
      dispatch(setSharedWithMe(await getSharedWithMe()));
    } catch (error) {
      console.error("Failed to load shares with me:", error);
      toast.add({
        title: "Unable to refresh shared items",
        description: getErrorMessage(error, "Please try again."),
        type: "error",
      });
    } finally {
      dispatch(setSharedWithMeLoading(false));
    }
  }, [dispatch, user]);

  useEffect(() => {
    void loadShares();
  }, [loadShares]);

  const filteredShares = useMemo(() => {
    const value = search.trim().toLowerCase();
    if (!value) return shares;

    return shares.filter((share) =>
      `${share.resource.name} ${share.owner.name} ${share.owner.email} ${share.permission}`
        .toLowerCase()
        .includes(value),
    );
  }, [search, shares]);

  if (!user) return null;

  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar
        activeRoot={false}
        activeTrash={false}
        activeSharedByMe={false}
        activeSharedWithMe
        mobileOpen={mobileOpen}
        user={user}
        onHome={() => navigate(`/${user.rootDirectoryId}`)}
        onCloseMobile={() => setMobileOpen(false)}
        onSharedByMe={() => navigate("/share")}
        onSharedWithMe={() => navigate("/shared-with-me")}
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
                  <span className="text-sm font-medium">Collaboration</span>
                </div>
                <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
                  Shared with me
                </h1>
                <p className="mt-1 text-sm text-slate-500">
                  Files and folders other Storiffy users shared with you.
                </p>
              </div>

              <div className="relative w-full sm:w-72">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search shared items"
                  className="h-10 bg-white pl-9"
                />
              </div>
            </div>

            {loading && shares.length === 0 ? (
              <div className="flex min-h-[45vh] items-center justify-center gap-2 text-sm text-slate-500">
                <Loader2 className="size-4 animate-spin text-blue-600" />
                Loading shared items...
              </div>
            ) : filteredShares.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
                <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                  <Users className="size-6" />
                </div>
                <h2 className="mt-4 text-base font-semibold text-slate-900">
                  {search ? "No matching items" : "Nothing has been shared with you"}
                </h2>
                <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-slate-500">
                  Active restricted links that include your account will appear here.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredShares.map((share: SharedWithMeShare) => (
                  <article
                    key={share.id}
                    className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
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
                              {share.permission === "editor" ? "Editor" : "Viewer"}
                            </Badge>
                          </div>
                          <p className="mt-1 text-xs text-slate-500">
                            Shared by {share.owner.name} · {share.owner.email}
                          </p>
                          <p className="mt-1 text-xs text-slate-400">
                            Expires {new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(share.expiresAt))}
                          </p>
                        </div>
                      </div>

                      <Button
                        size="sm"
                        className="bg-blue-600 hover:bg-blue-700"
                        onClick={() => window.open(absoluteUrl(share.url), "_self")}
                      >
                        <ExternalLink className="size-3.5" />
                        Open
                      </Button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default SharedWithMe;
