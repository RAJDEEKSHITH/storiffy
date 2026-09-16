import { Navigate, Outlet } from "react-router-dom";
import { useSelector } from "react-redux";
import type { RootState } from "../store/store";

export default function ProtectedRoute() {
  const { user, isCheckingAuth } = useSelector(
    (state: RootState) => state.auth
  );
  // We are still checking the existing session.
  // Do not redirect yet.
  if (isCheckingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  // Auth check is finished and there is no user.
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // User is authenticated.
  return <Outlet />;
}