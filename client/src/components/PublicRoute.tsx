import { Navigate, Outlet } from "react-router-dom";
import { useSelector } from "react-redux";

import type { RootState } from "../store/store";

const PublicRoute = () => {
  const {
    user,
    isCheckingAuth,
  } = useSelector(
    (state: RootState) => state.auth,
  );

  // Wait until App.tsx finishes checking
  // whether an existing session exists.
  if (isCheckingAuth) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-slate-500">
          Loading...
        </p>
      </div>
    );
  }

  // Already logged in.
  // Don't allow login/register pages.
  if (user) {
    return (
      <Navigate
        to="/"
        replace
      />
    );
  }

  // Not authenticated.
  // Allow login/register.
  return <Outlet />;
};

export default PublicRoute;