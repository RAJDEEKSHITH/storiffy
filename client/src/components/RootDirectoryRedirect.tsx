import { Navigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { Loader2 } from "lucide-react";
import type { RootState } from "../store/store";

const RootDirectoryRedirect = () => {
  const user = useSelector(
    (state: RootState) => state.auth.user,
  );

  if (!user) return null;

  return (
    <div className="flex min-h-screen items-center justify-center bg-white">
      <Loader2 className="size-5 animate-spin text-blue-600" />
      <Navigate
        to={`/${user.rootDirectoryId}`}
        replace
      />
    </div>
  );
};

export default RootDirectoryRedirect;
