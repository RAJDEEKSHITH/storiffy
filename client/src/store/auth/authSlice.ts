import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { User } from "../../types/user";

interface AuthState {
  user: User | null;
  isCheckingAuth: boolean;
}

const initialState: AuthState = {
  user: null,
  isCheckingAuth: true,
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setUser: (state, action: PayloadAction<User>) => {
      state.user = action.payload;
    },
    clearUser: (state) => {
      state.user = null;
    },
    finishAuthCheck: (state) => {
      state.isCheckingAuth = false;
    },
    updateStorageUsed: (
      state,
      action: PayloadAction<number>,
    ) => {
      if (state.user) {
        state.user.storageUsedInBytes = Math.max(
          0,
          action.payload,
        );
      }
    },
    decrementStorageUsed: (
      state,
      action: PayloadAction<number>,
    ) => {
      if (state.user) {
        state.user.storageUsedInBytes = Math.max(
          0,
          state.user.storageUsedInBytes -
            Math.max(0, action.payload),
        );
      }
    },
  },
});

export const {
  setUser,
  clearUser,
  finishAuthCheck,
  updateStorageUsed,
  decrementStorageUsed,
} = authSlice.actions;

export default authSlice.reducer;
