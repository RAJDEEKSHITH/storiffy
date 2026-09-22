import {
  HardDrive,
  Home as HomeIcon,
  Share2,
  Trash2,
  Users,
  X,
} from "lucide-react";
import type { User } from "../types/user";
import StorageUsage from "./StorageUsage";
import { Button } from "./ui/button";

interface SidebarProps {
  activeRoot: boolean;
  activeTrash: boolean;
  mobileOpen: boolean;
  user: User;
  onHome: () => void;
  onCloseMobile: () => void;
  onSharedWithMe: () => void;
  onTrash: () => void;
  onSharedByMe?: () => void;
  activeSharedByMe?: boolean;
  activeSharedWithMe?: boolean;
}

const Sidebar = ({
  activeRoot,
  activeTrash,
  mobileOpen,
  onHome,
  onCloseMobile,
  onSharedWithMe,
  onTrash,
  onSharedByMe = () => undefined,
  activeSharedByMe = false,
  activeSharedWithMe = false,
}: SidebarProps) => {
  const handleNavigation = (callback: () => void) => {
    callback();
    onCloseMobile();
  };

  return (
    <>
      {mobileOpen ? (
        <button
          type="button"
          aria-label="Close sidebar"
          onClick={onCloseMobile}
          className="fixed inset-0 z-40 bg-slate-900/20 lg:hidden"
        />
      ) : null}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r bg-white transition-transform duration-200 lg:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-16 shrink-0 items-center justify-between border-b px-4">
          <button type="button" onClick={() => handleNavigation(onHome)} className="flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-lg bg-blue-600 text-white shadow-sm">
              <HardDrive className="size-5" />
            </span>
            <span className="text-base font-semibold tracking-tight text-slate-900">Storiffy</span>
          </button>

          <Button variant="ghost" size="icon" className="lg:hidden" onClick={onCloseMobile} aria-label="Close menu">
            <X className="size-4" />
          </Button>
        </div>

        <nav className="flex-1 p-3">
          <div className="space-y-1">
            <Button
              variant="ghost"
              className={`w-full justify-start gap-3 ${
                activeRoot ? "bg-blue-50 text-blue-600 hover:bg-blue-100" : "text-slate-600 hover:bg-slate-50"
              }`}
              onClick={() => handleNavigation(onHome)}
            >
              <HomeIcon className="size-4" />
              <span>Home</span>
            </Button>

            <Button
              variant="ghost"
              className={`w-full justify-start gap-3 ${
                activeSharedByMe ? "bg-blue-50 text-blue-600 hover:bg-blue-100" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
              onClick={() => handleNavigation(onSharedByMe)}
            >
              <Share2 className="size-4" />
              Shared by me
            </Button>

            <Button
              variant="ghost"
              className={`w-full justify-start gap-3 ${
                activeSharedWithMe ? "bg-blue-50 text-blue-600 hover:bg-blue-100" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
              onClick={() => handleNavigation(onSharedWithMe)}
            >
              <Users className="size-4" />
              Shared with me
            </Button>
            <Button
              variant="ghost"
              className={`w-full justify-start gap-3 ${
                activeTrash ? "bg-blue-50 text-blue-600 hover:bg-blue-100" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
              onClick={() => handleNavigation(onTrash)}
            >
              <Trash2 className="size-4" />
              Trash
            </Button>
          </div>
        </nav>

        <StorageUsage />
      </aside>
    </>
  );
};

export default Sidebar;
