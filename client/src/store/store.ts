import { configureStore } from "@reduxjs/toolkit";

import authReducer from "./auth/authSlice";
import shareReducer from "./share/shareSlice";

export const store = configureStore({
  reducer: {
    auth: authReducer,
       share: shareReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;