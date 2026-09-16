import { Menu, Search, Share2 } from "lucide-react";

import type { User } from "../types/user";

interface HeaderProps {
  user: User;
  search: string;
  onSearchChange: (value: string) => void;
  onMenuClick: () => void;
  onProfileClick: () => void;
  onShareClick: () => void;
}

const Header = ({
  user,
  search,
  onSearchChange,
  onMenuClick,
  onProfileClick,
  onShareClick,
}: HeaderProps) => {
  const initials = user.name
    .trim()
    .split(/\s+/)
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <header className="fixed left-0 right-0 top-0 z-40 border-b border-slate-200 bg-white lg:left-64">
      <div className="flex h-[72px] items-center gap-3 px-4 sm:px-6">
        {/* Mobile menu */}
        <button
          type="button"
          onClick={onMenuClick}
          className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
          aria-label="Open menu"
        >
          <Menu size={21} />
        </button>

        {/* Search */}
        <div className="relative min-w-0 flex-1">
          <Search
            size={19}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
          />

          <input
            type="text"
            value={search}
            onChange={(event) =>
              onSearchChange(event.target.value)
            }
            placeholder="Search files and folders"
            className="
              h-11 w-full rounded-xl
              border border-slate-200
              bg-slate-50
              pl-11 pr-4
              text-sm text-slate-900
              outline-none
              placeholder:text-slate-400
              focus:border-blue-500
              focus:bg-white
              focus:ring-2 focus:ring-blue-100
            "
          />
        </div>

        {/* Share */}
        <button
          type="button"
          onClick={onShareClick}
          className="hidden rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800 sm:block"
        >
          <Share2 size={20} />
        </button>

        {/* Profile */}
        <button
          type="button"
          onClick={onProfileClick}
          className="
            flex h-10 w-10 shrink-0
            items-center justify-center
            overflow-hidden rounded-full
            bg-blue-600
            text-xs font-bold text-white
            hover:ring-4 hover:ring-blue-100
          "
        >
          {user.picture ? (
            <img
              src={user.picture}
              alt={user.name}
              className="h-full w-full object-cover"
            />
          ) : (
            initials
          )}
        </button>
      </div>
    </header>
  );
};

export default Header;