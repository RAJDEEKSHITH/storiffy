export type ShareResourceType = "file" | "directory";
export type ShareAccessType = "public" | "restricted";
export type SharePermission = "viewer" | "editor";

export type ShareDuration =
  | "1h"
  | "3h"
  | "5h"
  | "12h"
  | "1d"
  | "3d"
  | "5d"
  | "7d";

export interface ShareDurationOption {
  value: ShareDuration;
  label: string;
}

export const HOUR_DURATIONS: ShareDurationOption[] = [
  { value: "1h", label: "1 hour" },
  { value: "3h", label: "3 hours" },
  { value: "5h", label: "5 hours" },
  { value: "12h", label: "12 hours" },
];

export const DAY_DURATIONS: ShareDurationOption[] = [
  { value: "1d", label: "1 day" },
  { value: "3d", label: "3 days" },
  { value: "5d", label: "5 days" },
  { value: "7d", label: "7 days" },
];

export interface ShareTarget {
  type: ShareResourceType;
  id: string;
  name: string;
}

export interface ShareRecipient {
  // Kept optional for compatibility with existing API responses.
  // Share creation/update uses email addresses, not this identifier.
  _id?: string;
  name: string;
  email: string;
  status?: string;
}

export interface ShareRecipientLookup {
  name: string;
  email: string;
}

export interface ShareResourceSummary {
  _id: string;
  name: string;
  size: number;
  type: ShareResourceType;
  mimeType?: string;
}

export interface ShareLink {
  id: string;
  token: string;
  url: string;
  resourceType: ShareResourceType;
  resourceId: string;
  accessType: ShareAccessType;
  permission: SharePermission;
  expiresAt: string;
  createdAt?: string;
  updatedAt?: string;
  recipients: ShareRecipient[];
  resource: ShareResourceSummary;
}

export interface SharedWithMeShare extends ShareLink {
  owner: {
    _id: string;
    name: string;
    email: string;
  };
}

export interface SharedFile {
  _id: string;
  name: string;
  mimeType: string;
  size: number;
  createdAt?: string;
  updatedAt?: string;
  canDelete?: boolean;
}

export interface SharedDirectory {
  _id: string;
  name: string;
  parentDirectoryId: string | null;
  size: number;
  createdAt?: string;
  updatedAt?: string;
  canDelete?: boolean;
}

export interface SharedBreadcrumb {
  id: string;
  name: string;
}

export interface SharedDirectoryResponse {
  success: boolean;
  message: string;
  data: {
    share: Pick<
      ShareLink,
      | "id"
      | "token"
      | "resourceType"
      | "resourceId"
      | "accessType"
      | "permission"
      | "expiresAt"
    >;
    directory: SharedDirectory;
    directories: SharedDirectory[];
    files: SharedFile[];
    breadcrumbs: SharedBreadcrumb[];
    recipient?: ShareRecipient;
  };
}

export interface SharedFileResponse {
  success: boolean;
  message: string;
  data: {
    share: Pick<
      ShareLink,
      | "id"
      | "token"
      | "resourceType"
      | "resourceId"
      | "accessType"
      | "permission"
      | "expiresAt"
    >;
    file: SharedFile;
    url: string;
    recipient?: ShareRecipient;
  };
}

export interface SharedMutationResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

export interface SharedUploadInitiateData {
  share: Pick<
    ShareLink,
    | "id"
    | "token"
    | "resourceType"
    | "resourceId"
    | "accessType"
    | "permission"
    | "expiresAt"
  >;
  uploadType: "single" | "multipart";
  fileId: string;
  storageKey: string;
  uploadUrl?: string;
  uploadId?: string;
  partSize?: number;
  totalParts?: number;
}

export interface SharedPartUrlData {
  partNumber: number;
  uploadUrl: string;
}

export interface CreatePublicShareRequest {
  resourceType: ShareResourceType;
  resourceId: string;
  duration: ShareDuration;
}

export interface CreateRestrictedShareRequest {
  resourceType: ShareResourceType;
  resourceId: string;
  permission: SharePermission;
  recipientEmails: string[];
  duration: ShareDuration;
}

export interface UpdateShareLinkRequest {
  accessType?: ShareAccessType;
  permission?: SharePermission;
  recipientEmails?: string[];
  duration?: ShareDuration;
}
