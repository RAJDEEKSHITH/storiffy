import {
  Clock3,
  HardDrive,
  Home as HomeIcon,
  Share2,
  Star,
  Trash2,
  X,
} from "lucide-react";

import type { User } from "../types/user";
import StorageUsage from "./StorageUsage";
import { useSelector } from "react-redux";
import type { RootState } from "@reduxjs/toolkit/query";

interface SidebarProps {
  activeRoot: boolean;
  mobileOpen: boolean;
  user: User;
  onHome: () => void;
  onCloseMobile: () => void;
  onSharedWithMe?: () => void;
  onRecent?: () => void;
  onStarred?: () => void;
  onTrash?: () => void;
}

const Sidebar = ({
  activeRoot,
  mobileOpen,
  user,
  onHome,
  onCloseMobile,
  onSharedWithMe,
  onRecent,
  onStarred,
  onTrash,
}: SidebarProps) => {
  const handleNavigation = (callback?: () => void) => {
    callback?.();
    onCloseMobile();
  };

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <button
          type="button"
          aria-label="Close sidebar"
          onClick={onCloseMobile}
          className="fixed inset-0 z-40 bg-slate-900/20 lg:hidden"
        />
      )}

      <aside
        className={`
          fixed inset-y-0 left-0 z-50
          flex w-64 flex-col
          border-r border-slate-200
          bg-white
          transition-transform duration-200
          lg:translate-x-0
          ${mobileOpen ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        {/* Logo */}
        <div className="flex h-[72px] shrink-0 items-center justify-between border-b border-slate-200 px-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white">
              <HardDrive size={20} />
            </div>

            <span className="text-lg font-bold tracking-tight text-slate-900">
              OmniSpace
            </span>
          </div>

          <button
            type="button"
            onClick={onCloseMobile}
            className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 lg:hidden"
            aria-label="Close menu"
          >
            <X size={20} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <div className="space-y-1">
            {/* Home */}
            <button
              type="button"
              onClick={() => handleNavigation(onHome)}
              className={`
                flex w-full items-center gap-3 rounded-xl
                px-3 py-2.5
                text-sm font-medium
                transition
                ${
                  activeRoot
                    ? "bg-blue-50 text-blue-600"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }
              `}
            >
              <HomeIcon size={19} />
              <span>Home</span>
            </button>

            {/* Shared with me */}
            <button
              type="button"
              onClick={() =>
                handleNavigation(onSharedWithMe)
              }
              className="
                flex w-full items-center gap-3
                rounded-xl px-3 py-2.5
                text-sm font-medium
                text-slate-600
                transition
                hover:bg-slate-50
                hover:text-slate-900
              "
            >
              <Share2 size={19} />
              <span>Shared with me</span>
            </button>

            {/* Recent */}
            <button
              type="button"
              onClick={() =>
                handleNavigation(onRecent)
              }
              className="
                flex w-full items-center gap-3
                rounded-xl px-3 py-2.5
                text-sm font-medium
                text-slate-600
                transition
                hover:bg-slate-50
                hover:text-slate-900
              "
            >
              <Clock3 size={19} />
              <span>Recent</span>
            </button>

            {/* Starred */}
            <button
              type="button"
              onClick={() =>
                handleNavigation(onStarred)
              }
              className="
                flex w-full items-center gap-3
                rounded-xl px-3 py-2.5
                text-sm font-medium
                text-slate-600
                transition
                hover:bg-slate-50
                hover:text-slate-900
              "
            >
              <Star size={19} />
              <span>Starred</span>
            </button>

            {/* Trash */}
            <button
              type="button"
              onClick={() =>
                handleNavigation(onTrash)
              }
              className="
                flex w-full items-center gap-3
                rounded-xl px-3 py-2.5
                text-sm font-medium
                text-slate-600
                transition
                hover:bg-slate-50
                hover:text-slate-900
              "
            >
              <Trash2 size={19} />
              <span>Trash</span>
            </button>
          </div>
        </nav>

        {/* Storage */}
        <div className="shrink-0 border-t border-slate-200 pt-4">
          <StorageUsage
            used={user.storageUsedInBytes}
            limit={user.maxStorageLimitInBytes}
          />
        </div>
      </aside>
    </>
  );
};

export default Sidebar;