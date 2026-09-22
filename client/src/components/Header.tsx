import {
  LogOut,
  Menu,
  Search,
  Share2,
  UserRound,
} from "lucide-react";
import { useState } from "react";
import { useDispatch } from "react-redux";
import { useLocation, useNavigate } from "react-router-dom";

import {
  logoutAllUsers,
  logoutUser,
} from "../api/authApi";
import { getErrorMessage } from "../lib/error";
import { clearUser } from "../store/auth/authSlice";
import type { AppDispatch } from "../store/store";
import type { User } from "../types/user";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Button } from "./ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { Input } from "./ui/input";
import { toast } from "./ui/toast";

interface HeaderProps {
  user: User;
  search: string;
  onSearchChange: (value: string) => void;
  onMenuClick: () => void;
}

const Header = ({
  user,
  search,
  onSearchChange,
  onMenuClick,
}: HeaderProps) => {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const location = useLocation();

  const [logoutLoading, setLogoutLoading] =
    useState(false);
  const [logoutAllLoading, setLogoutAllLoading] =
    useState(false);

  const initials =
    user.name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "U";

  const handleLogout = async () => {
    setLogoutLoading(true);

    try {
      await logoutUser();

      dispatch(clearUser());

      toast.add({
        title: "Signed out",
        type: "success",
      });

      navigate("/login", {
        replace: true,
      });
    } catch (error) {
      console.error(
        "Failed to sign out:",
        error,
      );

      toast.add({
        title: "Unable to sign out",
        description: getErrorMessage(
          error,
          "Please try again.",
        ),
        type: "error",
      });
    } finally {
      setLogoutLoading(false);
    }
  };

  const handleLogoutAll = async () => {
    setLogoutAllLoading(true);

    try {
      await logoutAllUsers();

      dispatch(clearUser());

      toast.add({
        title: "Signed out on all devices",
        type: "success",
      });

      navigate("/login", {
        replace: true,
      });
    } catch (error) {
      console.error(
        "Failed to sign out on all devices:",
        error,
      );

      toast.add({
        title:
          "Unable to sign out on all devices",
        description: getErrorMessage(
          error,
          "Please try again.",
        ),
        type: "error",
      });
    } finally {
      setLogoutAllLoading(false);
    }
  };

  const handleShareNavigation = () => {
    if (location.pathname !== "/share") {
      navigate("/share");
    }
  };

  return (
    <header className="fixed inset-x-0 top-0 z-30 h-16 border-b bg-white/95 backdrop-blur lg:left-64">
      <div className="flex h-full items-center gap-3 px-4 sm:px-6">
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          onClick={onMenuClick}
          aria-label="Open menu"
        >
          <Menu className="size-5" />
        </Button>

        <div className="w-full max-w-xl">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />

            <Input
              value={search}
              onChange={(event) =>
                onSearchChange(
                  event.target.value,
                )
              }
              placeholder="Search files and folders"
              className="h-10 rounded-lg border-slate-200 bg-slate-50 pl-9 focus-visible:border-blue-600 focus-visible:ring-blue-600/20"
            />
          </div>
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="text-slate-600 hover:bg-blue-50 hover:text-blue-600"
            onClick={
              handleShareNavigation
            }
            aria-label="Shared links"
            title="Shared links"
          >
            <Share2 className="size-5" />
          </Button>

          <div className="h-7 w-px bg-slate-200" />

          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  className="size-10 rounded-full p-0 hover:bg-slate-100"
                  aria-label="Open profile menu"
                />
              }
            >
              <Avatar className="size-9">
                {user.picture ? (
                  <AvatarImage
                    src={user.picture}
                    alt={user.name}
                  />
                ) : null}

                <AvatarFallback className="bg-blue-50 text-blue-600">
                  {user.picture ? (
                    initials
                  ) : (
                    <UserRound className="size-4" />
                  )}
                </AvatarFallback>
              </Avatar>
            </DropdownMenuTrigger>

            <DropdownMenuContent
              align="end"
              sideOffset={8}
              className="w-64"
            >
              <DropdownMenuGroup>
                <DropdownMenuLabel>
                  <div className="truncate text-sm font-semibold text-foreground">
                    {user.name}
                  </div>

                  <div className="truncate text-xs font-normal text-muted-foreground">
                    {user.email}
                  </div>
                </DropdownMenuLabel>

                <DropdownMenuItem
                  onClick={() => {
                    // Future API: profile/settings page.
                    console.log(
                      "Profile settings API is not implemented yet.",
                    );
                  }}
                >
                  <UserRound className="size-4 text-blue-600" />
                  Profile
                </DropdownMenuItem>
              </DropdownMenuGroup>

              <DropdownMenuSeparator />

              <DropdownMenuGroup>
                <DropdownMenuItem
                  disabled={
                    logoutLoading ||
                    logoutAllLoading
                  }
                  onClick={() =>
                    void handleLogout()
                  }
                >
                  <LogOut className="size-4 text-blue-600" />

                  {logoutLoading
                    ? "Signing out..."
                    : "Sign out"}
                </DropdownMenuItem>

                <DropdownMenuItem
                  disabled={
                    logoutLoading ||
                    logoutAllLoading
                  }
                  onClick={() =>
                    void handleLogoutAll()
                  }
                  className="text-red-600 data-[highlighted]:bg-red-50 data-[highlighted]:text-red-700"
                >
                  <LogOut className="size-4 text-red-600" />

                  {logoutAllLoading
                    ? "Signing out everywhere..."
                    : "Sign out all devices"}
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
};

export default Header;