import { Navigate, Outlet } from "react-router-dom";
import { useSelector } from "react-redux";
import type { RootState } from "../store/store";
import { Loader2 } from "lucide-react";

const ProtectedRoute = () => {
  const {
    user,
    isCheckingAuth,
  } = useSelector(
    (state: RootState) => state.auth,
  );

  if (isCheckingAuth) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <Loader2 className="size-5 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
};

export default ProtectedRoute;
