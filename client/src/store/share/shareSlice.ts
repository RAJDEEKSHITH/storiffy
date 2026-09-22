import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { ShareLink, SharedWithMeShare } from "../../types/share-link";

interface SharesState {
  myShares: ShareLink[];
  sharedWithMe: SharedWithMeShare[];
  mySharesLoading: boolean;
  sharedWithMeLoading: boolean;
}

const initialState: SharesState = {
  myShares: [],
  sharedWithMe: [],
  mySharesLoading: false,
  sharedWithMeLoading: false,
};

const shareSlice = createSlice({
  name: "shares",
  initialState,
  reducers: {
    setMySharesLoading: (state, action: PayloadAction<boolean>) => {
      state.mySharesLoading = action.payload;
    },
    setSharedWithMeLoading: (state, action: PayloadAction<boolean>) => {
      state.sharedWithMeLoading = action.payload;
    },
    setMyShares: (state, action: PayloadAction<ShareLink[]>) => {
      state.myShares = action.payload;
    },
    setSharedWithMe: (
      state,
      action: PayloadAction<SharedWithMeShare[]>,
    ) => {
      state.sharedWithMe = action.payload;
    },
    upsertMyShare: (state, action: PayloadAction<ShareLink>) => {
      const next = action.payload;
      const index = state.myShares.findIndex(
        (share) => share.id === next.id,
      );

      if (index === -1) {
        state.myShares.unshift(next);
      } else {
        state.myShares[index] = next;
      }
    },
    removeMyShare: (state, action: PayloadAction<string>) => {
      state.myShares = state.myShares.filter(
        (share) => share.id !== action.payload,
      );
    },
    clearShares: (state) => {
      state.myShares = [];
      state.sharedWithMe = [];
    },
  },
});

export const {
  setMySharesLoading,
  setSharedWithMeLoading,
  setMyShares,
  setSharedWithMe,
  upsertMyShare,
  removeMyShare,
  clearShares,
} = shareSlice.actions;

export default shareSlice.reducer;
