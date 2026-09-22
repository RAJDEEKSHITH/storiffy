import { useEffect } from "react";
import { useDispatch } from "react-redux";
import { RouterProvider } from "react-router-dom";

import { getCurrentUser } from "./api/authApi";
import router from "./routes";
import {
  clearUser,
  finishAuthCheck,
  setUser,
} from "./store/auth/authSlice";
import type { AppDispatch } from "./store/store";
import { Toaster } from "./components/ui/toast";

const App = () => {
  const dispatch = useDispatch<AppDispatch>();

  useEffect(() => {
    const checkAuthentication =
      async () => {
        try {
          const user =
            await getCurrentUser();
          dispatch(setUser(user));
        } catch (error) {
          console.log(
            "No active session found.",
            error,
          );
          dispatch(clearUser());
        } finally {
          dispatch(finishAuthCheck());
        }
      };

    void checkAuthentication();
  }, [dispatch]);

  return (
    <>
      <RouterProvider router={router} />
      <Toaster />
    </>
  );
};

export default App;