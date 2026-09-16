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
        state.user.storageUsedInBytes = action.payload;
      }
    },

    updateUserPicture: (
      state,
      action: PayloadAction<string | null>,
    ) => {
      if (state.user) {
        state.user.picture = action.payload;
      }
    },
  },
});

export const {
  setUser,
  clearUser,
  finishAuthCheck,
  updateStorageUsed,
  updateUserPicture,
} = authSlice.actions;

export default authSlice.reducer;