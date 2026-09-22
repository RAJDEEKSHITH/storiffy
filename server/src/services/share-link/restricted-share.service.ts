import Directory from "../../models/directory.model.js";
import type { ShareLinkI } from "../../models/share-link.model.js";
import { AppError } from "../../utils/app.error.js";
import {
  getSharedDirectoryItems,
  createDirectory,
  renameDirectory,
  assertSharedDirectoryDeletionSafe,
  softDeleteDirectory,
} from "../directory/directory.service.js";
import {
  completeMultipartFileUploadAsCreator,
  completeSingleFileUploadAsCreator,
  getFileSignedUrl,
  getMultipartPartUploadUrlAsCreator,
  initiateMultipartUploadService,
  initiateSingleUpload,
  renameSharedFile,
  softDeleteFileAsCreator,
  abortFileUploadAsCreator,
} from "../file/file.service.js";
import {
  assertDirectoryShareTarget,
  assertEditorPermission,
  assertFileShareTarget,
  assertOwnerResourceStillValid,
  assertRestrictedRecipient,
  assertSharedRootIsNotTarget,
  assertSharedUploadTarget,
  resolveShareLinkByToken,
} from "./share-authorization.service.js";

const MULTIPART_THRESHOLD = 100 * 1024 * 1024;

const serializeFile = (
  file: any,
  actorId: string,
  deleteAllowed = true,
) => ({
  _id: file._id.toString(),
  name: file.name,
  mimeType: file.mimeType,
  size: file.size,
  createdAt: file.createdAt,
  updatedAt: file.updatedAt,
  ...(file.createdBy !== undefined
    ? {
        canDelete:
          deleteAllowed &&
          file.createdBy.toString() === actorId,
      }
    : {}),
});

const serializeDirectory = (
  directory: any,
  sharedRootId: string,
  actorId: string,
) => ({
  _id: directory._id.toString(),
  name: directory.name,
  parentDirectoryId:
    directory._id.toString() === sharedRootId
      ? null
      : directory.parentDirectoryId?.toString() ?? null,
  size: directory.size,
  createdAt: directory.createdAt,
  updatedAt: directory.updatedAt,
  ...(directory.createdBy !== undefined
    ? {
        canDelete:
          directory._id.toString() !== sharedRootId &&
          directory.createdBy.toString() === actorId,
      }
    : {}),
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

const resolveRestricted = async ({
  token,
  userId,
}: {
  token: string;
  userId: string;
}) => {
  const resolved = await resolveShareLinkByToken({
    token,
    expectedAccessType: "restricted",
  });

  const user = await assertRestrictedRecipient({
    share: resolved.share,
    userId,
  });

  return {
    ...resolved,
    user,
  };
};

const getDirectoryResponse = async ({
  share,
  actorId,
  directoryId,
}: {
  share: ShareLinkI;
  actorId: string;
  directoryId: string;
}) => {
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
      actorId,
    ),
    directories: data.directories.map((directory: any) =>
      serializeDirectory(
        directory,
        share.resourceId.toString(),
        actorId,
      ),
    ),
    files: data.files.map((file: any) =>
      serializeFile(file, actorId),
    ),
    breadcrumbs: data.breadcrumbs,
  };
};

export const resolveRestrictedShare = async ({
  token,
  userId,
}: {
  token: string;
  userId: string;
}) => {
  const { share, user } = await resolveRestricted({ token, userId });

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
      recipient: {
        _id: user._id.toString(),
        name: user.name,
        email: user.email,
      },
      file: serializeFile(resource, user._id.toString(), false),
      url: signed.url,
    };
  }

  return {
    ...(await getDirectoryResponse({
      share,
      actorId: user._id.toString(),
      directoryId: share.resourceId.toString(),
    })),
    recipient: {
      _id: user._id.toString(),
      name: user.name,
      email: user.email,
    },
  };
};

export const browseRestrictedDirectory = async ({
  token,
  userId,
  directoryId,
}: {
  token: string;
  userId: string;
  directoryId: string;
}) => {
  const { share, user } = await resolveRestricted({ token, userId });

  if (share.resourceType !== "directory") {
    throw new AppError(
      "This share does not grant directory browsing",
      404,
    );
  }

  return getDirectoryResponse({
    share,
    actorId: user._id.toString(),
    directoryId,
  });
};

export const viewRestrictedFile = async ({
  token,
  userId,
  fileId,
}: {
  token: string;
  userId: string;
  fileId: string;
}) => {
  const { share, user } = await resolveRestricted({ token, userId });
  const file = await assertFileShareTarget({ share, fileId });

  const signed = await getFileSignedUrl({
    userId: share.ownerId.toString(),
    fileId: file._id.toString(),
    download: false,
  });

  return {
    share: serializeShare(share),
    recipient: {
      _id: user._id.toString(),
      name: user.name,
      email: user.email,
    },
    file: serializeFile(
      file,
      user._id.toString(),
      share.resourceType === "directory",
    ),
    url: signed.url,
  };
};

export const downloadRestrictedFile = async ({
  token,
  userId,
  fileId,
}: {
  token: string;
  userId: string;
  fileId: string;
}) => {
  const { share, user } = await resolveRestricted({ token, userId });
  const file = await assertFileShareTarget({ share, fileId });

  const signed = await getFileSignedUrl({
    userId: share.ownerId.toString(),
    fileId: file._id.toString(),
    download: true,
  });

  return {
    share: serializeShare(share),
    recipient: {
      _id: user._id.toString(),
      name: user.name,
      email: user.email,
    },
    file: serializeFile(
      file,
      user._id.toString(),
      share.resourceType === "directory",
    ),
    url: signed.url,
  };
};

export const renameRestrictedFile = async ({
  token,
  userId,
  fileId,
  name,
}: {
  token: string;
  userId: string;
  fileId: string;
  name: string;
}) => {
  const { share } = await resolveRestricted({ token, userId });
  assertEditorPermission({ permission: share.permission });

  await assertFileShareTarget({ share, fileId });

  const file = await renameSharedFile({
    ownerId: share.ownerId.toString(),
    fileId,
    name,
  });

  return {
    share: serializeShare(share),
    file: serializeFile(
      file,
      userId,
      share.resourceType === "directory",
    ),
  };
};

export const renameRestrictedDirectory = async ({
  token,
  userId,
  directoryId,
  name,
}: {
  token: string;
  userId: string;
  directoryId: string;
  name: string;
}) => {
  const { share } = await resolveRestricted({ token, userId });
  assertEditorPermission({ permission: share.permission });

  await assertDirectoryShareTarget({ share, directoryId });
  assertSharedRootIsNotTarget({ share, directoryId });

  const directory = await renameDirectory(
    share.ownerId.toString(),
    directoryId,
    name,
  );

  return {
    share: serializeShare(share),
    directory: serializeDirectory(
      directory,
      share.resourceId.toString(),
      userId,
    ),
  };
};

export const createRestrictedDirectory = async ({
  token,
  userId,
  parentDirectoryId,
  name,
}: {
  token: string;
  userId: string;
  parentDirectoryId: string;
  name: string;
}) => {
  const { share } = await resolveRestricted({ token, userId });
  assertEditorPermission({ permission: share.permission });

  await assertDirectoryShareTarget({
    share,
    directoryId: parentDirectoryId,
  });

  const directory = await createDirectory(
    share.ownerId.toString(),
    parentDirectoryId,
    name,
    userId,
  );

  return {
    share: serializeShare(share),
    directory: serializeDirectory(
      directory,
      share.resourceId.toString(),
      userId,
    ),
  };
};

export const initiateRestrictedFileUpload = async ({
  token,
  userId,
  directoryId,
  name,
  size,
  mimeType,
}: {
  token: string;
  userId: string;
  directoryId: string;
  name: string;
  size: number;
  mimeType: string;
}) => {
  const { share } = await resolveRestricted({ token, userId });
  assertEditorPermission({ permission: share.permission });

  await assertDirectoryShareTarget({ share, directoryId });

  const ownerId = share.ownerId.toString();

  const data =
    size >= MULTIPART_THRESHOLD
      ? await initiateMultipartUploadService({
          userId: ownerId,
          createdBy: userId,
          directoryId,
          name,
          size,
          mimeType,
        })
      : await initiateSingleUpload({
          userId: ownerId,
          createdBy: userId,
          directoryId,
          name,
          size,
          mimeType,
        });

  return {
    share: serializeShare(share),
    ...data,
  };
};

export const generateRestrictedMultipartPartUrl = async ({
  token,
  userId,
  fileId,
  partNumber,
}: {
  token: string;
  userId: string;
  fileId: string;
  partNumber: number;
}) => {
  const { share } = await resolveRestricted({ token, userId });
  assertEditorPermission({ permission: share.permission });

  await assertSharedUploadTarget({ share, actorId: userId, fileId });

  return getMultipartPartUploadUrlAsCreator({
    ownerId: share.ownerId.toString(),
    actorId: userId,
    fileId,
    partNumber,
  });
};

export const completeRestrictedSingleUpload = async ({
  token,
  userId,
  fileId,
}: {
  token: string;
  userId: string;
  fileId: string;
}) => {
  const { share } = await resolveRestricted({ token, userId });
  assertEditorPermission({ permission: share.permission });

  await assertSharedUploadTarget({ share, actorId: userId, fileId });

  return completeSingleFileUploadAsCreator({
    ownerId: share.ownerId.toString(),
    actorId: userId,
    fileId,
  });
};

export const completeRestrictedMultipartUpload = async ({
  token,
  userId,
  fileId,
  parts,
}: {
  token: string;
  userId: string;
  fileId: string;
  parts: { partNumber: number; eTag: string }[];
}) => {
  const { share } = await resolveRestricted({ token, userId });
  assertEditorPermission({ permission: share.permission });

  await assertSharedUploadTarget({ share, actorId: userId, fileId });

  return completeMultipartFileUploadAsCreator({
    ownerId: share.ownerId.toString(),
    actorId: userId,
    fileId,
    parts,
  });
};

export const abortRestrictedUpload = async ({
  token,
  userId,
  fileId,
}: {
  token: string;
  userId: string;
  fileId: string;
}) => {
  const { share } = await resolveRestricted({ token, userId });
  assertEditorPermission({ permission: share.permission });

  await assertSharedUploadTarget({ share, actorId: userId, fileId });

  return abortFileUploadAsCreator({
    ownerId: share.ownerId.toString(),
    actorId: userId,
    fileId,
  });
};

export const deleteRestrictedFile = async ({
  token,
  userId,
  fileId,
}: {
  token: string;
  userId: string;
  fileId: string;
}) => {
  const { share } = await resolveRestricted({
    token,
    userId,
  });

  assertEditorPermission({
    permission: share.permission,
  });

  if (share.resourceType !== "directory") {
    throw new AppError(
      "A file share editor cannot delete the shared file",
      403,
    );
  }

  await assertFileShareTarget({
    share,
    fileId,
  });

  const file = await softDeleteFileAsCreator({
    ownerId: share.ownerId.toString(),
    actorId: userId,
    fileId,
  });

  return {
    share: serializeShare(share),
    file: serializeFile(file, userId),
  };
};

export const deleteRestrictedDirectory = async ({
  token,
  userId,
  directoryId,
}: {
  token: string;
  userId: string;
  directoryId: string;
}) => {
  const { share } = await resolveRestricted({ token, userId });
  assertEditorPermission({ permission: share.permission });

  await assertDirectoryShareTarget({ share, directoryId });
  assertSharedRootIsNotTarget({ share, directoryId });

  const directory = await Directory.findOne({
    _id: directoryId,
    userId: share.ownerId,
    deletedAt: null,
  })
    .select("_id createdBy")
    .lean();

  if (!directory) {
    throw new AppError("Directory not found", 404);
  }

  if (directory.createdBy.toString() !== userId) {
    throw new AppError(
      "You can only delete directories you created",
      403,
    );
  }

  // Use the existing shared-safety checker. It rejects recursive deletion
  // when any descendant was created by another user or is not ready.
  await assertSharedDirectoryDeletionSafe({
    ownerId: share.ownerId.toString(),
    actorId: userId,
    directoryId,
  });

  // Reuse the existing soft-delete semantics after the strict creator/tree
  // checks above. Owner storage accounting and trash semantics remain intact.
  return {
    share: serializeShare(share),
    ...(await softDeleteDirectory({
      userId: share.ownerId.toString(),
      directoryId,
    })),
  };
};
