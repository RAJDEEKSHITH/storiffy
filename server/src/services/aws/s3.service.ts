import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
  UploadPartCommand,
} from "@aws-sdk/client-s3";

import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "../../config/env.js";

const bucketName = env.AWS_BUCKET;

const s3Client = new S3Client({
  region: env.AWS_REGION,
  credentials: {
    accessKeyId: env.AWS_ACCESS_KEY_ID,
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
  },
});

// Generate presigned PUT Url for files < 100MB
export const generatePresignedUploadUrl = async ({
  key,
  contentType,
}: {
  key: string;
  contentType: string;
}) => {
  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    ContentType: contentType,
  });

  return getSignedUrl(s3Client, command, {
    expiresIn: 300,
    signableHeaders: new Set(["content-type"]),
  });
};

// initiate multipart upload
export const initiateMultipartUpload = async ({
  key,
  contentType,
}: {
  key: string;
  contentType: string;
}) => {
  const command = new CreateMultipartUploadCommand({
    Bucket: bucketName,
    Key: key,
    ContentType: contentType,
  });

  const response = await s3Client.send(command);

  if (!response.UploadId) {
    throw new Error("S3 did not return an upload ID");
  }

  return response.UploadId;
};

// Generate presigned URL for a specific part
export const  generateMultipartPartUrl = async ({
  key,
  uploadId,
  partNumber,
}: {
  key: string;
  uploadId: string;
  partNumber: number;
}) => {
  const command = new UploadPartCommand({
    Bucket: bucketName,
    Key: key,
    UploadId: uploadId,
    PartNumber: partNumber,
  });

  return getSignedUrl(s3Client, command, {
    expiresIn: 60 * 60,
  });
};

export const completeMultipartUpload = async ({
  key,
  uploadId,
  parts,
}: {
  key: string;
  uploadId: string;
  parts: {
    PartNumber: number;
    ETag: string;
  }[];
}) => {
  const sortedParts = [...parts].sort(
    (a, b) => a.PartNumber - b.PartNumber,
  );

  const command = new CompleteMultipartUploadCommand({
    Bucket: bucketName,
    Key: key,
    UploadId: uploadId,
    MultipartUpload: {
      Parts: sortedParts,
    },
  });

  return s3Client.send(command);
};

export const abortMultipartUpload = async ({
  key,
  uploadId,
}: {
  key: string;
  uploadId: string;
}) => {
  const command = new AbortMultipartUploadCommand({
    Bucket: bucketName,
    Key: key,
    UploadId: uploadId,
  });

  await s3Client.send(command);
};
export const getS3FileMetaData = async (key: string) => {
  const command = new HeadObjectCommand({
    Bucket: bucketName,
    Key: key,
  });

  return s3Client.send(command);
};

export const deleteS3Object = async (key: string) => {
  const command = new DeleteObjectCommand({
    Bucket: bucketName,
    Key: key,
  });

  return s3Client.send(command);
};

export const deleteS3Objects = async (keys: string[]) => {
  if (keys.length === 0) {
    return;
  }
  return s3Client.send(
    new DeleteObjectsCommand({
      Bucket: bucketName,
      Delete: {
        Objects: keys.map((key) => ({ Key: key })),
        Quiet: false,
      },
    }),
  );
};

export default s3Client;
