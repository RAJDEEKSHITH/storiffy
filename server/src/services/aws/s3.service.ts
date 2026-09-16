import {
  DeleteObjectCommand,
  DeleteObjectsCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const bucketName = process.env.AWS_BUCKET!;

const s3Client = new S3Client({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

/**
 * Generate a presigned PUT URL.
 *
 * Browser uses this URL to upload the file directly to S3.
 */
export const createUploadSignedUrl = async ({
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

  const url = await getSignedUrl(s3Client, command, {
    expiresIn: 300,
    signableHeaders: new Set(["content-type"]),
  });

  return url;
};

/**
 * Get metadata of an existing S3 object.
 *
 * Used after upload to verify that the object exists
 * and that its size is correct.
 */
export const getS3FileMetaData = async (
  key: string,
) => {
  const command = new HeadObjectCommand({
    Bucket: bucketName,
    Key: key,
  });

  return s3Client.send(command);
};

/**
 * Delete one S3 object.
 */
export const deleteS3File = async (
  key: string,
) => {
  const command = new DeleteObjectCommand({
    Bucket: bucketName,
    Key: key,
  });

  return s3Client.send(command);
};

/**
 * Delete multiple S3 objects.
 */
export const deleteS3Files = async (
  keys: string[],
) => {
  const command = new DeleteObjectsCommand({
    Bucket: bucketName,
    Delete: {
      Objects: keys.map((key) => ({
        Key: key,
      })),
      Quiet: false,
    },
  });

  return s3Client.send(command);
};

export default s3Client;