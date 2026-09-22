import type { ShareLinkI } from "../../models/share-link.model.js";
import { AppError } from "../../utils/app.error.js";
import { getSharedDirectoryItems } from "../directory/directory.service.js";
import { getFileSignedUrl } from "../file/file.service.js";
import {
  assertDirectoryShareTarget,
  assertFileShareTarget,
  assertOwnerResourceStillValid,
  resolveShareLinkByToken,
} from "./share-authorization.service.js";

const serializeFile = (file: {
  _id: { toString(): string };
  name: string;
  mimeType: string;
  size: number;
}) => ({
  _id: file._id.toString(),
  name: file.name,
  mimeType: file.mimeType,
  size: file.size,
});

const serializeDirectory = (
  directory: {
    _id: { toString(): string };
    name: string;
    parentDirectoryId:
      | { toString(): string }
      | null;
    size: number;
  },
  sharedRootId: string,
) => ({
  _id: directory._id.toString(),
  name: directory.name,
  parentDirectoryId:
    directory._id.toString() === sharedRootId
      ? null
      : directory.parentDirectoryId?.toString() ?? null,
  size: directory.size,
});

const serializeShare = (share: ShareLinkI) => ({
  id: share._id.toString(),
  token: share.token,
  resourceType: share.resourceType,
  resourceId: share.resourceId.toString(),
  accessType: share.accessType,
  permission: share.permission,
  expiresAt: share.expiresAt,
});

const getPublicShare = (token: string) =>
  resolveShareLinkByToken({
    token,
    expectedAccessType: "public",
  });

export const resolvePublicShare = async (token: string) => {
  const { share } = await getPublicShare(token);

  const resource = await assertOwnerResourceStillValid({
    ownerId: share.ownerId.toString(),
    resourceType: share.resourceType,
    resourceId: share.resourceId,
  });

  if (share.resourceType === "file") {
    const signed = await getFileSignedUrl({
      userId: share.ownerId.toString(),
      fileId: share.resourceId.toString(),
      download: false,
    });

    return {
      share: serializeShare(share),
      file: serializeFile(resource as any),
      url: signed.url,
    };
  }

  const data = await getSharedDirectoryItems({
    ownerId: share.ownerId.toString(),
    sharedRootDirectoryId: share.resourceId.toString(),
    currentDirectoryId: share.resourceId.toString(),
  });

  return {
    share: serializeShare(share),
    directory: serializeDirectory(
      data.directory,
      share.resourceId.toString(),
    ),
    directories: data.directories.map((directory: any) =>
      serializeDirectory(directory, share.resourceId.toString()),
    ),
    files: data.files.map(serializeFile),
    breadcrumbs: data.breadcrumbs,
  };
};

export const browsePublicDirectory = async ({
  token,
  directoryId,
}: {
  token: string;
  directoryId: string;
}) => {
  const { share } = await getPublicShare(token);

  if (share.resourceType !== "directory") {
    throw new AppError(
      "This share does not grant directory browsing",
      404,
    );
  }

  await assertDirectoryShareTarget({ share, directoryId });

  const data = await getSharedDirectoryItems({
    ownerId: share.ownerId.toString(),
    sharedRootDirectoryId: share.resourceId.toString(),
    currentDirectoryId: directoryId,
  });

  return {
    share: serializeShare(share),
    directory: serializeDirectory(
      data.directory,
      share.resourceId.toString(),
    ),
    directories: data.directories.map((directory: any) =>
      serializeDirectory(directory, share.resourceId.toString()),
    ),
    files: data.files.map(serializeFile),
    breadcrumbs: data.breadcrumbs,
  };
};

export const viewPublicFile = async ({
  token,
  fileId,
}: {
  token: string;
  fileId: string;
}) => {
  const { share } = await getPublicShare(token);
  const file = await assertFileShareTarget({ share, fileId });

  const signed = await getFileSignedUrl({
    userId: share.ownerId.toString(),
    fileId: file._id.toString(),
    download: false,
  });

  return {
    share: serializeShare(share),
    file: serializeFile(file),
    url: signed.url,
  };
};

export const downloadPublicFile = async ({
  token,
  fileId,
}: {
  token: string;
  fileId: string;
}) => {
  const { share } = await getPublicShare(token);
  const file = await assertFileShareTarget({ share, fileId });

  const signed = await getFileSignedUrl({
    userId: share.ownerId.toString(),
    fileId: file._id.toString(),
    download: true,
  });

  return {
    share: serializeShare(share),
    file: serializeFile(file),
    url: signed.url,
  };
};
