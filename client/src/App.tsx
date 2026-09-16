import { useEffect } from "react";
import { useDispatch } from "react-redux";
import { RouterProvider } from "react-router-dom";

import router from "./routes";
import { getCurrentUser } from "./api/authApi";
import {
  clearUser,
  finishAuthCheck,
  setUser,
} from "./store/auth/authSlice";

import type { AppDispatch } from "./store/store";

const App = () => {
  const dispatch = useDispatch<AppDispatch>();

  useEffect(() => {
    const checkAuthentication = async () => {
      try {
        const user = await getCurrentUser();
        dispatch(setUser(user));
      } catch {
        dispatch(clearUser());
      } finally {
        dispatch(finishAuthCheck());
      }
    };

    checkAuthentication();
  }, [dispatch]);

  return <RouterProvider router={router} />;
};

export default App;