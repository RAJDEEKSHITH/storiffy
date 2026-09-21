import { useLocation, useNavigate } from "react-router-dom";
import { useState } from "react";
import { Share2 } from "lucide-react";
import Header from "../components/Header";
import Sidebar from "../components/Sidebar";
import type { RootState } from "../store/store";
import { useSelector } from "react-redux";
import { Button } from "../components/ui/button";

const Share = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const user = useSelector(
    (state: RootState) => state.auth.user,
  );

  if (!user) return null;

  const sharedItem = location.state as
    | { type: "file" | "directory"; id: string; name?: string }
    | null;

  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar
        activeRoot={false}
        activeTrash={false}
        mobileOpen={mobileOpen}
        user={user}
        onHome={() => navigate(`/${user.rootDirectoryId}`)}
        onCloseMobile={() => setMobileOpen(false)}
        onSharedWithMe={() => console.log("Shared with me API is not implemented yet.")}
        onRecent={() => console.log("Recent API is not implemented yet.")}
        onStarred={() => console.log("Starred API is not implemented yet.")}
        onTrash={() => navigate("/trash")}
      />

      <div className="min-h-screen lg:ml-64">
        <Header
          user={user}
          search=""
          onSearchChange={() => undefined}
          onMenuClick={() => setMobileOpen(true)}
        />

        <main className="px-4 pb-8 pt-20 sm:px-6">
          <div className="mx-auto max-w-3xl">
            <div className="rounded-xl border bg-white p-8 text-center shadow-sm">
              <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                <Share2 className="size-7" />
              </div>
              <h1 className="mt-5 text-2xl font-semibold text-slate-900">
                Sharing
              </h1>
              <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-500">
                Sharing and public-link creation are reserved for the next integration step.
              </p>

              {sharedItem ? (
                <p className="mt-4 text-sm text-slate-600">
                  Selected {sharedItem.type}: {sharedItem.name ?? sharedItem.id}
                </p>
              ) : null}

              <Button
                className="mt-6 bg-blue-600 hover:bg-blue-700"
                onClick={() => navigate(`/${user.rootDirectoryId}`)}
              >
                Back to Home
              </Button>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default Share;
