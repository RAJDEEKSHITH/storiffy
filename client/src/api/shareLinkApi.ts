import api from "./axios";
import type {
  CreatePublicShareRequest,
  CreateRestrictedShareRequest,
  ShareLink,
  ShareRecipientLookup,
  SharedWithMeShare,
  UpdateShareLinkRequest,
} from "../types/share-link";

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

export const createPublicShare = async (
  body: CreatePublicShareRequest,
): Promise<ShareLink> => {
  const response = await api.post<ApiResponse<ShareLink>>(
    "/share-links/public",
    body,
  );

  return response.data.data;
};

export const createRestrictedShare = async (
  body: CreateRestrictedShareRequest,
): Promise<ShareLink> => {
  const response = await api.post<ApiResponse<ShareLink>>(
    "/share-links/restricted",
    body,
  );

  return response.data.data;
};

export const lookupShareRecipient = async (
  email: string,
): Promise<ShareRecipientLookup> => {
  const response = await api.get<
    ApiResponse<ShareRecipientLookup>
  >("/share-links/recipients/lookup", {
    params: { email },
  });

  return response.data.data;
};

export const getShareLink = async (
  shareId: string,
): Promise<ShareLink> => {
  const response = await api.get<ApiResponse<ShareLink>>(
    `/share-links/${shareId}`,
  );

  return response.data.data;
};

export const updateShareLink = async (
  shareId: string,
  body: UpdateShareLinkRequest,
): Promise<ShareLink> => {
  const response = await api.patch<ApiResponse<ShareLink>>(
    `/share-links/${shareId}`,
    body,
  );

  return response.data.data;
};

export const revokeShareLink = async (
  shareId: string,
): Promise<{ shareId: string; revoked: true }> => {
  const response = await api.delete<
    ApiResponse<{ shareId: string; revoked: true }>
  >(`/share-links/${shareId}`);

  return response.data.data;
};

export const getMyShares = async (): Promise<ShareLink[]> => {
  const response = await api.get<
    ApiResponse<ShareLink[]>
  >("/share-links/mine");

  return response.data.data;
};

export const getSharedWithMe = async (): Promise<SharedWithMeShare[]> => {
  const response = await api.get<
    ApiResponse<SharedWithMeShare[]>
  >("/share-links/shared-with-me");

  return response.data.data;
};
